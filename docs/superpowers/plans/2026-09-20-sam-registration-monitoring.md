# SAM Registration Monitoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track each client's SAM.gov registration status (active/inactive/not_registered/unknown) and expiration date via a periodic background check, and surface an expiration warning on the client dashboard.

**Architecture:** A new `sam_uei` field is collected on the existing Company Profile form. A daily cron route calls SAM.gov's Entity Management API for every client with a UEI on file and writes the result back to `clients`. This plan is self-contained and produces working, testable software with no dependency on the separate SAM.gov opportunity-sourcing plan — it's the piece that plan's scoring step will later read from.

**Tech Stack:** Next.js route handlers (existing `app/api/*` pattern), Supabase (Postgres + `@supabase/supabase-js` service-role client), `fetch` (no new HTTP library — the existing scrapers use plain `fetch`).

**Spec:** `docs/superpowers/specs/2026-09-20-sam-gov-adoption-design.md`

## Global Constraints

- New migrations follow the existing convention exactly: `supabase/migrations/YYYYMMDDHHMMSS_description.sql`, lowercase double-quoted identifiers, plain `alter table ... add column if not exists ...`, no `CHECK` constraints (the codebase's existing enum-like text columns, e.g. `packages.package_type`, are unconstrained text — match that, don't introduce a stricter convention here).
- New cron routes follow the existing `app/api/scrape/route.ts` pattern exactly: `export const runtime = "nodejs"`, `isAuthorized()` checking `Authorization: Bearer ${CRON_SECRET}`, a service-role Supabase client (`createClient` from `@supabase/supabase-js` with `SUPABASE_SERVICE_ROLE_KEY`, never the anon/publishable key), per-item `try/catch` so one failure doesn't block the batch.
- SAM.gov Entity Management API: base URL `https://api.sam.gov/entity-information/v3/entities`, API key passed as the `api_key` query parameter, entity lookup via the `ueiSAM` query parameter. Response fields under `entityRegistration`: `registrationStatus` (string, `"Active"` when active) and `registrationExpirationDate` (`YYYY-MM-DD`).
- New env var: `SAM_GOV_API_KEY` (the free public API key from a SAM.gov account's own "Account Details" page — same acquisition model as any other third-party API key already in this project's `.env.local`).

---

### Task 1: Migration — SAM registration columns on `clients`

**Files:**
- Create: `supabase/migrations/20260920120000_add_sam_registration_fields_to_clients.sql`

**Interfaces:**
- Produces: `clients.sam_uei` (text, nullable), `clients.sam_registration_status` (text, nullable), `clients.sam_registration_expires_at` (date, nullable), `clients.sam_status_checked_at` (timestamptz, nullable) — every later task in this plan and the sourcing plan reads/writes these exact column names.

- [ ] **Step 1: Write the migration**

```sql
-- SAM.gov registration tracking, added for the SAM.gov adoption
-- initiative (docs/superpowers/specs/2026-09-20-sam-gov-adoption-design.md).
-- sam_uei is optional -- only clients pursuing federal work need one.
-- sam_registration_status is plain unconstrained text (mirrors
-- packages.package_type's existing convention), expected values are
-- "active" / "inactive" / "not_registered" / "unknown", written only by
-- the app/api/check-sam-status cron -- never trust an unset value as
-- "active" anywhere that gates federal matching.
alter table "public"."clients"
  add column if not exists "sam_uei" text,
  add column if not exists "sam_registration_status" text,
  add column if not exists "sam_registration_expires_at" date,
  add column if not exists "sam_status_checked_at" timestamptz;
```

- [ ] **Step 2: Apply the migration locally and verify**

Run: `cd /workspaces/Bidpulse && npx supabase migration list`
Expected: the new `20260920120000` migration shows in the local list.

Run: `npx supabase db push` (or the project's existing local-dev migration-apply command, per `CLAUDE.md`'s established `supabase link`/`db push` workflow — do not apply this against `bidpulse-production` without the verification steps `CLAUDE.md` already documents for confirming the linked project).

