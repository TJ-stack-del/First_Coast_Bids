import { classifyOpportunity } from "./classify.ts";
import type { Trade, TradeInput } from "./types.ts";

// Planning a re-sort of open matches after a trade change. Pure, so the
// preview the admin sees and the change the save route applies come from
// the same function. Only status='new' rows are ever passed in (the caller
// filters); nothing here deletes anything.

export type ResortRow = { id: string; title: string; naicsCode: string | null; nigpCodes: string[]; tradeId: string | null };
export type ResortMove = { id: string; from: string | null; to: string | null };
export type ResortSummary = { total: number; into: { tradeId: string | null; label: string; count: number }[] };

// The trade list as it would be after saving `change` (null = no change,
// used by "Re-sort open matches"). A new trade goes last in sort order.
export function applyTradeChange(trades: Trade[], change: (TradeInput & { id: string }) | null): Trade[] {
  if (!change) return trades;
  const existing = trades.find((t) => t.id === change.id);
  const sortOrder = existing ? existing.sortOrder : Math.max(0, ...trades.map((t) => t.sortOrder)) + 1;
  const updated: Trade = {
    id: change.id,
    label: change.label,
    naics: change.naics,
    nigpCodes: change.nigpCodes,
    keywords: change.keywords,
    active: change.active,
    sortOrder,
    wdPositionCode: change.wdPositionCode ?? null,
    productionRate: change.productionRate ?? null,
  };
  return existing ? trades.map((t) => (t.id === change.id ? updated : t)) : [...trades, updated];
}

export function planResort(rows: ResortRow[], tradesAfter: Trade[]): ResortMove[] {
  const moves: ResortMove[] = [];
  for (const r of rows) {
    const to = classifyOpportunity({ title: r.title, naicsCode: r.naicsCode, nigpCodes: r.nigpCodes }, tradesAfter);
    if (to !== r.tradeId) moves.push({ id: r.id, from: r.tradeId, to });
  }
  return moves;
}

export function summarizeMoves(moves: ResortMove[], tradesAfter: Trade[]): ResortSummary {
  const counts = new Map<string | null, number>();
  for (const m of moves) counts.set(m.to, (counts.get(m.to) ?? 0) + 1);
  const into = [...counts.entries()]
    .map(([tradeId, count]) => ({
      tradeId,
      label: tradeId === null ? "Other trades" : tradesAfter.find((t) => t.id === tradeId)?.label ?? "Unknown trade",
      count,
    }))
    // Trades in sort order, Other trades last.
    .sort((a, b) => {
      if (a.tradeId === null) return 1;
      if (b.tradeId === null) return -1;
      const order = (id: string) => tradesAfter.find((t) => t.id === id)?.sortOrder ?? 0;
      return order(a.tradeId) - order(b.tradeId);
    });
  return { total: moves.length, into };
}

export function describeSummary(s: ResortSummary): string {
  if (s.total === 0) return "No open matches change trade.";
  const parts = s.into.map((g) => (g.tradeId === null ? `${g.count} to Other trades` : `${g.count} into ${g.label}`));
  return `This moves ${s.total} open ${s.total === 1 ? "match" : "matches"}: ${parts.join(", ")}.`;
}

// The save route re-plans at confirm time; if the count differs from what
// the admin confirmed (a scrape landed in between), nothing is applied.
export function resortConflict(actualMoves: number, expectedMoves: number): string | null {
  if (actualMoves === expectedMoves) return null;
  return `Matches changed since the preview: ${actualMoves} would move now, not ${expectedMoves}. Check the new count and confirm again.`;
}
