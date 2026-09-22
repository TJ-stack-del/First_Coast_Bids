# BidPulse (now First Coast Bids) — Project Status & Handoff

Read this first in any new conversation about this project. It captures
decisions, context, and pending work that isn't visible just from reading
the code. **This is the one current status/handoff doc** — see "Related
docs" near the bottom for what else exists and why.

## What this project is
A done-for-you government bid prep service for small local trade contractors
(janitorial, HVAC, landscaping) in the Jacksonville, FL area. Contractor
submits bid info through an intake wizard; a real admin/team member prepares
the actual deliverables (capability statement, compliance matrix, technical
narrative) using AI-assisted drafting, then the client pays and downloads
the package. Full current product/brand spec: `PRODUCT.md`; full current
visual design system: `DESIGN.md` — both more authoritative than this
file for product positioning, pricing language, and brand identity.

**Renamed from "BidPulse" to "First Coast Bids," 2026-09-19 (commit
`730c36c`) — this is real and complete in the app, not proposed.** Per
`PRODUCT.md`'s own changelog: "the full rebrand across marketing pages,
admin/dashboard UI, wordmark, PDF packet footer, email sender name, OG
image, and PWA manifest is complete." New identity: navy (#0C2D52) + gold
(#C19349), full detail in `DESIGN.md`. **Still using the old name / not yet
migrated:** the production domain (`bidpulse.co`), the GitHub repo/URL
itself, `package.json`'s internal `"name"` field (still `"bidpulse"`), and
two already-rendered launch videos — all deliberately separate,
not-yet-executed follow-ups per `PRODUCT.md`. The earlier trademark
question that originally motivated reconsidering the name (a different
ad-tech company already using "BidPulse") is effectively moot now that the
product itself is renamed — see the old note preserved under Business/
Naming Note below.

**Stack:** Next.js 15 (App Router, TypeScript), Tailwind, Supabase
(Postgres + Auth + Storage), Vercel (now deployed at bidpulse-nine.vercel.app,
production domain still `bidpulse.co`). GitHub Codespaces for development.

**Deploy status (2026-09-22, doc-consolidation pass — supersedes every
entry below, which are stale and should not be trusted as current):**
This file had not been substantively updated since ~2026-09-16 (see the
Package Pricing section's own date) until this pass, despite `origin/main`
moving **277 commits** past the `fb688a4` reference point the 2026-09-09
entry below describes, to `8b4297f` as of this writing. **None of the
work below this note has been independently re-verified against
production the way this file's own evidence standard requires** — it's a
`git log`-derived survey done to stop this file actively misleading
whoever reads it next, not a replacement for real verification. Real,
confirmed-via-git developments since the last update that this file
doesn't mention anywhere else:
- The First Coast Bids rename (above).
- `4e5e42f` **removed dark mode site-wide, light-only going forward** —
  directly contradicts every dark-mode note elsewhere in this file (the
  "systemic dark-mode elevation bug" entry under Confirmed Working, for
  instance); those entries are now moot, not current.
- Real starting prices now published (contradicts the "Package Pricing…
  deliberately not published" note further down — check that section's
  own currency before trusting it).
- A structurally distinct Retainer signup flow with tier auto-detection.
- SAM.gov integration: opportunity-sourcing (a new `matched_opportunities`
  producer alongside the JAA scraper and inbound-email pipeline),
  deterministic NAICS-overlap match scoring/suggestions surfaced in the
  admin matches screen, and a daily SAM.gov registration-status check
  cron warning clients about expiring registrations. Two design/plan docs
  exist for this: `docs/superpowers/specs/2026-09-20-sam-gov-adoption-design.md`
  and the two `docs/superpowers/plans/2026-09-20-sam-*.md` files.
  Genuinely new schema (SAM.gov UEI + registration columns on `clients`).
- A scheduled, encrypted database backup GitHub Actions workflow — likely
  closes Currently Open item #7 (Backup/disaster-recovery plan) below;
  **not confirmed working**, worth a real verification pass before
  striking that item.
- The City of Jacksonville Beach scraper (a fourth scraper alongside
  JAA/JEA/Atlantic Beach), added in the very latest commit (`8b4297f`).
- The RFP-extraction Python module now lives at `rfp-extractor/` (package
  `bidpulse_rfp_extractor`), **not** `rfp-extraction/` as several entries
  below still say — it was rebuilt from scratch under a different PR
  (`f1413a2` and later commits) after this file's own Phase 1+2 work
  (under the old `rfp-extraction/` path) never made it into `main`. The
  new module independently covers Phase 1 (admin-field extraction) and
  Phase 2 (section segmentation — `rfp-extractor/evidence/phase2/`) with
  its own evidence and its own bug list; see its `README.md` and
  `evidence/README.md`/`evidence/phase2/README.md` rather than the
  Phase 1/2 narrative later in this file, which describes a different,
  no-longer-existing implementation of the same two phases. Every
  `rfp-extraction/` path reference below is corrected in-place to
  `rfp-extractor/` with a note; the narrative (what bugs were found, why
  design decisions were made) is left as real history.
- **Three small, single-commit branches sitting open, unmerged, each one
  commit ahead of `main`:** `fix/transactional-stage-transitions` ("Make
  submission stage transitions atomic"), `fix/durable-stage-email-outbox`
  ("Make stage email delivery durable"), `feat/outbox-15-minute-retries`
  ("Run outbox retries every 15 minutes") — read together, these look
  like a deliberate small series hardening the stage-change email/outbox
  path against partial failure. Not reviewed in depth this pass; worth
  checking whether they're still wanted or already superseded before
  either merging or closing them.
- The `HANDOFF-2026-09-10.md` file this doc cites below (in the item
  about the 19-commit push) does not exist anywhere in this repo's
  history on any branch — a dead reference, not a hidden file; don't go
  looking for it.

*(Earlier entries below, kept for history — none describe current
reality; each is now stale on top of the last):*

**Deploy status (2026-09-15, updated — supersedes the 2026-09-09 entry
below, which is stale and should not be trusted):** `origin/main` and
local `main` are in sync at `3c2f63f`, confirmed live on
`bidpulse.co` (real `curl` checks against the production domain, not
just a Vercel dashboard status). The 19-commit gap and parallel-
cloud-session risk described in the paragraph below this one were both
resolved at some point between 2026-09-09 and now (untracked by which
session/commit) — the redesign, Past Performance, RFP extraction
Phase 1/2, and scraper rewrite this entry originally warned about are
all confirmed merged into current `main`. Get a fresh `git log
origin/main..HEAD --oneline | wc -l` before trusting "in sync" as
still true — this drifts fast. Vercel auto-deploy from Git is
confirmed still working as of 2026-09-15 (real push → real new
Production deployment observed via `vercel ls`, `Ready` in ~40s, live
site verified with `curl` afterward).

*(Original 2026-09-09 entry, kept for history — no longer describes
current reality, see above):* `origin/main` was at `fb688a4`, local
`main` was 19 commits ahead at `58a3279`, unpushed. A separate cloud
Claude Code session was also working on this same repo with its own
unpushed redesign work — a live divergence risk pending Mike's
decision on which checkout was authoritative. Neither condition holds
today.

**Recurring lesson, 2026-09-15:** a *second*, independent instance of
this exact "code deployed, migrations weren't" gap was found and
fixed this session — 5 migrations (the bid-estimation-facts cache and
all 4 Compliance Vault schema migrations) were live in application
code on `bidpulse-production` for days with their backing schema never
applied there, silently breaking the Compliance Vault page for every
real client who clicked the nav tab. Caught only by deliberately
running `supabase migration list` against the *actual* linked
production project (confirmed via the live site's own served JS
embedding `rixsgnbivayeaxbdseij`, not trusted from `.env.local` — see
`CLAUDE.md`'s existing rule on this). Fixed via `supabase db push`
against production, verified with real REST calls against every
affected table (see Confirmed Working). **This is now the second time
this exact class of gap has bitten this project** (see the first
instance elsewhere in this file, `client_past_performance`) — pushing
app code to `origin/main` does not imply the migrations it depends on
are live anywhere except whichever Supabase project was linked at
`db push` time. Worth treating "push code" and "push migrations" as
two separate, both-required steps in any future deploy checklist,
not one bundled mental step.

## How schema changes get made now
As of 2026-08-31, all schema changes go through Supabase CLI migrations —
`npx supabase migration new <name>`, edit the generated file under
`supabase/migrations/`, then `npx supabase db push`. Never edit the schema
freehand in the Supabase dashboard's SQL editor — that's what caused
`schema.sql` to drift from the live database in the first place (four orphan
tables lingering with no tracked history). `schema.sql` is a generated
reference now (`npx supabase db dump --schema public`), not hand-maintained —
regenerate it after every migration and commit the diff, never edit it
directly.

## Currently Open — Needs Action
Everything below is genuinely unresolved. Anything not listed here is
either fully closed (see Confirmed Working) or a deliberate, decided
non-action (see Known Issues / Recently Fixed, which includes real
"investigated and decided not to build" entries, not just bug fixes).

**⚠️ URGENT, hard deadline — `bidpulse.co` will no longer belong to
Mike in 30 days from 2026-09-22 (i.e. by ~2026-10-22) and must be fully
disassociated before then, not just partially migrated.** Once the
domain lapses, anything still pointed at it either breaks outright or —
worse — could be silently caught by whoever registers it next (auth
redirect links, webhook calls). Status as of this pass:
- **Done in code, this pass:** the Resend sender address
  (`lib/email/send.ts`, confirmed verified in Resend), `metadataBase`/OG
  image (`app/layout.tsx`), the admin-facing contact-form copy
  (`AdminGuide.tsx`), the inbound-bid-email docs/script
  (`scripts/README.md`, `scripts/gmail-inbound-bid-trigger.gs` — now
  reference `bids@firstcoastbids.com`, confirmed same IONOS account),
  and the local dev Supabase SMTP config (`supabase/config.toml`).
- **Also fixed this pass, a separate but related bug the GitHub repo
  rename surfaced:** `lib/auth/github-actions-oidc.ts` hardcoded the
  pre-rename repo slug (`TJ-stack-del/Bidpulse`) — GitHub's OIDC token
  claims reflect the *current* repo name, so this was silently failing
  the scheduled stage-email-outbox cron's auth check since the rename.
  Fixed to `TJ-stack-del/First_Coast_Bids`.
- **Also done, this pass:** the OIDC `AUDIENCE` constant (same file) and
  `.github/workflows/process-stage-email-outbox.yml`'s matching
  `OIDC_AUDIENCE` — both moved to `https://www.firstcoastbids.com/api/
  process-stage-email-outbox`, confirmed the correct one via a real
  `curl -sI` test (`www.` returns 200 with no redirect; the bare domain
  308-redirects to it, which would have broken the exact-match audience
  check). **Not independently verified against a real triggered cron
  run** — worth confirming the next scheduled run (`7,22,37,52 * * * *`)
  actually succeeds once this is deployed, not just that the values
  look right.
- **Done, 2026-09-22, via the Supabase dashboard directly (previously
  the single highest-risk item here):** `bidpulse-production`'s Site URL
  moved from `https://bidpulse.co` to `https://www.firstcoastbids.com`
  (the old `bidpulse.co` Redirect URL entry deliberately left in place
  alongside the new one, as a safety net until closer to the deadline).
  `bidpulse-dev` turned out to have zero `bidpulse.co` references at
  all — but while checking it, found and fixed a separate, real drift
  from `CLAUDE.md`'s own documented fix: dev's Site URL had drifted to
  one specific Codespace's temporary forwarded URL (would have broken
  again the next time that Codespace got rebuilt) instead of the stable
  `http://localhost:3000` fallback the incident write-up calls for —
  reset to `http://localhost:3000`. Also removed a stray
  `https://bidpulse-nine.vercel.app/**` entry from dev's Redirect
  URLs — the production Vercel alias had no business being on dev's
  allow-list, the same cross-wiring shape that caused the original
  dev→production misdirect incident. **Not yet independently verified**
  with a real password-reset/magic-link click-through on either
  project — worth doing before fully trusting this is closed.
- **Also not yet done:** removing `bidpulse.co` as an assigned domain in
  Vercel (safe to leave until closer to the deadline, but shouldn't be
  the *last* thing checked — do it with enough runway to catch any
  fallout), and a check of anywhere outside this repo entirely
  (Google Business Profile, social accounts, business cards, USPTO/
  trademark filings if any exist) that might still list `bidpulse.co`.

1. **Four SECURITY DEFINER functions still directly callable via
   `/rest/v1/rpc/<name>` by anon and authenticated — deliberately not
   locked down yet.** Supabase's own security linter flags `is_admin`,
   `is_own_client_record`, `can_access_client_object`, and
   `can_access_rfp_object` (2026-09-12 pass). Verified each is
   genuinely wired into real, active RLS policies (organizations,
   client_past_performance, submissions drafts, storage.objects for
   rfp-documents) — revoking EXECUTE from `authenticated` would break
   those policies for every real signed-in user, since Postgres
   requires the querying role to hold EXECUTE on any function a policy
   it triggers references, regardless of that function's own SECURITY
   DEFINER status. The real fix (moving them to a schema PostgREST
   doesn't expose, then updating every policy that references them by
   name) needs its own dedicated migration and testing pass, not a
   same-session blind revoke. Actual risk today is low regardless: each
   only returns a boolean about the caller's own access to a specific,
   already-known resource (their own org/client/submission), no cross-
   user data exposure. Two sibling functions with zero real usage
   anywhere (`is_org_member`, `org_has_admin`) were the safe subset and
   are now fully locked down (see Confirmed Working).

2. **Leaked Password Protection — CORRECTED, 2026-09-22: this is
   Supabase Pro-plan-gated, not a free toggle as originally logged
   here.** Checked directly in the dashboard (Authentication → Sign In
   / Providers → Email → "Prevent use of leaked passwords"): the switch
   is already ON in both `bidpulse-dev` and `bidpulse-production`, but
   the org (`TJ-stack-del's Org`) is on Supabase's **Free** plan, and
   the setting's own description says "Only available on Pro plan and
   above." Confirmed directly (tried to enable it, blocked pending a
   Pro upgrade) — so despite showing enabled, this is very likely a
   no-op on the current plan, not real protection. **Real status: not
   actually available without upgrading to Supabase Pro** — a pricing/
   plan decision for Mike, not something left undone by neglect. Leave
   the switch on (harmless, and it'll activate automatically if the
   org ever upgrades) but don't count this as closed.

3. **Compliance checklist auto-population from completeness signals —
   deliberately not built yet.** Needs its own schema migration (a
   `source` column on `checklist_items`, to distinguish an auto-
   generated item from an admin-created one) — deliberately not stacked
   behind other pending migrations during a session with real
   migration-permission friction. Needs a real design pass: rules for
   when an auto-item should be marked done or removed once the client
   fills the corresponding field.

4. **Retainer package usage tracking.** No schema yet — needs a
   usage-count field or derived query against `submissions`/`packages`,
   plus a decision on how resets are timed (calendar month vs. rolling
   30 days). Explicitly deferred until there's a real retainer client to
   test against.

5. **Inbound bid email pipeline — code built and verified, blocked on
   Mike's own setup.** `app/api/inbound-bid-email/route.ts` is done and
   verified (real extraction calls, direct DB read-backs). Not yet live
   — needs Mike's IONOS/Gmail forwarding rule, label/filter, and Apps
   Script trigger set up per `scripts/README.md`, plus the real
   `INBOUND_BID_EMAIL_SECRET` in Vercel's **production** environment.

6. **Golden-set regression check for the "never invent facts"
   guarantee — needs real design time, not a quick add.** LLM outputs
   are non-deterministic, so a literal diff-against-expected-text script
   would be fragile and fail on harmless wording variation, not just
   genuine fabrication. Needs a *structural* check instead (does an
   expected fact appear, does an expected null/placeholder stay a
   placeholder, does anything appear that wasn't in the source input),
   which is a real script-design decision plus real API cost to run
   repeatedly. Existing fixtures in `test-fixtures/` are a reasonable
   starting point.

7. **Backup/disaster-recovery plan — Mike's own check, not a code
   task.** Log into the Supabase dashboard for `bidpulse-production` →
   Settings → Backups, confirm what's actually available on the current
   plan tier, decide whether to upgrade given real client data now
   exists. If manual-only, a free DIY option remains available (a
   scheduled GitHub Action running `supabase db dump`, storing the
   result in a private repo) without requiring a plan upgrade.

8. **Error monitoring and alerting — needs Mike to create a Sentry
   account first.** Sign up at sentry.io, choose Next.js, get a DSN
   key, hand it to a future session to wire in `@sentry/nextjs`. Not a
   code task until the DSN exists.

9. **`client_reported_submitted_at` column — minor schema-tidiness
   item, not blocking anything.** Kept on `submissions` by Mike's
   explicit call even though the client-facing "I've submitted this"
   button itself was removed. A drop migration was written and
   verified safe but paused rather than pushed same-session. Nothing
   in the app reads or writes it either way.

10. **Admin UI toggle for `is_test` — built, one click-through
   verification still needed.** Real finding while setting up a
   disposable test client to verify a production fix: nothing in the
   app ever wrote `is_test: true` anywhere, including the intake
   wizard — every instance had been a direct database edit. Built a new
   toggle on the admin submission detail page's Status panel (same
   pattern as the existing estimated-value control), writing directly
   to `submissions.is_test` — already covered by existing RLS, no
   migration needed. Replaces the old read-only "TEST" label in the
   same spot. `tsc --noEmit` and `next build` both clean. **Not yet
   verified:** an actual admin click-through (real login, click the
   toggle, confirm the DB write) — worth doing before calling this
   fully closed.

11. **jsPDF major-version upgrade (2026-09-11 npm audit) — deliberately
   deferred, not a code task right now.** `npm audit` flags jsPDF as
   critical / jspdf-autotable as high — the fix requires jsPDF 2→4 and
   jspdf-autotable 3→5, both major-version bumps into the exact files
   that generate this app's real client-facing deliverable PDFs
   (`lib/pdf/deliverables-packet.ts`, `lib/pdf/bid-packet.ts`).
   Individually checked every constituent CVE (not just trusted the
   severity label): all of them require a specific jsPDF method this
   app never calls — `addImage`, `.html()`, `addFont`, `addSvgAsImage`,
   `addJS`, `AcroForm*`, `link`/`textWithLink`, `addMetadata`. Grepped
   every `doc.*` call site in both files: only plain text/table/shape
   primitives (`text`, `setFont`, `rect`, `line`, `autoTable`, etc.) are
   actually used. Real risk today: low. Real residual risk: a future
   change could add a call to one of those methods without whoever
   writes it knowing this history — worth a deliberate major-version
   upgrade (with its own real testing pass against the actual generated
   PDFs) at some point, not an emergency. The two other CVEs in the same
   audit pass (dompurify, postcss) were fixed for real via `overrides`
   without any breaking bump — see the `fix:` commit from this date.

12. **"Sign in with Google" — deliberately deferred, Mike's own call.**
    Investigated 2026-09-12 after Mike noticed the toggle already sitting
    in `bidpulse-dev`'s Auth providers panel (unconfigured, no Client
    ID/Secret). Scoped to "existing accounts only" (not a new-signup
    path) — the app's existing "no account found" fallback on the root
    page already handles a Google identity with no matching
    clients/team_members row correctly, no new code needed for that
    case. Not built: Google Cloud's OAuth product has its own real
    per-verification/per-user-volume fee tier, and Mike wants to wait
    until client intake volume actually justifies it before setting up
    the Google Cloud project, OAuth consent screen, and Client ID/Secret
    (all steps only Mike can do, outside this codebase). When it's
    time: register both `https://hvrwxcyqgjobrgpcequj.supabase.co/auth/v1/callback`
    and `https://rixsgnbivayeaxbdseij.supabase.co/auth/v1/callback` as
    authorized redirect URIs on one Google OAuth Client (both dev and
    production can share the same Client ID/Secret), paste into each
    Supabase project's Google provider panel, then the actual "Sign in
    with Google" button + `supabase.auth.signInWithOAuth({ provider:
    "google" })` wiring into LoginForm.tsx is a small, well-scoped
    follow-up.

13. **19 local commits, push/deploy/migrations — CLOSED 2026-09-11,
    including a real production-only bug found and fixed along the
    way.** All 19 commits merged with the other session's work and
    pushed (`f1413a2..14f8688`, see `HANDOFF-2026-09-10.md`); Vercel
    confirmed serving the merged commit at `bidpulse.co`. Migration
    verification took real digging: this checkout's `.env.local` turned
    out to point at **`bidpulse-dev`** (`hvrwxcyqgjobrgpcequj`), not the
    project `bidpulse.co` actually runs on
    (**`bidpulse-production`**, `rixsgnbivayeaxbdseij`) — see `CLAUDE.md`
    for the full rule this incident produced. Once checked against the
    real project via an authenticated `supabase migration list`, every
    migration *except* `client_past_performance`
    (`20260908130300_add_client_past_performance.sql`) was already
    applied. That migration's earlier "applied directly against
    production via the dashboard SQL editor" note (previously logged
    right here) was almost certainly against the wrong project too —
    same root confusion. Fixing it for real surfaced a second, real bug:
    the table already existed in `bidpulse-production` (confirmed once
    `db push --include-all` hit `relation already exists`), but
    PostgREST's schema cache didn't know about it
    (`PGRST205` on a real `GET` against the table), meaning **every real
    request touching Past Performance had been silently failing in
    production** until a manual `NOTIFY pgrst, 'reload schema';` fixed
    it. Migration bookkeeping repaired via `supabase migration repair
    --status applied 20260908130300 --linked`. Verified end-to-end: a
    real disposable-fixture Playwright test against dev confirmed the
    `advance-if-deliverables-complete` placeholder guard works both
    directions (blocks on a leftover `[ADD: ...]` bracket, advances to
    `deliverables_ready` once clean, DB read-back confirmed the stage
    change), and `supabase migration list` against
    `bidpulse-production` now shows all 25 migrations with local ==
    remote, zero mismatches. `schema.sql` regeneration against the real
    production project is still outstanding — do that next, not from
    dev.

14. **CI workflow exists but needs Mike to add secrets before it
    actually runs — carried over from `BUILD-ORDER-BIDPULSE.md`
    (archived, folded in here).** `.github/workflows/ci.yml` (type
    check + build on every push to `main` and every PR, dev-project
    secrets only) was added and is otherwise ready. Needs Mike to add
    the required secrets under repo Settings → Secrets and variables →
    Actions before it runs for real — unconfirmed whether this has
    happened since the workflow was added.

15. **Three small, single-commit branches sitting open on GitHub,
    unmerged — see the 2026-09-22 Deploy status note at the top of
    this file for the actual branch names/commit messages.** Not
    reviewed in depth; worth deciding whether to merge or close them.

16. **Full reconciliation pass against `origin/main`'s actual current
    state (as of `8b4297f`, 2026-09-22) — not done yet, only surveyed
    via `git log`.** The 277-commits-of-drift note at the top of this
    file lists what's known to exist but none of it has been verified
    the way this file's own standard requires (real requests, real DB
    reads, screenshots). Next session's first real task on this repo
    should probably be closing that gap before adding more new work on
    top of an unverified base.

### Business decisions (Mike's, not code tasks)
- **Pricing as a deliberate throttle** — raising prices to intentionally
  slow growth while building capacity is a legitimate strategy some
  service businesses use on purpose. Not implementable; just worth
  having as a real, considered option.
- **Hiring a part-time first-pass reviewer** — the real long-term fix
  for the admin review bottleneck once volume justifies it: someone else
  runs `Admin-Review-Rubric.md` as a first pass, escalating only
  ambiguous or judgment-heavy cases. Not a code task; a hiring decision
  to make when the numbers justify it.

### Process habits (no artifact needed)
- **Batch similar review work** — reviewing several capability
  statements back-to-back is faster per-document than context-switching
  between clients and deliverable types all day. Free, no code required,
  just a habit worth deliberately trying.


## Confirmed Working (tested with real evidence, not just "reported done")
- **Consolidated admin communication surfaces — done and verified,
  carried over from `BUILD-ORDER-BIDPULSE.md` (archived, folded in
  here) since it was missing from this file entirely.**
  `RequestInfoForm.tsx` shows a picker of the submission's open
  checklist items (plus "Other" for anything not yet tracked);
  selecting one pre-fills a second-person request built from that
  item's own label, sends the notification tied to it, and marks it
  `in_progress` instead of creating a duplicate row. "Other" still
  creates a new checklist item exactly as before. Verified against the
  real dev server and database: the existing-item path updates in
  place, the "Other" path still creates a genuinely new row.
- **Compliance & Licensing Vault Phases 1-5 and 7 shipped and live —
  CLOSED 2026-09-15.** Phases 1-4 (trade licenses, structured insurance/
  bonding, RFP-boilerplate document library, past performance + hybrid
  USASpending.gov federal-award check) plus the page split and two
  review-driven cleanup passes were already committed from earlier
  sessions. This session added Phase 5 (a derived readiness score +
  expiring-soon banner, `lib/compliance/readiness-score.ts` /
  `expiring-soon.ts`) and Phase 7 (an authenticated `/api/compliance/
  export` route zipping every verified document + the document library
  into one download, using `archiver` 8.x's `ZipArchive` class — its
  older docs' factory-function API no longer exists in that version).
  Phase 6 (public share-link + QR code) was explicitly skipped per
  direct instruction — the plan at
  `/home/codespace/.claude/plans/enchanted-greeting-twilight.md` still
  has its full spec if picked back up later. Both new phases were each
  independently run through an architecture review and a UX/UI review
  (fresh agents, not self-review); every should-fix finding was fixed
  and re-verified, not just logged — real bugs caught this way: a
  timezone off-by-one in expiration-date math (DATE columns parsed as
  UTC midnight instead of local calendar days), an already-expired
  document rendering identically to one merely expiring soon, a zip
  export that silently dropped failed files with zero indication
  (now a `MISSING_FILES.txt` manifest inside the zip itself), and an
  always-enabled export button guaranteed to 404 on a brand-new
  client's first click (now hidden until there's something real to
  export). Deployed and smoke-tested live on `bidpulse.co` — see the
  Deploy status note above this section for the separate production-
  migration gap this surfaced and fixed along the way.
- **Matched-opportunity notification email — CLOSED 2026-09-15.**
  `MatchesPanel.tsx`'s admin "assign this opportunity to a client"
  action already created a real draft submission but sent no email at
  all, to any client, active or lapsed — a real gap surfaced while
  working through how BidPulse should handle client offboarding/
  win-back (run through the `churn-prevention` and `emails` skills,
  translated against the actual business model: no subscription
  object exists anywhere in the schema, billing is manually invoiced,
  matching is admin-curated not automated). New
  `getMatchedOpportunityEmail()` template + `/api/notify-matched-
  opportunity` route, mirroring `notify-new-message`'s exact pattern.
  Deliberately one real, specific email tied to an actual admin action
  rather than an automated multi-email drip sequence. Offboarding-
  reason capture (the other half of that discussion) was scoped and
  explicitly deferred — no admin Clients page exists yet and
  `audit_log` has no `client_id` column, so it needs a real schema/UI
  decision once a real Retainer client actually churns to design it
  against (same call already made for Currently Open item #4).
- **Supabase security-linter findings verified and safely closed where
  possible — CLOSED 2026-09-12, applied to both dev and production.**
  `is_org_member` was the one function (of six similar SECURITY
  DEFINER helpers) missing a pinned `search_path` — confirmed by
  reading all six real definitions, not just trusting the lint label;
  fixed to match its siblings. Two of six functions flagged as
  publicly callable via `/rest/v1/rpc/<name>`
  (`is_org_member`, `org_has_admin`) were confirmed genuinely unused
  anywhere (grepped every migration's RLS policies and every app
  source file) and safely locked down. First attempt (revoking from
  `anon`/`authenticated` only) silently failed to do anything — real
  RPC calls against production still succeeded — because PostgreSQL
  grants `EXECUTE` to the `PUBLIC` pseudo-role by default at function
  creation and the original migration never revoked that; every real
  role inherits through it regardless of role-specific revokes. Fixed
  with an explicit `REVOKE ... FROM PUBLIC`, then re-verified with a
  real RPC call against production returning an actual
  `permission denied for function` error. The other four flagged
  functions were confirmed to have real RLS-policy dependencies and
  deliberately left unchanged (see Currently Open #1) rather than risk
  breaking production data access same-session. Verified end-to-end
  with disposable admin + client accounts on dev (full login,
  dashboard, admin inbox, settings — all real RLS paths through the
  *untouched* functions) before applying anything to production.
- **Auto-draft now pulls real requirements from the uploaded RFP —
  CLOSED 2026-09-11.** Root cause of the user's original complaint
  ("auto draft doesn't pull all items from the RFP that was loaded"):
  `generate-draft/route.ts` only ever read the client's short intake
  `scope` text and profile fields — it never read the actual RFP file
  uploaded via `SubmissionDocuments.tsx` (`submission_documents`,
  `document_type = 'rfp_file'`), even though the plumbing to do so
  (Anthropic client, `buildDocumentContent`, the private
  `rfp-documents` bucket) already existed from the intake-wizard
  auto-fill feature built earlier this session. New
  `lib/rfp-requirements.ts` extracts concrete, compliance-relevant
  requirements from the submission's uploaded RFP file(s) via Claude
  document understanding — grounded strictly in the document's own
  text, same never-fabricate rule as everything else this app
  generates — cached on new `submissions.rfp_requirements` /
  `rfp_requirements_extracted_at` columns
  (`20260911223430_add_rfp_requirements_cache.sql`), invalidated only
  when a newer `rfp_file` is uploaded. Wired into `generate-draft`'s
  `compliance_matrix` branch only — every other deliverable type and
  the no-RFP-file case are unchanged. Verified live against a real
  `is_test` fixture with an actual uploaded RFP PDF (Playwright +
  disposable admin account, both cleaned up after): the generated
  compliance matrix now includes correctly-cited real requirements
  (exact deadlines, dollar amounts, JSEB percentage, wage rates,
  required forms, evaluation point weights) that exist nowhere in the
  scope text. Confirmed the cache actually works (repeat call: ~400ms,
  not a fresh extraction) and the no-RFP-file fallback is byte-for-byte
  the same behavior as before (~400ms, no RFP rows). Also repaired
  `bidpulse-dev`'s migration bookkeeping for `client_past_performance`
  (`20260908130300`) along the way — same "table exists but was never
  recorded" gap already found and fixed on production, now closed on
  dev too — and regenerated `schema.sql`. **Applied to `bidpulse-dev`
  only; not yet pushed to `bidpulse-production`** — do that as a
  deliberate, separate step (see `CLAUDE.md`'s rule on verifying which
  project before touching production). `tsc --noEmit` and a clean
  `next build` both pass.
- **Systemic dark-mode elevation bug — CLOSED 2026-09-11, fixed
  everywhere, not just the login/reset-password cards.** Root cause:
  `surface-container-lowest`'s dark-mode value (52) is literally darker
  than plain `surface` (80) — the opposite of "elevated" — while the
  same token name is correctly the lightest tier in the light ramp (the
  two ramps were authored independently against separate Stitch design
  passes and ended up structurally inverted between themes). Applied
  the `dark:bg-surface-container-low` override (the pattern already
  used for login/reset-password) to every remaining card/modal across
  24 files, including `ConfirmDeleteDialog.tsx` specifically. Also
  fixed a second-order issue the blanket fix would otherwise have
  introduced: several elements nest a plain `bg-surface-container-low`
  directly inside a container now overridden to `dark:...-low` — table
  theads, status badges, hover states, and `SubmissionCard`'s inner
  detail boxes all got bumped one tier further
  (`dark:bg-surface-container`) to preserve the same nesting
  distinction in dark mode that already existed correctly in light
  mode. Verified with real dark-mode screenshots (pricing and gallery
  pages) and a real authenticated admin session triggering
  `ConfirmDeleteDialog` — both show correct elevation now, not just a
  passing build. `tsc --noEmit` and `next build` both clean.
- **Landing page "Trades we work with" copy fix — built and verified.**
  Added honest copy below the trade grid (`app/page.tsx`): "We're
  deepest in these four — but if you're in a related trade, go ahead
  and start your bid. You'll get an honest heads-up right away if
  something's outside our sweet spot," with the real tradeoff stated
  plainly (less tailored compliance guidance outside the four, told up
  front) — plus a small secondary "Contact us" link for anyone who wants
  an answer before committing to intake. Points at `/intake` as the
  primary path, not a contact form, per the decided approach. Did not
  touch `TRADES`, `KNOWN_TRADES`, or `assertNoMissingTradeCards()` — this
  is additive copy only. Also lightly clarified the existing intake-time
  trade-coverage heads-up on the dashboard (`app/dashboard/page.tsx`) —
  the prior wording ("We'll flag that for you when it's ready") had an
  ambiguous referent; reworded for clarity without changing its warm,
  non-alarming tone. The compliance-matrix deliverable's own version of
  this note (`generate-draft/route.ts`) was reviewed and already reads
  clearly — left unchanged. Verified with a real screenshot of the
  updated section at a genuine desktop viewport, and confirmed both
  `/intake` and `/contact` resolve (200). `next build` succeeded,
  confirming the trade-card drift check wasn't weakened.
- **RFP-document field extraction — built and verified against
  deliberately adversarial multi-date test cases.** The backend route
  (`app/api/extract-from-document/route.ts`) already existed, built in
  an early commit (`1609c2a`) for exactly this purpose, but had **zero
  UI callers** anywhere in the app — the real gap was integration, not a
  missing extraction pipeline. Built `RfpDocumentUpload.tsx` (mirrors
  `CompanyProfileUpload.tsx`'s upload/error-handling pattern exactly) and
  wired it into the intake wizard's "About the bid" step as an
  interstitial upload-first micro-step, matching the company-info
  precedent — skippable, never invents a field it can't find. Also
  hardened the due-date extraction prompt specifically, since that was
  the one flagged serious-risk area: it now explicitly names the decoy
  dates real solicitations contain (site visit, Q&A deadline, pre-bid
  conference, amendment deadlines) and instructs the model to return
  `null` rather than guess when it can't clearly identify the actual
  submission deadline. Verified directly against the live route with
  three adversarial synthetic solicitations (a disposable auth user, a
  real HTTP POST, not a simplified proxy): a document with 5 distinct
  dates correctly extracted only the explicitly-labeled submission
  deadline; a harder case requiring cross-referencing a "bid opening"
  date named in prose against a separate schedule list above it also
  resolved correctly; a genuinely ambiguous document with no real
  due date (only unrelated budget/fiscal dates) correctly returned
  `null` rather than guessing. `tsc --noEmit` and `next build` both
  clean.
- **Intake confirmation screen fit badge + desktop width — CLOSED, fully
  verified with a real browser click-through.** Built earlier this
  session (completeness percentage replacing the old fit badge, desktop
  width fix); the browser verification flagged as outstanding is now
  done. Real Playwright session: signed up a disposable client, skipped
  both upload interstitials, filled "About the bid," submitted with both
  attestation checkboxes checked, reached the real confirmation screen.
  Confirmed via the actual rendered page (not just querying the DB):
  "Profile 0% complete" badge renders correctly (this client had no
  profile filled in), no trace of the old "Strong fit"/"Moderate
  fit"/"Worth a second look" badge text anywhere on the page. Measured
  the real rendered `<main>` bounding box directly: 768px wide at a
  1440px desktop viewport (the new `md:max-w-3xl`, up from the old
  672px), and correctly full-width (390px) at a 390px mobile viewport —
  confirms the fix applies on desktop without regressing mobile. Real
  screenshots taken at both sizes. Disposable client, submission, and
  auth user deleted afterward and confirmed gone.
- **Law enforcement/detention agency-type gap — CLOSED, built and
  verified.** Confirmed directly before building:
  `TRADE_SPECIFIC_CERTIFICATIONS`' bloodborne-pathogen/PREA rows already
  trigger correctly off scope text, so compliance-matrix behavior was
  already fine — deliberately left untouched. What was actually
  missing: a `detention` `AgencyType` in `lib/agency-type.ts` (matches
  sheriff's office/correctional/jail/detention/police department in the
  agency name — "police" alone deliberately excluded to avoid over-
  matching routine city-agency mentions), plus the equivalent softer
  fit-check note matching the existing airport/school/transit/VA
  pattern. Verified with 5 real test cases including two negative
  controls (confirmed no over-matching); `tsc --noEmit` and
  `next build` both clean.
- **Push/deploy fully reconciled across two same-day sessions,
  2026-09-05 — corrected commit count and final verified state.** Real
  count: 12 commits pushed to `origin/main` (`acea384..abdfa9f`, plus a
  later `is_test`-investigation commit), not 8 as an earlier same-day
  checkpoint reported — the 8-count was accurate at the moment it was
  taken, but a second session added 4 more (the CI workflow, the
  regression-check script, the request-info consolidation, the
  pre-flight summary) before the final push. All pending migrations
  applied to `bidpulse-production` and verified via `supabase migration
  list` (local == remote for every one), `schema.sql` regenerated to
  match. Vercel auto-deploy from Git confirmed genuinely working via a
  real empirical test (a harmless commit produced an automatic
  deployment, no manual `vercel --prod` needed) — see the Git-
  integration correction below for the full story of how that got
  settled.
- **Intake document-upload reorder — investigated, real architectural
  reason found, decided not to build.** The ask (show the upload prompt
  right after company name, before any other field) runs into a genuine
  constraint: the extraction route's auth requirement (a deliberate
  anti-abuse gate on a paid AI endpoint) means an account must exist
  first, which requires `signUp()` (email/phone + password) and the
  `clients` row insert (`company_name` + `contact_name`, both `NOT
  NULL`) — meaning today's 4 fields are already the practical minimum
  before the upload gate can exist at all. Honoring the literal ask
  would require either a schema change (nullable `contact_name`) or
  reopening the anti-abuse gate — neither judged worth it. Mike's call:
  leave the flow as-is. Closed, not a bug, not deferred — a real decision
  with a real reason.
- **Admin page + Fit Check stale-data investigation — root-caused, only
  half of it was actually a bug.** The admin page's "Client info" panel
  was never actually stale — confirmed a genuinely live join, no
  snapshot, no caching directive, and Next.js 15 defaults to no fetch
  caching. Fit Check, however, genuinely was stale: `fit_alignment`/
  `fit_explanation` only ever got computed at intake final-submit and
  admin "Assign," with nothing re-triggering it when a client updated
  their profile afterward — confirmed via a full-codebase `grep`. Fixed:
  `CompanyInfoForm.tsx` now re-triggers Fit Check for the client's own
  active (non-draft, non-closed) submissions after a successful profile
  save. Verified against the real dev database with a disposable client
  and three submissions in different states — correctly targets only
  the active one.
- **Phone number not appearing on admin page — fixed, third occurrence
  resolved.** Kept `phone` (the auth-linked login/SMS field) separate
  from `business_phone` by design, as before — extraction still never
  writes to an auth-linked field from a guessed document value. Fixed
  via a display-layer fallback instead: the admin page's "Phone" row now
  shows `business_phone` labeled "(business)" when `phone` is empty,
  rather than showing nothing. Verified against the real dev server with
  a disposable account and a real session — both the number and the
  label render correctly.
- **Client-facing fit badge fully replaced with a profile-completeness
  percentage — on the dashboard.** `lib/compliance/profile-
  completeness.ts`: a deterministic, equally-weighted presence check
  across 6 real fields (NAICS codes, license number, insurance provider/
  coverage, business address, business phone, at least one certification
  on file) — no LLM judgment call. Replaces the badge in the dashboard
  Status card entirely. Shows "Profile N% complete," never red at any
  level. Verified against the real dev server and database: a client
  with 1 of 6 fields set shows exactly 17%, and 100% on a fresh reload
  after filling in the rest — confirms it updates live. `fit_
  eligibility_concern` and the admin-side Fit Check panel are untouched.
  **The intake confirmation screen was explicitly left out of this
  item's original scope** — since built and fully verified, see the
  newer entry above.
- **Law enforcement/detention agency-type gap** — see the newer,
  CLOSED entry above; this entry is the original scoping investigation
  that preceded it.
- **Full pipeline automation trio + admin-inbox health, all verified
  directly against production, 2026-09-05 — real requests, real DB
  reads, not inference.**
  - `deliverables_ready → client_review`: real HTTP POST to
    `https://bidpulse.co/api/advance-on-client-preview` with a real
    client session. Response:
    `{"advanced":true,"sent":false,"reason":"test_submission"}` (the
    notification logic correctly recognized test data and skipped
    sending a real email). DB read after: `stage` changed to
    `"client_review"`.
  - Negative case: the same route called with a real **admin** session
    against a different submission correctly returned
    `403 {"error":"Client access required."}`, stage unchanged —
    confirms the client-vs-admin distinction is genuinely enforced.
  - `submitted → in_review`: a real admin session, never having viewed
    the submission before, loaded the detail page for the first time.
    Before: `stage: "submitted"`, `first_viewed_by_admin_at: null`.
    After: `stage: "in_review"`,
    `first_viewed_by_admin_at: "2026-09-05T21:25:48.422+00:00"`.
  - Admin-inbox health: a genuinely new client + submission (simulating
    a just-finished intake) appeared correctly in
    `https://bidpulse.co/admin/inbox` on the very first request — no
    cache, no manual refresh. Closes the original 2026-09-02 "zero
    submissions" report for real, on production, not by theory.
  - `scripts/regression-check.mjs` run unmodified against production's
    own database — all checks pass there too, not just in dev.
  - All disposable test data created for this pass (3 admin accounts, 4
    clients, 5 submissions) deleted afterward and confirmed gone via a
    follow-up query — production left clean.
