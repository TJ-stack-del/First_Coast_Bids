import type { ClinCandidate, ClinLine, UnitKind } from "./types.ts";

// Plain code around the AI's reading of a CLIN table (docs/superpowers/specs/
// 2026-09-25-clin-pricing-design.md): what unit a line is priced in, which
// contract period it belongs to, and which lines are the same building
// across years. Checked against five real solicitations (JDMTA, Lake Tahoe,
// Crow Agency, Montrose, Martha's Vineyard).

// The unit column decides ("12 MO", "Months", "YR"); anything else is priced
// by hand.
export function unitKind(unit: string | null, _description?: string): UnitKind {
  const u = (unit ?? "").trim().toLowerCase().replace(/^\d+\s*/, "");
  if (/^(mo|mos|mon|month|months)\.?$/.test(u)) return "month";
  if (/^(yr|yrs|year|years)\.?$/.test(u)) return "year";
  return "other";
}

const WORD_NUM: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9 };

// 0 = base, N = option year N, null = unknown (highlighted for the admin).
// "Option Year 1" wins over "Base Period <dates>" in the same description
// (Lake Tahoe words its option lines that way).
export function periodIndex(clin: string, description: string, allClins: string[]): number | null {
  const opt = description.match(/\boption\s+(?:year|period)\s+(\d+|one|two|three|four|five|six|seven|eight|nine)\b/i);
  if (opt) return /^\d+$/.test(opt[1]) ? Number(opt[1]) : WORD_NUM[opt[1].toLowerCase()];
  if (/\bbase\b/i.test(description)) return 0;
  // Numbering: 0001/1001/2001 or 00001/10001/20001 -- only when the table
  // really uses a leading period digit (some CLIN starts with 1-9); a plain
  // 00001-00005 sequence says nothing about periods.
  const numeric = allClins.map((c) => c.match(/^(\d)\d{3,4}[A-Z]{0,2}$/));
  if (numeric.every(Boolean) && numeric.some((m) => m![1] !== "0")) {
    const m = clin.match(/^(\d)\d{3,4}[A-Z]{0,2}$/);
    return m ? Number(m[1]) : null;
  }
  return null;
}

// Order within each period (1st, 2nd... line = the same building across
// years, which is what the split is keyed on), from the stored periods.
export function assignPositions(lines: ClinLine[]): ClinLine[] {
  const key = (p: number | null) => (p === null ? 99 : p);
  const sorted = [...lines].sort((a, b) => key(a.period_index) - key(b.period_index) || a.clin.localeCompare(b.clin));
  const counters = new Map<number | null, number>();
  return sorted.map((l, i) => {
    const n = (counters.get(l.period_index) ?? 0) + 1;
    counters.set(l.period_index, n);
    return { ...l, position: n, sort: i };
  });
}

// For a fresh reading: periods from the text, then positions.
export function assignPeriodsAndPositions(lines: Omit<ClinLine, "period_index" | "position" | "sort">[]): ClinLine[] {
  const all = lines.map((l) => l.clin);
  return assignPositions(lines.map((l) => ({ ...l, period_index: periodIndex(l.clin, l.description, all), position: 0, sort: 0 })));
}

// Files in upload order: a later file's CLIN replaces an earlier one's (an
// amendment re-listing the table), and says which file revised it.
export function dedupeClins(byFile: { file: string; items: ClinCandidate[] }[]): (ClinCandidate & { revised_by: string | null })[] {
  const out = new Map<string, ClinCandidate & { revised_by: string | null }>();
  for (const { file, items } of byFile) {
    for (const it of items) {
      const prior = out.get(it.clin);
      const source = it.source_file ?? file;
      // Only a different, later file revises a line; a repeat in the same
      // file (a table split across pages) doesn't.
      const revised = prior && prior.source_file !== source ? file : (prior?.revised_by ?? null);
      out.set(it.clin, { ...it, source_file: source, revised_by: revised });
    }
  }
  return [...out.values()];
}

// The quote must show the CLIN number itself, as a whole token.
export function clinInQuote(clin: string, quote: string): boolean {
  const esc = clin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^0-9A-Za-z])${esc}([^0-9A-Za-z]|$)`).test(quote);
}
