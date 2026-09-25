import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchWdText } from "@/lib/wage/fetch-wd";
import { parseWd, type ParsedWd } from "@/lib/wage/parse-wd";
import { parseWdReference, prefillLines, sanitizeLines, sanitizeNumber, type PricingDefaults } from "@/lib/wage/prefill";
import { getOrExtractBidEstimationFacts } from "@/lib/bid-estimation";
import { loadTrades } from "@/lib/trades/server";
import { clientTradeIds } from "@/lib/trades/naics-options";

export const runtime = "nodejs";
export const maxDuration = 60;

// The wage worksheet (docs/superpowers/specs/2026-09-25-wage-worksheet-design.md).
// POST creates it pre-filled on first open (or returns the saved one);
// PATCH autosaves edits. Admin only.

async function adminFor(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("team_members").select("id, org_id").eq("auth_user_id", user.id).eq("role", "admin").maybeSingle();
  return data;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const submissionId = typeof body?.submissionId === "string" ? body.submissionId : null;
  if (!submissionId) return NextResponse.json({ error: "Invalid submissionId." }, { status: 400 });
  const supabase = await createClient();
  const member = await adminFor(supabase);
  if (!member) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  const { data: existing } = await supabase.from("wage_worksheets").select("*").eq("submission_id", submissionId).maybeSingle();
  const { data: org } = await supabase.from("organizations").select("pricing_defaults").eq("id", member.org_id).single();
  const defaults = ((org?.pricing_defaults ?? {}) as PricingDefaults) || {};
  if (existing && typeof body?.wdNumber !== "string") {
    return NextResponse.json({ worksheet: existing, parsed: existing.wd_parsed, missingCode: null, hoursNeeded: false, defaults });
  }

  // Which WD: the admin's entry, else the checklist's wage-determination item.
  let ref = typeof body?.wdNumber === "string" ? parseWdReference(body.wdNumber) : null;
  let revisionSource: "solicitation" | "latest" | "manual" = "manual";
  if (ref && typeof body?.wdRevision === "number") ref = { ...ref, revision: body.wdRevision };
  if (!ref) {
    const { data: s } = await supabase
      .from("checklist_suggestions")
      .select("label, dedupe_key")
      .eq("submission_id", submissionId)
      .like("dedupe_key", "wd:%")
      .limit(1)
      .maybeSingle();
    ref = s ? parseWdReference(s.label) : null;
    revisionSource = "solicitation";
  }
  if (!ref) return NextResponse.json({ error: "no_wd" }, { status: 404 });

  let fetched: Awaited<ReturnType<typeof fetchWdText>>;
  try {
    fetched = await fetchWdText(ref.number, ref.revision);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't fetch the wage determination." }, { status: 502 });
  }
  const parsed = parseWd(fetched.text);
  if (!parsed.ok) {
    return NextResponse.json({ error: "The wage determination couldn't be read.", missing: parsed.missing }, { status: 422 });
  }
  const wd = parsed.wd as ParsedWd;
  if (fetched.revisionSource === "latest") revisionSource = "latest";

  // The bid's trade: from the match it came from, else the client's NAICS.
  const trades = await loadTrades(supabase, member.org_id);
  const { data: sub } = await supabase
    .from("submissions")
    .select("id, bid_estimation_facts, bid_estimation_facts_extracted_at, clients!submissions_client_id_fkey(naics_codes)")
    .eq("id", submissionId)
    .single();
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
    const naics = (sub?.clients as unknown as { naics_codes: string[] | null } | null)?.naics_codes ?? [];
    tradeId = clientTradeIds(naics, trades)[0] ?? null;
  }
  const trade = trades.find((t) => t.id === tradeId) ?? null;
  const facts = sub ? await getOrExtractBidEstimationFacts(supabase, sub as never) : null;

  const pre = prefillLines({
    wd,
    positionCode: trade?.wdPositionCode ?? null,
    productionRate: trade?.productionRate ?? null,
    cleanableSqft: facts?.cleanable_sqft ?? null,
    serviceDaysPerWeek: facts?.service_days_per_week ?? null,
    defaults,
  });

  const row = {
    submission_id: submissionId,
    org_id: member.org_id,
    wd_number: wd.number,
    wd_revision: wd.revision,
    wd_revision_source: revisionSource,
    wd_text: fetched.text,
    wd_parsed: wd,
    lines: pre.lines,
    options: { includeVacation: defaults.includeVacation ?? true, eo13658: false },
    supplies_mode: defaults.suppliesMode ?? "percent",
    supplies_value: defaults.suppliesValue ?? 0,
    overhead_pct: defaults.overheadPct ?? 0,
    profit_pct: defaults.profitPct ?? 0,
    updated_by: member.id,
    updated_at: new Date().toISOString(),
  };
  const { data: saved, error } = await supabase.from("wage_worksheets").upsert(row).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ worksheet: saved, parsed: wd, missingCode: pre.missingCode, hoursNeeded: pre.hoursNeeded, defaults });
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
