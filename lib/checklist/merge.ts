import { identifierKey } from "./detectors.ts";
import { isFederalAgency } from "../federal-agency.ts";
import type { Candidate } from "./types.ts";

// Folding detector and AI results into one list of suggestions: one per
// requirement, detectors' verbatim quotes preferred, nothing re-suggested
// that the bid already has (in any status).

function normalizeLabel(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

export function candidateKey(c: Candidate): string {
  if (c.key) return c.key;
  return identifierKey(`${c.label} ${c.detail ?? ""} ${c.quote}`) ?? `${c.kind}:${normalizeLabel(c.label)}`;
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