- **Client dashboard Preview/Download auto-trigger — root cause found
  and fixed in dev, 2026-09-05.** Worth recording the investigation's
  own wrong-then-right sequence, since it's a real lesson: a first pass
  investigated by reading the code only — confirmed `PacketButtons` is
  mounted with `viewerRole="client"` and live on `origin/main`, confirmed
  the auto-trigger's gating logic reads correctly — and closed this as
  "code confirmed correct, no bug found." **That was wrong.** Reading
  code that looks correct isn't the same as running it; nothing in that
  pass was actually executed against a live session. Real dev testing
  (a genuine client account, a real Preview click, a real DB reload)
  caught the actual bug: the UI is completely fine — Preview renders
  real content with the watermark intact, Download correctly gates on
  the attestation modal — but `stage` never advanced from
  `deliverables_ready` to `client_review` on a real client click.
  Investigated for real this time: built a disposable client +
  submission against the actual dev database, signed in for a real JWT,
  issued the exact `UPDATE` the route performs. Result: `status 200,
  updateData: [], updateError: null` — PostgREST's specific signature
  for "RLS silently filtered this row out of the write," no error
  surfaced anywhere. **Root cause:**
  `close_submissions_broad_client_policy_gap.sql` (applied to dev this
  same week, for a real and unrelated reason — closing an
  attestation-bypass gap) dropped the only client `submissions` UPDATE
  policy broad enough to allow this write; the one remaining policy only
  permits UPDATE while `draft = true`, and `deliverables_ready` is
  inherently non-draft. A legitimate fix for one problem silently broke
  a different feature. **Fixed** using the exact pattern already
  established elsewhere in this codebase for the identical constraint
  (`generate-fit-check/route.ts`): keep the ownership/stage check on the
  caller's own RLS-scoped session (so real authorization still applies),
  perform the already-validated write through the service role instead.
  **Verified** with the same reproduction — the ownership check still
  correctly passes under the client's own session, and the write now
  genuinely succeeds. **Still entirely untested against production** —
  this fix and its migration are both dev-only; production doesn't have
  the bug *or* the fix yet, since neither the migration that caused it
  nor the code fix has shipped there. Needs full re-verification once
  pushed (see Open items below).
