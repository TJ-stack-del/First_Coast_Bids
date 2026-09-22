import "server-only";

import { createRemoteJWKSet, jwtVerify } from "jose";

const ISSUER = "https://token.actions.githubusercontent.com";
// www.firstcoastbids.com is the confirmed-canonical URL (real curl test,
// 2026-09-22: HTTP 200, no redirect; the bare domain 308-redirects to this
// one, which would break the JWT audience match even though it's fine for
// a browser). bidpulse.co is being fully decommissioned (30-day sunset).
// Must match .github/workflows/process-stage-email-outbox.yml's
// OIDC_AUDIENCE exactly -- these two are independently maintained strings
// with no shared source of truth, so a change to one without the other
// silently breaks the outbox cron's auth the same way the repo-rename bug
// below did.
const AUDIENCE = "https://www.firstcoastbids.com/api/process-stage-email-outbox";
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

