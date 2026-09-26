import type { ClinLine } from "./types.ts";

// A re-read replaces what the AI found, but never the admin's own work:
// lines added by hand stay, and a typed unit price stays on its CLIN.
export function mergeRescan(existing: ClinLine[], fresh: ClinLine[]): ClinLine[] {
  const typed = new Map(existing.filter((l) => l.unit_price_override !== null).map((l) => [l.clin, l.unit_price_override]));
  const freshClins = new Set(fresh.map((l) => l.clin));
  const kept = existing.filter((l) => l.quote_status === "admin" && !freshClins.has(l.clin));
  return [...fresh.map((l) => ({ ...l, unit_price_override: typed.get(l.clin) ?? l.unit_price_override })), ...kept];
}
