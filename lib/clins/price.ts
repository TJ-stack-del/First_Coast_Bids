import type { ClinLine } from "./types.ts";

// Every CLIN's price from the agreed yearly bid (the wage worksheet's bid
// price), the client's yearly increase and the per-bid split -- plain code,
// and nothing guessed: a missing input leaves the line blank with a reason.

export type PricedLine = {
  clin: string;
  yearPrice: number | null;
  share: number | null;
  unitPrice: number | null;
  amount: number | null;
  typed: boolean;
  problem: "no_bid" | "no_increase" | "no_share" | "unit" | "no_quantity" | "no_period" | null;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function priceLines(i: { lines: ClinLine[]; bidPrice: number | null; increasePct: number | null; shares: Record<string, number> }): {
  lines: PricedLine[];
  total: number | null;
  missing: number;
  sharesProblem: string | null;
} {
  // A period with several lines (one per building) is split by position.
  const perPeriod = new Map<number, number>();
  for (const l of i.lines) if (l.period_index !== null) perPeriod.set(l.period_index, (perPeriod.get(l.period_index) ?? 0) + 1);
  const shared = (l: ClinLine) => l.period_index !== null && (perPeriod.get(l.period_index) ?? 0) > 1;
  const positions = [...new Set(i.lines.filter(shared).map((l) => l.position))];
  let sharesProblem: string | null = null;
  if (positions.length > 1) {
    const vals = positions.map((p) => i.shares[String(p)]);
    const sum = vals.reduce((a, v) => a + (typeof v === "number" ? v : 0), 0);
    if (vals.some((v) => typeof v !== "number")) sharesProblem = "Enter the split for each line.";
    else if (Math.abs(sum - 100) > 0.01) sharesProblem = `The split adds up to ${round2(sum)}%, not 100%.`;
  }

  const lines: PricedLine[] = i.lines.map((l) => {
    const blank = (problem: PricedLine["problem"]): PricedLine => ({ clin: l.clin, yearPrice: null, share: null, unitPrice: null, amount: null, typed: false, problem });
    if (l.unit_price_override !== null) {
      const q = l.unit_kind === "lump" ? 1 : l.quantity;
      const amount = q === null ? null : round2(l.unit_price_override * q);
      return { clin: l.clin, yearPrice: null, share: null, unitPrice: l.unit_price_override, amount, typed: true, problem: amount === null ? "no_quantity" : null };
    }
    if (l.period_index === null) return blank("no_period");
    if (l.unit_kind === "other") return blank("unit");
    const lump = l.unit_kind === "lump";
    if (!lump && l.quantity === null) return blank("no_quantity");
    if (i.bidPrice === null) return blank("no_bid");
    if (l.period_index > 0 && i.increasePct === null) return blank("no_increase");
    if (shared(l) && sharesProblem) return blank("no_share");
    const share = shared(l) ? i.shares[String(l.position)] / 100 : 1;
    const yearPrice = i.bidPrice * Math.pow(1 + (i.increasePct ?? 0) / 100, l.period_index);
    // A lump sum is its period's share of the year, by months (a 9-month
    // base is 9/12 of the year's price); one lump = quantity 1.
    const unitPrice = lump
      ? round2((yearPrice * share * (l.period_months as number)) / 12)
      : round2((yearPrice * share) / (l.unit_kind === "month" ? 12 : 1));
    const amount = lump ? unitPrice : round2(unitPrice * (l.quantity as number));
    return { clin: l.clin, yearPrice: round2(yearPrice), share, unitPrice, amount, typed: false, problem: null };
  });
  const missing = lines.filter((l) => l.amount === null).length;
  const total = missing ? null : round2(lines.reduce((a, l) => a + (l.amount as number), 0));
  return { lines, total, missing, sharesProblem };
}