- **Request-info voice/duplication fix, and certifications optional
  upload** — both confirmed done and **pushed to `origin/main`**
  (`acea384`), per the 2026-09-03→04 session handoff. Not just committed
  locally this time — reconciled and on the main branch.
- **"Message admin" UI** — a genuine two-way message thread on a
  submission (`SubmissionMessages.tsx`), separate from "Request info from
  client." New `support_messages.sent_by_admin_id` column + a rewritten
  INSERT policy (the old one was `with check (true)`, too permissive for
  a real thread) covering the anonymous contact form, a client's own
  message, and an admin's message, plus a new client SELECT policy (none
  existed before). Verified 2026-09-02 with a real disposable client and
  admin: client sends → admin sees and replies → client sees the reply,
  each step confirmed via direct DB reads. Confirmed the anonymous
  contact-form path still works completely unmodified, and confirmed the
  RLS negative case — a second client genuinely cannot read the first
  client's messages (empty result, not an error).
- **File upload on the new production project** — a real, pre-launch-blocking
  bug found 2026-09-02 during the first genuine end-to-end test against the
  new project, root-caused to two things created out-of-band before tracked
  migrations existed and invisible to the whole system (they live outside
  `public` schema): the `rfp-documents` storage bucket was never actually
  created by any migration (only later changes to it were tracked), and the
  submission-scoped `storage.objects` RLS policies (`can_access_rfp_object`)
  were never migrated either — only the client-scoped ones happened to be.
  Both confirmed directly via raw queries against the new project (zero
  buckets, 4 of the expected 8 policies) before writing either fix. Fixed
  with two new migrations, applied to both projects. Verified end-to-end
  against the *actual new project* (not dev) — a disposable test client
  uploaded a real PDF through the real intake UI, confirmed via the UI, a
  direct `submission_documents` read, and a direct Storage listing showing
  the real object with correct metadata.
