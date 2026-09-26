// CLIN pricing (docs/superpowers/specs/2026-09-25-clin-pricing-design.md).

export type UnitKind = "month" | "year" | "other";

// One priced line as the AI read it from the solicitation's price schedule.
export type ClinCandidate = {
  clin: string;
  description: string;
  quantity: number | null;
  unit: string | null;
  quote: string;
  page: number | null;
  source_file: string | null;
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
  position: number;
  quote: string | null;
  page: number | null;
  source_file: string | null;
  quote_status: "verified" | "not_found" | "unreadable" | "admin";
  revised_by: string | null;
  unit_price_override: number | null;
  sort: number;
};
