import { isSamRegistrationExpiringSoon } from "./expiration-warning.ts";

// The single place that turns a client's raw SAM.gov registration fields
// into one user-facing message. Previously these were two independently
// evaluated conditionals inlined in app/dashboard/page.tsx (an "expiring
// soon" check and a separate "not active" check) that weren't mutually
// exclusive -- a client whose status was non-"active" for a reason other
// than expiration (e.g. suspended) while sam_registration_expires_at still
// happened to fall inside the 30-day window could trip both at once,
// stacking "expires in N days, renew" directly above "is not active, won't
// be matched" -- self-contradictory copy on the same profile card.
//
// "Not active" is deliberately checked first and returned alone when true:
// "expiring soon" only makes sense as its own, less urgent message when
// the registration IS currently active (about to stop being true), not
// when it's already false for some other reason. This also gives the
// design doc's anticipated second consumer (gating federal-opportunity
// matching on this same status) one function to call instead of
// reimplementing this branching a third time.
export function getSamStatusMessage(client: {
  sam_uei: string | null;
  sam_registration_status: string | null;
  sam_registration_expires_at: string | null;
}): string | null {
  if (!client.sam_uei) return null;

  if (client.sam_registration_status && client.sam_registration_status !== "active") {
    return "Your SAM.gov registration is not active — you won't be matched to federal opportunities until it's renewed at sam.gov.";
  }

  if (isSamRegistrationExpiringSoon(client.sam_registration_expires_at)) {
    return `Your SAM.gov registration expires ${client.sam_registration_expires_at} — renew it at sam.gov to stay eligible for federal opportunities.`;
  }

  return null;
}
