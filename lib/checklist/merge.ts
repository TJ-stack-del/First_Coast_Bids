import { identifierKey } from "./detectors.ts";
import { isFederalAgency } from "../federal-agency.ts";
import type { Candidate } from "./types.ts";

// Folding detector and AI results into one list of suggestions: one per
// requirement, detectors' verbatim quotes preferred, nothing re-suggested
// that the bid already has (in any status).

// Parentheticals ("(Page 46)", "(3)") and punctuation don't make a new item.
function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// "Form 10", "FORM 5:" -- a solicitation's own numbered forms. Two digits at
// most, so "Form 1449" (an SF form, keyed by the detectors) isn't caught.
// Only as a heading ("Form 10:", "FORM 1 – ...") or at the start, so a count
// like "W-9 form 2 copies" isn't read as Form 2.
const LOCAL_FORM = /(?:^|\b)form\s*#?\s*(\d{1,2})\s*(?:[:\-\u2013\u2014]|$)|^form\s*#?\s*(\d{1,2})\b/i;
const FAR_NUMBER = /\b(52\.2\d{2}-\d{1,3})\b/;

// Identity of a requirement, so different wordings of it (from different
// page ranges or readings) become one suggestion. Taken from the item's own
// label (and, for FAR numbers, its detail) -- never from the quote, which
// can mention other requirements in passing. Found necessary on real
// documents (2026-09-25): "FORM 10: Qualifications (Page 46)" and
// "Form 10: Qualifications & Experience" were separate suggestions.
export function candidateKey(c: Candidate): string {
  if (c.key) return c.key;
  const id = identifierKey(c.label);
  if (id) return id;
  // A FAR number identifies the item only when the item IS that provision:
  // many different submission rules cite 52.212-1 in their detail, and
  // merging them would silently drop requirements (final review, 2026-09-25).
  const far = c.label.match(FAR_NUMBER);
  if (far) return `far:${far[1]}`;
  const form = c.label.match(LOCAL_FORM);
  if (form) return `localform:${Number(form[1] ?? form[2])}`;
  return `${c.kind}:${normalizeLabel(c.label)}`;
}

export function mergeCandidates(detected: Candidate[], ai: Candidate[]): Candidate[] {
  const byKey = new Map<string, Candidate>();
  for (const d of detected) byKey.set(candidateKey(d), { ...d, key: candidateKey(d) });
  for (const a of ai) {
    const key = candidateKey(a);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...a, key });
    } else if (existing.found_by === "detector" && !existing.detail && a.detail) {
      byKey.set(key, { ...existing, detail: a.detail });
    }
  }
  return [...byKey.values()];
}

// Federal-only items (wage determinations, FAR provisions, SAM, SF forms)
// belong on bids for federal agencies, or where the documents themselves
// carry federal forms/provisions (a locally run, federally funded bid).
export function allowFederalItems(agency: string, detected: Candidate[]): boolean {
  if (isFederalAgency(agency)) return true;
  return detected.some((d) => d.key !== null && (d.key.startsWith("form:sf-") || d.key.startsWith("far:")));
}

export function finalizeCandidates(
  merged: Candidate[],
  opts: { agency: string; detected: Candidate[]; existingKeys: Set<string> }
): (Candidate & { key: string })[] {
  const federalOk = allowFederalItems(opts.agency, opts.detected);
  return merged
    .map((c) => ({ ...c, key: candidateKey(c) }))
    .filter((c) => (federalOk || !c.federal) && !opts.existingKeys.has(c.key));
}
