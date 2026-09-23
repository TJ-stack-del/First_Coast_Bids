import type { Trade } from "./types.ts";

// Which offered trade a bid belongs to -- plain code, no AI
// (docs/superpowers/specs/2026-09-23-trade-list-design.md). Codes first
// across all trades, then title keywords. The scope/description is never
// searched: on 2026-09-23, construction scopes produced false matches
// ("McCoy's Creek Greenway" mentions landscaping in passing).

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}

// Matches only at the start of a word, so "it support" never matches
// "transit support". A keyword may be a stem: "landscap" matches
// "landscaping".
export function keywordMatches(text: string, keyword: string): boolean {
  const k = keyword.trim().toLowerCase();
  if (!k) return false;
  return new RegExp(`(?<![a-z0-9])${escapeRegExp(k)}`).test(text.toLowerCase());
}

function activeInOrder(trades: Trade[]): Trade[] {
  return trades.filter((t) => t.active).sort((a, b) => a.sortOrder - b.sortOrder);
}

// Returns the trade id, or null for "Other trades".
export function classifyOpportunity(
  o: { title: string; naicsCode?: string | null; nigpCodes?: string[] | null },
  trades: Trade[]
): string | null {
  const active = activeInOrder(trades);
  if (o.naicsCode) {
    const byNaics = active.find((t) => t.naics.some((n) => n.code === o.naicsCode));
    if (byNaics) return byNaics.id;
  }
  if (o.nigpCodes && o.nigpCodes.length > 0) {
    const byNigp = active.find((t) => t.nigpCodes.some((c) => o.nigpCodes!.includes(c)));
    if (byNigp) return byNigp.id;
  }
  const byKeyword = active.find((t) => t.keywords.some((k) => keywordMatches(o.title, k)));
  return byKeyword ? byKeyword.id : null;
}

// The NAICS codes SAM.gov searches for: every active trade's codes, once.
export function offeredNaicsCodes(trades: Trade[]): string[] {
  const seen = new Set<string>();
  for (const t of activeInOrder(trades)) for (const n of t.naics) seen.add(n.code);
  return [...seen];
}
