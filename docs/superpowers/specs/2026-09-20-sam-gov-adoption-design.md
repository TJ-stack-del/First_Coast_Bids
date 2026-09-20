# SAM.gov Adoption — Design

**Status:** Approved (brainstorming), pending implementation plan.
**Date:** 2026-09-20

## Purpose

Expand First Coast Bids beyond its current local/state Jacksonville-area
opportunity sources (`lib/scrapers/jaa.ts`, `coj.ts`, `coj-forecast.ts`)
to include federal contract opportunities via SAM.gov, and use
SAM.gov's Entity Management API to verify a client's own SAM
registration status as a prerequisite for being matched to federal
work. This is an audience expansion, not just a new data source:
federal contracts become a real target alongside existing local/state
work.

## Scope decisions (from brainstorming)

1. **Both halves are in scope**: a new opportunity-source producer
   (federal listings feeding the existing `matched_opportunities`
   pipeline) *and* SAM.gov Entity Management API integration for
   registration verification. Neither alone satisfies this request.
2. **Audience expands** to include federal contracts, not just local/
   state — this is a real product-positioning change (PRODUCT.md and
   marketing copy currently say "local/state government contracts"
   and will need updating as part of implementation, not left
   inconsistent).
3. **Gate matching, not the deliverable**: a client without an active
   SAM registration never becomes the *suggested* match for a federal
   opportunity. Federal law requires an active registration to be
   awarded a federal contract at all, so showing an opportunity to an
   unregistered client sets up the exact paperwork-technicality
   failure this product exists to prevent. Gating at the deliverable
   stage instead was rejected: SAM registration for a new entity can
   take 2-3+ weeks, and gating that late risks real admin labor
   already spent on a capability statement/compliance matrix for a
   client who then can't ship it for weeks.
4. **Automate match scoring, keep assignment manual** (Approach 1 of
   2 proposed). SAM.gov volume (federal-wide, even NAICS-filtered) is
   expected to dwarf the current two-source local queue, so a flat
   unassigned list stops being browsable — but full auto-assignment
   was rejected because this is the product's first expansion into a
   new audience segment with no track record yet on what "good fit"
   means beyond NAICS overlap (scope size, set-aside eligibility,
   agency type can all make a NAICS match a bad real-world fit). A
   human still makes the final assignment call, consistent with the
   product's existing "deterministic tooling extracts/detects, a real
   person decides" principle (currently applied to deliverable prep;
   this extends the same split to matching).
5. **Registration status: periodic background check, not live-at-
   match-time or check-once-at-intake.** Live checking on every match
   evaluation risks exhausting SAM.gov's public API rate limit as
   federal volume grows. Check-once-at-intake goes silently stale the
   moment a registration lapses a year later — treated as equivalent
   to presenting stale data as current, which conflicts with the
   product's "never fabricate a fact" principle. A periodic job
   (daily is sufficient given registrations change annually) mirrors
   existing scraper-cron infrastructure, stays cheap on API quota, and
   enables a genuinely useful proactive feature: warning a client
   their registration expires soon, before it becomes a sudden
   failure.

## Architecture

Two independent pieces, decoupled from each other, each following an
existing pattern in this codebase rather than introducing a new one:

1. **Opportunity sourcing** — `lib/scrapers/sam-gov.ts`, a new producer
   added to the existing `SCRAPERS` array in `app/api/scrape/route.ts`.
   Same cron trigger, same `CRON_SECRET` bearer auth, same
   dedup-by-`(org_id, source_title, source_agency)` logic already used
   for `jaa`/`coj`/`coj-forecast`. Unlike those three, this is a real
   typed client against SAM.gov's public Contract Opportunities REST
   API (`api.sam.gov`), not HTML scraping.
2. **Registration monitoring** — `app/api/check-sam-status/route.ts`, a
   new cron route (same `CRON_SECRET` pattern) that loops over every
   client with a UEI on file and refreshes their status via SAM.gov's
   Entity Management API.

The scraper never calls the Entity API directly — it only reads the
`sam_registration_status` the monitoring cron already wrote to
`clients`, so the two pieces can be built, deployed, and fail
independently.

## Data model changes

`matched_opportunities` (existing table):
- `naics_code text` (nullable) — the opportunity's own NAICS code.
  Existing scrapers (JAA, COJ) leave this null; only SAM.gov populates
  it.
