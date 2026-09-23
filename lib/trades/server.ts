import type { SupabaseClient } from "@supabase/supabase-js";
import { TRADE_COLUMNS, rowToTrade, type Trade, type TradeInput, type TradeRow } from "./types";
import { normalizeTradeInput, validateTrade } from "./validate";
import { applyTradeChange, planResort, type ResortMove, type ResortRow } from "./resort";

// Supabase glue for the trade list. The logic lives in the pure modules
// next to this file; this only loads and shapes rows.

export async function loadTrades(supabase: SupabaseClient, orgId: string): Promise<Trade[]> {
  const { data, error } = await supabase.from("trades").select(TRADE_COLUMNS).eq("org_id", orgId);
  if (error) throw new Error(`Couldn't load trades: ${error.message}`);
  return ((data ?? []) as TradeRow[]).map(rowToTrade);
}

// Public read (RLS: anyone reads active trades). One org per database, so
// no org filter -- used by the intake wizard before the visitor has an
// account, and by the document-reading routes.
export async function loadActiveTrades(supabase: SupabaseClient): Promise<Trade[]> {
  const { data, error } = await supabase.from("trades").select(TRADE_COLUMNS).eq("active", true);
  if (error) throw new Error(`Couldn't load trades: ${error.message}`);
  return ((data ?? []) as TradeRow[]).map(rowToTrade);
}

// Every open (status='new') match, paged past PostgREST's 1,000-row cap.
export async function loadOpenRows(supabase: SupabaseClient, orgId: string): Promise<ResortRow[]> {
  const PAGE = 1000;
  const rows: ResortRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("matched_opportunities")
      .select("id, source_title, naics_code, nigp_codes, trade_id")
      .eq("org_id", orgId)
      .eq("status", "new")
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Couldn't load open matches: ${error.message}`);
    for (const r of data ?? []) {
      rows.push({
        id: r.id,
        title: r.source_title,
        naicsCode: r.naics_code,
        nigpCodes: r.nigp_codes ?? [],
        tradeId: r.trade_id,
      });
    }
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

// Thrown by planTradeChange when the submitted trade fails validation. A
// class rather than an {ok: false} union: this repo compiles with
// strict: false, where such a union can't be narrowed.
export class TradeValidationError extends Error {
  errors: string[];
  constructor(errors: string[]) {
    super(errors.join(" "));
    this.errors = errors;
  }
}

export type TradeChangePlan = {
  trades: Trade[];
  tradesAfter: Trade[];
  change: (TradeInput & { id: string }) | null;
  isNew: boolean;
  moves: ResortMove[];
};

// Shared by the preview and save routes, so both plan the exact same
// change. rawTrade null = "re-sort only" (no trade edited).
export async function planTradeChange(
  supabase: SupabaseClient,
  orgId: string,
  rawTrade: unknown | null
): Promise<TradeChangePlan> {
  const trades = await loadTrades(supabase, orgId);
  let change: (TradeInput & { id: string }) | null = null;
  let isNew = false;
  if (rawTrade !== null) {
    const input = normalizeTradeInput(rawTrade);
    if (input.id && !trades.some((t) => t.id === input.id)) {
      throw new TradeValidationError(["That trade no longer exists. Reload the page."]);
    }
    const result = validateTrade(input, trades);
    if (!result.ok) throw new TradeValidationError(result.errors);
    isNew = !input.id;
    change = { ...input, id: input.id ?? crypto.randomUUID() };
  }
  const tradesAfter = applyTradeChange(trades, change);
  const moves = planResort(await loadOpenRows(supabase, orgId), tradesAfter);
  return { trades, tradesAfter, change, isNew, moves };
}