Run:
```bash
psql "$DATABASE_URL" -c "\d clients" | grep sam_
```
Expected: all four new columns listed with the correct types.

- [ ] **Step 3: Regenerate `schema.sql`**

Run whatever command this repo already uses to regenerate `schema.sql` after a migration (check `package.json` scripts for a `db:dump`/`schema` script, or `npx supabase db dump --schema public -f schema.sql` if none exists) and confirm the four new columns appear in the diff.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260920120000_add_sam_registration_fields_to_clients.sql schema.sql
git commit -m "feat: add SAM.gov registration tracking columns to clients"
```

---

### Task 2: SAM.gov Entity API client

**Files:**
- Create: `lib/sam-gov/entity-client.ts`
- Test: `lib/sam-gov/entity-client.test.ts`

**Interfaces:**
- Consumes: `process.env.SAM_GOV_API_KEY`.
- Produces: `checkEntityRegistration(uei: string): Promise<EntityRegistrationResult>` where
  ```ts
  export type EntityRegistrationResult =
    | { found: true; status: "active" | "inactive"; expiresAt: string | null }
    | { found: false };
  ```
  Task 3's cron route calls this function by this exact name and consumes this exact return shape.

- [ ] **Step 1: Write the failing test for the "not found" case**

This test needs no network access — it exercises response parsing against a fixture, matching how `lib/scrapers/*` are structured (real fetch logic separated from parsing so parsing is unit-testable without hitting the network on every run).

This project has no test runner installed (confirmed: no `test` script, no `vitest`/`jest` in `package.json`) — use Node's own built-in `node:test` and `node:assert`, not a new dependency for one file. Node 24 (the version installed in this environment) strips simple TypeScript type annotations natively behind the `--experimental-strip-types` flag, which is all these files use (plain type aliases, no enums/decorators/namespaces).

```ts
// lib/sam-gov/entity-client.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEntityRegistrationResponse } from "./entity-client.ts";

test("parseEntityRegistrationResponse returns found:false when the entity data array is empty", () => {
  const result = parseEntityRegistrationResponse({ entityData: [] });
  assert.deepEqual(result, { found: false });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test lib/sam-gov/entity-client.test.ts`
Expected: FAIL — `parseEntityRegistrationResponse` is not defined (the file doesn't exist yet).

- [ ] **Step 3: Write the response-parsing logic (minimal, makes Step 1 pass)**

```ts
// lib/sam-gov/entity-client.ts

// SAM.gov Entity Management API (production v3) -- real REST API, not
// scraping. Response shape under entityData[].entityRegistration:
// registrationStatus ("Active" when active, otherwise some other
// string), registrationExpirationDate ("YYYY-MM-DD"). Confirmed against
// GSA's own published API documentation (open.gsa.gov/api/entity-api),
// not guessed from memory.
const ENTITY_API_BASE = "https://api.sam.gov/entity-information/v3/entities";

export type EntityRegistrationResult =
  | { found: true; status: "active" | "inactive"; expiresAt: string | null }
  | { found: false };

type RawEntityApiResponse = {
  entityData?: {
    entityRegistration?: {
      registrationStatus?: string;
      registrationExpirationDate?: string;
    };
  }[];
};

export function parseEntityRegistrationResponse(raw: RawEntityApiResponse): EntityRegistrationResult {
  const entity = raw.entityData?.[0];
  if (!entity) return { found: false };

  const reg = entity.entityRegistration;
  const status: "active" | "inactive" = reg?.registrationStatus === "Active" ? "active" : "inactive";
  return { found: true, status, expiresAt: reg?.registrationExpirationDate ?? null };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test lib/sam-gov/entity-client.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing test for the "found, active" case**

Append to `lib/sam-gov/entity-client.test.ts`:

```ts
test("parseEntityRegistrationResponse returns active status and expiration date when the entity is found and active", () => {
  const result = parseEntityRegistrationResponse({
    entityData: [
      {
        entityRegistration: {
          registrationStatus: "Active",
          registrationExpirationDate: "2027-03-15",
        },
      },
    ],
  });
  assert.deepEqual(result, { found: true, status: "active", expiresAt: "2027-03-15" });
});

test("parseEntityRegistrationResponse returns inactive status when registrationStatus is not \"Active\"", () => {
  const result = parseEntityRegistrationResponse({
    entityData: [
      {
        entityRegistration: {
          registrationStatus: "Expired",
          registrationExpirationDate: "2025-01-01",
        },
      },
    ],
  });
  assert.deepEqual(result, { found: true, status: "inactive", expiresAt: "2025-01-01" });
});
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `node --experimental-strip-types --test lib/sam-gov/entity-client.test.ts`
Expected: PASS, all 3 tests (parsing logic from Step 3 already handles these — this step is confirming coverage, not adding new implementation).

- [ ] **Step 7: Add the real fetch wrapper (not independently unit-tested — thin I/O around the tested parser)**

```ts
// Appended to lib/sam-gov/entity-client.ts

// Fails loudly rather than returning a default "unknown" — same
// convention as lib/scrapers/coj.ts: a missing API key or a broken
// response shape must surface as a real error in the caller's
// per-item try/catch, not get silently swallowed into a status that
// looks like a legitimate "not registered."
export async function checkEntityRegistration(uei: string): Promise<EntityRegistrationResult> {
  const apiKey = process.env.SAM_GOV_API_KEY;
  if (!apiKey) {
    throw new Error("checkEntityRegistration: SAM_GOV_API_KEY is not set.");
  }

  const url = `${ENTITY_API_BASE}?ueiSAM=${encodeURIComponent(uei)}&api_key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`SAM.gov Entity API request failed: ${res.status} ${res.statusText}`);
  }

  const raw = (await res.json()) as RawEntityApiResponse;
  return parseEntityRegistrationResponse(raw);
}
```

- [ ] **Step 8: Manual real-API verification (requires a real `SAM_GOV_API_KEY` and a real UEI — do not fabricate a UEI for this)**

Get a real UEI to test against from SAM.gov's own public entity search (search.sam.gov) — pick any entity showing an "Active" registration there, note its UEI, and use that value; do not guess or hardcode a UEI you haven't actually looked up. Add `SAM_GOV_API_KEY=<your real key>` to `.env.local` (never commit this file — confirm it's already in `.gitignore`), then run:

```bash
node -e "
require('dotenv').config({ path: '.env.local' });
const { checkEntityRegistration } = require('./lib/sam-gov/entity-client.ts');
checkEntityRegistration('<the real UEI you looked up>').then(console.log);
"
```

(Adjust to `npx tsx` or this project's existing pattern for running a one-off TypeScript file against real env vars — check how other one-off verification scripts in this session's git history were run, e.g. the pattern used to verify `lib/scrapers/coj.ts` directly.)

Expected: `{ found: true, status: 'active', expiresAt: '<some date>' }` matching what search.sam.gov's own UI shows for that entity.

- [ ] **Step 9: Commit**

```bash
git add lib/sam-gov/entity-client.ts lib/sam-gov/entity-client.test.ts
git commit -m "feat: add SAM.gov Entity Management API client"
```

---

### Task 3: Registration-check cron route

**Files:**
- Create: `app/api/check-sam-status/route.ts`

**Interfaces:**
- Consumes: `checkEntityRegistration(uei: string): Promise<EntityRegistrationResult>` from Task 2.
- Produces: `GET /api/check-sam-status` — no other code depends on this route's internals, only its side effect (writing `clients.sam_registration_status` etc.).

- [ ] **Step 1: Write the route**

```ts
// app/api/check-sam-status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkEntityRegistration } from "@/lib/sam-gov/entity-client";

export const runtime = "nodejs";
export const maxDuration = 60;

// Daily cron -- SAM registrations change annually, so daily freshness is
// far more than sufficient. Independent of app/api/scrape's cron: this
// route only ever reads clients.sam_uei and writes the four
// sam_registration_* columns, it never touches matched_opportunities.
// See docs/superpowers/specs/2026-09-20-sam-gov-adoption-design.md.
function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return request.headers.get("authorization") === `Bearer ${expected}`;
}

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = serviceClient();

  const { data: clients, error: fetchError } = await supabase
    .from("clients")
    .select("id, sam_uei")
    .not("sam_uei", "is", null);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  let checked = 0;
  const errors: { clientId: string; error: string }[] = [];

  for (const client of clients ?? []) {
    try {
      const result = await checkEntityRegistration(client.sam_uei!);

      const update = result.found
        ? {
            sam_registration_status: result.status,
            sam_registration_expires_at: result.expiresAt,
            sam_status_checked_at: new Date().toISOString(),
          }
        : {
            sam_registration_status: "not_registered",
            sam_registration_expires_at: null,
            sam_status_checked_at: new Date().toISOString(),
          };

      const { error: updateError } = await supabase.from("clients").update(update).eq("id", client.id);
      if (updateError) {
        errors.push({ clientId: client.id, error: updateError.message });
        continue;
      }
      checked++;
    } catch (e) {
      // One client's failed lookup (bad UEI, transient API error) must
      // not block the rest of the batch, and must not overwrite that
      // client's last-known status with a wrong "unknown" -- leaving
      // sam_status_checked_at stale is the honest signal that this
      // client's status is unverified, not "verified as unknown."
      errors.push({ clientId: client.id, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return NextResponse.json({ checked, total: clients?.length ?? 0, errors });
}
```

- [ ] **Step 2: Manual verification against a real disposable test client**

Create a real test client row with a real UEI you looked up (same one from Task 2 Step 8), run the route locally with a valid `CRON_SECRET`:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/check-sam-status
```

Expected: JSON response with `checked: 1` (or however many test clients have a `sam_uei` set), `errors: []`. Then confirm directly in the database:

```bash
psql "$DATABASE_URL" -c "select id, sam_uei, sam_registration_status, sam_registration_expires_at from clients where sam_uei is not null;"
```

Expected: the test client's row shows the real status/expiration matching what search.sam.gov's UI shows for that UEI.

- [ ] **Step 3: Verify the unauthorized case**

```bash
curl -i http://localhost:3000/api/check-sam-status
```

Expected: `401` with `{"error":"Unauthorized"}` — no `Authorization` header supplied.

- [ ] **Step 4: Commit**

```bash
git add app/api/check-sam-status/route.ts
git commit -m "feat: add daily SAM.gov registration status check cron"
```

---

### Task 4: Register the cron in `vercel.json`

**Files:**
- Modify: `vercel.json`

**Interfaces:** None — this is deployment configuration only.

- [ ] **Step 1: Add the cron entry**

```json
{
  "crons": [
    {
      "path": "/api/scrape",
      "schedule": "0 13 * * *"
    },
    {
      "path": "/api/daily-digest",
      "schedule": "0 14 * * *"
    },
    {
      "path": "/api/process-stage-email-outbox",
      "schedule": "30 13 * * *"
    },
    {
      "path": "/api/check-sam-status",
      "schedule": "0 12 * * *"
    }
  ]
}
```

(Scheduled an hour before the existing `/api/scrape` run at 13:00 UTC, so opportunity scoring in the separate sourcing plan can rely on same-day-fresh registration status — not required for this plan's own tests to pass, but worth keeping in mind when that plan is implemented.)

- [ ] **Step 2: Verify the JSON is valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('vercel.json'))" && echo "valid"`
Expected: prints `valid`.

- [ ] **Step 3: Commit**

```bash
git add vercel.json
git commit -m "feat: schedule the SAM.gov registration status check cron"
```

---

### Task 5: Collect `sam_uei` on the Company Profile form

**Files:**
- Modify: `app/dashboard/profile/page.tsx`
- Modify: `app/dashboard/profile/CompanyProfileClient.tsx`
- Modify: `app/dashboard/profile/CompanyInfoForm.tsx`

**Interfaces:**
- Consumes: nothing new from other tasks.
- Produces: a `clients.sam_uei` value written on Save — Task 3's cron reads whatever this form writes.

- [ ] **Step 1: Add `sam_uei` to the `CompanyInfo` type and the select query in `page.tsx`**

Find this project's `app/dashboard/profile/page.tsx` query that fetches `initialInfo` for `CompanyProfileClient` (it selects the same field list as the `CompanyInfo` type in `CompanyProfileClient.tsx`) and add `sam_uei` to the selected columns, matching the existing comma-separated string style used there and in `app/dashboard/page.tsx`'s own `clients` select.

- [ ] **Step 2: Add `sam_uei` to the `CompanyInfo` type in `CompanyProfileClient.tsx`**

```ts
type CompanyInfo = {
  license_number: string | null;
  business_registration_number: string | null;
  years_in_business: number | null;
  business_address: string | null;
  business_phone: string | null;
  insurance_provider: string | null;
  insurance_policy_number: string | null;
  general_liability_coverage: string | null;
  workers_comp_coverage: string | null;
  commercial_auto_coverage: string | null;
  differentiators: string | null;
  naics_codes: string[];
  small_business_statuses: string[];
  set_asides: string[];
  sam_uei: string | null;
};
```

(Same edit applies to the duplicate `CompanyInfo` type in `CompanyInfoForm.tsx` — both files currently define this type separately rather than sharing an import; add the field to both rather than introducing a shared type as an unrelated refactor.)

- [ ] **Step 3: Add the field to `CompanyInfoForm.tsx`'s `FIELDS` array**

```ts
const FIELDS: { key: keyof CompanyInfo; label: string; type?: string; area?: boolean }[] = [
  { key: "license_number", label: "Trade/occupational license number" },
  { key: "business_registration_number", label: "Business registration number (e.g. Sunbiz Doc#)" },
  { key: "years_in_business", label: "Years in business", type: "number" },
  { key: "business_address", label: "Business address" },
  { key: "business_phone", label: "Business phone" },
  { key: "insurance_provider", label: "Insurance provider" },
  { key: "insurance_policy_number", label: "Insurance policy number" },
  { key: "general_liability_coverage", label: "General liability coverage (e.g. $1M/$2M)" },
  { key: "workers_comp_coverage", label: "Workers' comp coverage" },
  { key: "commercial_auto_coverage", label: "Commercial auto coverage" },
  { key: "sam_uei", label: "SAM.gov Unique Entity ID (UEI) — only if you plan to bid on federal work" },
];
```

Adding it to `FIELDS` is sufficient — the existing render loop (`FIELDS.map(...)`) and `setField`/`handleSave` logic in `CompanyInfoForm.tsx` already handles any key generically; no other change to that file's render or save logic is needed.

- [ ] **Step 4: Manual verification**

Run the dev server, navigate to `/dashboard/profile`, confirm the new "SAM.gov Unique Entity ID" field renders in the grid alongside the existing fields, type a value, click "Save company info", confirm the "Saved" message appears, then confirm directly:

```bash
psql "$DATABASE_URL" -c "select id, sam_uei from clients where id = '<your test client id>';"
```

Expected: the value you typed is present.

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/profile/page.tsx app/dashboard/profile/CompanyProfileClient.tsx app/dashboard/profile/CompanyInfoForm.tsx
git commit -m "feat: collect SAM.gov UEI on the Company Profile form"
```

---

### Task 6: Surface an expiration warning on the client dashboard

**Files:**
- Modify: `app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `clients.sam_registration_status`, `clients.sam_registration_expires_at` (written by Task 3's cron).

- [ ] **Step 1: Add the two new columns to the existing `clients` select**

```ts
  const { data: client } = await supabase
    .from("clients")
    .select(
      "id, org_id, company_name, contact_name, naics_codes, license_number, business_registration_number, years_in_business, insurance_provider, general_liability_coverage, workers_comp_coverage, business_address, business_phone, sam_registration_status, sam_registration_expires_at"
    )
    .eq("auth_user_id", user.id)
    .maybeSingle();
```

- [ ] **Step 2: Write the failing test for the expiration-window helper**

```ts
// lib/sam-gov/expiration-warning.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { isSamRegistrationExpiringSoon } from "./expiration-warning.ts";

test("isSamRegistrationExpiringSoon returns false when there is no expiration date on file", () => {
  assert.equal(isSamRegistrationExpiringSoon(null, new Date("2026-09-20")), false);
});

test("isSamRegistrationExpiringSoon returns true when the expiration date is within 30 days", () => {
  assert.equal(isSamRegistrationExpiringSoon("2026-10-10", new Date("2026-09-20")), true);
});

test("isSamRegistrationExpiringSoon returns false when the expiration date is more than 30 days out", () => {
  assert.equal(isSamRegistrationExpiringSoon("2027-01-01", new Date("2026-09-20")), false);
});

test("isSamRegistrationExpiringSoon returns false when the expiration date has already passed", () => {
  assert.equal(isSamRegistrationExpiringSoon("2026-01-01", new Date("2026-09-20")), false);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --experimental-strip-types --test lib/sam-gov/expiration-warning.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement the helper**

```ts
// lib/sam-gov/expiration-warning.ts

// A registration that already lapsed is a different, more urgent state
// than "expiring soon" -- this helper only flags the 30-day warning
// window, not an already-expired registration (that's what
// sam_registration_status !== "active" already communicates
// separately in the UI).
const WARNING_WINDOW_DAYS = 30;

export function isSamRegistrationExpiringSoon(expiresAt: string | null, now: Date = new Date()): boolean {
  if (!expiresAt) return false;
  const expiry = new Date(expiresAt);
  const daysUntilExpiry = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return daysUntilExpiry > 0 && daysUntilExpiry <= WARNING_WINDOW_DAYS;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --experimental-strip-types --test lib/sam-gov/expiration-warning.test.ts`
Expected: PASS, all 4 cases.

- [ ] **Step 6: Render the warning next to the existing profile-completeness card**

Find the existing block in `app/dashboard/page.tsx` around where `completeness.percent` renders (the `Profile {completeness.percent}% complete` text found at the two locations grepped earlier in this plan's research). Import `isSamRegistrationExpiringSoon` from `@/lib/sam-gov/expiration-warning` and add, immediately after that block:

```tsx
{isSamRegistrationExpiringSoon(client.sam_registration_expires_at) && (
  <p className="text-body-sm text-error mt-1">
    Your SAM.gov registration expires {client.sam_registration_expires_at} — renew it at sam.gov to
    stay eligible for federal opportunities.
  </p>
)}
```

Match the surrounding block's existing indentation and conditional-rendering style exactly (the two locations found in this file both already use a `completeness.percent < 100 && (...)`-shaped conditional right next to where this new block belongs).

- [ ] **Step 7: Manual verification**

Set a test client's `sam_registration_expires_at` to a date 10 days from today, reload `/dashboard`, confirm the warning text renders. Set it to a date 60 days out, reload, confirm the warning does not render.

- [ ] **Step 8: Commit**

```bash
git add app/dashboard/page.tsx lib/sam-gov/expiration-warning.ts lib/sam-gov/expiration-warning.test.ts
git commit -m "feat: warn clients when their SAM.gov registration is expiring soon"
```

---

## Self-Review Notes

- **Spec coverage:** registration monitoring (periodic cron, Task 3), status storage (Task 1), UEI collection (Task 5), expiration warning (Task 6) — all covered. The gating requirement itself (excluding non-active clients from opportunity *suggestions*) belongs to the separate sourcing plan, which reads the columns this plan produces; correctly out of scope here per the spec's own "two independent pieces" architecture.
- **Placeholder scan:** no TBD/TODO; the one place real content had to be deferred to the implementer (Task 2 Step 8, Task 3 Step 2) is a real external-account credential (a UEI looked up from SAM.gov's own public search) that cannot be fabricated without violating the product's own "never fabricate a fact" principle — flagged with exact commands and exactly what to look up, not a vague "test appropriately."
- **Type consistency:** `EntityRegistrationResult`, `checkEntityRegistration`, `parseEntityRegistrationResponse`, `isSamRegistrationExpiringSoon` are each defined once and referenced by the same name/shape everywhere they're used across tasks.
