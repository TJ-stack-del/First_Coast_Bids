// CLIN pricing (docs/superpowers/specs/2026-09-25-clin-pricing-design.md).

// "lump": a whole-period line with no quantity or unit, priced by its months.
export type UnitKind = "month" | "year" | "lump" | "other";

// One priced line as the AI read it from the solicitation's price schedule.
export type ClinCandidate = {
  clin: string;
  description: string;
  quantity: number | null;
  unit: string | null;
  quote: string;
  page: number | null;
  source_file: string | null;
  // The line's period of performance as printed (e.g. "10/01/2026"), or null.
  period_start?: string | null;
  period_end?: string | null;
};

// A clin_lines row.
export type ClinLine = {
  id?: string;
  clin: string;
  description: string;
  quantity: number | null;
  unit: string | null;
  unit_kind: UnitKind;
  period_index: number | null;
  // Months in the line's period of performance, from verified dates (lump sums).
  period_months?: number | null;
  position: number;
  quote: string | null;
  page: number | null;
  source_file: string | null;
  quote_status: "verified" | "not_found" | "unreadable" | "admin";
  revised_by: string | null;
  unit_price_override: number | null;
  sort: number;
};