- **Admin delete action** (submissions + matched opportunities) — single-record,
  admin-only, real type-to-confirm dialog (`ConfirmDeleteDialog.tsx`), never
  a bulk tool. Verified 2026-09-02 with a real disposable submission carrying
  a child row in every cascading table (`deliverables`, `checklist_items`,
  `admin_notes`, `submission_documents`) — confirmed all four are genuinely
  empty after deletion (checked directly), confirmed the `audit_log` entry
  for the deletion survives (its `submission_id` goes null via `ON DELETE
  SET NULL`, but `event_detail` keeps the agency/company name), and
  confirmed the client account itself stays intact afterward.
- **Dynamic diagonal watermark on the Preview modal** (`PacketButtons.tsx`)
  — "PREVIEW — [client company name] — [today's date]" tiled across the
  modal, ~7% opacity, `pointer-events: none`. Deliberately scoped to the
  existing text-only preview, not a real PDF (Preview never generates a
  real file for exactly this reason — a real PDF's native browser viewer
  would bypass the payment gate). Verified 2026-09-02 with a real
  screenshot using a deliberately extreme company name to stress-test
  wrapping — renders cleanly, content underneath stays fully legible.
- **5-stage submission pipeline** (`submitted → in_review → deliverables_ready
  → client_review → closed`) — `confirmed_submitted` removed 2026-09-02 via a
  real tracked migration (Postgres has no `DROP VALUE` for an enum, so this
  swapped in a new `submission_stage` type); confirmed zero rows sat in that
  stage beforehand, and row counts matched exactly before/after (16 total).
  Two auto-triggers replace what used to require a manual "Move to stage"
  click: `in_review → deliverables_ready` fires the moment all three full
  deliverables have real content/a file (`app/api/advance-if-deliverables-complete`),
  and `deliverables_ready → client_review` fires when the *client* (not an
  admin doing QA) clicks Preview on their own dashboard
  (`app/api/advance-on-client-preview`). Verified with a real disposable
  admin + client account: partial deliverable saves correctly don't advance,
  a complete set does; an admin's own Preview click does NOT advance the
  stage, a client's does. Every stage-label map, the Kanban board, the
  "Move to stage" button set, and the client-facing stepper all confirmed
  showing 5 stages via real screenshots, not just code review.
- Client signup, login (password + magic link), intake wizard (simplified to
  4 fields in step 1; skips "About the bid" when created from an assigned match)
- Scraper pulls real JAA listings from flyjacksonville.com/bids.aspx
- Inbound bid email pipeline (`app/api/inbound-bid-email/route.ts`) — a
  second producer into `matched_opportunities` alongside the scraper, for
  DemandStar/PublicPurchase/JTA notification emails forwarded via a Gmail
  Apps Script trigger (`scripts/gmail-inbound-bid-trigger.gs`). Verified
  2026-09-02 with real extraction calls and direct DB read-backs — not
  yet live in production, since it needs Mike's IONOS/Gmail/Apps Script
  setup first (see `scripts/README.md`) and the real
  `INBOUND_BID_EMAIL_SECRET` added to Vercel
- Admin can log/assign opportunities manually, with fit-check firing automatically
- Auto-draft (capability statement, compliance matrix, technical narrative) —
  fabrication bugs found and fixed twice; current behavior correctly uses
  bracketed placeholders / "NEEDS VERIFICATION" instead of inventing facts
- Compliance matrix is agency-aware (airport → SIDA badging, school → background
  checks, transit → DBE, with correct federal-funding reasoning on airport projects)
- Fit-check runs automatically on both client intake AND admin "Assign"
- Company Profile (license, insurance, differentiators) + certifications with
  admin verification toggle — feeds Auto-draft's facts block
- Payment gate: Preview always free (in-app modal, not a real PDF — a real PDF
  preview would let people bypass payment via the browser's own PDF viewer),
  Download gated by `packages.paid`, Pilot package type always bypasses gate
- Full bid packet PDF generation (jsPDF + jspdf-autotable for real tables)
- Stage-change emails (Resend, currently test-mode: only delivers to
  michaeltcoleman@gmail.com until a custom domain is verified)
- Daily digest + 48-hour turnaround SLA tracking (Vercel Cron, 2 jobs/day limit
  on Hobby tier — already at that limit)
- Contact form (`/contact`, saves to `support_messages` + emails admin) +
  `/admin/messages` inbox — verified 2026-08-31 end-to-end (real browser
  session submitted a message, admin login confirmed it in the inbox)
- Real logo (multiple variants — stacked, horizontal nav, app icon/favicon)
- Compliance matrix mandatory/conditional/trade-specific categorization
  (`lib/compliance/requirements-reference.ts`) — verified 2026-08-31: real
  admin session generated a compliance matrix for a test submission whose
  scope mentioned "prevailing wage" and "pesticide," and the generated
  draft correctly included all 7 always-mandatory rows plus the two
  triggered conditional/trade-specific rows
- Fit-check set-aside eligibility flag (`lib/compliance/set-aside-eligibility.ts`,
  `fit_eligibility_concern`/`fit_eligibility_explanation`) — verified
  2026-08-31: a real intake submission mentioning "SDVOSB Set-Aside" from a
  client with no verified SDVOSB cert correctly set the concern flag with
  the right explanation. As of 2026-09-01 this also names the SPECIFIC
  program (JSEB vs. DBE/SDB) based on funding source
  (`lib/agency-type.ts`'s `isFederallyFunded()`, checked against the bid's
  own scope text) instead of a generic "set-aside certification" message,
  and flags a cross-contamination risk even when the client holds the
  *wrong* program's cert for the funding source in play (a JSEB cert
  doesn't satisfy a federally-funded DBE/SDB requirement, or vice versa —
  verified live with a real submission where this exact mismatch fired
  correctly). JSEB and DBE/SDB are now real trackable certification types
  (client-facing dropdown in `CertificationsSection.tsx`) — neither existed
  anywhere in the app before this. Re-verified live during the September
  audit against all 5 hardening edge cases: ambiguous funding source,
  multiple set-aside mentions in one bid, client holding a different
  (wrong) verified cert than what's required, near-miss keyword text not
  false-firing (e.g. "vosb" inside "sdvosb"), and casing/spacing variance
  in set-aside language (e.g. "8 ( A )  SET-ASIDE") — all 5 passed.
- Static bid-process warnings (Cone of Silence, Florida Sunshine Law/public
  records, government payment lag Net-30/45, mobilization/NTP timeline) —
  shared `BidProcessNotices` component shown on the intake confirmation
  screen and the client dashboard. Verified 2026-09-01 rendering in the
  real flow via screenshots at both locations.
- Bid-specific risk detection from real scope text, verified 2026-09-01
  with present/absent real submissions for both:
  - Prevailing/living wage risk (`lib/compliance/wage-risk.ts`,
    `wage_risk_concern`/`wage_risk_explanation`) — flags prevailing wage,
    living wage, Davis-Bacon, Service Contract Act, or wage determination
    language; never invents a dollar figure.
  - Mandatory site visit detection (`lib/compliance/mandatory-site-visit.ts`,
    `mandatory_site_visit_concern`/`mandatory_site_visit_explanation`) —
    requires an actual "mandatory"-equivalent word near a site-visit term
    in the same sentence, so a bare/optional site-visit mention never
    false-positives. Fixed a related bug in the existing compliance-matrix
    reference-library entry, which had a bare "pre-bid conference" keyword
    that would have fired even when a bid called the conference optional.
  - All three fit-check concern flags (this pair plus the pre-existing
    eligibility one) now actually render in the UI for the first time —
    they were computed and persisted by an earlier session but never shown
    anywhere. Escalating visual prominence: mandatory site visit renders
    most urgently (red), since missing a truly mandatory walkthrough gets a
    bid rejected unopened as non-responsive.
- Dollar-value threshold → lean package — `submissions.estimated_value`
  (admin-entered, nullable) and admin-adjustable
  `organizations.lean_package_threshold` (default $35,000, FL Statute
  287.017 Category Two *state* threshold; editable at the new
  `/admin/settings` page since local bodies may set their own). When
  estimated_value is below threshold, the deliverables panel shows a
  suggestion banner — never automatic, confirmed with Mike, since
  estimated_value is often a rough guess — to switch from the full
  3-deliverable set to a lean one (Rate Sheet, Executive Cover, Certificate
  of Insurance). No pricing data exists anywhere in the schema, so Rate
  Sheet is placeholder-only (never invents a rate); Certificate of
  Insurance is a summary of what's on file, not a substitute for the real
  uploaded COI document. Verified 2026-09-01 with real below/above-threshold
  submissions.
- Package-linking UI: `PaymentStatus.tsx` — admin can now create a new
  package (type, price note) or reuse an existing one from the same client
  (packages are 1:many with submissions — no unique constraint ties one to
  the other, confirmed against `schema.sql`), link it to the submission,
  and mark it paid. The earlier "No package linked to this submission yet"
  message with no way to act on it is closed. Verified with a real
  DB-backed test: before linking, `isPaidOrPilot` → false; after linking +
  marking paid → true; a `pilot`-type package unlocks downloads without
  `paid = true`, as designed.
- Tracked Supabase CLI migrations: 8 real migration files in
  `supabase/migrations/`, confirmed via a live query that every column they
  add actually exists on the live database (not just sitting as unapplied
  local files).
- IT/Computer Support compliance vertical: three new
  `TRADE_SPECIFIC_CERTIFICATIONS` tiers in
  `lib/compliance/requirements-reference.ts` — VA information-system/data
  access (VA Handbook 6500.6, VAAR 852.239-70), Section 508/ICT
  accessibility (VAAR 852.239-75), and Controlled Unclassified Information
  (NIST SP 800-171 / CMMC / DFARS 252.204-7012 family). Trigger keywords
  are real VAAR/DFARS clause citations, verified against actual
  Acquisition.gov clause text rather than generic terms, specifically so
  "veteran" or "computer" alone in a bid never triggers any of the three.
  `lib/agency-type.ts` also gained a `"va"` agency type (matched on agency
  name: "veterans affairs," "VAMC," "VISN," etc. — deliberately not a bare
  "VA," which collides with the Virginia state abbreviation) for a softer,
  non-blocking fit-check note. Verified live against 7 cases (no VA/CUI
  language, VA system-access language, Section 508 language, CUI/NIST
  language, plus false-positive probes for "circuit" — which contains the
  substring "cui" — and generic "veteran"/"computer" mentions) — all
  correct. See "Known Issues" for the real Dar Mano Consulting bid this
  vertical was built to address.
