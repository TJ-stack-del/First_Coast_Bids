import type { Supabase } from "@/lib/wage/server";
import { normalizeClientPricing } from "@/lib/wage/client-pricing";
import type { ClinLine } from "@/lib/clins/types";
import { priceLines } from "@/lib/clins/price";
import { rateSheetText } from "@/lib/clins/rate-sheet";

// Everything the CLIN panel and the Rate sheet need, read with the admin's
// own session (RLS: admin-only clin_lines and wage_worksheets).
export async function loadClinContext(supabase: Supabase, submissionId: string) {
  const { data: submission } = await supabase
    .from("submissions")
    .select("id, agency, solicitation_number, stage, clin_shares, clin_scan, clients!submissions_client_id_fkey(org_id, company_name, pricing)")
    .eq("id", submissionId)
    .maybeSingle();
  if (!submission) return null;
  const { data: rows } = await supabase.from("clin_lines").select("*").eq("submission_id", submissionId).order("sort");
  const { data: ws } = await supabase.from("wage_worksheets").select("bid_price").eq("submission_id", submissionId).maybeSingle();
  const { data: sheet } = await supabase
    .from("deliverables")
    .select("content")
    .eq("submission_id", submissionId)
    .eq("deliverable_type", "rate_sheet")
    .maybeSingle();
  const client = submission.clients as unknown as { org_id: string; company_name: string | null; pricing: unknown } | null;
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  // Lines the admin removed stay in the table (so a re-read keeps them
  // removed) but are left out of everything else.
  const lines = ((rows ?? []) as ClinLine[]).filter((l) => !l.dismissed).map((l) => ({
    ...l,
    quantity: num(l.quantity),
    unit_price_override: num(l.unit_price_override),
    period_months: num(l.period_months),
  }));
  return {
    submission,
    orgId: client?.org_id ?? null,
    lines,
    shares: (submission.clin_shares ?? {}) as Record<string, number>,
    bidPrice: num(ws?.bid_price ?? null),
    increasePct: normalizeClientPricing(client?.pricing).yearlyIncreasePct,
    clientName: client?.company_name?.trim() || "the client",
    rateSheet: (sheet?.content as string | null | undefined) ?? null,
  };
}

export type ClinContext = NonNullable<Awaited<ReturnType<typeof loadClinContext>>>;

export function priceContext(ctx: ClinContext) {
  return priceLines({ lines: ctx.lines, bidPrice: ctx.bidPrice, increasePct: ctx.increasePct, shares: ctx.shares });
}

export function rateSheetFor(ctx: ClinContext) {
  return rateSheetText({
    agency: ctx.submission.agency,
    solicitationNumber: ctx.submission.solicitation_number,
    lines: ctx.lines,
    priced: priceContext(ctx),
  });
}
