// Shapes for the admin-managed trade list (public.trades). See
// docs/superpowers/specs/2026-09-23-trade-list-design.md.

export type NaicsEntry = { code: string; label: string };

export type Trade = {
  id: string;
  label: string;
  naics: NaicsEntry[];
  nigpCodes: string[];
  keywords: string[];
  active: boolean;
  sortOrder: number;
  // Wage worksheet defaults (set once in Settings): the WD position this
  // trade's bids are priced on, and square feet per labor hour.
  wdPositionCode: string | null;
};

// What the Trades form submits: a new trade has no id yet.
export type TradeInput = {
  id?: string;
  label: string;
  naics: NaicsEntry[];
  nigpCodes: string[];
  keywords: string[];
  active: boolean;
  wdPositionCode?: string | null;
};

export const TRADE_COLUMNS =
  "id, label, naics, nigp_codes, keywords, active, sort_order, wd_position_code";

export type TradeRow = {
  id: string;
  label: string;
  naics: unknown;
  nigp_codes: string[] | null;
  keywords: string[] | null;
  active: boolean;
  sort_order: number;
  wd_position_code?: string | null;
};

// naics is jsonb, so it's checked rather than trusted: anything that isn't
// a {code, label} pair of strings is dropped.
export function rowToTrade(row: TradeRow): Trade {
  const naics = Array.isArray(row.naics)
    ? row.naics.flatMap((n) =>
        n && typeof n === "object" && typeof (n as NaicsEntry).code === "string" && typeof (n as NaicsEntry).label === "string"
          ? [{ code: (n as NaicsEntry).code, label: (n as NaicsEntry).label }]
          : []
      )
    : [];
  return {
    id: row.id,
    label: row.label,
    naics,
    nigpCodes: row.nigp_codes ?? [],
    keywords: row.keywords ?? [],
    active: row.active,
    sortOrder: row.sort_order,
    wdPositionCode: row.wd_position_code ?? null,
  };
}
