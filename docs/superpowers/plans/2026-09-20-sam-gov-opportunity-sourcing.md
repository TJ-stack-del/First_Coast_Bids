# SAM.gov Opportunity Sourcing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add SAM.gov federal contract opportunities as a new source feeding the existing `matched_opportunities` admin-review pipeline, with a deterministic NAICS-overlap match score suggesting (not auto-assigning) the best-fit actively-registered client per opportunity.

**Architecture:** A new producer (`lib/scrapers/sam-gov.ts`) slots into the existing `SCRAPERS` array in `app/api/scrape/route.ts`, following the exact pattern `jaa.ts`/`coj.ts`/`coj-forecast.ts` already establish. Unlike those three, it's a real typed client against SAM.gov's public Contract Opportunities REST API, looping over every NAICS code this org's clients could plausibly have on file (SAM.gov's API accepts only one NAICS code per request). A new pure scoring function computes a `suggested_client_id`/`match_score` for each new SAM.gov-sourced row, gated on `clients.sam_registration_status = 'active'` (from the separate, already-shipped SAM Registration Monitoring plan). The admin `/admin/matches` screen surfaces the suggestion; assignment stays a manual admin action.

**Tech Stack:** Next.js route handlers, `fetch` (matches existing scraper convention, no new HTTP library), Supabase (Postgres + `@supabase/supabase-js` service-role client), `node:test`/`node:assert` for the pure scoring logic (no test runner installed in this repo — see the companion plan's Global Constraints for why `node:test` was chosen).

**Spec:** `docs/superpowers/specs/2026-09-20-sam-gov-adoption-design.md`

**Depends on:** `docs/superpowers/plans/2026-09-20-sam-registration-monitoring.md` (already implemented, PR open at the time of writing) — this plan reads `clients.sam_registration_status`, which that plan's migration and cron produce. If that PR hasn't merged yet, this plan's migration (Task 1) can still land independently (it doesn't touch `clients` at all), but Task 3's scoring logic will find zero actively-registered clients until the dependency lands.

## Global Constraints

