// Deterministic, not an LLM judgment call -- a real matching signal
// (NAICS-code equality) is cheaper and more reliable than a model guess
// here. A suggestion requires an exact NAICS-code match AND active SAM
// registration; the registration gate exists because federal law requires
// an active registration to be awarded a federal contract at all --
// surfacing an opportunity to an unregistered client would be exactly the
// kind of paperwork-technicality failure this product exists to prevent.
export type MatchCandidate = {
  id: string;
  naics_codes: string[];
  sam_registration_status: string | null;
};

export function findBestMatchingClient(
  opportunityNaicsCode: string,
  clients: MatchCandidate[]
): { clientId: string; score: number } | null {
  const eligible = clients.filter(
    (c) => c.sam_registration_status === "active" && c.naics_codes.includes(opportunityNaicsCode)
  );
  if (eligible.length === 0) return null;
  // Tie-break: first-registered-in-the-list wins. This project has no
  // per-client "registered at" ordering signal available at this call
  // site yet; if the caller wants a different tie-break later (e.g.
  // fewest currently-assigned opportunities), that's an enhancement to
  // this function's input, not its matching logic.
  return { clientId: eligible[0].id, score: 1 };
}
