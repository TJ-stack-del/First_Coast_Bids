import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { extractFileText } from "@/lib/checklist/extract-text";
import { chunkPages } from "@/lib/checklist/chunk";
import { verifyQuote } from "@/lib/checklist/verify-quote";
import { allowForce, claimFilter, filesFingerprint, isScanStale } from "@/lib/checklist/scan-state";
import type { FilePages } from "@/lib/checklist/detectors";
import { isFederalAgency } from "@/lib/federal-agency";
import { runClinPass } from "@/lib/clins/ai-pass";
import { assignPeriodsAndPositions, clinInQuote, dedupeClins, lineKind, verifiedMonths } from "@/lib/clins/parse";
import { mergeRescan } from "@/lib/clins/rescan";
import type { ClinLine } from "@/lib/clins/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type ClinScan = {
  status: "running" | "done" | "failed";
  started_at: string;
  finished_at?: string;
  files_fingerprint: string;
  error?: string | null;
  excel_attachments?: string[];
  found?: number;
};

// Reads a federal bid's price table (CLINs) from its solicitation files
// (docs/superpowers/specs/2026-09-25-clin-pricing-design.md). Called right
// after a solicitation upload and by the panel's "Read again" / "Read the
// price table". Same shape as /api/checklist-scan: access checked with the
// caller's session, then the service role reads and writes (clin_lines are
// admin-only rows); one reading at a time per bid; the same files aren't
// read (and paid for) twice.
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
  const { data: adminRow } = await supabase.from("team_members").select("id").eq("auth_user_id", user.id).eq("role", "admin").maybeSingle();
  const force = allowForce(forceRequested, !!adminRow);

  const service = createServiceClient();
  const { data: submission } = await service
    .from("submissions")
    .select("id, agency, clin_scan, clients!submissions_client_id_fkey(org_id)")
    .eq("id", submissionId)
    .single();
  const orgId = (submission?.clients as unknown as { org_id: string } | null)?.org_id;
  if (!submission || !orgId) return NextResponse.json({ error: "Submission not found." }, { status: 404 });

  // Federal bids only: the agency is federal, or the checklist found federal
  // items (SF forms, FAR provisions) in the documents.
  if (!isFederalAgency(submission.agency)) {
    const { count } = await service
      .from("checklist_suggestions")
      .select("id", { count: "exact", head: true })
      .eq("submission_id", submissionId)
      .eq("federal", true);
    if (!count) return NextResponse.json({ status: "not_federal" });
  }

  const { data: docs } = await service
    .from("submission_documents")
    .select("file_name, file_url, created_at")
    .eq("submission_id", submissionId)
    .eq("document_type", "rfp_file")
    .order("created_at", { ascending: true });
  if (!docs || docs.length === 0) return NextResponse.json({ status: "no_files" });

  const fingerprint = filesFingerprint(docs);
  const previous = submission.clin_scan as ClinScan | null;
  const now = new Date();
  if (!force && previous?.status === "done" && previous.files_fingerprint === fingerprint) {
    return NextResponse.json({ status: "done" });
  }
  if (previous?.status === "running" && !isScanStale(previous as never, now)) {
    return NextResponse.json({ status: "running" });
  }
  const excel = docs.map((d) => d.file_name).filter((n) => /\.xlsx?$/i.test(n));
  const started: ClinScan = { status: "running", started_at: now.toISOString(), files_fingerprint: fingerprint, excel_attachments: excel };
  const { data: claimed } = await service
    .from("submissions")
    .update({ clin_scan: started })
    .eq("id", submissionId)
    .or(claimFilter(now, "clin_scan"))
    .select("id");
  if (!claimed || claimed.length !== 1) return NextResponse.json({ status: "running" });

  try {
    const files: FilePages[] = [];
    for (const doc of docs) {
      const { data: blob } = await service.storage.from("rfp-documents").download(doc.file_url);
      if (!blob) continue;
      const text = await extractFileText(doc.file_name, Buffer.from(await blob.arrayBuffer()));
      files.push({ fileName: doc.file_name, pages: text.pages });
    }
    const { chunks } = chunkPages(files);
    const ai = await runClinPass({ chunks, agency: submission.agency });

    const textByFile = new Map(files.map((f) => [f.fileName, f.pages ? f.pages.join("\n") : null]));
    const allText = [...textByFile.values()].filter(Boolean).join("\n") || null;
    const fresh = assignPeriodsAndPositions(
      dedupeClins(ai.byFile).map((c) => {
        const fileText = c.source_file && textByFile.has(c.source_file) ? textByFile.get(c.source_file)! : allText;
        const quoteStatus = verifyQuote(c.quote, fileText);
        const months = verifiedMonths(c.period_start ?? null, c.period_end ?? null, fileText);
        return {
          clin: c.clin,
          description: c.description,
          quantity: c.quantity,
          unit: c.unit,
          unit_kind: lineKind(c.unit, c.quantity, months),
          period_months: months,
          quote: c.quote,
          page: c.page,
          source_file: c.source_file,
          quote_status: quoteStatus === "verified" && !clinInQuote(c.clin, c.quote) ? "not_found" : quoteStatus,
          revised_by: c.revised_by,
          unit_price_override: null,
        } as Omit<ClinLine, "period_index" | "position" | "sort">;
      })
    );

    const { data: existingRows } = await service.from("clin_lines").select("*").eq("submission_id", submissionId);
    const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
    const existing = ((existingRows ?? []) as ClinLine[]).map((l) => ({ ...l, quantity: num(l.quantity), unit_price_override: num(l.unit_price_override) }));
    const allFailed = ai.failed.length > 0 && ai.failed.length === chunks.length;
    // A reading that failed entirely changes nothing that was there.
    if (!allFailed) {
      const merged = mergeRescan(existing, fresh).map((l, i) => {
        const { id: _id, ...rest } = l as ClinLine & { created_at?: string; submission_id?: string; org_id?: string };
        delete (rest as Record<string, unknown>).created_at;
        return { ...rest, sort: i, submission_id: submissionId, org_id: orgId };
      });
      const keep = new Set(merged.map((l) => l.clin));
      const gone = existing.filter((l) => !keep.has(l.clin)).map((l) => l.id!);
      if (gone.length) {
        const { error } = await service.from("clin_lines").delete().eq("submission_id", submissionId).in("id", gone);
        if (error) throw new Error(`Couldn't update the CLIN lines: ${error.message}`);
      }
      if (merged.length) {
        const { error } = await service.from("clin_lines").upsert(merged, { onConflict: "submission_id,clin" });
        if (error) throw new Error(`Couldn't save the CLIN lines: ${error.message}`);
      }
    }
    const finished: ClinScan = {
      ...started,
      status: allFailed ? "failed" : "done",
      finished_at: new Date().toISOString(),
      error: allFailed ? `The AI reading failed: ${ai.failed[0].file} ${ai.failed[0].message}` : null,
      found: fresh.length,
    };
    await service.from("submissions").update({ clin_scan: finished }).eq("id", submissionId);
    return NextResponse.json({ status: finished.status, found: fresh.length });
  } catch (err) {
    const failed: ClinScan = { ...started, status: "failed", finished_at: new Date().toISOString(), error: err instanceof Error ? err.message : "The reading failed." };
    await service.from("submissions").update({ clin_scan: failed }).eq("id", submissionId);
    return NextResponse.json({ status: "failed", error: failed.error }, { status: 500 });
  }
}
