import "server-only";

import { createRemoteJWKSet, jwtVerify } from "jose";

const ISSUER = "https://token.actions.githubusercontent.com";
// TODO(domain-cutover): AUDIENCE still targets bidpulse.co, which is being
// fully decommissioned (30-day sunset, no longer owned after that) -- must
// move to the confirmed-canonical firstcoastbids.com URL (the one that
// actually serves with no redirect) before that domain lapses, in lockstep
// with .github/workflows/process-stage-email-outbox.yml's OIDC_AUDIENCE
// (these two must match exactly or the JWT audience check fails). Not
// changed yet as of this pass because which of www.firstcoastbids.com /
// firstcoastbids.com serves without a redirect wasn't confirmed live.
const AUDIENCE = "https://bidpulse.co/api/process-stage-email-outbox";
// Real incident: this and WORKFLOW_REF below hardcoded the pre-rename repo
// slug ("TJ-stack-del/Bidpulse") -- GitHub's OIDC token claims reflect the
// *current* repo name at request time, so once the repo was renamed to
// First_Coast_Bids, payload.repository/workflow_ref stopped matching these
// constants and the scheduled outbox cron's OIDC auth started failing
// silently (no error surfaced anywhere but a Vercel function log). Fixed
// here; if the repo is ever renamed again, update these two in the same
// commit as the rename, not as an afterthought.
const REPOSITORY = "TJ-stack-del/First_Coast_Bids";
const REF = "refs/heads/main";
const WORKFLOW_REF =
  "TJ-stack-del/First_Coast_Bids/.github/workflows/process-stage-email-outbox.yml@refs/heads/main";
const ALLOWED_EVENTS = new Set(["schedule", "workflow_dispatch"]);

const githubKeys = createRemoteJWKSet(
  new URL(`${ISSUER}/.well-known/jwks`)
);

export async function isTrustedOutboxSchedulerToken(
  token: string
): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, githubKeys, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });

    return (
      payload.repository === REPOSITORY &&
      payload.ref === REF &&
      payload.workflow_ref === WORKFLOW_REF &&
      typeof payload.event_name === "string" &&
      ALLOWED_EVENTS.has(payload.event_name)
    );
  } catch {
    return false;
  }
}

