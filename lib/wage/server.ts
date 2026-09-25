import { createClient } from "@/lib/supabase/server";
import type { ParsedWd } from "@/lib/wage/parse-wd";
import { pickWdSuggestion, prefillGuidance, prefillLines } from "@/lib/wage/prefill";
import { normalizeClientPricing, missingPricing, type ClientPricing } from "@/lib/wage/client-pricing";
import { getOrExtractBidEstimationFacts } from "@/lib/bid-estimation";
import { loadTrades } from "@/lib/trades/server";
import { clientTradeIds } from "@/lib/trades/naics-options";

// Shared by /api/wage-worksheet and /api/wage-worksheet/client-pricing.

export type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function adminFor(supabase: Supabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("team_members").select("id, org_id").eq("auth_user_id", user.id).eq("role", "admin").maybeSingle();
  return data;
}

// Everything the pre-fill needs: the bid's client and their numbers, the
// bid's trade (from the match it came from, else the client's NAICS), the
// solicitation's facts, and the WD the checklist found (one rule, shared
// with the page).
export async function prefillContext(supabase: Supabase, orgId: string, submissionId: string) {
  const { data: sub } = await supabase
    .from("submissions")
    .select(
      "id, bid_estimation_facts, bid_estimation_facts_extracted_at, clients!submissions_client_id_fkey(id, company_name, naics_codes, pricing)"
    )
    .eq("id", submissionId)
    .maybeSingle();
  if (!sub) return null;
  const c = sub.clients as unknown as { id: string; company_name: string | null; naics_codes: string[] | null; pricing: unknown } | null;
  if (!c) return null;
  const client: { id: string; name: string; pricing: ClientPricing } = {
    id: c.id,
    name: c.company_name?.trim() || "the client",
    pricing: normalizeClientPricing(c.pricing),
  };
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
  if (!tradeId) tradeId = clientTradeIds(c.naics_codes ?? [], trades)[0] ?? null;
  const trade = trades.find((t) => t.id === tradeId) ?? null;
  const facts = await getOrExtractBidEstimationFacts(supabase, sub as never);
  const { data: suggestions } = await supabase
    .from("checklist_suggestions")
    .select("kind, dedupe_key, label, status, created_at")
    .eq("submission_id", submissionId);
  return { trade, facts, client, currentWd: pickWdSuggestion(suggestions ?? []) };
}

export type Ctx = NonNullable<Awaited<ReturnType<typeof prefillContext>>>;

// The worksheet's own pricing (possibly different from the client's usual
// numbers) decides what's still missing on this bid.
export function guidanceFor(
  ctx: Ctx,
  wd: ParsedWd,
  current: { suppliesValue: number | null; overheadPct: number | null; profitPct: number | null }
) {
  const pre = prefillLines({
    wd,
    positionCode: ctx.trade?.wdPositionCode ?? null,
    productionRate: ctx.client.pricing.productionRate,
    cleanableSqft: ctx.facts?.cleanable_sqft ?? null,
    serviceDaysPerWeek: ctx.facts?.service_days_per_week ?? null,
  });
  const guidance = prefillGuidance({
    tradeLabel: ctx.trade?.label ?? null,
    positionCode: ctx.trade?.wdPositionCode ?? null,
    clientName: ctx.client.name,
    productionRate: ctx.client.pricing.productionRate,
    cleanableSqft: ctx.facts?.cleanable_sqft ?? null,
    missingCode: pre.missingCode,
    missingPricing: missingPricing({ ...ctx.client.pricing, ...current }),
  });
  return { pre, guidance };
}

// A worksheet's pricing columns, pre-filled from the client's numbers.
export function pricingColumns(p: ClientPricing) {
  return { supplies_mode: p.suppliesMode, supplies_value: p.suppliesValue, overhead_pct: p.overheadPct, profit_pct: p.profitPct };
}
