// Detects prevailing/living wage language in a bid's own scope text. Never
// invents a dollar figure (e.g. "$16.50/hr base + $4.98/hr fringe") — that
// has to come from the real wage determination document. Only ever flags
// that one needs to be checked before pricing labor, same
// never-a-confirmed-fact rule as set-aside-eligibility.ts.
//
// All multi-word phrases (no bare short acronyms like "SCA") — a bare "sca"
// would substring-match inside real words like "scaffold" or "scared" under
// this file's word-boundary-safe but still-naive-per-word matching, so the
// full "service contract act" phrase is used instead, same reasoning as the
// SDVOSB/VOSB word-boundary fix in set-aside-eligibility.ts.
const WAGE_TRIGGER_PATTERNS: RegExp[] = [
  /\bprevailing wage\b/i,
  /\bliving wage\b/i,
  /\bdavis[- ]bacon\b/i,
  /\bservice contract act\b/i,
  /\bwage determination\b/i,
];

export type WageRiskResult = { concern: boolean; explanation: string | null; matched: string | null };

export function assessWageRisk(bidText: string): WageRiskResult {
  for (const pattern of WAGE_TRIGGER_PATTERNS) {
    const match = bidText.match(pattern);
    if (match) {
      return {
        concern: true,
        matched: match[0],
        explanation: `The bid text references "${match[0]}" — this bid may require prevailing/living wage rates. Confirm the actual wage determination before pricing labor. Do not bid standard market rates without checking.`,
      };
    }
  }
  return { concern: false, explanation: null, matched: null };
}
