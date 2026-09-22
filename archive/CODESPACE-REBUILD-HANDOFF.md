# Session Handoff (2026-09-05)

Read `CLAUDE.md` first. Then this doc for what's actually done vs.
pending. **10 commits are local-only right now** (`ed394bc..e8637a6`) —
nothing below is on production yet, either code or database.

## Environment: dev server up, codespace idle-timeout is a real nuisance
Dev server runs fine (`npm run dev`, port 3000), env vars/Supabase links
already resolved. **This codespace keeps auto-stopping between exchanges**
(idle timeout) — each restart wipes the running dev server and resets
port 3000's forwarding back to private. If you hit a 404 on the forwarded
URL, check first whether the codespace and dev server are actually still
running before assuming anything else is wrong; re-run `npm run dev` and
`gh codespace ports visibility 3000:public --codespace <name>` after any
restart. Worth raising the idle-timeout setting at
github.com/settings/codespaces if this keeps interrupting real work.

## What's new this session (on top of the already-local `855c949`)

**Docs reconciled to the 2026-09-03→04 session's actual state**
(`8647d32`). That long session never did its planned final pass on
`PROJECT-STATUS.md`/`BUILD-ORDER-BIDPULSE.md` (noted in its own handoff).
Replaced both files with the versions that actually reflect what shipped:
the six-commits-local situation, the ambiguous-FK admin-inbox fix, the
login/reset-password dark-mode fix, and the (at-the-time-still-open)
client dashboard Preview/Download contradiction.

**The client dashboard Preview/Download investigation — got this wrong
once, then right.** Worth reading both halves since the wrong-then-right
sequence is itself the lesson:
- First pass (`536168f`): investigated by reading code only — confirmed
  `PacketButtons` is mounted with `viewerRole="client"` and live on
  `origin/main`, confirmed the auto-trigger's gating logic reads
  correctly. Closed it as "code confirmed correct, no bug found."
  **This was wrong** — reading code that looks correct isn't the same as
  running it, and nothing here was actually executed against a live
  session.
- Uploaded docs from a separate, later session (real dev testing: real
  client account, real Preview click, real DB reload) caught the actual
  bug: Preview/Download UI is genuinely fine, but `stage` never advances
  from `deliverables_ready` to `client_review` on a real client click.
- Investigated for real this time (`e8637a6`): built a disposable
  client + submission against the actual dev database, signed in for a
  real JWT, and issued the exact `UPDATE` the route performs. Result:
  `status 200, updateData: [], updateError: null` — PostgREST's
  signature for "RLS silently filtered this row out of the write," no
  error surfaced anywhere. Root cause:
  `close_submissions_broad_client_policy_gap.sql` (applied to dev this
  same week, for a real and unrelated reason — closing an attestation-
  bypass gap) dropped the only client `submissions` UPDATE policy broad
  enough to allow this write; the one remaining policy only permits
  UPDATE while `draft = true`, and `deliverables_ready` is inherently
  non-draft. Fixed using the exact pattern already established elsewhere
  in this codebase for the identical constraint
  (`generate-fit-check/route.ts`): keep the ownership/stage check on the
  caller's own RLS-scoped session, perform the already-validated write
  through the service role instead. **Verified the fix** with the same
  reproduction — the ownership check still correctly passes under the
  client's own session, and the write now genuinely succeeds.

## Migrations applied to `bidpulse-dev` only — NOT production
Same three as the prior handoff, still unapplied to prod:
`20260903161956_certification_verified_requires_document.sql`,
`20260904140124_add_attestation_tracking.sql`,
`20260904142743_close_submissions_broad_client_policy_gap.sql`. The
auto-trigger bug fixed this session only exists *because* the third one
is applied in dev — production doesn't have this RLS gap (or its fix)
yet either way, since neither the migration nor the code fix has shipped
there.

## Still genuinely open
- **Push everything to production** — 10 local commits + 3 migrations,
  in order. Single biggest remaining item; see `BUILD-ORDER-BIDPULSE.md`
  item #1.
- **Re-verify the auto-trigger fix against production** once pushed —
  this session's fix and verification are dev-only.
- Production's actual admin-inbox health — still never directly checked
  against `bidpulse-production` (no prod credentials available in this
  environment either session).
- The systemic dark-mode elevation issue on every other card/modal
  besides login/reset-password — flagged, not fixed, out of scope again
  this session.
- Inbound bid email pipeline — code done, blocked on Mike's IONOS/Gmail/
  Apps Script setup.

## Uncommitted / local-only
Nothing — working tree is clean, everything this session is committed.