- New migrations follow the existing convention exactly: `supabase/migrations/YYYYMMDDHHMMSS_description.sql`, lowercase double-quoted identifiers, plain `alter table ... add column if not exists ...`, no `CHECK` constraints.
- New/modified cron logic follows the existing `app/api/scrape/route.ts` pattern: `export const runtime = "nodejs"`, `isAuthorized()` checking `Authorization: Bearer ${CRON_SECRET}`, a service-role Supabase client, per-item `try/catch`, fail loudly per-scraper rather than silently returning zero (see `lib/scrapers/coj.ts`'s own documented reasoning).
- SAM.gov Get Opportunities Public API: base URL `https://api.sam.gov/opportunities/v2/search`, API key as the `api_key` query parameter, **exactly one** NAICS code per request via the `ncode` parameter (the API does not support comma-separated or multiple values — confirmed against GSA's own published docs, not assumed), `postedFrom`/`postedTo` required in `MM/dd/yyyy` format with a maximum 1-year range between them, `limit`/`offset` for pagination. Response: a `opportunitiesData` array of objects with fields `title`, `fullParentPathName` (agency), `solicitationNumber`, `responseDeadLine`, `naicsCode`, `uiLink`.
- The full, real set of NAICS codes to query (the union of every code a client could plausibly have on file — from `lib/business-options.ts`'s `COMMON_NAICS_CODES` checkbox list, plus `lib/compliance/known-trades.ts`'s IT/computer-support codes, which aren't offered as a checkbox and are only ever entered via the intake form's free-text "Other NAICS code" field): `561720`, `561790`, `561740`, `561730`, `238220`, `238290`, `561210`, `238210`, `541512`, `541519`, `518210` — 11 codes total, each requiring its own separate API request. `238220` ("Plumbing, Heating, and Air-Conditioning Contractors") is included here even though `lib/compliance/known-trades.ts`'s `KNOWN_TRADES` entry for HVAC deliberately excludes it as a *compliance-coverage* signal (see that file's own comment on why) — that exclusion is for a different feature (scope-text-based compliance flagging) and does not apply to opportunity-to-client NAICS matching, which uses the real NAICS taxonomy directly. A client who genuinely selected `238220` on their Company Profile is a legitimate match for an opportunity carrying that code.
- `matched_opportunities` (existing table) gains: `naics_code text` (nullable — existing JAA/COJ scrapers never populate it), `suggested_client_id uuid references clients(id)` (nullable — kept separate from the existing `assigned_client_id`, which remains the admin's confirmed choice; `match_score`, an existing but currently-always-null column, becomes populated for SAM.gov-sourced rows only).
- A suggestion requires an exact NAICS-code match between the opportunity and an actively-registered (`clients.sam_registration_status = 'active'`) client's `naics_codes` array. No suggestion (both `suggested_client_id` and `match_score` stay null) when no actively-registered client's codes overlap — the row still lands in the queue unassigned, same as JAA/COJ rows do today.
- New env var: `SAM_GOV_API_KEY` (same key already required by the companion registration-monitoring plan — one SAM.gov account, one key, two consumers).

---

### Task 1: Migration — `naics_code` and `suggested_client_id` on `matched_opportunities`

**Files:**
- Create: `supabase/migrations/20260921090000_add_naics_and_suggestion_to_matched_opportunities.sql`

**Interfaces:**
- Produces: `matched_opportunities.naics_code` (text, nullable), `matched_opportunities.suggested_client_id` (uuid, nullable, references `clients(id)`) — Tasks 3 and 4 write/read these exact column names.

- [ ] **Step 1: Check the most recent migration's timestamp**

Run: `ls supabase/migrations/ | tail -3` — confirm `20260921090000` sorts after every existing file (including the SAM registration-monitoring plan's `20260920120000` and `20260920130000` migrations, and that plan's fix wave's migration, if merged by the time you run this — check and adjust the timestamp forward if not).

- [ ] **Step 2: Write the migration**

```sql
-- SAM.gov opportunity-sourcing columns, added for the SAM.gov adoption
-- initiative (docs/superpowers/specs/2026-09-20-sam-gov-adoption-design.md).
-- naics_code is the opportunity's own NAICS code, populated only by the
-- SAM.gov producer (lib/scrapers/sam-gov.ts) -- existing JAA/COJ scrapers
-- have no equivalent and leave this null. suggested_client_id is a
-- computed best-guess match (NAICS overlap against actively-registered
-- clients only), kept separate from the existing assigned_client_id
-- column, which remains the admin's own confirmed assignment -- a
-- suggestion is never auto-assigned.
alter table "public"."matched_opportunities"
  add column if not exists "naics_code" text,
  add column if not exists "suggested_client_id" uuid references "public"."clients"("id");
```

- [ ] **Step 3: Verify the migration file's SQL is syntactically sound**

You will not be able to apply this to a live database in most execution environments for this plan (same constraint the companion registration-monitoring plan hit — no linked Supabase project). Read the SQL back carefully; confirm the foreign key syntax matches this project's convention by comparing against an existing migration that adds a foreign-key column (search `supabase/migrations/` for `references` to find one).

If you DO have a linked, working Supabase dev project available: run `npx supabase db push`, then `psql "$DATABASE_URL" -c "\d matched_opportunities"` to confirm both columns exist with correct types, then regenerate `schema.sql`. If you don't, note this as deferred in your report — same pattern as the companion plan's Task 1.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260921090000_add_naics_and_suggestion_to_matched_opportunities.sql
git commit -m "feat: add naics_code and suggested_client_id to matched_opportunities"
```

(If you also ran Step 3's live verification, `git add schema.sql` too and note it in the commit.)

---

### Task 2: Extend `ScrapedOpportunity` with an optional NAICS code

**Files:**
- Modify: `lib/scrapers/jaa.ts`

**Interfaces:**
- Produces: `ScrapedOpportunity.naics_code?: string | null` — Task 4's SAM.gov producer populates this field; the existing JAA/COJ scrapers never set it (already-optional fields in this type are fine left unset).

- [ ] **Step 1: Add the field**

Find the `ScrapedOpportunity` type definition in `lib/scrapers/jaa.ts` (it's the shared type `coj.ts` and `coj-forecast.ts` both import from this file — do not duplicate the type elsewhere). Add, following the existing style of this type's other optional fields (each documented with why it's optional and which scraper populates it):

```ts
  // Optional — only lib/scrapers/sam-gov.ts populates this (SAM.gov
  // opportunities carry a real NAICS code; neither jaa.ts's nor coj.ts's
  // listing pages have an equivalent). Used downstream to compute a
  // suggested-client match against clients.naics_codes.
  naics_code?: string | null;
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` — must be clean (this is a purely additive optional field, should not break `jaa.ts`, `coj.ts`, or `coj-forecast.ts`, none of which need to change).

- [ ] **Step 3: Commit**

```bash
git add lib/scrapers/jaa.ts
git commit -m "feat: add optional naics_code field to ScrapedOpportunity"
```

---

### Task 3: Pure NAICS-overlap match-scoring function

**Files:**
- Create: `lib/sam-gov/match-scoring.ts`
- Test: `lib/sam-gov/match-scoring.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks (pure function, no I/O).
- Produces: `findBestMatchingClient(opportunityNaicsCode: string, clients: MatchCandidate[]): { clientId: string; score: number } | null` where
  ```ts
  export type MatchCandidate = {
    id: string;
    naics_codes: string[];
    sam_registration_status: string | null;
  };
  ```
  Task 4's producer-insertion logic (in `app/api/scrape/route.ts`) calls this by this exact name and consumes this exact return shape.

- [ ] **Step 1: Write the failing test for "no active clients"**

This project has no test runner installed — use Node's built-in `node:test`/`node:assert/strict`, run via `node --experimental-strip-types --test <file>` (the root `tsconfig.json` already excludes `**/*.test.ts` from type-checking, a fix made in the companion registration-monitoring plan — you don't need to touch `tsconfig.json` again).

```ts
// lib/sam-gov/match-scoring.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { findBestMatchingClient, type MatchCandidate } from "./match-scoring.ts";

test("findBestMatchingClient returns null when no client is actively registered", () => {
  const clients: MatchCandidate[] = [
    { id: "c1", naics_codes: ["238210"], sam_registration_status: "not_registered" },
    { id: "c2", naics_codes: ["238210"], sam_registration_status: "inactive" },
  ];
  assert.equal(findBestMatchingClient("238210", clients), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test lib/sam-gov/match-scoring.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the minimal implementation**

```ts
// lib/sam-gov/match-scoring.ts

// Deterministic, not an LLM judgment call -- see this project's own
// established preference (a real matching signal, NAICS-code equality,
// is cheaper and more reliable than a model guess here). A suggestion
// requires an exact NAICS-code match AND active SAM registration; the
// registration gate exists because federal law requires an active
// registration to be awarded a federal contract at all -- surfacing an
// opportunity to an unregistered client would be exactly the kind of
// paperwork-technicality failure this product exists to prevent.
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test lib/sam-gov/match-scoring.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing tests for the remaining cases**

Append to `lib/sam-gov/match-scoring.test.ts`:

```ts
test("findBestMatchingClient returns the matching active client", () => {
  const clients: MatchCandidate[] = [
    { id: "c1", naics_codes: ["561720"], sam_registration_status: "active" },
    { id: "c2", naics_codes: ["238210"], sam_registration_status: "active" },
  ];
  assert.deepEqual(findBestMatchingClient("238210", clients), { clientId: "c2", score: 1 });
});

test("findBestMatchingClient returns null when no client's naics_codes overlap", () => {
  const clients: MatchCandidate[] = [
    { id: "c1", naics_codes: ["561720"], sam_registration_status: "active" },
  ];
  assert.equal(findBestMatchingClient("238210", clients), null);
});

test("findBestMatchingClient ignores an active client whose codes don't match, even if an inactive client's codes do", () => {
  const clients: MatchCandidate[] = [
    { id: "c1", naics_codes: ["238210"], sam_registration_status: "inactive" },
    { id: "c2", naics_codes: ["561720"], sam_registration_status: "active" },
  ];
  assert.equal(findBestMatchingClient("238210", clients), null);
});

test("findBestMatchingClient matches a client with multiple naics_codes on any one of them", () => {
  const clients: MatchCandidate[] = [
    { id: "c1", naics_codes: ["561720", "238220"], sam_registration_status: "active" },
  ];
  assert.deepEqual(findBestMatchingClient("238220", clients), { clientId: "c1", score: 1 });
});
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `node --experimental-strip-types --test lib/sam-gov/match-scoring.test.ts`
Expected: PASS, all 5 tests.

- [ ] **Step 7: Commit**

```bash
git add lib/sam-gov/match-scoring.ts lib/sam-gov/match-scoring.test.ts
git commit -m "feat: add deterministic NAICS-overlap match scoring"
```

---

### Task 4: SAM.gov opportunity-sourcing producer

**Files:**
- Create: `lib/scrapers/sam-gov.ts`

**Interfaces:**
- Consumes: `ScrapedOpportunity` type from `lib/scrapers/jaa.ts` (Task 2).
- Produces: `scrapeSamGov(): Promise<ScrapedOpportunity[]>` — Task 5 (the `SCRAPERS` array registration) calls this by this exact name, matching the existing `scrapeJaa`/`scrapeCoj`/`scrapeCojForecast` signatures exactly.

- [ ] **Step 1: Write the producer**

```ts
// lib/scrapers/sam-gov.ts
import type { ScrapedOpportunity } from "./jaa";

// SAM.gov's public Get Opportunities API -- a real typed REST client, not
// HTML scraping like jaa.ts/coj.ts. Confirmed against GSA's own published
// API docs (open.gsa.gov/api/get-opportunities-public-api), not guessed:
// exactly one NAICS code per request (no comma-separated support), a
// maximum 1-year range between postedFrom/postedTo, MM/dd/yyyy date format.
const OPPORTUNITIES_API_BASE = "https://api.sam.gov/opportunities/v2/search";
const SOURCE_AGENCY_FALLBACK = "Federal (SAM.gov)";

// The full, real set of NAICS codes a First Coast Bids client could
// plausibly have on file: lib/business-options.ts's COMMON_NAICS_CODES
// checkbox list, plus lib/compliance/known-trades.ts's IT/computer-support
// codes (only ever entered via the intake form's free-text "Other NAICS
// code" field, never a checkbox). 238220 is included even though
// KNOWN_TRADES' own HVAC entry excludes it as a *compliance-coverage*
// signal -- that exclusion serves a different feature (scope-text
// compliance flagging) and doesn't apply here, where a client who
// genuinely selected 238220 is a legitimate NAICS match for an
// opportunity carrying that code.
const NAICS_CODES = [
  "561720", // Janitorial Services
  "561790", // Other Services to Buildings and Dwellings
  "561740", // Carpet and Upholstery Cleaning Services
  "561730", // Landscaping Services
  "238220", // Plumbing, Heating, and Air-Conditioning Contractors
  "238290", // Other Building Equipment Contractors
  "561210", // Facilities Support Services
  "238210", // Electrical Contractors
  "541512", // Computer Systems Design Services
  "541519", // Other Computer Related Services
  "518210", // Data Processing, Hosting, and Related Services
];

function formatDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

type RawOpportunity = {
  title?: string;
  fullParentPathName?: string;
  solicitationNumber?: string;
  responseDeadLine?: string;
  naicsCode?: string;
  uiLink?: string;
};

type RawOpportunitiesResponse = {
  opportunitiesData?: RawOpportunity[];
};

function parseOpportunity(raw: RawOpportunity): ScrapedOpportunity | null {
  if (!raw.title) return null; // no usable title -- skip rather than insert a blank row
  return {
    source_title: raw.title,
    source_agency: raw.fullParentPathName || SOURCE_AGENCY_FALLBACK,
    source_url: raw.uiLink ?? null,
    due_date: raw.responseDeadLine ?? null,
    solicitation_number: raw.solicitationNumber ?? null,
    naics_code: raw.naicsCode ?? null,
  };
}

async function fetchOpportunitiesForNaicsCode(naicsCode: string, apiKey: string): Promise<ScrapedOpportunity[]> {
  const today = new Date();
  const oneYearAgo = new Date(today);
  oneYearAgo.setFullYear(today.getFullYear() - 1);
  // postedFrom/postedTo max range is exactly 1 year -- use "one year ago"
  // to "today" every run rather than tracking a high-water mark, since
  // the existing dedup-by-title-and-agency logic in app/api/scrape/route.ts
  // already prevents re-inserting anything still posted from a prior run.
  const params = new URLSearchParams({
    api_key: apiKey,
    ncode: naicsCode,
    postedFrom: formatDate(oneYearAgo),
    postedTo: formatDate(today),
    limit: "100",
  });

  const res = await fetch(`${OPPORTUNITIES_API_BASE}?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`SAM.gov Opportunities API request failed for NAICS ${naicsCode}: ${res.status} ${res.statusText}`);
  }

  const raw = (await res.json()) as RawOpportunitiesResponse;
  return (raw.opportunitiesData ?? [])
    .map(parseOpportunity)
    .filter((o): o is ScrapedOpportunity => o !== null);
}

export async function scrapeSamGov(): Promise<ScrapedOpportunity[]> {
  const apiKey = process.env.SAM_GOV_API_KEY;
  if (!apiKey) {
    throw new Error("scrapeSamGov: SAM_GOV_API_KEY is not set.");
  }

  const results: ScrapedOpportunity[] = [];
  for (const code of NAICS_CODES) {
    const found = await fetchOpportunitiesForNaicsCode(code, apiKey);
    results.push(...found);
  }
  return results;
}
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit` — must be clean. This confirms `ScrapedOpportunity`'s new optional `naics_code` field (Task 2) is used correctly here.

- [ ] **Step 3: Manual real-API verification (requires a real `SAM_GOV_API_KEY`)**

This project has neither `ts-node` nor `dotenv` installed (confirmed — do not add either as a new dependency for a one-off check). Use Node's own `--env-file` flag (built in since Node 20.6, and this environment runs Node 24) plus `--experimental-strip-types`, the same no-dependency pattern the companion registration-monitoring plan's Task 2 established and verified working:

```bash
node --env-file=.env.local --experimental-strip-types -e "
import('./lib/scrapers/sam-gov.ts').then(({ scrapeSamGov }) =>
  scrapeSamGov().then((results) => {
    console.log('Total opportunities found:', results.length);
    console.log('Sample:', results.slice(0, 3));
  })
).catch(console.error);
"
```

Expected: a real count of federal opportunities across the 11 NAICS codes (could be zero for any single code on a given day — that alone is not a failure — but the overall call sequence should complete without throwing, and at least a few of the 11 codes should return partial matches in a typical run given federal contracting volume). If `SAM_GOV_API_KEY` isn't available in your environment, skip this step and report it deferred — same pattern the companion plan used for its own real-API check.

- [ ] **Step 4: Commit**

```bash
git add lib/scrapers/sam-gov.ts
git commit -m "feat: add SAM.gov opportunity-sourcing producer"
```

---

### Task 5: Wire the producer into the scrape cron, with match-scoring on insert

**Files:**
- Modify: `app/api/scrape/route.ts`

**Interfaces:**
- Consumes: `scrapeSamGov` (Task 4), `findBestMatchingClient`/`MatchCandidate` (Task 3), `matched_opportunities.naics_code`/`suggested_client_id` (Task 1).

- [ ] **Step 1: Register the new scraper**

Find the `SCRAPERS` array in `app/api/scrape/route.ts` (currently `jaa`, `coj`, `coj-forecast`) and add the new one, importing `scrapeSamGov` from `@/lib/scrapers/sam-gov` alongside the existing scraper imports:

```ts
  { name: "sam-gov", run: scrapeSamGov },
```

- [ ] **Step 2: Fetch eligible clients once per run, before the scraper loop**

Find where the route currently fetches `org` (the `organizations` table lookup near the top of the `GET` handler). Immediately after it, add one query to fetch every client's matching-relevant fields for this org, reused across all inserted opportunities in this run (avoids one query per opportunity):

```ts
  const { data: clientsForMatching } = await supabase
    .from("clients")
    .select("id, naics_codes, sam_registration_status")
    .eq("org_id", org.id);
```

- [ ] **Step 3: Compute the suggestion at insert time**

Find the existing insert logic inside the `for (const item of found)` loop (the `supabase.from("matched_opportunities").insert({...})` call). Add `naics_code` and `suggested_client_id`/`match_score` to that insert payload:

```ts
        const suggestion = item.naics_code
          ? findBestMatchingClient(item.naics_code, clientsForMatching ?? [])
          : null;

        const { error: insertError } = await supabase.from("matched_opportunities").insert({
          org_id: org.id,
          assigned_client_id: null,
          source_title: item.source_title,
          source_agency: item.source_agency,
          source_url: item.source_url,
          due_date: item.due_date,
          solicitation_number: item.solicitation_number ?? null,
          scope: item.scope ?? null,
          naics_code: item.naics_code ?? null,
          suggested_client_id: suggestion?.clientId ?? null,
          match_score: suggestion?.score ?? null,
        });
```

(Keep every existing field in that insert exactly as it already is — this only adds the three new fields. Read the actual current insert call in the file first; do not guess at its exact current shape from this snippet alone, since the real file may have additional fields already added since this plan was written.)

Add the import at the top of the file:

```ts
import { findBestMatchingClient } from "@/lib/sam-gov/match-scoring";
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` — must be clean.

- [ ] **Step 5: Manual verification against a real disposable test client (requires a linked Supabase project)**

Create two real test clients in the same org: one with `naics_codes: ["238210"]` and `sam_registration_status: "active"`, one with `naics_codes: ["561720"]` and `sam_registration_status: "not_registered"`. Run the route with a valid `CRON_SECRET`:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/scrape
```

Then confirm directly:

```bash
psql "$DATABASE_URL" -c "select source_title, naics_code, suggested_client_id, match_score from matched_opportunities where naics_code is not null order by created_at desc limit 10;"
```

Expected: any row with `naics_code = '238210'` shows the first test client's id as `suggested_client_id`; any row with a NAICS code matching only the second (non-active) test client shows `suggested_client_id` as null. If no linked Supabase project is available, skip this step and report it deferred — same pattern as the companion plan.

- [ ] **Step 6: Commit**

```bash
git add app/api/scrape/route.ts
git commit -m "feat: score and suggest a client match for SAM.gov-sourced opportunities"
```

---

### Task 6: Surface the suggestion in the admin Matched Opportunities screen

**Files:**
- Modify: `app/admin/matches/page.tsx`
- Modify: `app/admin/matches/MatchesPanel.tsx`

**Interfaces:**
- Consumes: `matched_opportunities.naics_code`/`suggested_client_id`/`match_score` (Task 1/5).

- [ ] **Step 1: Select the new columns and sort by match_score**

In `app/admin/matches/page.tsx`, find the existing `matched_opportunities` select query and add `naics_code, suggested_client_id` to the selected column list (alongside the existing `match_score`, which is already selected but currently always null for pre-existing rows). Change the query's `.order(...)` to sort by `match_score` descending first, falling back to the existing `created_at` ordering as a secondary sort — Supabase/PostgREST supports multiple `.order()` calls chained, with nulls handled via `{ ascending: false, nullsFirst: false }` on the `match_score` order so unscored (JAA/COJ) rows sort after scored ones rather than before:

```ts
    .order("match_score", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
```

- [ ] **Step 2: Pass the new fields through to the type and the panel**

Find the `matches` variable in `page.tsx` — it's passed as `initialMatches` to `<MatchesPanel>`. Confirm the new columns flow through automatically (they will, since the select's return type flows through untyped `matches ?? []` in the existing code) — no explicit type change needed there unless `MatchesPanel.tsx`'s own local type for a match row needs updating (check for one).

In `MatchesPanel.tsx`, find wherever it defines a type for a single match row (search for `match_score` in that file, which you've already read once during a prior planning pass if this is executed as part of the same session — otherwise, find it now) and add `naics_code: string | null` and `suggested_client_id: string | null` to that type.

- [ ] **Step 3: Pre-select the suggested client in the assign dropdown**

Find where `MatchesPanel.tsx` renders the assign-to-client `<select>` dropdown for each match row (search for where `clients` prop is mapped into `<option>` elements). Change its initial/default value so that when `match.suggested_client_id` is non-null and matches one of the `clients` prop's ids, that option is pre-selected — the admin must still explicitly interact with the assign action to confirm (do not auto-submit or auto-trigger the assignment fetch/mutation the existing "Assign" flow uses just because a value is pre-selected).

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` — must be clean.

- [ ] **Step 5: Manual verification**

If a linked Supabase project with the Task 5 test data is available: load `/admin/matches`, confirm SAM.gov-sourced rows with a real suggestion appear above unscored rows, and confirm the assign dropdown shows the suggested client pre-selected (still requiring a manual click to actually assign). If not available, report deferred.

- [ ] **Step 6: Commit**

```bash
git add app/admin/matches/page.tsx app/admin/matches/MatchesPanel.tsx
git commit -m "feat: surface SAM.gov match suggestions in the admin matches screen"
```

---

## Self-Review Notes

- **Spec coverage:** the opportunity-sourcing producer (Task 4/5), NAICS-overlap scoring gated on active registration (Task 3/5), and admin-visible suggestion (Task 6) are all covered. Marketing/positioning copy updates (spec decision 2) are explicitly out of scope here too, same as the companion plan — a content task, not a technical one.
- **Placeholder scan:** no TBD/TODO. Task 4's Step 3 and Task 5/6's Step 5 defer real-API/real-DB verification the same way the companion plan's tasks did, for the same real environment-constraint reason, not vagueness.
- **Type consistency:** `ScrapedOpportunity.naics_code`, `scrapeSamGov`, `MatchCandidate`, `findBestMatchingClient` are each defined once and referenced by the same name/shape everywhere they're used across tasks.
- **Cross-plan consistency:** this plan's `MatchCandidate.sam_registration_status: string | null` matches the companion plan's `clients.sam_registration_status text` column exactly (both nullable text, no enum constraint, matching the codebase's existing unconstrained-text convention for status-like columns).
