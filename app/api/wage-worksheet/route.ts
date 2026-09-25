import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchWdText } from "@/lib/wage/fetch-wd";
import { parseWd, type ParsedWd } from "@/lib/wage/parse-wd";
import {
  bidPriceForSave,
  parseWdReference,
  rerateLines,
  sanitizeLines,
  sanitizeNumber,
  wdRefChanged,
} from "@/lib/wage/prefill";
import { adminFor, prefillContext, guidanceFor, pricingColumns, saveWageCheck, type Ctx } from "@/lib/wage/server";

export const runtime = "nodejs";
export const maxDuration = 60;

// The wage worksheet (docs/superpowers/specs/2026-09-25-wage-worksheet-design.md).
// POST: create it pre-filled on first open, or return the saved one --
//   { wdNumber } switches it to another WD/revision (positions re-rated),
//   { refill: true } re-applies the client's numbers (after they change).
// PATCH: autosave edits, and the client's read-only line. Admin only.

// A worksheet row's own pricing (null = not given yet).
const current = (w: { supplies_value: unknown; overhead_pct: unknown; profit_pct: unknown }) => ({
  suppliesValue: w.supplies_value === null ? null : Number(w.supplies_value),
  overheadPct: w.overhead_pct === null ? null : Number(w.overhead_pct),
  profitPct: w.profit_pct === null ? null : Number(w.profit_pct),
});
const clientOut = (ctx: Ctx) => ({ name: ctx.client.name, pricing: ctx.client.pricing });

