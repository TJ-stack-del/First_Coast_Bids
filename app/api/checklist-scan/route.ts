import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { extractFileText } from "@/lib/checklist/extract-text";
import { detectItems, type FilePages } from "@/lib/checklist/detectors";
import { chunkPages } from "@/lib/checklist/chunk";
import { runAiPass } from "@/lib/checklist/ai-pass";
import { verifyQuote } from "@/lib/checklist/verify-quote";
import { mergeCandidates, finalizeCandidates } from "@/lib/checklist/merge";
import { filesFingerprint, filesReadParts, filesToRead, isScanStale, type ScanState } from "@/lib/checklist/scan-state";

export const runtime = "nodejs";
export const maxDuration = 60;

// Reads a bid's solicitation files and saves checklist suggestions for an
// admin to review (docs/superpowers/specs/2026-09-25-submission-checklist-design.md).
// Called right after a solicitation upload -- by the admin or by the client
// -- and by the panel's "Check again". Access is checked with the caller's
// own session first (RLS: the bid's admin or its own client can read the
// submission); only then does the service role do the reading and writing,
// because suggestions are admin-only rows.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const submissionId = body && typeof body === "object" ? (body as { submissionId?: unknown }).submissionId : null;
  const force = !!(body && typeof body === "object" && (body as { force?: unknown }).force === true);
  if (typeof submissionId !== "string") return NextResponse.json({ error: "Invalid submissionId." }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { data: visible } = await supabase.from("submissions").select("id").eq("id", submissionId).maybeSingle();
  if (!visible) return NextResponse.json({ error: "Submission not found." }, { status: 404 });

  const service = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: submission } = await service
    .from("submissions")
    .select("id, agency, checklist_scan, clients!submissions_client_id_fkey(org_id)")
    .eq("id", submissionId)
    .single();
  const orgId = (submission?.clients as unknown as { org_id: string } | null)?.org_id;
  if (!submission || !orgId) return NextResponse.json({ error: "Submission not found." }, { status: 404 });

  const { data: docs } = await service
    .from("submission_documents")
    .select("file_name, file_url, created_at")
    .eq("submission_id", submissionId)
    .eq("document_type", "rfp_file")
    .order("created_at", { ascending: true });
  if (!docs || docs.length === 0) return NextResponse.json({ status: "no_files" });

  const fingerprint = filesFingerprint(docs);
  const previous = submission.checklist_scan as ScanState | null;
  const now = new Date();
  if (!force && previous?.status === "done" && previous.files_fingerprint === fingerprint) {
    return NextResponse.json({ status: "done", inserted: 0 });
  }
  if (previous?.status === "running" && !isScanStale(previous, now)) {
    return NextResponse.json({ status: "running" });
  }

  const started: ScanState = { status: "running", started_at: now.toISOString(), files_fingerprint: fingerprint };
  await service.from("submissions").update({ checklist_scan: started }).eq("id", submissionId);

  try {
    // Download and read every file's own text.
    const files: (FilePages & { buffer: Buffer })[] = [];
    for (const doc of docs) {
      const { data: blob } = await service.storage.from("rfp-documents").download(doc.file_url);
      if (!blob) continue;
      const buffer = Buffer.from(await blob.arrayBuffer());
      const text = await extractFileText(doc.file_name, buffer);
      files.push({ fileName: doc.file_name, pages: text.pages, buffer });
    }

    // Detectors cover every file; the AI reads only files not covered by
    // the last reading, unless this is a forced "Check again".
    const toRead = new Set(filesToRead(docs, previous, force));
    const detected = detectItems(files);
    const { chunks, pagesRead } = chunkPages(files.filter((f) => toRead.has(f.fileName)));
    const scannedPdfs = files
      .filter((f) => toRead.has(f.fileName) && f.pages === null && f.fileName.toLowerCase().endsWith(".pdf"))
      .map((f) => ({ fileName: f.fileName, buffer: f.buffer }));
    const ai = await runAiPass({ chunks, scannedPdfs, agency: submission.agency });

    const { data: existing } = await service
      .from("checklist_suggestions")
      .select("dedupe_key")
      .eq("submission_id", submissionId);
    const finalized = finalizeCandidates(mergeCandidates(detected, ai.items), {
      agency: submission.agency,
      detected,
      existingKeys: new Set((existing ?? []).map((e) => e.dedupe_key)),
    });

    const textByFile = new Map(files.map((f) => [f.fileName, f.pages ? f.pages.join("\n") : null]));
    const allText = [...textByFile.values()].filter(Boolean).join("\n") || null;
    const rows = finalized.map((c) => {
      // Verify against the named file; if the AI named no file or a file
      // that doesn't exist, verify against all the text rather than calling
      // the quote unreadable.
      const fileText = c.source_file && textByFile.has(c.source_file) ? textByFile.get(c.source_file)! : allText;
      return {
        submission_id: submissionId,
        org_id: orgId,
        kind: c.kind,
        federal: c.federal,
        label: c.label,
        detail: c.detail,
        quote: c.quote,
        page: c.page,
        source_file: c.source_file,
        quote_status: c.found_by === "detector" ? "verified" : verifyQuote(c.quote, fileText),
        found_by: c.found_by,
        suggested_owner: c.suggested_owner,
        dedupe_key: c.key,
      };
    });
    if (rows.length > 0) {
      const { error } = await service.from("checklist_suggestions").upsert(rows, { onConflict: "submission_id,dedupe_key", ignoreDuplicates: true });
      if (error) throw new Error(`Couldn't save suggestions: ${error.message}`);
    }

    const allAiFailed = ai.failed.length > 0 && ai.failed.length === chunks.length + scannedPdfs.length;
    const finished: ScanState = {
      ...started,
      status: allAiFailed ? "failed" : "done",
      finished_at: new Date().toISOString(),
      error: allAiFailed ? `The AI reading failed: ${ai.failed[0]}` : null,
      pages_read: pagesRead,
      ai_failed: ai.failed,
      files_read: filesReadParts(docs),
    };
    await service.from("submissions").update({ checklist_scan: finished }).eq("id", submissionId);
    return NextResponse.json({ status: finished.status, inserted: rows.length });
  } catch (err) {
    const failed: ScanState = {
      ...started,
      status: "failed",
      finished_at: new Date().toISOString(),
      error: err instanceof Error ? err.message : "The scan failed.",
    };
    await service.from("submissions").update({ checklist_scan: failed }).eq("id", submissionId);
    return NextResponse.json({ status: "failed", error: failed.error }, { status: 500 });
  }
}