- Trade-coverage safety net: `lib/compliance/known-trades.ts` defines the
  currently-supported trades (HVAC, Janitorial, Landscaping, IT/Computer
  Support) as the single source of truth for three touchpoints — a red
  admin-facing banner on the submission detail page, an 8th-grade-level
  note inside the actual compliance-matrix deliverable content (client
  reads this in preview/download), and an intake-time heads-up on the
  client dashboard. Verified live: an electrical-contracting test
  submission (unsupported trade) correctly triggers all three; a
  landscaping test submission (supported) triggers none, no regression.
  One byproduct fix needed to make the deliverable note actually reach the
  downloaded PDF: `lib/pdf/deliverables-packet.ts`'s compliance-matrix
  renderer previously only ever drew the pipe-delimited table and silently
  dropped every surrounding prose line (including the pre-existing
  "[DRAFT...]" disclaimer and the trailing scope-reference line) — fixed to
  render prose and table segments in their original order.
- Homepage trade list is now generated, not hardcoded, in both places it
  appears: the "Built for small trades" tagline (`app/page.tsx`) is built
  from `KNOWN_TRADES` via `Intl.ListFormat` (proper Oxford-comma "X, Y, and
  Z" joining) plus a small sentence-casing helper (keeps acronyms like
  HVAC/IT uppercase, lowercases the rest so it reads naturally mid-sentence).
  The separate "Trades we work with" card grid (icon + description per
  trade) can't be auto-generated the same way — it needs real authored
  content per trade — so instead it has a module-scope check that throws if
  `KNOWN_TRADES` ever gets an entry with no matching card, both in dev
  (real 500 + exact error) and in `next build` itself (confirmed a real
  build failure, not just a dev-time one). The IT/Computer Support card
  that was missing (added when the vertical shipped, but never added here)
  is now present. Verified with real screenshots; the drift check was
  proven by temporarily adding a 5th fake trade with no card and confirming
  both dev and build failed loudly, then reverting.
- Fit-Score Quiz (`/quiz`) audited and confirmed fully built and working —
  not a stub. Four real yes/no questions, `yesCount >= 2` -> "strong fit"
  vs. "we can still help" branch, both routing to `/intake`. Purely
  client-side (`useState`, no `supabase`/`fetch` calls, no schema table) —
  deliberate, not an oversight, per the code's own comment. Means a visitor
  who finishes the quiz but doesn't click through leaves zero trace; worth
  knowing if lead capture on drop-off ever becomes a priority.
- Logo consistency audit: every location that renders a BidPulse
  logo/icon — favicon, marketing nav, marketing footer, admin header,
  client dashboard header (same shared `AppShell`, so these two can't
  drift from each other), login page — already uses its correctly intended
  asset per the three-variant mapping (icon-only for favicon, horizontal
  for nav bars, stacked for login). No code-level mismatches found. Email
  templates (`lib/email/templates.ts`) are plain text, no logo, nothing to
  fix there. See Open — Needs Attention for a real visual inconsistency
  found in the source art itself (not a code bug).
- Login page (`app/login/page.tsx`): the logo is now a `Link` to `/` — the
  page previously had no way out at all except closing the tab. Kept
  minimal, no full nav bar added. Verified real click-through to `/` and
  browser back to `/login` both work.
- **Password reset was redirecting to localhost — root-caused and fixed.**
  Not an app-code bug: there was (and still is, until the item below is
  committed) no `resetPasswordForEmail` call anywhere in the codebase. The
  actual cause was the Supabase project's Auth settings — `site_url` was
  `http://localhost:3000` and the redirect allowlist was completely empty,
  so *any* redirect target, even a correct dynamic one, got silently
  overridden back to localhost. Fixed via the Management API: `site_url` ->
  `https://bidpulse-nine.vercel.app`, redirect allowlist ->
  `https://bidpulse-nine.vercel.app/**,http://localhost:3000/**` (both, so
  local dev keeps working). Verified live: generated a real recovery link
  via the admin API for a real existing user and confirmed the actual HTTP
  303 redirect lands on the production domain, not localhost.
- Forgot-password flow — genuinely missing before, now built.
  `LoginForm.tsx` gained a "Forgot password?" link and a request-reset mode
  calling `resetPasswordForEmail` with `redirectTo` pointed at the existing
  `/auth/callback` route (same PKCE code-exchange route the passwordless
  magic-link flow already used — reused, not duplicated) with
  `next=/reset-password`. New `app/reset-password/page.tsx` +
  `ResetPasswordForm.tsx` lets the user set a new password once a real
  session exists (from the exchanged recovery code), with a clear "this
  link is invalid or expired" fallback if there's no session (link already
  used, expired, or the page opened directly). Verified end-to-end with a
  real test account: real request submitted, signed in with the original
  password, reset the password with a real session, **signed out and back
  in with the new password to confirm it actually changed** (not just that
  the UI reported success), and confirmed the no-session fallback state
  renders correctly for a fresh visitor. A literal inbox click-through
  couldn't be tested (this project's PKCE flow needs the same browser that
  requests the reset to hold the matching code-verifier when it completes
  the exchange, and there's no real inbox to check in this environment) —
  every other real code path this touches was verified instead. Committed
  (`46c999f`) — **but this commit sat unpushed for a while after landing,
  which caused a real, confusing production symptom: see the note below
  under Known Issues about "Forgot password?" appearing to send the wrong
  email.** Now actually pushed (`bebb5b6`), and **confirmed fully working
  live**: a real click-through on the deployed site received an actual
  "Reset your password" email, followed it to a working form, changed the
  password, and logged in with the new one successfully. Fully closed.
- "No guarantee of winning" disclaimer — closes the loop on the fit-check
  system's existing no-win-probability-claims stance for the client-facing
  side. `components/ui/BidFileStep.tsx` (the real final-submit step, shared
  by the intake wizard and the dashboard's "complete your bid" card) now
  has a required checkbox that genuinely gates the "Send it to us" button
  (`disabled={saving || !acknowledged}`, not just decorative text).
  Persisted as a real `audit_log` entry (`no_guarantee_acknowledged`, exact
  acknowledgment text, real timestamp) right alongside the existing
  `submission_locked` entry in `finalizeSubmission()` — no new
  column/migration needed. Also added short plain-language disclaimer text
  to the marketing footer (every page) and the pricing page (right after
  the bottom CTA). Verified end-to-end with a real signup: confirmed the
  submit button is genuinely disabled unchecked, enables once checked, and
  a real DB read-back after submitting showed the audit_log row with the
  correct text and timestamp. Test accounts cleaned up afterward.
- **Signed-in users had no way back to the marketing site — a real bug,
  distinct from the earlier login-page exit-link fix.** The login-page fix
  (`822de01`) only ever covered an anonymous visitor sitting on `/login`.
  Once actually signed in, both admin and client accounts hit a real dead
  end: `components/ui/AppShell.tsx` (the header shared by every `/admin/*`
  and `/dashboard/*` page) had its logo as a plain, unlinked `<Image>` —
  not wrapped in a `Link` at all — and its nav items only point to in-app
  routes. Even a link to `/` wouldn't have helped: `app/page.tsx`'s root
  routing deliberately bounces any signed-in user straight back into the
  app, so `/` can never show the marketing homepage to someone logged in.
  The only way out was signing out entirely — confirmed by reproducing
  with real admin and client test accounts (sign in, land on
  `/admin/inbox` or `/dashboard`, navigate directly to `/`: bounced right
  back both times). Fixed by linking AppShell's logo to `/pricing` instead
  of `/` — a real public page that doesn't get overridden by the
  signed-in redirect. Verified for both roles with real test accounts:
  admin and client each land on `/pricing` after clicking the logo, zero
  console errors either time.
- A separate console error a real browser session surfaced
  (`A tree hydrated but some attributes of the server rendered HTML
  didn't match...`, with `RedirectBoundary`/`HTTPAccessFallbackBoundary`/
  `NotAllowedRootHTTPFallbackError` in the component stack) turned out to
  be a Chrome DevTools artifact, not a real bug — confirmed from the
  screenshot itself, which showed the Responsive device-emulation toolbar
  active. DevTools injects a `zoom` style onto `<body>` in that mode,
  which is exactly the mismatched attribute React flagged; it's unrelated
  to any actual page. Worth remembering for next time: those boundary
  component names are normal Next.js 15 App Router scaffolding present on
  *every* route regardless of whether a redirect/not-found is actually
  firing — seeing them in a stack trace isn't itself evidence of anything
  broken. Re-tested outside Responsive mode and the warning didn't recur.
- `tsconfig.json`: removed the deprecated `baseUrl` option (TS flagged it
  as going away in TypeScript 7.0). It was redundant under
  `moduleResolution: "bundler"` — `paths` resolves relative to the
  tsconfig file's own directory without it. Confirmed via both
  `tsc --noEmit` and a real `next build` that every `@/*` import still
  resolves correctly.
- Mobile nav menu items now read as real tappable buttons. Confirmed
  mobile-only (desktop nav's plain text links are a standard, working
  pattern with hover states — the gap was specifically the full-width,
  stacked, touch-only mobile drawer). `MarketingShell.tsx`'s mobile menu
  items (Pricing, Fit-Score Quiz, Gallery, FAQ, Blog, Log in) now use the
  same secondary-button treatment already established elsewhere on the
  site — bordered, rounded, full-width, hover/active states — matching
  "Get started"'s visual weight instead of sitting as plain stacked text.
  The active/current page keeps a distinct highlighted border+color state.
  Verified with real before/after screenshots at a real mobile viewport,
  plus the active-page and dark-mode states.
- Admin inbox (`/admin/inbox`) is now a genuine FIFO queue, oldest-submitted-
  first — previously there was no consistent order at all (a flag-priority
  sort that ignored `submitted_at` entirely, so due dates jumped around
  row to row with no visible logic). The query now excludes `draft = true`
  rows outright (not yet actionable, no `submitted_at` to queue by) and
  sorts `is_test` ascending before `submitted_at` ascending, so rehearsal
  submissions always sort after every real one regardless of their own
  submission date, matching the existing principle of excluding test data
  from real reporting elsewhere in the app. The "Past due"/"Needs
  attention" badges are unchanged and still computed the same way — they
  no longer reorder rows, just flag them in place, since a real FIFO means
  row position always matches submission order. Verified with a real
  DB-backed test: inserted rows with deliberately out-of-order
  `submitted_at` values, a draft row, and a test row whose `submitted_at`
  was the *oldest* of all — confirmed the real rendered admin inbox
  excluded the draft entirely, ordered the real rows correctly
  oldest-first, and still sorted the test row dead last despite its date.
- Admin → client "need more info" requests: new "Request info from
  client" card on the submission detail page. Went with the
  `checklist_items` + email approach over extending `support_messages`
  bidirectionally — checked that table's actual RLS first (currently
  INSERT-anyone/SELECT-admin-only, no client-facing read UI at all), so
  bidirectional would have needed a new migration, RLS in both
  directions, and a client UI built from scratch; the checklist_items
  route needed none of that. The text box pre-fills from the real Fit
  Check explanation (the one actual "what's missing" text that exists —
  a single joined paragraph, not separate structured suggestions) for the
  admin to edit down before sending. On submit: creates a real
  `checklist_items` row (already client-readable, zero dashboard changes
  needed), emails the client via a new `getInfoRequestEmail()` template
  (`lib/email/templates.ts`), and logs a real `audit_log` entry
  (`info_requested`, alongside the existing event types in
  `AUDIT_EVENT_LABELS`). Test submissions skip the real email send,
  matching the existing convention. Verified end-to-end with a real
  submission: confirmed the prefill pulled the actual Fit Check text,
  sent a real request, and a real DB read-back showed the correct
  `checklist_items` row and `audit_log` entry, plus confirmed the item is
  visible via the exact query the client dashboard already uses.