async function fetchAndParse(number: string, revision: number | null) {
  const fetched = await fetchWdText(number, revision);
  const parsed = parseWd(fetched.text);
  return { fetched, parsed };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const submissionId = typeof body?.submissionId === "string" ? body.submissionId : null;
  if (!submissionId) return NextResponse.json({ error: "Invalid submissionId." }, { status: 400 });
  const supabase = await createClient();
  const member = await adminFor(supabase);
  if (!member) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  const ctx = await prefillContext(supabase, member.org_id, submissionId);
  if (!ctx) return NextResponse.json({ error: "Submission not found." }, { status: 404 });

  const { data: existing } = await supabase.from("wage_worksheets").select("*").eq("submission_id", submissionId).maybeSingle();
  const typed = typeof body?.wdNumber === "string" ? parseWdReference(body.wdNumber) : null;
  const refill = body?.refill === true;

  // Existing worksheet, nothing to change: return it, with guidance and a
  // flag if the solicitation's WD has changed since (e.g. an amendment).
  if (existing && !typed && !refill) {
    const wd = existing.wd_parsed as ParsedWd;
    const { guidance } = guidanceFor(ctx, wd, current(existing));
    // A WD the admin chose by hand isn't second-guessed.
    const changed =
      existing.wd_revision_source !== "manual" &&
      wdRefChanged({ number: existing.wd_number, revision: existing.wd_revision }, ctx.currentWd);
    return NextResponse.json({ worksheet: existing, parsed: wd, guidance, wdChanged: changed ? ctx.currentWd : null, client: clientOut(ctx) });
  }

  // Refill: re-apply the client's numbers to the saved WD.
  if (existing && refill && !typed) {
    const wd = existing.wd_parsed as ParsedWd;
    const { pre, guidance } = guidanceFor(ctx, wd, ctx.client.pricing);
    const { data: saved, error } = await supabase
      .from("wage_worksheets")
      .update({
        lines: pre.lines,
        ...pricingColumns(ctx.client.pricing),
        options: { ...(existing.options as object), includeVacation: true },
        updated_by: member.id,
        updated_at: new Date().toISOString(),
      })
      .eq("submission_id", submissionId)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const checkError = await saveWageCheck(supabase, submissionId, saved);
    if (checkError) return NextResponse.json({ error: checkError }, { status: 500 });
    return NextResponse.json({ worksheet: saved, parsed: wd, guidance, wdChanged: null, client: clientOut(ctx) });
  }

  // Which WD: typed by the admin, else the checklist's.
  const ref = typed ?? ctx.currentWd;
  if (!ref) return NextResponse.json({ error: "no_wd" }, { status: 404 });
  let fp: Awaited<ReturnType<typeof fetchAndParse>>;
  try {
    fp = await fetchAndParse(ref.number, ref.revision);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't fetch the wage determination." }, { status: 502 });
  }
  if (!fp.parsed.ok) {
    return NextResponse.json({ error: "The wage determination couldn't be read.", missing: fp.parsed.missing }, { status: 422 });
  }
  const wd = fp.parsed.wd as ParsedWd;
  // The banner's "Update the worksheet" sends the solicitation's own WD; that
  // stays "solicitation" so a later amendment is still flagged.
  const handPicked = typed !== null && (ctx.currentWd === null || wdRefChanged(typed, ctx.currentWd));
  const revisionSource = fp.fetched.revisionSource === "latest" ? "latest" : handPicked ? "manual" : "solicitation";
  const { pre, guidance } = guidanceFor(ctx, wd, existing ? current(existing) : ctx.client.pricing);

  // Switching an existing worksheet to another WD keeps the admin's
  // positions, hours, pricing and bid; only the WD and its rates change.
  const base = existing
    ? { lines: rerateLines(existing.lines, wd) }
    : {
        lines: pre.lines,
        options: { includeVacation: true, eo13658: false },
        ...pricingColumns(ctx.client.pricing),
      };
  const { data: saved, error } = await supabase
    .from("wage_worksheets")
    .upsert({
      submission_id: submissionId,
      org_id: member.org_id,
      wd_number: wd.number,
      wd_revision: wd.revision,
      wd_revision_source: revisionSource,
      wd_text: fp.fetched.text,
      wd_parsed: wd,
      ...base,
      updated_by: member.id,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const checkError = await saveWageCheck(supabase, submissionId, saved);
  if (checkError) return NextResponse.json({ error: checkError }, { status: 500 });
  const changed = wdRefChanged({ number: wd.number, revision: wd.revision }, ctx.currentWd);
  return NextResponse.json({ worksheet: saved, parsed: wd, guidance, wdChanged: changed && !handPicked ? ctx.currentWd : null, client: clientOut(ctx) });
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const submissionId = typeof body?.submissionId === "string" ? body.submissionId : null;
  if (!submissionId) return NextResponse.json({ error: "Invalid submissionId." }, { status: 400 });
  const supabase = await createClient();
  const member = await adminFor(supabase);
  if (!member) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  const { data: ws } = await supabase
    .from("wage_worksheets")
    .select("wd_parsed, wd_number, wd_revision")
    .eq("submission_id", submissionId)
    .maybeSingle();
  if (!ws) return NextResponse.json({ error: "Worksheet not found." }, { status: 404 });
  const wd = ws.wd_parsed as ParsedWd;
  const options = (body?.options ?? {}) as Record<string, unknown>;
  const updatedAt = new Date().toISOString();
  const lines = sanitizeLines(body?.lines, wd);
  const opts = { includeVacation: options.includeVacation !== false, eo13658: options.eo13658 === true };
  const bid = bidPriceForSave(body?.bidPrice);
  const { error } = await supabase
    .from("wage_worksheets")
    .update({
      lines,
      options: opts,
      supplies_mode: body?.suppliesMode === "flat" ? "flat" : "percent",
      supplies_value: sanitizeNumber(body?.suppliesValue, null),
      overhead_pct: sanitizeNumber(body?.overheadPct, null),
      profit_pct: sanitizeNumber(body?.profitPct, null),
      bid_price: bid,
      updated_by: member.id,
      updated_at: updatedAt,
    })
    .eq("submission_id", submissionId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // The client's read-only line on their bid; cleared when there's no bid price.
  const checkError = await saveWageCheck(supabase, submissionId, { ...ws, lines, options: opts, bid_price: bid });
  if (checkError) return NextResponse.json({ error: checkError }, { status: 500 });
  return NextResponse.json({ ok: true, updatedAt });
}
