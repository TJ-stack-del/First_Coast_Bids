import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchWdText } from "@/lib/wage/fetch-wd";
import { parseWd, type ParsedWd } from "@/lib/wage/parse-wd";
import {
  parseWdReference,
  pickWdSuggestion,
  prefillGuidance,
  prefillLines,
  rerateLines,
  sanitizeLines,
  sanitizeNumber,
  wdRefChanged,
  type PricingDefaults,
} from "@/lib/wage/prefill";
import { getOrExtractBidEstimationFacts } from "@/lib/bid-estimation";
import { loadTrades } from "@/lib/trades/server";
import { clientTradeIds } from "@/lib/trades/naics-options";

export const runtime = "nodejs";
export const maxDuration = 60;

// The wage worksheet (docs/superpowers/specs/2026-09-25-wage-worksheet-design.md).
// POST: create it pre-filled on first open, or return the saved one --
//   { wdNumber } switches it to another WD/revision (positions re-rated),
//   { refill: true } re-applies the Settings defaults (after they change).
// PATCH: autosave edits. Admin only.

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function adminFor(supabase: Supabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("team_members").select("id, org_id").eq("auth_user_id", user.id).eq("role", "admin").maybeSingle();
  return data;
}

// Everything the pre-fill needs: the bid's trade (from the match it came
// from, else the client's NAICS), the solicitation's facts, the defaults,
// and the WD the checklist found (one rule, shared with the page).
async function prefillContext(supabase: Supabase, orgId: string, submissionId: string) {
  const { data: sub } = await supabase
    .from("submissions")
    .select("id, bid_estimation_facts, bid_estimation_facts_extracted_at, clients!submissions_client_id_fkey(naics_codes)")
    .eq("id", submissionId)
    .maybeSingle();
  if (!sub) return null;
  const { data: org } = await supabase.from("organizations").select("pricing_defaults").eq("id", orgId).single();
  const defaults = ((org?.pricing_defaults ?? {}) as PricingDefaults) || {};
  const trades = await loadTrades(supabase, orgId);
  const { data: link } = await supabase
    .from("audit_log")
    .select("event_detail")
    .eq("submission_id", submissionId)
    .eq("event_type", "submission_created_from_match")
    .limit(1)
    .maybeSingle();
  const opportunityId = (link?.event_detail as { opportunity_id?: string } | null)?.opportunity_id;
  let tradeId: string | null = null;
  if (opportunityId) {
    const { data: m } = await supabase.from("matched_opportunities").select("trade_id").eq("id", opportunityId).maybeSingle();
    tradeId = m?.trade_id ?? null;
  }
  if (!tradeId) {
    const naics = (sub.clients as unknown as { naics_codes: string[] | null } | null)?.naics_codes ?? [];
    tradeId = clientTradeIds(naics, trades)[0] ?? null;
  }
  const trade = trades.find((t) => t.id === tradeId) ?? null;
  const facts = await getOrExtractBidEstimationFacts(supabase, sub as never);
  const { data: suggestions } = await supabase
    .from("checklist_suggestions")
    .select("kind, dedupe_key, label, status, created_at")
    .eq("submission_id", submissionId);
  return { trade, facts, defaults, currentWd: pickWdSuggestion(suggestions ?? []) };
}

type Ctx = NonNullable<Awaited<ReturnType<typeof prefillContext>>>;

