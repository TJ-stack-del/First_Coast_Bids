import type { ClinLine } from "./types.ts";

// A re-read replaces what the AI found, but never the admin's own work
// (final review I-2): a line is matched by the CLIN number as the AI read it,
// the fields the admin corrected (period, quantity, a renamed CLIN...) and a
// typed unit price are carried over, a removed line stays removed, and lines
// added by hand stay. A partial reading (a file or part of one not read) never
// drops a line it didn't see (final review I-3); a full one drops only lines
// the admin never touched.
export function mergeRescan(existing: ClinLine[], fresh: ClinLine[], opts: { partial?: boolean } = {}): ClinLine[] {
  const byRead = new Map(existing.filter((l) => l.read_clin).map((l) => [l.read_clin as string, l]));
  const seen = new Set<string>();
  const merged = fresh.map((f) => {
    const e = byRead.get(f.clin);
    const base = { ...f, read_clin: f.clin, edited: [] as string[], dismissed: false };
    if (!e) return base;
    seen.add(f.clin);
    if (e.dismissed) return { ...e };
    const out: ClinLine = { ...base, edited: e.edited ?? [], unit_price_override: e.unit_price_override ?? null };
    for (const field of e.edited ?? []) (out as Record<string, unknown>)[field] = (e as Record<string, unknown>)[field];
    return out;
  });
  const kept = existing.filter((l) => {
    if (!l.read_clin) return true; // added by hand
    if (seen.has(l.read_clin)) return false;
    return !!opts.partial || (l.edited ?? []).length > 0 || l.unit_price_override !== null || !!l.dismissed;
  });
  return [...merged, ...kept];
}
