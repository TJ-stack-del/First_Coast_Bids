import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { extractFileText } from "@/lib/checklist/extract-text";
import { detectItems, type FilePages } from "@/lib/checklist/detectors";
import { chunkPages } from "@/lib/checklist/chunk";
import { runAiPass } from "@/lib/checklist/ai-pass";
import { verifyQuote } from "@/lib/checklist/verify-quote";
import { mergeCandidates, finalizeCandidates } from "@/lib/checklist/merge";
import {
  allowForce,
  carryForward,
  claimFilter,
  filesFingerprint,
  filesToRead,
  isScanStale,
  nextFilesRead,
  type ScanState,
} from "@/lib/checklist/scan-state";

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
  const forceRequested = !!(body && typeof body === "object" && (body as { force?: unknown }).force === true);
  if (typeof submissionId !== "string") return NextResponse.json({ error: "Invalid submissionId." }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { data: visible } = await supabase.from("submissions").select("id").eq("id", submissionId).maybeSingle();
  if (!visible) return NextResponse.json({ error: "Submission not found." }, { status: 404 });

  // "Check again" (force) re-reads every file with the AI -- admins only.
  const { data: adminRow } = await supabase
    .from("team_members")
    .select("id")
    .eq("auth_user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  const force = allowForce(forceRequested, !!adminRow);

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

  // Earlier coverage and notices ride along, so a run that dies or fails
  // doesn't make the next one re-read (and re-word) everything.
  const started: ScanState = {
    status: "running",
    started_at: now.toISOString(),
    files_fingerprint: fingerprint,
    files_read: previous?.files_read,
    pages_read: previous?.pages_read,
    ai_failed: previous?.ai_failed,
    unreadable: previous?.unreadable,
  };
  // Claim atomically: several simultaneous requests start one reading.
  const { data: claimed } = await service
    .from("submissions")
    .update({ checklist_scan: started })
    .eq("id", submissionId)
    .or(claimFilter(now))
    .select("id");
  if (!claimed || claimed.length !== 1) return NextResponse.json({ status: "running" });

  try {
    // Download and read every file's own text.
    // One file that can't be downloaded or read is recorded and skipped;
    // it never sinks the reading of the others.
    const files: (FilePages & { buffer: Buffer; problem: string | null })[] = [];
    const unreadableNow: { file: string; problem: string }[] = [];
    for (const doc of docs) {
      const { data: blob } = await service.storage.from("rfp-documents").download(doc.file_url);
      if (!blob) {
        unreadableNow.push({ file: doc.file_name, problem: "couldn't be downloaded" });
        continue;
      }
      const buffer = Buffer.from(await blob.arrayBuffer());
      const text = await extractFileText(doc.file_name, buffer);
      if (text.problem === "unsupported_type") unreadableNow.push({ file: doc.file_name, problem: "file type can't be read (use PDF or Word .docx)" });
      if (text.problem === "unreadable_file") unreadableNow.push({ file: doc.file_name, problem: "file is damaged or not what its name says" });
      files.push({ fileName: doc.file_name, pages: text.pages, buffer, problem: text.problem });
    }

    // Detectors cover every file; the AI reads only files not covered by
    // the last reading, unless this is a forced "Check again".
    const toRead = new Set(filesToRead(docs, previous, force));
    const detected = detectItems(files);
    const { chunks, pagesRead } = chunkPages(files.filter((f) => toRead.has(f.fileName)));
    // Only genuinely scanned PDFs go to the AI as PDFs -- never damaged or
    // unsupported files.
    const scannedPdfs = files
      .filter((f) => toRead.has(f.fileName) && f.problem === "no_text" && f.fileName.toLowerCase().endsWith(".pdf"))
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
    const toReadNames = [...toRead];
    const currentNames = docs.map((d) => d.file_name);
    const finished: ScanState = {
      ...started,
      status: allAiFailed ? "failed" : "done",
      finished_at: new Date().toISOString(),
      error: allAiFailed ? `The AI reading failed: ${ai.failed[0].file} ${ai.failed[0].message}` : null,
      // Only what was really read counts as read; notices about files not
      // re-read this time are kept.
      files_read: nextFilesRead({
        previousRead: previous?.files_read,
        docs,
        toRead: toReadNames,
        pagesRead,
        failedFiles: ai.failed.map((f) => f.file),
        unreadable: unreadableNow.map((u) => u.file),
      }),
      pages_read: carryForward(previous?.pages_read, pagesRead, toReadNames, currentNames),
      ai_failed: carryForward(previous?.ai_failed, ai.failed, toReadNames, currentNames),
      unreadable: carryForward(previous?.unreadable, unreadableNow, currentNames, currentNames),
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
