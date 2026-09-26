import type { ClinCandidate, ClinLine, UnitKind } from "./types.ts";
import { normalizeForMatch } from "../checklist/verify-quote.ts";

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

// A whole-period line (no quantity and no unit, as Montrose, Crow Agency and
// Martha's Vineyard print them) is a lump sum once its months are known.
export function lineKind(unit: string | null, quantity: number | null, months: number | null): UnitKind {
  // Over a year is the whole contract's range (Section F), not one period's
  // (final review I-6): left for the admin, never priced at 5x the year.
  if (unit === null && quantity === null) return months !== null && months <= 12.5 ? "lump" : "other";
  return unitKind(unit);
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function parseDate(s: string): Date | null {
  const t = s.trim();
  let m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(Date.UTC(Number(m[3]), Number(m[1]) - 1, Number(m[2])));
  m = t.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})$/);
  if (m && MONTHS.includes(m[2].slice(0, 3).toLowerCase())) return new Date(Date.UTC(Number(m[3]), MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()), Number(m[1])));
  m = t.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m && MONTHS.includes(m[1].slice(0, 3).toLowerCase())) return new Date(Date.UTC(Number(m[3]), MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()), Number(m[2])));
  return null;
}

// Months in a period of performance, end date inclusive, to one decimal
// (10/01/2026-09/30/2027 = 12; 01/01/2027-09/30/2027 = 9).
export function periodMonths(start: string, end: string): number | null {
  const a = parseDate(start);
  const b = parseDate(end);
  if (!a || !b || b <= a) return null;
  const next = new Date(b.getTime() + 86_400_000);
  const days = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + 1, 0)).getUTCDate();
  const months = (next.getUTCFullYear() - a.getUTCFullYear()) * 12 + (next.getUTCMonth() - a.getUTCMonth()) + (next.getUTCDate() - a.getUTCDate()) / days;
  return Math.round(months * 10) / 10;
}

// Months from the AI's period dates -- only when both dates really appear in
// the document (the same rule as quotes: nothing unverified is priced).
export function verifiedMonths(start: string | null, end: string | null, fileText: string | null): number | null {
  if (!start || !end || !fileText) return null;
  const text = normalizeForMatch(fileText);
  if (!text.includes(normalizeForMatch(start)) || !text.includes(normalizeForMatch(end))) return null;
  return periodMonths(start, end);
}

const WORD_NUM: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9 };

// 0 = base, N = option year N, null = unknown (highlighted for the admin).
// "Option Year 1" wins over "Base Period <dates>" in the same description
// (Lake Tahoe words its option lines that way).
export function periodIndex(clin: string, description: string, allClins: string[]): number | null {
  const opt = description.match(/\boption\s+(?:year|period)\s+(\d+|one|two|three|four|five|six|seven|eight|nine)\b/i);
  if (opt) return /^\d+$/.test(opt[1]) ? Number(opt[1]) : WORD_NUM[opt[1].toLowerCase()];
  // "OP1", "ServicesOP3" (Montrose); case-sensitive so "DEVELOP 2" isn't one.
  const op = description.match(/(?:^|[^A-Za-z]|[a-z])OP\s?([1-9])\b/);
  if (op) return Number(op[1]);
  // Numbering: 0001/1001/2001 or 00001/10001/20001 -- only when the table
  // really uses a leading period digit (some CLIN starts with 1-9); a plain
  // 00001-00005 sequence says nothing about periods. Checked before the word
  // "base", which is also a place ("MacDill Air Force Base", final review I-1).
  const numeric = allClins.map((c) => c.match(/^(\d)\d{3,4}[A-Z]{0,2}$/));
  if (numeric.every(Boolean) && numeric.some((m) => m![1] !== "0")) {
    const m = clin.match(/^(\d)\d{3,4}[A-Z]{0,2}$/);
    return m ? Number(m[1]) : null;
  }
  if (/\bbase\s+(year|period)\b/i.test(description)) return 0;
  // A bare "BASE" (Montrose) -- but not a military base's name.
  const bare = description.replace(/\b(air\s+force|space\s+force|naval|navy|army|air|marine\s+corps|military|joint|coast\s+guard|reserve|guard)\s+base\b/gi, "");
  if (/\bbase\b/i.test(bare)) return 0;
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
