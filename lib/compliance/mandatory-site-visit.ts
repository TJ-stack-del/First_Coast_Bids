// Detects genuinely mandatory pre-bid site visit / walkthrough language.
// Deliberately conservative: only flags when the text pairs an actual
// "mandatory"-equivalent word with a site-visit term near each other —
// never just because a site visit is mentioned at all. An optional
// walkthrough is extremely common in bid text and must never trigger this.
//
// This is one of the highest-stakes flags in the app: a proposal submitted
// without attending a truly mandatory walkthrough is typically rejected
// unopened as non-responsive, with no chance to fix it after the fact. But
// a false positive here (crying "mandatory" on an optional site visit)
// would train whoever reads it to stop trusting the flag, which defeats
// the point just as badly — precision matters as much as recall.
const MANDATORY_TERMS = ["mandatory", "must attend", "required to attend", "shall attend", "attendance is mandatory"];
const SITE_VISIT_TERMS = [
  "site visit",
  "site walkthrough",
  "walkthrough",
  "pre-bid conference",
  "pre-proposal conference",
  "pre-proposal meeting",
  "site inspection",
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Requires the two terms to appear near each other WITHIN THE SAME
// SENTENCE (no period in the gap) — otherwise "Attendance is mandatory
// for the safety briefing. A site visit is also available." would
// wrongly connect an unrelated "mandatory" to the site visit.
function nearMandatory(siteVisitTerm: string, mandatoryTerm: string): RegExp {
  const a = escapeRegExp(mandatoryTerm);
  const b = escapeRegExp(siteVisitTerm);
  return new RegExp(`\\b${a}\\b[^.]{0,60}\\b${b}\\b|\\b${b}\\b[^.]{0,60}\\b${a}\\b`, "i");
}

// matched: the exact words that triggered the flag, so a caller can quote
// the line they sit on (the homepage bid read does).
export type MandatorySiteVisitResult = { flagged: boolean; explanation: string | null; matched: string | null };

export function detectMandatorySiteVisit(bidText: string): MandatorySiteVisitResult {
  for (const siteTerm of SITE_VISIT_TERMS) {
    for (const mandatoryTerm of MANDATORY_TERMS) {
      const match = bidText.match(nearMandatory(siteTerm, mandatoryTerm));
      if (match) {
        return {
          flagged: true,
          matched: match[0],
          explanation: `The bid text says "${match[0]}" — this looks like a mandatory pre-bid site visit or walkthrough. A proposal submitted without attending is typically rejected unopened as non-responsive. Confirm the requirement and make sure someone actually attends and signs in.`,
        };
      }
    }
  }
  return { flagged: false, explanation: null, matched: null };
}