- `suggested_client_id uuid references clients(id)` (nullable) — the
  computed best-guess match, kept separate from the existing
  `assigned_client_id`, which remains the admin's actual, confirmed
  assignment. `match_score` (existing column, currently always null)
  becomes populated for SAM.gov-sourced rows.

`clients` (existing table):
- `sam_uei text` (nullable) — the client's federal Unique Entity ID.
  Collected as a new optional field on the existing Company Profile
  screen (same place `naics_codes` already lives), optional because
  it's only relevant to clients pursuing federal work.
- `sam_registration_status text` (nullable) — one of `active`,
  `inactive`, `not_registered`, `unknown`.
- `sam_registration_expires_at date` (nullable).
- `sam_status_checked_at timestamptz` (nullable) — last time the
  monitoring cron successfully checked this client.

## Data flow

**Sourcing:**
1. `/api/scrape` cron fires (existing trigger, unchanged).
2. `sam-gov.ts` queries the Opportunities API, filtered server-side to
   the org's serviced NAICS codes (drawn from the trades already
   defined in `lib/compliance/known-trades.ts`) to stay well under the
   free API key's daily quota.
3. For each new listing (post-dedup), compute `match_score` by
   comparing its `naics_code` against every client in the org whose
   `sam_registration_status = 'active'`. A suggestion requires a real
   NAICS-code match — an opportunity with no actively-registered
   client sharing its NAICS code gets no `suggested_client_id`; it
   still lands in the queue (for the admin to notice "nobody
   registered yet fits this"), just with `suggested_client_id` and
   `match_score` left null. The exact score formula and any tie-
   breaking among multiple equally-matching clients (e.g. by
   due-date proximity, or simplest-first: earliest-registered) is an
   implementation-plan decision, not fixed here — the one fixed
   requirement is that a NAICS match is necessary for any suggestion
   at all.
4. `/admin/matches` sorts by `match_score` descending (nulls last) and
   pre-selects `suggested_client_id` in the existing assign dropdown
   where present; the admin still clicks to confirm the actual
   `assigned_client_id`.

**Monitoring:**
1. `/api/check-sam-status` cron fires on its own daily schedule,
   independent of the scrape cron.
2. For each client with a non-null `sam_uei`, call the Entity
   Management API, write `sam_registration_status`,
   `sam_registration_expires_at`, `sam_status_checked_at`.
3. A client whose `sam_registration_expires_at` falls within 30 days
   gets a flag surfaced alongside the existing profile-completeness
   indicator on their dashboard.

## Error handling

Follows the existing scraper convention exactly (see `coj.ts`'s own
documented reasoning): fail loudly and distinctly per source rather
than silently returning zero results. A broken SAM.gov API key,
exhausted rate limit, or a response-shape change throws from
`sam-gov.ts`; the per-scraper `try/catch` already in `/api/scrape`
logs that as a real error, distinguishable from "ran fine, found
nothing new today." The same per-item isolation applies in
`check-sam-status`: one client's failed lookup (bad UEI, API timeout)
does not block the rest of the batch, and that client's
`sam_status_checked_at` simply stays stale rather than getting a wrong
value written.

## Testing

Consistent with this project's existing standard (verify against the
real thing, not a simplified proxy): confirm a known real UEI returns
a real active/inactive status from the live Entity API; confirm
NAICS-overlap scoring produces the correct `suggested_client_id` for a
synthetic opportunity against two or more real disposable test clients
with different NAICS codes; confirm the gate actually excludes an
unregistered (or `inactive`/`not_registered`/`unknown`-status) client
from ever becoming the suggestion, using a real test client with a
known non-active status rather than an assumed one.

## Explicitly out of scope for this pass

- Auto-assignment (Approach 1's alternative, rejected — see scope
  decision 4). Revisit once there's a real track record of suggested
  matches being correct.
- The fuller opportunity × client scoring join table (the rejected
  Approach 2) — the current single-best-guess model is not a dead end;
  it's an additive migration to the fuller model later if a single
  trade ever has enough registered clients that "best guess" starts
  hiding real second-best candidates.
- Updating all marketing copy/positioning for the federal-audience
  expansion is acknowledged as necessary (scope decision 2) but is a
  content/marketing task, not part of this technical spec — flagged
  here so it isn't silently forgotten, not designed here.