- **Company-profile document upload/extraction — a real, net-new
  capability, not an enhancement of an existing one.** The brief that
  requested this assumed an existing extraction route already handled
  company-profile fields (company name, license, insurance,
  certifications); that route (`extract-from-document`) only ever
  extracted bid/RFP fields (agency, due date, scope, etc.) — nothing in
  the app extracted company-profile info from a document before this.
  Built as a separate route, `app/api/extract-company-profile/route.ts`
  (kept separate from the bid-extraction route since the schemas and
  consumers are entirely different), sharing a new
  `lib/document-parsing.ts` helper with the bid-extraction route so
  PDF/DOCX/TXT support only needs maintaining in one place (also closes
  the file-type gap on the bid-extraction route itself — legacy binary
  `.doc` deliberately stays unsupported, no safe parser exists without
  adding a new dependency).
  - Two new `clients` columns via a tracked migration:
    `business_registration_number` (state/Sunbiz filing number) and
    `commercial_auto_coverage`, alongside the existing
    `general_liability_coverage`/`workers_comp_coverage`. Also found and
    fixed real drift in `schema.sql` itself while regenerating it — a
    function and an RLS policy that existed live but had gone missing
    from the committed reference file at some earlier point.
  - Added a new mandatory compliance-matrix item, "Business Registration
    (Sunbiz / State Filing)," distinct from the existing "Local Business
    Tax Receipt / Occupational License" row — the brief claimed this
    distinction already existed in `requirements-reference.ts`; it
    didn't, so this closes that gap for real rather than assuming it was
    already done.
  - The extraction prompt is deliberately explicit that
    business-registration numbers and trade-license numbers are
    different things — the one real fabrication risk here, verified with
    a synthetic test fixture whose only registration-style number was a
    Sunbiz Doc# with no separate trade license stated anywhere: extracted
    `licenseNumber: null` correctly, never confused the two.
  - Certifications extract as an array (`client_certifications` is a
    real one-to-many table) using the *actual* `cert_type` vocabulary in
    use in `CertificationsSection.tsx` (`JSEB`, `DBE/SDB` are real
    first-class values there, not just the six federal SBA program types
    the schema comment implied) rather than the stale schema comment —
    caught this before wiring the UI, not after.
  - Wired into both the Company Profile page (`CompanyProfileClient.tsx`
    — upload prefills the form via a remount-on-extraction pattern,
    nothing saved to the `clients` row until the existing "Save company
    info" button is clicked; certifications insert immediately since
    that's a separate table with its own existing "add" flow) and the
    intake wizard's "About you" step, as a new optional micro-step shown
    right after account creation (`Want to save some typing?`) — the
    extraction route requires a real session, so it can't run any
    earlier in an anonymous visitor's flow than that; the wizard's own
    fields stay exactly as minimal as before for anyone who skips it.
  - Along the way, found `/dashboard/*` had no `ToastProvider` at all
    (only `/admin/*` got one earlier this session) — `useToast()` was
    crashing the whole Company Profile page render. Added
    `app/dashboard/layout.tsx` to fix it for real, not just this one
    feature.
  - Verified end-to-end on both surfaces with a synthetic test fixture
    (no real fixture was available in this environment — built one
    matching every field and value the brief specified) via real
    Playwright sessions and real DB read-backs: correct field values
    across the board, all 4 certifications inserted as separate rows
    (not collapsed to one), `licenseNumber` correctly null, Company
    Profile's fields persisted only after clicking Save and confirmed via
    a fresh page reload, intake's fields persisted immediately and
    confirmed via direct query.
- A follow-up report claimed three "systemic field-mapping" bugs in the
  above (insurance provider holding coverage text, license# still
  colliding with the Sunbiz number, phone/business_phone confusion) —
  re-verified against the actual shipped code rather than assumed stale:
  none are present. Specifically retested with a new fixture variant
  that, unlike the original, states a real insurance carrier name — came
  back correctly as `insuranceProvider`, with `workersCompCoverage`
  still separate and correct. Field mapping is by JSON key name
  throughout (`obj.insuranceProvider`, `obj.workersCompCoverage`, etc.),
  not array position, so there's no structural way for values to shift
  between fields. The "phone empty" observation is by design, not a
  bug: `clients.phone` is the account's login/SMS-auth number, and
  extraction deliberately never writes to it — overwriting a real
  auth-linked phone from a guessed document value would be a real risk.
  Confirmed with Mike: leave as-is, business_phone only.
- **One real, live bad record found and corrected.** The re-verification
  above was about the *code* — separately, a genuinely live `clients` row
  ("Coastal Clean Facility Services, LLC," `cbow038@gmail.com`, created
  17:05 that day, well before the extraction feature shipped) actually
  did have the exact bad values described: `license_number` held the
  Sunbiz number with a trailing space, `insurance_provider` held
  "Statutory FL limits." Whitespace/tab artifacts throughout the record
  point to this having been hand-typed into the *old* Company Profile
  form (before it had a dedicated Business Registration field) rather
  than produced by the extraction feature. Backfilled exactly the three
  named corrections, nothing broader: `license_number` → null,
  `business_registration_number` → `L25000TEST99` (trimmed),
  `insurance_provider` → null (its correct value was already separately
  present in `workers_comp_coverage`, left untouched). `phone` left null
  per the same business_phone-only decision above. Verified with a
  direct before/after read of the actual record, not just "the query ran
  without error."
- **Admin → client "need more info" requests — now fully verified, not
  just built.** This was built and committed (`2eb27d6`) but a follow-up
  correctly pointed out that build vs. verified are different things
  here. Closed the one real gap: previously confirmed the email *send*
  succeeded (no error, correct `checklist_items`/`audit_log` rows) but
  never literally checked a received email's content — this time sent a
  real request through the actual UI to a real, publicly-checkable
  mailinator inbox and read back the actual delivered email: subject
  **"We need some info for your Verify Agency bid"** — the real
  `getInfoRequestEmail()` template, not a sign-in-link-style mixup.
  Confirmed working end-to-end.
- **Document upload/extraction's remaining items (file types beyond PDF,
  multi-certification, Commercial Auto) were re-requested as "still
  needed" but were already built and verified in the same-day work
  above** — a stale build order, not new scope. Re-confirmed directly
  against the current code (`detectDocumentKind` on both extraction
  routes, `certifications: ExtractedCertification[]` as a real array,
  `commercial_auto_coverage` in `schema.sql`) rather than trusting either
  claim. Closed the one genuinely untested angle: generated a real
  `.docx` file (not just `.txt`, which was already tested) from the same
  mock content and ran it through the actual extraction route — every
  field came back correct, including all 4 certifications and the
  Commercial Auto coverage.
- Theme color tokens recolored to match the new logo's actual palette.
  Sampled `public/logo.png`'s dominant pixel colors directly (navy
  wordmark `#102858`, cobalt shield blue `#2080c8`) rather than eyeballing
  it, then compared against `app/globals.css`'s design tokens.
  `--color-primary` was already close (deliberately matched to the logo
  during the earlier dark-mode-contrast fix), but `--color-secondary`
  (a teal, driving every button/link/badge app-wide) was a genuinely
  different hue family. Confirmed with Mike before touching it, since
  it's an app-wide visual change. Recolored `--color-secondary` and its
  container/on-* variants (light and dark mode) to the logo's blue,
  preserving each token's exact original HSL lightness — same contrast
  characteristics, different hue. Verified WCAG contrast ratios
  before/after: every pair improved (e.g. white-on-secondary button
  text 5.95:1 → 9.04:1), no accessibility regression. Left
  `--color-surface-tint` alone — confirmed via grep it's defined but
  never actually used as a class anywhere. Verified with real
  screenshots in both themes, homepage and login.
