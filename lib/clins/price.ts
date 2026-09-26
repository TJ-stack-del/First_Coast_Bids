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
  // A period with several lines (one per building) is split by position,
  // and each split period must add up to 100% on its own (final review I-5:
  // a building added in an option year, or a base with fewer buildings).
  const perPeriod = new Map<number, number[]>();
  for (const l of i.lines) if (l.period_index !== null) perPeriod.set(l.period_index, [...(perPeriod.get(l.period_index) ?? []), l.position]);
  const shared = (l: ClinLine) => l.period_index !== null && (perPeriod.get(l.period_index) ?? []).length > 1;
  const badPeriods = new Set<number>();
  let sharesProblem: string | null = null;
  for (const [period, positions] of [...perPeriod.entries()].sort((a, b) => a[0] - b[0])) {
    if (positions.length < 2) continue;
    const vals = positions.map((p) => i.shares[String(p)]);
    if (vals.some((v) => typeof v !== "number")) {
      badPeriods.add(period);
      sharesProblem ??= "Enter the split for each line.";
      continue;
    }
    const sum = vals.reduce((a, v) => a + (v as number), 0);
    if (Math.abs(sum - 100) > 0.01) {
      badPeriods.add(period);
      sharesProblem ??= `The split for ${period === 0 ? "Base" : `Option ${period}`} adds up to ${round2(sum)}%, not 100%.`;
    }
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
    if (shared(l) && badPeriods.has(l.period_index)) return blank("no_share");
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

// Where each building's split box goes: its first line (earliest period) in a
// period that has more than one line. Returns those lines' CLINs.
export function shareBoxLines(lines: ClinLine[]): Set<string> {
  const counts = new Map<number, number>();
  for (const l of lines) if (l.period_index !== null) counts.set(l.period_index, (counts.get(l.period_index) ?? 0) + 1);
  const first = new Map<number, ClinLine>();
  for (const l of lines) {
    if (l.period_index === null || (counts.get(l.period_index) ?? 0) < 2) continue;
    const seen = first.get(l.position);
    if (!seen || (l.period_index as number) < (seen.period_index as number)) first.set(l.position, l);
  }
  return new Set([...first.values()].map((l) => l.clin));
}
