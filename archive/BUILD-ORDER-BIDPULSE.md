# BidPulse — Build Order

Read `PROJECT-STATUS.md` first for full context, evidence, and history.
This file tracks what's actually queued to work on next.

## 🚀 Pre-launch checklist — do these before client #1
1. ~~Dev/prod Supabase split~~ — **done and verified 2026-09-02.**
2. ~~File upload on the new production project~~ — **done and verified
   2026-09-02.**
3. ~~"Message admin" UI~~ — **done and verified 2026-09-02.**
4. ~~Admin delete action~~ — **done and verified 2026-09-02.**
5. ~~"Request info from client" voice/duplication fix~~ and
   ~~certifications optional upload~~ — **both done and pushed to
   `origin/main` (`acea384`)**.
6. ~~Client dashboard Preview/Download auto-trigger~~ — **CLOSED, fully
   verified on production** (real HTTP POST, real stage change, real
   negative case with an admin session correctly rejected).
7. ~~Push local commits + apply pending migrations to production~~ —
   **done.** 12 commits pushed to `origin/main` (`acea384..abdfa9f`,
   plus the `is_test`-toggle finding below), all migrations applied and
   verified via `supabase migration list` (local == remote), `schema.sql`
   regenerated to match. Vercel auto-deploy from Git confirmed genuinely
   working (a harmless test commit produced an automatic deployment,
   no manual `vercel --prod` needed).
8. ~~submitted → in_review auto-trigger~~ — **CLOSED, fully verified on
   production.** Built, migration applied to production, commit pushed
   — both independently confirmed via direct checks (production column
   exists, commit is on `origin/main`).