- 14-day inactivity sign-out, built at the app level since Supabase's
  native `sessions_inactivity_timeout` setting is real but gated behind
  a Pro-plan paywall this project isn't on (confirmed via the Management
  API — see Known Issues). `middleware.ts` now tracks a plain
  `bp_last_active` cookie (httpOnly, 14-day maxAge) as a sliding window,
  renewed on every authenticated request. Once a signed-in visitor goes
  14 days without a single request, the next one they make calls
  `supabase.auth.signOut()` server-side and redirects to
  `/login?reason=inactive`, which shows a real message ("You were
  signed out after 14 days of inactivity") instead of an unexplained
  bounce. Anonymous visitors never get the cookie at all. Verified
  end-to-end with a real signed-in session: normal continued activity
  never falsely signs out; backdating the cookie to 15 days old
  triggers the sign-out on the very next request; a second request
  afterward confirms the session was actually cleared server-side (lands
  on plain `/login`, not just a one-time redirect) rather than silently
  refreshing forever, which is what happened before this existed.
- Gallery page's sample-deliverable cards (`app/gallery/page.tsx`) were
  a completely separate hardcoded array from `known-trades.ts` — the
  homepage's "Trades we work with" build-time drift check never
  covered this page, exactly how it fell out of sync when IT/Computer
  Support shipped (Gallery still only showed 3 of 4 trades). Added a
  real synthetic IT/Computer Support example card ("Help Desk & Network
  Support," matching the other three's tone/length), extracted the
  drift-check into a shared `assertNoMissingTradeCards()` helper in
  `known-trades.ts` so one mechanism now covers both the homepage and
  Gallery instead of two separate checks, and fixed the same 3→4-card
  grid-orphan layout issue the homepage hit earlier. Verified: real
  screenshot showing all four cards; confirmed the shared check fires
  for *both* pages via a temporary 5th fake trade (both `/` and
  `/gallery` returned real 500s), reverted and confirmed clean 200s;
  real production build succeeds.
- **Full frontend rebuild onto Google Stitch's "Industrial Precision"
  design system, 2026-09-08 (`626cf4f`, 55 files).** Restyled every
  major screen to match actual rendered Stitch mockups — verified by
  comparing real screenshots against the mockups' screenshots, not by
  translating Tailwind class names, after several early passes were
  correctly called out as "just re-themed, not from Stitch" and had to
  be redone structurally. Every real data field, route, and behavior
  was kept; anything the mockups fabricated was dropped or replaced
  with real copy/fields (fake personas, invented win-rate/SLA stats,
  SMS/social SSO login, a non-existent "Cost Calculator" page). Notable
  pieces: `AppShell.tsx` now gives both admin *and* client roles a
  persistent left sidebar (previously client-only pages had none —
  caught by a user-shared Stitch reference screenshot: "These do not
  look the same look at the menu"); the client dashboard
  (`app/dashboard/page.tsx`) was rebuilt from a tab-switcher hiding all
  but one bid into one unified card per active submission (stepper,
  deadline, checklist, deliverables, messages together) plus a real
  stat row and a persistent profile/credentials sidebar; the admin
  inbox and matches pages got restyled tables/cards with real filters
  kept intact; the landing page got a real trade-coverage pill strip,
  a card-grid pricing preview with no fabricated dollar figures, and a
  two-card "transformation pipeline" visual matching a specific
  user-shared reference image. Added real Electrical trade compliance
  coverage (NAICS 238210, license + NFPA 70E arc-flash) alongside
  HVAC/Janitorial/Landscaping/IT, with matching homepage and Gallery
  cards (passes `assertNoMissingTradeCards()`). Dark-theme
  `--color-secondary-container`/`--color-surface` tokens were corrected
  to the exact Stitch brand-seed hexes (`#10b981`/`#0f172a`) per the
  user's explicit choice, after confirming these differ from the
  M3-tonal-expanded values Stitch's own screens actually render (the
  seed rarely survives verbatim into any token slot — the *rendered*
  values were ground truth for every other token, this one pairing was
  a deliberate exception). `tsc --noEmit` clean; real Playwright
  screenshots taken across admin/client/marketing pages in both
  themes. **Not yet pushed — see Currently Open #10.**
- **Client Past Performance / references — real feature, replaces two
  bracket placeholders every capability statement used to leave
  unfilled, 2026-09-08 (`88eac4f`).** User's own complaint: the app had
  no place for a client to enter past-project references, so the
  capability statement always shipped with literal
  `[Client name] — [scope of work] — $[contract value] — [outcome/result]`
  lines — while the client-facing completeness badge still read "100%
  complete." New `client_past_performance` table (migration applied
  directly to production — see Currently Open #10) plus a
  `PastPerformanceSection.tsx` client form on `/dashboard/profile`
  (client/agency name, scope, contract value, outcome — self-reported,
  no verification gate, same trust level as the existing
  Differentiators field). `generate-draft/route.ts` now queries up to
  3 real entries and uses them in the capability statement instead of
  the placeholder lines when any exist. Verified end-to-end against
  "Sunrise Janitorial Solutions, LLC" — a `is_test: true` QA fixture in
  the production database (synthetic company, `.test`-domain email; see
  the specimen capability-statement PDF used to create it), not a real
  customer — two entries added through the real UI, confirmed present
  via direct DB read.
  Same commit also fixed `business_registration_number` being
  hardcoded to a bracket placeholder in the entity line even when the
  real value was on file, and fixed `deriveRequirementLabels()`
  producing garbled mid-sentence-truncated fake "requirements" from
  dense scope paragraphs (now only derives a label when it can do so
  without truncating; otherwise falls back to the existing
  zero-labels path).
- **PDF/download placeholder gate — literal `[bracket]` template text
  could reach a client-downloaded PDF; now blocked, 2026-09-08
  (`88eac4f`).** Real user report: a downloaded capability statement
  PDF still had unresolved brackets in it. New
  `lib/pdf/placeholder-check.ts` (`hasUnresolvedPlaceholders`) is now
  checked in two places: `advance-if-deliverables-complete/route.ts`
  won't auto-advance a submission to "Deliverables ready" while any
  text deliverable (file uploads exempt) still has brackets, and
  `PacketButtons.tsx` blocks a *client* (not admin) download the same
  way, before the attestation flow. Verified with real Supabase test
  data and the exact query the real code runs, per this file's own
  "test the exact query" rule — an early false negative during testing
  came from reusing one Supabase client instance across a service-role
  call and a client sign-in, which silently downgrades that instance's
  session for every later call (same class of bug worth watching for
  again).
- **Admin console had no way to open the client's actual RFP/
  solicitation document — fixed, 2026-09-08 (`c9cf762`).** Real gap
  found while answering "where do I get the info to fill in the
  Compliance Matrix": `SubmissionDocuments.tsx` (client-facing RFP
  upload, used during intake) was never rendered anywhere in
  `app/admin/inbox/[id]/page.tsx`, and RLS already allowed admin read
  access — the component just wasn't wired in. Now rendered inside the
  "Bid details" card so the file the client uploaded is one click away
  from where the compliance matrix and technical narrative are edited.
  Verified against the same `is_test: true` QA-fixture submission used
  throughout this session (Sunrise Janitorial / City of Jacksonville
  RFP-0892-26 — not a real customer, see the note on the Past
  Performance entry above): the actual uploaded solicitation PDF
  renders and opens correctly.
- **Compliance matrix editor rebuilt as a structured per-row form, then
  REVERTED — `ComplianceMatrixEditor.tsx` does not exist in the
  codebase anymore, don't build on this entry.** Built 2026-09-08/09
  (`15448df`, `93391f5`, `7ea3763`), then explicitly undone
  (`d49ec01`, same day) per Mike's own direct feedback: "i was not
  happy with the the code changes made for updating the compliance
  matrix so do not want that in production." `DeliverablesPanel.tsx`
  is back to a single plain textarea for all three deliverable types
  (kept the `estimateRows()` content-sizing fix from `5ddb0fc`, which
  wasn't part of the complaint). Left the rest of this entry below
  intact as a real record of what was tried and why, in case a future
  session revisits per-row compliance-matrix editing — starting over
  from scratch here would be wasted effort if the same design already
  didn't land well. No LLM, purely a mechanical editing-UX fix,
  2026-09-08/09. User pushback after being told
  filling in the matrix is a genuinely manual step ("there has to be
  an easier way... that does not use an LLM"). The matrix was one
  giant `<textarea>` holding strict pipe-delimited text
  (`Requirement | Status | Methodology`, one row per line — the same
  convention `deliverables-packet.ts`'s PDF table renderer already
  parses), so confirming one row meant hunting for its line in a wall
  of text and hand-retyping it without breaking the format. New
  `ComplianceMatrixEditor.tsx` parses the same content into real rows
  and reserializes back to the identical pipe-delimited string on
  every edit, so Auto-draft, the PDF renderer, and the placeholder
  gate all needed zero changes. First pass added a status dropdown, a
  live "N of M rows confirmed" count, and unresolved-row highlighting;
  user feedback ("looks out of place") led to a restyle referencing
  this same Stitch project's "Proposal Paperwork & Forms Checklist"
  screen and reusing this same page's own preflight-check badge colors
  instead of inventing a new palette; further feedback ("seem a little
  big") led to a compaction pass (tighter padding/gaps, textareas sized
  to content instead of a fixed 2-row minimum). Verified with a real
  save round-trip against the Sunrise Janitorial `is_test` fixture's
  actual compliance matrix (10 rows preserved, edit persisted, then
  restored to its original content afterward) and real screenshots in
  both themes. A "raw text" toggle stays available as
  an escape hatch. Prose/Capability Statement/Technical Narrative
  textareas got the same "don't hide content behind a fixed-height
  scrollbox" treatment separately (`5ddb0fc`) — sized to content
  instead of the structured-row form, since that content is free prose
  with no parseable schema to build a form out of.
- **RFP extraction pipeline — new, separate initiative, standalone
  Python module, Phases 1-2 built and verified, 2026-09-09
  (`1aa32bf`, `d1e0acb`).** Real motivation: the existing LLM-based
  intake extraction only pulls a handful of admin fields for the
  intake form — it does nothing to relieve Mike from personally reading
  a full RFP to identify what belongs in the compliance matrix,
  technical narrative, or capability statement. Deterministic
  (regex/layout-heuristic based), no generative model calls anywhere.
  Lived entirely in `rfp-extraction/` (does not touch the Next.js app,
  any existing route, or any of BidPulse's own LLM-based extraction) —
  **but that directory and everything below no longer exists in the
  codebase; see the 2026-09-22 Deploy status note at the top of this
  file.** The module was rebuilt from scratch, independently, under
  `rfp-extractor/` (a separate PR), and that's what actually ships
  today — check `rfp-extractor/README.md` and its own `evidence/`
  folder for the current, real implementation and its own bug list
  rather than assuming this narrative still applies. Kept below as
  real history of what the original Phase 1+2 build found, in case
  it's useful context for whoever works on the current module's own
  Phase 3/4. Full design (still current, not implementation-specific):
  `rfp-extraction-pipeline-design.md`; original phase briefs (now in
  `archive/`, superseded by the current module's own docs):
  `BRIEF-rfp-extraction-phase1.md`, `BRIEF-rfp-extraction-phase2.md`.
  - **Phase 1** (ingest + admin-field regex: due date, NAICS, set-aside,
    contract type, page limit, solicitation number): tested against a
    real fixture pulled from the actual `RFP-2026-0847-JANI` submission
    in the production database (an `is_test: true` QA fixture, labeled
    synthetic on every page — not a real customer document, but a real
    object, not invented for this task). Two of the design doc's own
    §5 regex patterns needed real fixing, not just tuning: `due_date`
    silently returned the *wrong* date at high confidence (matched a
    decoy "Questions Deadline" instead of the real "Proposal Due
    Date," with no conflict flagged), and `solicitation_number` had a
    self-matching bug (the "RFP" anchor keyword also matches as a
    prefix inside the ID itself, "RFP-2026-0847-JANI"). Also verified:
    a field-free input returns null on all six fields (no false
    positives), and a genuinely image-only page (confirmed via an
    empty-text precheck) correctly triggers Tesseract OCR fallback with
    every result flagged `low` confidence. Full evidence was at
    `rfp-extraction/evidence/NOTES.md` — gone along with the rest of
    the old module (see note above); the current module's own Phase 1
    evidence is `rfp-extractor/evidence/README.md`.
  - **Phase 2** (section segmentation: heading detection + a
    data-driven `SECTION_SYNONYMS` canonical taxonomy + an actually-
    surfaced `unclassified_headings` report, not just a JSON field
    nobody opens): zero changes to any Phase 1 file (verified via
    `git diff`). Found and fixed **five** real bugs against the same
    fixture plus two deliberately constructed synthetic tests (an
    unmappable heading, a row-interleaved two-column layout — both
    stated plainly as constructed, not naturally occurring), three of
    them genuine silent-failure bugs rather than tuning issues: a
    document's own title (the single biggest font on the page) was
    swallowing the entire rest of the document into one section since
    nothing else could ever match-or-beat its font size; fixing that
    exposed a second bug where the *fallback* section's font-size
    sentinel (`inf`) made it equally unclosable; every info-table label
    cell was bold+short, indistinguishable from a real sub-heading by
    the design doc's own rule alone; "top 2 font sizes" over-triggered
    on a short document with only 2 distinct sizes; and multi-column
    reordering was a **complete no-op on every input**, an off-by-one
    in the column-split index having silently swallowed both columns
    into "left" every single time. Full evidence was at
    `rfp-extraction/evidence/phase2/NOTES.md` — gone along with the
    rest of the old module (see note above); the current module's own
    Phase 2 evidence is `rfp-extractor/evidence/phase2/README.md`,
    which independently found the same title-swallowing bug as its
    first listed issue. **Stated limitation, not
    glossed over:** the synonym map is validated against synthetic
    fixtures only — no real agency solicitation was available to test
    against in this environment. First draft, needs a real
    second-verification pass once real solicitations are sourced.
  - **Not yet done, and don't assume otherwise:** Phase 3 (obligation
    harvesting — the part that actually finds compliance-matrix
    requirements, not just organizes the document) and Phase 4 (table
    extraction: CLINs, evaluation factors, deliverables) are both
    unbuilt. Neither phase reduces Mike's actual review burden on its
    own yet — that only arrives once obligation harvesting and real
    wiring into `generate-draft/route.ts` both exist.
- **City of Jacksonville scraper rewritten from headless Chromium to
  plain `fetch()`, 2026-09-09 (`58a3279`).** Important context: a real,
  working Playwright + `@sparticuz/chromium`-based `coj.ts` already
  existed and was already deployed (`acea384`, on `origin/main`,
  wired into the daily `/api/scrape` cron alongside `jaa.ts`) — a
  separate status doc shared this session described this as an unsolved
  "research phase" problem, apparently unaware the file already
  existed; worth reconciling with whoever owns that doc so this doesn't
  get "solved" a third time. That said, real, independent live
  investigation (actual `curl` + Node `fetch` runs against the live
  Oracle Fusion Cloud Procurement page, not assumptions) found the
  existing implementation, while working, was heavier than necessary:
  the page's "JavaScript-rendered" table is actually gated behind a
  two-step Oracle ADF loopback redirect, not a real client-side data
  fetch — `_afrLoop`, the value that gates it, is a literal the server
  bakes directly into the loopback response's own JS source
  (extractable via one regex, no JS execution needed), and a live
  browser's own network capture confirmed zero XHR/JSON requests are
  involved at all — the solicitation table is server-rendered HTML.
  Replaced with a 3-request `fetch()` chain (cold request → regex out
  `_afrLoop` → replay with a cookie jar → follow the resulting 302 →
  real data), feeding the same cheerio-based extraction `jaa.ts`
  already uses. Verified live, twice, both times returning real active
  solicitations. Never hardcodes `_afrLoop`/`_adf.ctrl-state` — both
  are scraped fresh every run (confirmed necessary: a fabricated value
  gets rejected, re-serving the loopback shell instead). Removed
  `@sparticuz/chromium` entirely and moved `playwright-core` to
  `devDependencies` — confirmed via a real `next build` that
  `/api/scrape` dropped from bundling a full browser binary to a 173B
  function. `route.ts`'s `runtime`/`maxDuration` settings deliberately
  left untouched — no longer strictly required by `coj.ts` alone, but
  changing them is a real infra decision, not implied by this change.

## Known Issues / Recently Fixed
- **Admin submission page's "N deliverables still have bracketed
  placeholders" badge undercounted — fixed, 2026-09-08.**
  `lib/compliance/preflight-summary.ts` declared its placeholder regex
  at module scope *with the `g` flag* (`/\[[^\[\]]+\]/g`) and reused
  that same object across every deliverable via `.test()` inside a
  `.filter()`. A global regex's `.test()` is stateful — it advances
  `lastIndex` on a match and resumes from there on the *next* call
  instead of starting at 0 — so across several different strings in a
  row it silently returns `false` for a real match. Caught directly: a
  real submission's badge read "2 deliverables still have bracketed
  placeholders" while a direct DB check showed all 3 actually did.
  Fixed by dropping the `g` flag (`.test()` never needed it for a
  boolean check). The real gating logic
  (`advance-if-deliverables-complete/route.ts`,
  `hasUnresolvedPlaceholders`) was unaffected — it builds a fresh regex
  literal per call — so this was a display-only bug, not a gate bypass.
- **"New Bid" from the client dashboard reportedly dropped an existing
  client onto the signup form instead of skipping to step 2 —
  mitigated, root cause NOT confirmed, 2026-09-08.** Real user report.
  Code review found `IntakeWizard.tsx`'s session-check `useEffect`
  intact and correct, and a real Playwright reproduction (fresh client
  account, real "New Bid" click) landed correctly on step 2 — could not
  reproduce. User confirmed it was a fresh navigation, not a
  back-button/cache scenario, which points at either a transient
  failure or something account-specific. Hardened the one plausible
  mechanism: `getUser()` is a real network round-trip to Supabase's
  auth server (not a local cache read), and the effect had no retry —
  any transient failure on that call, or on the follow-up `clients`
  lookup, was silently treated identically to "not logged in"/"no
  client record." Added a bounded retry (3 attempts, backoff) that only
  fires on an actual Supabase `error`, never on a genuine error-free
  "no session"/"no client" result, so a legitimately new visitor still
  lands on step 0 immediately with no added delay. Verified no
  regression with a real seeded-client Playwright test. **This is a
  plausible fix, not a confirmed root-cause fix** — if the user reports
  it again, the next step is checking that specific account's data
  directly (their `clients` row, `auth_user_id` match), not re-testing
  the happy path again.
- **Admin inbox Board view had horizontal-only scroll, unusable on
  mobile — fixed.** Columns were a fixed `flex` row at every width,
  meaning reaching later-stage columns on a ~380px phone required
  horizontal scrolling. Added a `sm` breakpoint: columns stack full-width
  vertically below `sm`, side-by-side (original layout, unchanged) from
  `sm` up. Verified with real screenshots at 380px (stacked, correct
  Submitted→Closed top-to-bottom order) and 1440px (pixel-identical to
  before), both against the real `submissions` table via a disposable
  test admin account.
- **Admin inbox was a flat list with no way to group by stage or filter/
  sort — fixed with a Board/List toggle.** The reported complaint (the
  same client scattered across multiple non-adjacent rows, no way to
  filter to "Needs attention," no due-date sort) was real — confirmed
  directly against the code before building anything: no Kanban/column
  layout existed anywhere, and the query's only ordering was the fixed
  `is_test ASC, submitted_at ASC` FIFO. Built a new `InboxBoard.tsx`
  client component with a Board view (columns per `submission_stage`,
  active stages shown by default, closed/confirmed reachable via a
  toggle) and the original List view kept as an alternate (Board is now
  the default). Added real filter/sort controls on both views: "Needs
  attention only," "Include test submissions," and a submission-order/
  due-date sort toggle — `is_test` stays the primary sort key in every
  mode, so a test row still can't out-rank a real one just from an
  earlier due date. Verified with a real DB-backed test using a
  disposable test admin account (created and deleted for this test
  specifically, rather than touching the real admin's actual password):
  signed in through the real login form, drove the live UI against the
  real 9-row `submissions` table, confirmed columns show/hide correctly,
  the attention filter narrows 9→4, excluding test rows narrows 9→8, and
  due-date sort reorders correctly with the test row still last. The
  exact reported symptom (River City Janitorial Partners LLC scattered
  across 3 rows) now reads as 3 cards in 3 distinct columns, confirmed
  via screenshot.
- **Intake confirmation page ("We've got it") had no way back to the
  marketing site — third instance of the same navigation-dead-end
  pattern, now fixed.** `app/intake/page.tsx`'s header rendered "BidPulse"
  as a bare `<span>`, not a link — confirmed before fixing, matching the
  report. Audited every other standalone page in the app (not using
  `AppShell` or `MarketingShell`) the same way this bug was found twice
  before: `login` and `reset-password` already link their logo correctly,
  so intake was the only remaining gap. Linked it to `/pricing` (not
  `/`) since this flow creates a real account partway through step 1 —
  a signed-in visitor mid-intake clicking a link to `/` would hit
  `app/page.tsx`'s root-routing redirect and get bounced right back into
  the app, the same reason `AppShell`'s logo fix used `/pricing` instead
  of `/`. Verified in both auth states with a real anonymous context and
  a real signed-in session (disposable test admin) — both correctly land
  on `/pricing`.
- **Intake/Company Profile document upload failing with "Couldn't read
  that document" — fixed, but root cause is inferred, not directly
  reproduced.** Could not reproduce the failure with two synthetic PDF
  fixtures (a bare jsPDF text dump, and a realistic Chromium-rendered
  PDF with real tables/fonts) — both extracted every field correctly
  through the real API and the real browser upload flow on both
  surfaces (Company Profile page and intake wizard). No real fixture
  was actually attached to the brief that reported this despite its
  wording, so the exact failing document was never available to test
  directly. Most probable cause based on strong circumstantial
  evidence: neither `extract-from-document/route.ts` nor
  `extract-company-profile/route.ts` had a `maxDuration` override, so
  both ran on Vercel's default ~10s serverless timeout — and real
  Claude extraction calls were already observed taking 15–25s even for
  tiny test files in this session, so a larger real-world document
  would plausibly get killed mid-request. A killed function returns a
  non-JSON platform error page, which breaks `res.json()` client-side
  and surfaces as exactly this generic message with no indication it
  was a timeout — and this class of failure can't reproduce locally
  (`npm run dev` has no such limit), consistent with nothing failing
  despite thorough local testing. Fixed by adding
  `export const maxDuration = 60;` to both routes, and by hardening
  `CompanyProfileUpload.tsx` to show a distinct message for a non-JSON
  (crashed/timed-out) response instead of folding it into the same
  string as "no readable text" or "no network connection." Saved both
  synthetic fixtures into the repo (`test-fixtures/`, with a README) so
  future verification doesn't need to rebuild them from scratch. This
  is flagged honestly as the most probable cause, not a confirmed one —
  a real deployed Vercel timeout can't be directly tested from local
  dev.
- **Favicon vs. nav/login logo mismatch — decided, no code change.**
  The logo audit (2026-09-01) confirmed every location already uses its
  correctly *intended* asset (no code-level mismatch); the open question
  was purely whether to redesign the favicon to visually match the
  plain heartbeat nav/login mark, or keep its bolder "BP" monogram
  deliberately. Mike's call 2026-09-02: keep it as-is, for small-size
  legibility. Closed.
- **Due-date alerting was reported as broken but is actually already
  correct — audited, not fixed.** The report claimed the daily digest
  (`app/api/daily-digest/route.ts`) only fires on staleness, so a
  submission due tomorrow that was touched today would get no alert.
  Traced the actual filter before writing any code: it's a genuine 3-way
  OR (`breachedTurnaround || daysUntilDue <= 5 || stale`), not staleness
  gating the due-soon check — a due-tomorrow-but-fresh submission already
  fires today, and the email template already labels it distinctly ("DUE
  SOON — N days left," sorted to the top). Git history shows this file
  was only ever touched once, so it's not a regression either. Likely
  explanation for the report: the variable name `staleItems` and the
  `"nothing_stale"` skip reason read as if staleness gates everything,
  without tracing the actual OR. Verified for real, not just by reading
  the code: inserted an isolated test submission (`daysSinceUpdate: 0`,
  `breachedTurnaround: false`, due tomorrow) and confirmed it passed the
  real filter purely on the due-soon condition. No code change made.
- **"Forgot password?" appeared to send a sign-in link instead of a
  password-reset link — root cause was a deployment gap, not a code
  bug.** Real evidence: emails received while testing on the live site
  were titled "Your sign-in link" (Supabase's magic-link template), not
  "Reset your password" (the recovery template) — four arrived within a
  ~3 hour window, consistent with repeated attempts. Investigated by
  checking the actual deployed commit: `origin/main` was still at
  `e83f77a` when this was reported — the forgot-password commit
  (`46c999f`) had been committed locally but never pushed, so production
  had no "Forgot password?" feature at all yet, only the pre-existing
  "Sign in without a password" magic-link option. That's the one that got
  clicked/tested, and it correctly sent exactly the sign-in-link email
  it's supposed to. Confirmed the actual code is correct (grepped every
  call site — the "forgot" mode's form really does call
  `resetPasswordForEmail`, not `signInWithOtp`) and confirmed via the
  Supabase Management API that the recovery and magic-link mailer
  templates are genuinely distinct on the project (`mailer_subjects_recovery
  = "Reset your password"` vs. `mailer_subjects_magic_link = "Your
  sign-in link"`) — so there was nothing to fix in either the app code or
  the Supabase project config. Pushed the previously-stranded commits
  (`bebb5b6` now on `origin/main`) so this stops recurring. **Retested
  live and confirmed fully working**: a real click-through received an
  actual "Reset your password" email, followed it to a working form,
  changed the password, and logged in with the new one successfully.
  Fully closed.
- Fixed twice: RLS blocking `clients` insert during signup. Most recent
  instance was Vercel-only (didn't reproduce in Codespace) — suspected timing
  issue between `signUp()` resolving and the session being ready for the
  `clients` insert's RLS check.
- Admin signup page (`/admin/signup`) was removed — this business only needs
  one organization; the page was a real risk (anyone could accidentally spin
  up a second, disconnected org).
- Fixed 2026-08-31: the `rfp-documents` storage bucket had four broad,
  ownership-blind RLS policies (anyone could read; any authenticated user
  could update/delete/upload into ANY client's or submission's folder, not
  just their own) sitting alongside properly-scoped ones — the broad grants
  fully overrode the scoped checks. Closed via
  `supabase/migrations/20260831210857_fix_rfp_documents_storage_rls.sql`
  (added `can_access_client_object()` for the certifications upload path,
  which the old scoped policies didn't cover, then dropped the four broad
  policies).
- Fixed 2026-08-31: the follow-up above is done. `file_url` columns
  (`submission_documents`, `deliverables`, `client_certifications`) now
  store the bare storage path, not a public URL; every read site generates
  a signed URL at request time (`lib/storage.ts`) instead of persisting
  one. The `rfp-documents` bucket is now private
  (`supabase/migrations/20260831214629_make_rfp_documents_bucket_private.sql`).
  One bug found and fixed mid-migration: certification/deliverable uploads
  never sanitized filenames, so the initial backfill left percent-encoded
  paths (spaces as `%20`) that didn't match the real storage key — corrected
  in a follow-up migration and verified live against `storage.objects`.
- Fixed 2026-08-31: `lib/agency-type.ts`'s school/airport detection regexes
  (`\bschool\b`, `\bairport\b`) never matched their own plurals — no word
  boundary between "l"/"t" and a trailing "s" in "Schools"/"Airports". Real
  impact: "Duval County Public Schools" silently never triggered the Level 2
  background-check compliance row. Also affects real airport-authority names
  using plural "Airports" (e.g. "Metropolitan Washington Airports
  Authority"). Fixed to `\bschools?\b` / `\bairports?\b`; `transit` checked
  and didn't have the same bug.
- The Dar Mano Consulting "Computer support for Veterans" submission
  (the one that prompted the IT vertical and trade-coverage safety net
  work) turned out to be test data, not a real client bid — confirmed
  by Mike 2026-09-02. It correctly showed NO VA-system/CUI flags because
  its scope text has no confirmed trigger language (the system declining
  to guess, same as always), but since it isn't a real bid there's
  nothing to manually verify against a real solicitation. Corrected its
  `is_test` flag to `true` (it was `false`, inconsistent with reality —
  would have counted toward real reporting/revenue and competed for
  real queue position otherwise). Verified with a direct before/after
  read of the record.


## Business/Naming Note
**Resolved, 2026-09-19 (see the Deploy status note at the top of this
file): the product is now named "First Coast Bids," not "BidPulse."**
The trademark question below was the original motivation for
reconsidering the name; it's effectively moot now that the rename
already happened. Kept below as real history of the reasoning, and
because the old name still lingers in a few places (the GitHub repo,
`bidpulse.co`, `package.json`) that a future session may need this
context to understand.

A different company (ad-tech, Boston, bidpulse.io) already uses the name
"BidPulse" — different industry, likely low trademark risk, but Mike was
advised this isn't a legal opinion and to check the USPTO database or consult
an attorney before investing further in the name. Also relevant: he's not
fully happy with the current logo and was already planning to revisit it —
worth reconsidering both together.

**New shield/heartbeat logo is now wired in**, ahead of the trademark
question being resolved — the three PNG variants (BP-monogram shield icon,
horizontal shield+wordmark, stacked shield+wordmark) were trimmed to their
real content bounds and given a transparent background (the originals were
opaque-white 1024x1024 canvases, which would have shown ugly white boxes
against the app's own surface color), then wired into every actual asset
location: `app/icon.png` is the new shield+BP+heartbeat mark (replacing
both the old glossy 3D icon and the `app/icon.tsx` placeholder — that
placeholder's own comment said "until a real designed logo exists," so
it's deleted now that one does), `public/logo.png` is the new horizontal
shield+wordmark (used by `AppShell.tsx` nav, `MarketingShell.tsx` nav +
footer, and the `PacketButtons.tsx` PDF-preview watermark — all four call
sites' width/height props updated to the new image's real aspect ratio so
none of them render squished), and the new `public/login-logo.png` (stacked
variant) now replaces the old wide logo on the login page. Verified with
real Playwright screenshots of the live dev server's homepage nav and login
page — both render correctly. This does supersede the current logo
entirely (the old `logo.png`/`icon.png` are gone, not kept as alternates) —
worth flagging that the trademark question is still open, so this
represents committing real design/engineering time to a name that might
still change.

## Package Pricing (set 2026-09-16; **publication status changed since —
see flag below, not independently re-verified this pass**)
**One-off: $399/bid. Retainer: $649/mo (up to 2 bids/month, ~$325/bid
effective).** These were the actual numbers to quote when confirming
pricing directly with a real client through the existing manual-invoicing
flow — deliberately **not** published on the public pricing page
(`app/(marketing)/pricing/page.tsx`), which by design showed no dollar
amounts ("we confirm exact pricing with you directly before any work
starts"). Mike explicitly chose to keep it that way rather than publish
these figures, **at the time this was written.**

**Flag: `git log` shows a later commit, `deb8fdd feat: publish real
starting prices, cap Pilot's free offer, fix fabricated Most Popular
badge`, that sounds like it directly reverses the "deliberately not
published" decision above.** `PRODUCT.md` (current, 2026-09-19) also
states real starting prices as public-facing facts: Pilot free for the
first 10 clients, One-off starting at $399, Retainer starting at
$649/mo. Trust `PRODUCT.md` over the paragraph above for current pricing
language; this section is kept for the *reasoning* behind the numbers,
which is likely still valid, not for whether they're published.

**Not a modeled number — a starting bet, by design.** BidPulse is
pre-revenue with zero completed bids, so there's no real labor-hours data
to price against yet. Built from: a real, measured LLM API cost floor of
~$1.35–$2.00 per submission (via actual Anthropic API calls against a
real 34-page municipal janitorial RFP, run this session — see the
Confirmed Working entry on the COJ forecast scraper for the methodology),
a reasoned but unmeasured assumption of 3-5 hours of real founder labor
per bid, and real market context that traditional bid-writing consultants
charge $500–$2,500+ per proposal for small-business government bids.
Deliberately priced well above the ~$2 API floor — pricing near it would
read as "cheap AI tool" and undermine the real differentiator (a real
person prepares and reviews every deliverable, nothing is fully
automated).

**Revisit as soon as a real bid is completed and Mike tracks his actual
hours on it** — that one data point turns this from a reasoned estimate
into a real, measured cost floor worth re-pricing against.

## Working Style Notes (for continuity)
- Always verify fixes with real regenerated output/evidence, not just "done"
- Auto-draft content must never invent specific facts (registration numbers,
  insurance amounts, brand names, statistics) — bracketed placeholders or
  "NEEDS VERIFICATION" only, grounded strictly in real client/bid data
- Mike is not deeply experienced in gov contracting but is actively
  researching it himself and bringing back real domain knowledge to build in
- Solo operator with a day job — features that catch problems automatically
  (digest emails, SLA tracking) are treated as essential, not nice-to-have
- **Codespace idle-timeout is a real recurring nuisance** (carried over
  from `CODESPACE-REBUILD-HANDOFF.md`, archived, folded in here): the
  codespace auto-stops between exchanges, which wipes the running dev
  server and resets port 3000's forwarding back to private. If a
  forwarded URL 404s, check whether the codespace/dev server are still
  running before assuming anything else is wrong — re-run `npm run dev`
  and `gh codespace ports visibility 3000:public --codespace <name>`
  after any restart. Worth raising the idle-timeout setting at
  github.com/settings/codespaces if this keeps interrupting real work.
- **This file itself has gone stale for a week or more at a stretch at
  least twice now** (see the 2026-09-22 and 2026-09-15 Deploy status
  notes, each describing the previous entry as no longer trustworthy) —
  updating it is easy to skip under real work pressure, but a status doc
  that silently drifts behind `origin/main` is worse than no doc, since
  it actively misleads. Worth treating "update PROJECT-STATUS.md" as
  part of finishing a session's work, not an optional last step.

## Related docs
This file and `PRODUCT.md`/`DESIGN.md` are the three canonical,
actively-maintained docs for this project — status/history here, product
positioning and brand/visual identity there. Everything else:
- **Still active, kept separate on purpose (different job, not status
  history):** `CLAUDE.md` (process/convention lessons, auto-loaded every
  session), `CODESPACE-REBUILD-BRIEF.md` (how to rebuild the dev
  environment from scratch), `Admin-Review-Rubric.md` (the live
  per-deliverable review checklist), `rfp-extraction-pipeline-design.md`
  (the RFP-extraction design — still the right reference for building
  Phase 3/4, even though Phase 1/2's actual implementation has since
  moved to `rfp-extractor/`, see the note near the top of this file),
  `rfp-extractor/README.md` and its `evidence/` docs (the current
  RFP-extraction module's own docs), `scripts/README.md`,
  `test-fixtures/README.md`, and the `mockups-reference/` docs.
- **Moved to `archive/`, 2026-09-22, with their unique content folded
  into this file where it was genuinely missing** (each archived file
  still exists in full at that path — this was a move, not a deletion):
  `BUILD-ORDER-BIDPULSE.md` (had gone stale in lockstep with this file,
  substantially duplicated this file's own Currently Open list; its two
  genuinely-missing items are now items #14-15 above and the
  RequestInfoForm entry under Confirmed Working), `CODESPACE-REBUILD-
  HANDOFF.md` (a single dated session snapshot from 2026-09-05,
  superseded by this file's own ongoing narrative; its one genuinely
  new fact — the codespace idle-timeout nuisance — is folded in above),
  `MIGRATION-TO-BIDPULSE.md` (the original self-serve → done-for-you
  business-model migration plan; fully executed, purely historical now),
  `BRIEF-rfp-extraction-phase1.md` and `BRIEF-rfp-extraction-phase2.md`
  (specs for the original Phase 1+2 build under the now-gone
  `rfp-extraction/` path; the current `rfp-extractor/` module has its
  own, more accurate docs).