function guidanceFor(ctx: Ctx, wd: ParsedWd) {
  const pre = prefillLines({
    wd,
    positionCode: ctx.trade?.wdPositionCode ?? null,
    productionRate: ctx.trade?.productionRate ?? null,
    cleanableSqft: ctx.facts?.cleanable_sqft ?? null,
    serviceDaysPerWeek: ctx.facts?.service_days_per_week ?? null,
    defaults: ctx.defaults,
  });
  const guidance = prefillGuidance({
    tradeLabel: ctx.trade?.label ?? null,
    positionCode: ctx.trade?.wdPositionCode ?? null,
    productionRate: ctx.trade?.productionRate ?? null,
    cleanableSqft: ctx.facts?.cleanable_sqft ?? null,
    missingCode: pre.missingCode,
  });
  return { pre, guidance };
}

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
    const { guidance } = guidanceFor(ctx, wd);
    // A WD the admin chose by hand isn't second-guessed.
    const changed =
      existing.wd_revision_source !== "manual" &&
      wdRefChanged({ number: existing.wd_number, revision: existing.wd_revision }, ctx.currentWd);
    return NextResponse.json({ worksheet: existing, parsed: wd, guidance, wdChanged: changed ? ctx.currentWd : null });
  }

  // Refill: re-apply the Settings defaults to the saved WD.
  if (existing && refill && !typed) {
    const wd = existing.wd_parsed as ParsedWd;
    const { pre, guidance } = guidanceFor(ctx, wd);
    const { data: saved, error } = await supabase
      .from("wage_worksheets")
      .update({
        lines: pre.lines,
        supplies_mode: ctx.defaults.suppliesMode ?? "percent",
        supplies_value: ctx.defaults.suppliesValue ?? 0,
        overhead_pct: ctx.defaults.overheadPct ?? 0,
        profit_pct: ctx.defaults.profitPct ?? 0,
        options: { ...(existing.options as object), includeVacation: ctx.defaults.includeVacation ?? true },
        updated_by: member.id,
        updated_at: new Date().toISOString(),
      })
      .eq("submission_id", submissionId)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ worksheet: saved, parsed: wd, guidance, wdChanged: null });
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
  const { pre, guidance } = guidanceFor(ctx, wd);

  // Switching an existing worksheet to another WD keeps the admin's
  // positions, hours, pricing and bid; only the WD and its rates change.
  const base = existing
    ? { lines: rerateLines(existing.lines, wd) }
    : {
        lines: pre.lines,
        options: { includeVacation: ctx.defaults.includeVacation ?? true, eo13658: false },
        supplies_mode: ctx.defaults.suppliesMode ?? "percent",
        supplies_value: ctx.defaults.suppliesValue ?? 0,
        overhead_pct: ctx.defaults.overheadPct ?? 0,
        profit_pct: ctx.defaults.profitPct ?? 0,
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
  const changed = wdRefChanged({ number: wd.number, revision: wd.revision }, ctx.currentWd);
  return NextResponse.json({ worksheet: saved, parsed: wd, guidance, wdChanged: changed && !handPicked ? ctx.currentWd : null });
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const submissionId = typeof body?.submissionId === "string" ? body.submissionId : null;
  if (!submissionId) return NextResponse.json({ error: "Invalid submissionId." }, { status: 400 });
  const supabase = await createClient();
  const member = await adminFor(supabase);
  if (!member) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  const { data: ws } = await supabase.from("wage_worksheets").select("wd_parsed").eq("submission_id", submissionId).maybeSingle();
  if (!ws) return NextResponse.json({ error: "Worksheet not found." }, { status: 404 });
  const wd = ws.wd_parsed as ParsedWd;
  const options = (body?.options ?? {}) as Record<string, unknown>;
  const updatedAt = new Date().toISOString();
  const { error } = await supabase
    .from("wage_worksheets")
    .update({
      lines: sanitizeLines(body?.lines, wd),
      options: { includeVacation: options.includeVacation !== false, eo13658: options.eo13658 === true },
      supplies_mode: body?.suppliesMode === "flat" ? "flat" : "percent",
      supplies_value: sanitizeNumber(body?.suppliesValue, 0),
      overhead_pct: sanitizeNumber(body?.overheadPct, 0),
      profit_pct: sanitizeNumber(body?.profitPct, 0),
      bid_price: body?.bidPrice === null || body?.bidPrice === "" || body?.bidPrice === undefined ? null : sanitizeNumber(body.bidPrice, 0),
      updated_by: member.id,
      updated_at: updatedAt,
    })
    .eq("submission_id", submissionId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, updatedAt });
}