9. ~~Intake flow: move document upload earlier~~ — **investigated, not
   building.** Real architectural constraint found (see item #2 below),
   not a simple reorder. Mike's call to leave the flow as-is.
10. ~~Admin page + Fit Check show stale company info~~ — **root-caused
    and fixed.** See item #3 below.
11. ~~Phone number not appearing on admin page~~ — **fixed** with a
    display-layer fallback. See item #4 below.
12. ~~Production's actual admin-inbox health~~ — **CLOSED, fully
    verified on production** (a genuinely new client + submission
    appeared correctly on first load, no cache, no manual refresh).
13. **Inbound bid email pipeline** — built and verified, blocked on
    Mike's IONOS/Gmail/Apps Script setup. See item #6 below. Lower
    urgency; can wait until after launch if needed.
14. **Final pass on `PROJECT-STATUS.md`'s Known Issues** — confirm
    nothing still genuinely open has been missed before launch. Not done
    in any session so far.
15. **Push 19 local commits to `origin/main` and deploy — top
    priority, nothing below this line is live yet.** Local `main` is at
    `58a3279`, `origin/main` still at `fb688a4` — get a fresh
    `git log origin/main..HEAD --oneline | wc -l` before trusting this
    count, it goes stale fast. Covers the full Stitch "Industrial
    Precision" redesign, the Past Performance feature, the PDF
    placeholder gate, the RFP-documents admin view, and the City of
    Jacksonville scraper rewrite (drops `@sparticuz/chromium`) — see
    `PROJECT-STATUS.md`'s Deploy status line and Confirmed Working
    section for full detail, **including a real, live divergence risk
    with a separate cloud session also working on this repo** that
    needs Mike's decision before either side pushes. The compliance-
    matrix row editor mentioned in older summaries was built *and then
    reverted* per Mike's own feedback — don't push expecting to find
    it. One wrinkle before pushing: the `client_past_performance`
    migration was already applied directly against production (no
    DB-DDL access this session) — confirm via `supabase migration
    list` that it's recorded as applied remotely before running
    `supabase db push`, and regenerate `schema.sql` after.
16. **RFP extraction pipeline — new initiative, standalone
    `rfp-extractor/` Python module (singular — the package that won a
    2026-09-10 merge over an independent `rfp-extraction/` build from a
    parallel session; see `HANDOFF-2026-09-10.md`), not part of this
    app-build-order list's usual scope but worth tracking here since
    it's real, ongoing work.** Phases 1 (admin-field regex) and 2
    (section segmentation) are both built and verified with real
    evidence against a real fixture (`test-fixtures/RFP-2026-0847-JANI.pdf`),
    2026-09-11 commit `c3fea15` — Phase 2 was the losing session's
    contribution, recovered from this checkout's own git history
    (it was never lost, just deleted from HEAD by the merge) and ported
    onto `rfp-extractor`'s actual conventions rather than copied
    verbatim: a new `rules/section_synonyms.json` data file matching the
    existing `admin_fields.json` pattern, dataclasses folded into the
    shared `models.py`, and real `pytest` regression coverage
    (`tests/test_sections.py`) for the three real bugs its original
    evidence pass found, not just narrative writeup. Phase 3 (obligation
    harvesting — the part that actually reduces Mike's review burden)
    and Phase 4 (table extraction) are not started. See
    `PROJECT-STATUS.md`'s Confirmed Working entry and
    `rfp-extractor/README.md` / `rfp-extractor/evidence/phase2/README.md`
    for detail and how to run it.

## Status as of 2026-09-05 (reconciled across two same-day sessions)
The first 2026-09-05 session closed two real investigations in dev only
(admin-inbox ambiguous-FK bug, Preview/Download auto-trigger RLS bug)
but left everything local. A second same-day session pushed all of it:
applied the pending migrations to `bidpulse-production` directly
(verified clean via `supabase migration list`), regenerated `schema.sql`
(it had never been updated after those migrations landed in dev), and
pushed 12 commits to `origin/main`. A third round of direct verification
(real HTTP requests against `bidpulse.co`, real DB reads) confirmed
every pipeline automation and the admin-inbox fix genuinely work on
production, not just in dev — see `PROJECT-STATUS.md`'s Confirmed
Working section for the actual evidence.

Also closed this same day: the intake-upload-reorder investigation
(real architectural constraint found, decided not to build), the
stale-data investigation (admin page was never actually stale; Fit
Check genuinely was, now fixed), and the phone-number display fix.

A `CLAUDE.md` file exists specifically to carry forward hard-won lessons
(the FK-ambiguity rule chief among them) into every future Claude Code
session automatically.

## Active + deferred

### 1. Split dev and production Supabase projects — CLOSED
Fully closed and verified 2026-09-02. See `PROJECT-STATUS.md` for the
complete troubleshooting history (env var type/naming issues, the
stale-deployment build-time gotcha, Auth URL config, OTP-signup
behavior, and the later-corrected Git-integration finding).

### 2. Intake flow: move document upload earlier — investigated, not building
**Real ask, real architectural blocker found before building anything.**
The ask: show the "Want to save some typing?" upload prompt right after
company name, before any other manual field — currently it appears
after company name, contact name, email/phone, *and* password are all
collected and the account is created.

**Why the literal ask isn't achievable without a real tradeoff:**
- `extract-company-profile/route.ts`'s auth check (`if (!user) return
  401`) isn't a technical dependency of the extraction logic itself —
  the route is stateless. It exists specifically to stop an anonymous
  visitor from hitting a paid Anthropic-backed endpoint for free and
  unlimited.
- A session can only exist after Supabase Auth `signUp()`, which
  requires an identifier (email/phone) + password.
- The same submit that creates that session also inserts the `clients`
  row, which requires `company_name` **and** `contact_name` — both
  `NOT NULL` in the schema.
- So today's 4 fields (company name, your name, email/phone, password)
  are already the practical minimum before an account — and therefore
  the upload gate — can exist. There's no field left to defer without
  either a schema migration (make `contact_name` nullable, restructure
  the insert) or relaxing the extraction route's anti-abuse gate
  (allowing anonymous extraction calls, reopening a real cost/abuse
  surface on a paid AI endpoint that was deliberately closed).

**Decided (Mike): leave the flow as-is.** Neither tradeoff (schema
change for a minor UX win, or reopening the abuse surface) was worth it.
Closed, not building.

### 3. Admin page + Fit Check show stale company info — root-caused and fixed
**Investigated before assuming a fix, per this project's history of
caching-related surprises.** The two halves turned out to have different
answers:
- **The admin page's "Client info" panel was never actually stale.**
  Confirmed it's a genuinely live join
  (`clients!submissions_client_id_fkey(...)` in
  `app/admin/inbox/[id]/page.tsx`), field-by-field, no snapshot
  elsewhere, no caching directive anywhere in the Supabase client setup,
  and Next.js 15 defaults to no fetch caching (unlike Next 14). This
  panel already reflects current data on every load.
- **Fit Check genuinely was stale.** `fit_alignment`/`fit_explanation`
  only ever got (re)computed at two call sites — intake final-submit
  and admin "Assign" — confirmed via `grep` across the whole app.
  Nothing re-triggered it when a client updated their Company Profile
  afterward, so it silently kept citing missing license/insurance/certs
  long after those were added — most likely what the original report
  actually saw, misattributed to "the admin page" broadly.

**Fixed:** `CompanyInfoForm.tsx` now re-triggers `generate-fit-check`
for the client's own active submissions (non-draft, non-closed) after a
successful profile save, using the same fire-and-forget browser-fetch
pattern `finalizeSubmission()` already uses successfully. Verified the
new filter query directly against the real dev database with a
disposable client and three submissions (draft/active/closed) —
correctly returns only the active one.

### 4. Phone number not appearing on admin page — fixed
**Decision made:** display-layer fallback, not a schema/extraction
change — the earlier reasoning for keeping `phone` (the account's
login/SMS-auth number) separate from `business_phone` still holds
(extraction deliberately never writes to an auth-linked field from a
guessed document value). Third recurring complaint made the friction
worth fixing anyway.

**Fixed:** the admin page's "Phone" row now shows `business_phone` with
a "(business)" label when the dedicated `phone` field is empty, instead
of showing nothing. Verified against the real running dev server with a
disposable admin + client account and a real authenticated session
cookie — both the number and the label render correctly on the actual
page.

### 5. New feature: extract bid fields from an uploaded RFP document — built and verified
**Real finding before building anything: the extraction backend already
existed.** `app/api/extract-from-document/route.ts` was built in an
early commit (`1609c2a`, well before this brief) — it already extracted
agency/solicitationNumber/dueDate/scope/naicsCodes/smallBusinessStatuses/
setAsides from an uploaded document with the same "never invent, return
null if not found" discipline used elsewhere. It just had **zero UI
callers anywhere in the app.** The real gap was integration, not a
missing capability.

**Built:** `components/ui/RfpDocumentUpload.tsx`, mirroring
`CompanyProfileUpload.tsx`'s upload/error-handling pattern exactly, wired
into the intake wizard's "About the bid" step as an upload-first
interstitial (matching the company-info precedent) — skippable via
"Skip and type it myself," prefills only the fields actually found,
leaves the rest blank for manual entry.

**The one real technical risk — hardened, not just accepted:** real
solicitations often list multiple dates (site visit, Q&A deadline,
pre-bid conference, amendment deadlines) that are NOT the actual
submission due date. The extraction prompt now explicitly names each of
those decoy date types and instructs the model to return `null` rather
than guess when it can't clearly identify which date is the real
submission deadline — "a wrong date here is worse than no date."

**Verified against three adversarial synthetic solicitations** (real
HTTP POSTs to the live route with a disposable authenticated test user,
not a simplified proxy):
1. A document with 5 distinct dates (pre-bid conference, question
   deadline, site-visit window, addendum date, and the actual due date)
   — correctly extracted only the explicitly-labeled submission deadline.
2. A harder case where the real deadline required cross-referencing a
   "bid opening" date named in prose against a separate schedule list
   above it — resolved correctly.
3. A genuinely ambiguous sources-sought notice with no real due date
   (only unrelated budget/fiscal dates) — correctly returned `null`
   rather than guessing.

`tsc --noEmit` and `next build` both clean.

### 6. Inbound bid email pipeline — built, blocked on Mike's email setup
Code is done and verified (`app/api/inbound-bid-email/route.ts`, a second
producer into `matched_opportunities` alongside the existing scraper) —
real extraction calls and direct DB read-backs confirmed it works. **Not
yet live in production** — still needs Mike's IONOS/Gmail forwarding
rule, label/filter, and Apps Script trigger set up per
`scripts/README.md`, plus the real `INBOUND_BID_EMAIL_SECRET` added to
Vercel's **production** environment specifically.

### 7. Client-facing profile-completeness indicator — dashboard done, intake screen now done too
**Built and verified on the dashboard:** `lib/compliance/profile-
completeness.ts` — a deterministic, equally-weighted presence check
across 6 fields (NAICS codes, license number, insurance provider/
coverage, business address, business phone, at least one certification
on file), no LLM judgment call. Replaces the old fit badge in the
dashboard's Status card entirely — `fit_alignment` removed from that
query and rendering. Shows "Profile N% complete," never red at any
level, since there's nothing alarming left to soften. Verified against
the real dev server and database: a client with only 1 of 6 fields set
shows exactly 17%, and shows 100% on a fresh reload after filling in the
rest — confirms it actually updates live, the same staleness risk item
#3 already found and fixed for Fit Check itself.

**`fit_eligibility_concern` and the admin-side Fit Check panel are
untouched** — this only ever replaced the client-facing dashboard
signal.

**Now also done: the intake confirmation screen.** `IntakeWizard.tsx`
was explicitly left out of the original scope, and real screenshot
evidence confirmed it still showed the old badge plus the raw
`fit_explanation` text — the same third-person voice problem caught
elsewhere, and worse there since it's the full paragraph, not just a
label, on the very first screen a client sees after submitting. Fixed
with the same completeness treatment as the dashboard: the confirmation
screen now fetches the client's own row + certification count
client-side once the submission locks and renders the same "Profile N%
complete" badge, computed via the same `computeProfileCompleteness()`.
**A real codebase-wide search** (grep for `fit_alignment`,
`fit_explanation`, `fit_eligibility` across every client-facing
component) confirmed there wasn't a third location.

**Also fixed on this same screen:** the desktop-width issue — it sat in
a narrow, fixed-width column with large unused margins even on a
clearly desktop-width viewport, reading like a mobile-width container
that never picked up a proper desktop layout. Widened the intake page
container (`max-w-2xl` → `md:max-w-3xl`) and the confirmation screen's
inner cards (`max-w-md` → `md:max-w-lg` on desktop), leaving mobile
sizing unchanged.

**Verified, including a real browser click-through — CLOSED.**
`tsc --noEmit` clean, full `next build` succeeds (including the
build-time trade-card drift check, confirming it wasn't accidentally
weakened). Real Playwright session: signed up a disposable client,
skipped both upload interstitials, submitted a bid, reached the real
confirmation screen. Confirmed via the actual rendered page: "Profile
0% complete" badge renders correctly, zero trace of the old fit-badge
text anywhere on the page. Measured the real rendered `<main>` bounding
box directly: 768px wide at a 1440px desktop viewport (the new
`md:max-w-3xl`), correctly full-width (390px) at a 390px mobile
viewport — confirms the width fix applies on desktop without regressing
mobile. Real screenshots taken at both sizes. Disposable client,
submission, and auth user deleted afterward and confirmed gone.

**Not built yet, deliberately, real reason:** auto-populating the
compliance checklist from these same missing-field signals — this
item's own earlier brief asked to merge with the badge replacement to
avoid drift. `checklist_items` has no column to distinguish an
auto-generated item from an admin-created one, so a safe merge needs its
own schema migration — deliberately not built alongside this session's
already-pending migration, to avoid stacking a second one during a
session with real migration-permission friction. Needs a real design
pass: a `source`/`auto_generated` column, and rules for when an
auto-item should be marked done or removed once the client fills the
corresponding field.

**Still needed for the completeness percentage itself (both
locations):** a real browser click-through — a client with a
mostly-empty profile shows a low completeness number on both the intake
confirmation page and the dashboard; after filling in several fields,
both update on a fresh reload. Also real screenshots of the
desktop-width fix at a genuine desktop viewport, confirming mobile
still looks correct afterward. The itemized checklist mentioned above
is a separate, not-yet-built piece — see the schema-migration note
above; nothing to verify there yet.

### 8. Law enforcement/detention agency-type integration check — built
**Checked directly, not assumed, before building.**
`TRADE_SPECIFIC_CERTIFICATIONS`' bloodborne-pathogen/PREA rows are fine
as-is — they trigger off `submission.scope` text directly, not agency
name, so compliance-matrix behavior for a detention/correctional bid is
already correct and unaffected by this gap; deliberately left
`generate-draft`'s compliance-matrix rows untouched. **What was
actually missing, now built:** a `detention` `AgencyType` in
`lib/agency-type.ts` (matches sheriff's office / correctional / jail /
detention / police department in the agency name — "police" alone
deliberately excluded to avoid over-matching routine city-agency
mentions), plus the equivalent softer fit-check note in
`generate-fit-check/route.ts` (confirm background checks and PREA/
bloodborne pathogen training) matching the existing
airport/school/transit/VA pattern. Verified directly: 5 real test cases
including two negative controls ("City of Jacksonville" alone, the
airport authority) confirmed no over-matching; `tsc --noEmit` and
`next build` both clean.

### 9. Retainer package usage tracking
Track how many bids a retainer client has used this month against the
"up to 2/month" promise. No schema yet — needs a usage-count field or
derived query against `submissions`/`packages`, plus a decision on how
resets are timed (calendar month vs. rolling 30 days). Explicitly
deferred until there's a real retainer client to test against.

### 10. No admin UI toggle for `is_test` — built
**Real finding, then built.** While setting up a disposable test client
to verify a production fix, checked whether there's any admin-facing
way to mark a client/submission `is_test = true`. There wasn't — the
column is real and actively used throughout the app (admin inbox
ordering, digest emails, reporting all filter on it), but nothing in
the app ever wrote `is_test: true` anywhere, including the intake
wizard; every instance had been a direct database edit. **Built:** a
new `IsTestToggle.tsx` on the admin submission detail page's Status
panel (same pattern as the existing `EstimatedValueInput.tsx` admin
control), writing directly to `submissions.is_test` — already covered
by the existing "admins manage submissions" RLS policy, no migration
needed. Replaces the old read-only "TEST" label in the same spot.
Verified: `tsc --noEmit` and `next build` both clean. **Not yet
verified:** an actual admin click-through (real login, click the
toggle, confirm the DB write) — worth doing before calling this fully
closed.

### 11. Landing page "Trades we work with" copy — built and verified
Real concern: the grid only lists 4 trades, but the intake flow already
accepts *any* trade and gives an honest heads-up (not a rejection) when
it's outside those four — the landing page implied a harder gate than
the product actually has. **Built:** copy below the trade grid
(`app/page.tsx`) — "We're deepest in these four — but if you're in a
related trade, go ahead and start your bid. You'll get an honest
heads-up right away if something's outside our sweet spot," with the
real tradeoff (less tailored compliance guidance outside the four)
stated honestly, plus a small secondary "Contact us" link. Points at
`/intake` as the primary CTA, not a contact form — the product already
answers the question for free, and a reply-and-wait step is the wrong
thing to introduce at the exact moment someone's deciding whether to
try BidPulse. Did not touch `TRADES`, `KNOWN_TRADES`, or
`assertNoMissingTradeCards()`. Also reviewed and lightly clarified the
existing intake-time trade-coverage heads-up on the dashboard (an
ambiguous referent in the old wording, "We'll flag that for you when
it's ready") without changing its tone; the compliance-matrix
deliverable's own version of this note was reviewed and already read
clearly, left unchanged. Verified with a real screenshot of the updated
section at a genuine desktop viewport, and confirmed both `/intake` and
`/contact` resolve (200). `next build` succeeded, confirming the
drift check wasn't weakened.

## Process / Infrastructure Recommendations
These aren't things a client would ever notice missing — they're
structural gaps that make the *next* version of problems already seen
recur less likely.

### A. CI safety net — done
`.github/workflows/ci.yml` added: type check + build on every push to
`main` and every PR, using dev-project secrets only. **Still needs Mike**
to add the listed secrets under repo Settings → Secrets and variables →
Actions before it actually runs.

### B. Regression-test script — done, three real bugs found and fixed before committing
`scripts/regression-check.mjs` added — not just copy-pasted. Ran it
before committing and it failed, for real reasons, not flakiness:
- Test 1 used a bare `clients(...)` embed — permanently ambiguous now
  that `info_attested_by` is a real second FK by design (the actual fix
  was disambiguating every real call site, not preventing the second FK
  from existing).
- Test 2 attempted a raw client-session `UPDATE` directly, which the
  real fix deliberately makes fail forever (the fix moved the write
  server-side through the service role, keeping client RLS restrictive
  on purpose).
- A third, separate bug: a silent session-propagation issue — plain
  `signInWithPassword()` on a bare Node client doesn't reliably attach
  the session to later queries with no browser storage to persist it
  from.
All three rewritten to test the real fixed mechanisms and fixed
propagation pattern. **Verified against the real dev database — all
tests genuinely pass now**, and separately re-run against production's
own database with the same result.

### C. Consolidate admin communication surfaces — done and verified
`RequestInfoForm.tsx` now shows a picker of the submission's open
checklist items (plus "Other" for anything not tracked yet); selecting
one pre-fills a second-person request built from that item's own label,
sends the notification tied to it, and marks it `in_progress` instead of
creating a duplicate row. "Other" still creates a new checklist item
exactly as before. Verified against the real dev server and database:
the existing-item path updates in place, the "Other" path still creates
a genuinely new row.

### D. Golden-set regression check for the "never invent facts" guarantee — not built, needs real design time
Deliberately not rushed. LLM outputs are non-deterministic, so a literal
diff-against-expected-text script would be fragile and fail on harmless
wording variation, not just genuine fabrication. A correct version needs
to check *structural* presence/absence (does an expected fact appear,
does an expected null/placeholder stay a placeholder, does anything
appear that wasn't in the source input) rather than exact-text matching
— a real script-design decision, plus real API cost to run repeatedly.
Existing fixtures in `test-fixtures/` (Sunrise Janitorial Solutions,
Coastal Clean) are a reasonable starting point rather than building new
ones from scratch. Next concrete step, not done yet.

### E. Backup/disaster-recovery plan — Mike's own check, not a code task
Log into the Supabase dashboard for `bidpulse-production` → Settings →
Add-ons or Database → Backups, confirm what's actually available on the
current plan tier, decide whether to upgrade given real client data now
exists. If manual-only, the free DIY option (a scheduled GitHub Action
running `supabase db dump`, storing the result in a private repo)
remains available and doesn't require a plan upgrade — nothing to build
until Mike decides which path to take.

### F. Rate limiting on public, cost-incurring routes — premise checked, doesn't hold
**Investigated before building.** Checked every route in `app/api` that
instantiates the Anthropic client: `extract-from-document` and
`extract-company-profile` both already require a real authenticated
Supabase session (401 if absent); `inbound-bid-email` already requires a
shared-secret header. **There is no genuinely public, unauthenticated,
cost-incurring AI route in this codebase right now.** Not zero risk — a
real signed-up account could still hammer an extraction endpoint — but a
materially different, lower-priority shape of problem than anonymous
public abuse. The right future defense, if abuse ever appears, is
per-account/per-`client_id` limiting using the auth context these routes
already have, not IP-based limiting. Not built now.

### G. Error monitoring and alerting — needs Mike to create an account first
Sign up for Sentry (or similar), get a DSN key, hand it to a future
session to wire in `@sentry/nextjs`. Can't proceed without the DSN — not
a code task until then.

## Admin Review Bottleneck — Mitigations

### 1. Reduce what needs review by improving inputs — already underway
Not new work — the profile-completeness indicator (item #7) and the
phone-number fix (item #4) already reduce how many bracketed
placeholders/gaps a draft needs, directly reducing review time.

### 2. Structured review checklist — done
`Admin-Review-Rubric.md` added to the repo — a concrete per-deliverable-
type checklist replacing freeform "read the whole thing carefully"
review. Process document, ready to use immediately, no code involved.

### 3. Batch similar review work
Process habit, not a code task — no artifact needed.

### 4. Surface mechanical checks before full review — done and verified
`lib/compliance/preflight-summary.ts`: three deterministic checks
(deliverable content present, certification verified/unverified counts,
leftover bracketed placeholders in deliverable content), rendered as
status chips at the top of the admin submission detail page. Verified
against the real dev server and database across both an incomplete
state (1/3 deliverables, unverified cert, active placeholder) and a
fully-complete state — all three checks correctly flip.

### 5. Pricing as a deliberate throttle — Mike's decision
Business decision, not implementable.

### 6. Hire a part-time first-pass reviewer — Mike's decision
Business/hiring decision, not implementable now.

## Not building yet (still explicitly deferred)
- Stripe checkout — manual invoicing continues
- Automated recurring bid matching/shortlist delivery — admin-curated
  matching (assign flow) stays as-is
- Any further logo/branding work beyond what's already shipped — paused
  pending the BidPulse trademark question (see `PROJECT-STATUS.md`'s
  Business/Naming Note)
- Intake flow document-upload reorder (item #2) — real architectural
  constraint found, not worth the schema-change or security tradeoff
  required to fully honor the original ask.
- Golden-set regression fixture (item D above) — needs real script-design
  time given LLM output non-determinism, not a quick add.
- IP-based rate limiting (item F above) — premise doesn't hold; the
  routes in question already require auth. Revisit as per-account
  limiting if real abuse ever appears.
- Compliance checklist auto-population from Fit Check/completeness
  signals — needs its own schema migration (a `source` column on
  `checklist_items`), deliberately not stacked behind other pending
  migrations this session.
