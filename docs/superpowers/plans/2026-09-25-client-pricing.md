# Client Pricing Numbers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The wage worksheet pre-fills supplies, overhead, profit and crew
production rate from **the bid's client**, entered once by the admin on the
worksheet. The client sees one read-only "Wage law check" line on their bid.
Settings loses Pricing defaults and the per-trade production rate.

**Architecture:**
- The client's numbers live in `clients.pricing` (jsonb).
- Pure logic lives in `lib/wage/client-pricing.ts` (normalise, what's
  missing) and `lib/wage/wage-check.ts` (the client line).
- `lib/wage/prefill.ts` drops the org defaults.
- The shared server pre-fill moves to `lib/wage/server.ts`, so two routes
  can use it:
  - `/api/wage-worksheet` (existing);
  - `/api/wage-worksheet/client-pricing` (new: saves the client's numbers).
- PATCH writes `submissions.wage_check`, which the client dashboard reads.
  No RLS change is needed.

**Tech Stack:** Next.js 15 App Router, Supabase (Postgres, RLS, PostgREST),
TypeScript (`strict: false`), and `node --experimental-strip-types --test`
with relative `.ts` imports in `lib/`.

**Spec:** `docs/superpowers/specs/2026-09-25-client-pricing-design.md`

## Global Constraints

- Client does nothing extra: no client forms, Profile fields or intake questions.
- Missing numbers are never guessed. They are stored as `null`, never `0`, shown blank and highlighted, and named in guidance.
- Hours the admin typed (`hoursSource === null` and `hoursPerWeek > 0`) are never overwritten by a pre-fill.
- Service days fall back to 5, with the hours source ending ` (assumed; the solicitation didn't say)`.
- The client line appears only when a bid price is set. Its below-floor wording is exactly: "This price is below the legal minimum. We'll go over it with you before you submit."
- The per-trade position code stays in Settings, under a "Wage worksheet" heading.
- **PostgREST embeds:** from `submissions`, always embed `clients!submissions_client_id_fkey(...)`, because `submissions` has 2 FKs to `clients` (CLAUDE.md).
- **Tests and checks:** `npm test` must stay green; `npx tsc --noEmit -p .` must pass.
- **Commit trailer** on every commit:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01VxaQ43PbCfwewBqBw5t8Dd
  ```
- **Dev only:** the Supabase project `hvrwxcyqgjobrgpcequj`.
  - Production migrations are run by the user (`! npx supabase db push`).
  - Never update or delete more than one row without printing the count and getting confirmation.
- **Rollout deviation from the spec (safety):** the columns are removed in a **second** migration, applied only after the new code is live.
  - Reason: `production_rate_sqft_per_hour` is selected by `lib/trades` for the scrapers and Matches.
  - Dropping it before the deploy would break them for the minutes in between.

## Review Focus

1. **A client with pricing `{}`**, like every existing client, opens the worksheet with supplies, overhead and profit blank and highlighted. The resulting price is replaced by "Enter <Company>'s numbers to see a price". The floor and the below-floor warning still work.
2. **Saving the client's numbers a second time** (the client already had numbers) must NOT change the open worksheet. Only the first save fills it (Task 4 test).
3. **A worksheet saved before this change** (non-null 0 overhead) keeps its values. It is not re-read as missing (Task 5 manual check).
4. **Clearing the bid price** must clear `submissions.wage_check`, so the client never sees a stale price (Task 2 test: `wageCheckFor` returns null; Task 4 writes null).
5. **Typing "12%" or "$1,500"** in a client-number box is read as 12 or 1500, not dropped (Task 2 test).

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/20260925170000_client_pricing.sql` (new) | Add `clients.pricing`, `submissions.wage_check`; make worksheet pricing columns nullable |
| `supabase/migrations/20260925180000_drop_org_pricing_defaults.sql` (new, **Task 8, after deploy**) | Guarded drop of `organizations.pricing_defaults`, `trades.production_rate_sqft_per_hour` |
| `lib/wage/client-pricing.ts` (+ test, new) | `ClientPricing` type, `normalizeClientPricing`, `hasAnyPricing`, `missingPricing` |
| `lib/wage/wage-check.ts` (+ test, new) | `WageCheck` type, `staffingText`, `wageCheckFor`, `wageCheckLines` |
| `lib/wage/prefill.ts` (+ test) | Drop `PricingDefaults`; `prefillLines` without defaults, "assumed" days; `prefillGuidance` names the client; `applyPrefilledHours`; `readOptionalNumberText` |
| `lib/wage/server.ts` (new) | `prefillContext`, `guidanceFor`: shared by both worksheet routes |
| `app/api/wage-worksheet/route.ts` | Use client pricing; PATCH nullable pricing, writes `wage_check` |
| `app/api/wage-worksheet/client-pricing/route.ts` (new) | PUT: save the client's numbers; the first save fills the worksheet |
| `app/admin/inbox/[id]/ClientNumbers.tsx` (new) | The "<Company>'s numbers" row |
| `app/admin/inbox/[id]/WageWorksheet.tsx` | Nullable fields, highlights, price-ready message, renamed re-fill, supplies-mode select, mounts ClientNumbers |
| `lib/trades/{types,validate,resort}.ts`, `app/api/admin/trades/route.ts`, `app/admin/settings/{TradeForm,TradesSettings}.tsx`, trade tests | Remove production rate |
| `app/admin/settings/page.tsx`, `app/admin/settings/PricingDefaultsForm.tsx` (delete) | Remove Pricing defaults |
| `app/dashboard/page.tsx`, `app/dashboard/SubmissionCard.tsx`, `app/dashboard/WageCheckNotice.tsx` (new) | The client's read-only line |

---

### Task 1: Migration (additive) on dev

**Files:**
- Create: `supabase/migrations/20260925170000_client_pricing.sql`

**Interfaces:**
- Produces:
  - `clients.pricing jsonb not null default '{}'`;
  - `submissions.wage_check jsonb` (nullable);
  - `wage_worksheets.supplies_value`, `overhead_pct` and `profit_pct` are now nullable, with no default.

- [ ] **Step 1: Write the migration**

```sql
-- The wage worksheet's pricing numbers are the client's, not ours
-- (docs/superpowers/specs/2026-09-25-client-pricing-design.md).

-- Each client's usual numbers, entered once by the admin on a worksheet.
-- {suppliesMode: 'percent'|'flat', suppliesValue, overheadPct, profitPct,
--  productionRate (sq ft per hour)}; a missing number is absent or null.
alter table public.clients
  add column pricing jsonb not null default '{}'::jsonb;

-- The one read-only line the client sees on their bid (set when the admin
-- enters a bid price, cleared when it's cleared):
-- {floor, bidPrice, staffing, wdNumber, wdRevision, updatedAt}.
alter table public.submissions
  add column wage_check jsonb;

-- null = "not given yet" (shown blank and highlighted), never 0.
alter table public.wage_worksheets
  alter column supplies_value drop not null,
  alter column supplies_value drop default,
  alter column overhead_pct drop not null,
  alter column overhead_pct drop default,
  alter column profit_pct drop not null,
  alter column profit_pct drop default;
```

- [ ] **Step 2: Apply to dev**

```bash
npx supabase link --project-ref hvrwxcyqgjobrgpcequj
npx supabase db push --dry-run   # expect exactly 20260925170000_client_pricing.sql
npx supabase db push --yes
npx supabase db query --linked "NOTIFY pgrst, 'reload schema';"
npx supabase link --project-ref rixsgnbivayeaxbdseij
cat supabase/.temp/project-ref   # expect rixsgnbivayeaxbdseij
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260925170000_client_pricing.sql
git commit -m "Client pricing: clients.pricing, submissions.wage_check, nullable worksheet pricing"
```

---

### Task 2: Pure logic: client pricing and the client's line

**Files:**
- Create: `lib/wage/client-pricing.ts`, `lib/wage/client-pricing.test.ts`, `lib/wage/wage-check.ts`, `lib/wage/wage-check.test.ts`

**Interfaces:**
- Consumes: `WorksheetLine` from `lib/wage/floor.ts`
  (`{code, title, rate, workers, hoursPerWeek, hoursSource}`).
- Produces:
  - `type ClientPricing = { suppliesMode: "percent" | "flat"; suppliesValue: number | null; overheadPct: number | null; profitPct: number | null; productionRate: number | null }`
  - `normalizeClientPricing(raw: unknown): ClientPricing`
  - `hasAnyPricing(p: ClientPricing): boolean`
  - `missingPricing(p: ClientPricing): string[]`, e.g. `["supplies", "overhead %", "profit %"]` (production rate is reported separately by prefill guidance)
  - `type WageCheck = { floor: number; bidPrice: number; staffing: string; wdNumber: string; wdRevision: number; updatedAt: string }`
  - `staffingText(lines: WorksheetLine[]): string`
  - `wageCheckFor(i: { floor: number; bidPrice: number | null; lines: WorksheetLine[]; wdNumber: string; wdRevision: number; now: string }): WageCheck | null`
  - `wageCheckLines(c: WageCheck): { main: string; warning: string | null }`

- [ ] **Step 1: Write the failing tests**

`lib/wage/client-pricing.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeClientPricing, hasAnyPricing, missingPricing } from "./client-pricing.ts";

test("an empty or unknown value is all-missing, never zeros", () => {
  const p = normalizeClientPricing({});
  assert.deepEqual(p, { suppliesMode: "percent", suppliesValue: null, overheadPct: null, profitPct: null, productionRate: null });
  assert.deepEqual(normalizeClientPricing(null), p);
  assert.equal(hasAnyPricing(p), false);
  assert.deepEqual(missingPricing(p), ["supplies", "overhead %", "profit %"]);
});

test("typed text is read: '12%', '$1,500', ' 3500 '", () => {
  const p = normalizeClientPricing({ suppliesMode: "flat", suppliesValue: "$1,500", overheadPct: "12%", profitPct: 0, productionRate: " 3500 " });
  assert.deepEqual(p, { suppliesMode: "flat", suppliesValue: 1500, overheadPct: 12, profitPct: 0, productionRate: 3500 });
  assert.equal(hasAnyPricing(p), true);
  assert.deepEqual(missingPricing(p), []);
});

test("negative, unreadable, or a zero production rate is missing", () => {
  const p = normalizeClientPricing({ suppliesValue: -1, overheadPct: "abc", profitPct: "", productionRate: 0 });
  assert.deepEqual(p, { suppliesMode: "percent", suppliesValue: null, overheadPct: null, profitPct: null, productionRate: null });
});

test("0% profit is a real answer, not missing", () => {
  assert.deepEqual(missingPricing(normalizeClientPricing({ suppliesValue: 5, overheadPct: 10, profitPct: 0 })), []);
});
```

`lib/wage/wage-check.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { staffingText, wageCheckFor, wageCheckLines } from "./wage-check.ts";

const jan = { code: "11150", title: "Janitor", rate: 17.04, workers: 2, hoursPerWeek: 32.14, hoursSource: null };
const base = { floor: 86427.26, lines: [jan], wdNumber: "2015-4539", wdRevision: 32, now: "2026-09-25T12:00:00.000Z" };

test("staffing lists each position with workers and hours; empty lines are left out", () => {
  assert.equal(staffingText([jan]), "2 × Janitor at 32.14 hours/week each");
  assert.equal(
    staffingText([jan, { ...jan, code: "11210", title: "Laborer, Grounds Maintenance", workers: 1, hoursPerWeek: 20 }, { ...jan, workers: 0 }]),
    "2 × Janitor at 32.14 hours/week each; 1 × Laborer, Grounds Maintenance at 20 hours/week each"
  );
});

test("no bid price, or no floor yet: nothing for the client", () => {
  assert.equal(wageCheckFor({ ...base, bidPrice: null }), null);
  assert.equal(wageCheckFor({ ...base, floor: 0, bidPrice: 90000 }), null);
});

test("with a bid price: the saved line", () => {
  assert.deepEqual(wageCheckFor({ ...base, bidPrice: 112943.14 }), {
    floor: 86427.26, bidPrice: 112943.14, staffing: "2 × Janitor at 32.14 hours/week each",
    wdNumber: "2015-4539", wdRevision: 32, updatedAt: "2026-09-25T12:00:00.000Z",
  });
});

test("the client's wording, with the warning only below the floor", () => {
  const ok = wageCheckLines(wageCheckFor({ ...base, bidPrice: 112943.14 }));
  assert.equal(
    ok.main,
    "Federal wage law requires at least $86,427/year in labor for this contract (2 × Janitor at 32.14 hours/week each, WD 2015-4539 Rev. 32). Your price: $112,943/year."
  );
  assert.equal(ok.warning, null);
  const low = wageCheckLines(wageCheckFor({ ...base, bidPrice: 80000 }));
  assert.equal(low.warning, "This price is below the legal minimum. We'll go over it with you before you submit.");
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `node --experimental-strip-types --test lib/wage/client-pricing.test.ts lib/wage/wage-check.test.ts`
Expected: FAIL, because the modules can't be found.

- [ ] **Step 3: Implement**

`lib/wage/client-pricing.ts`:
```ts
// A client's usual pricing numbers (clients.pricing), entered once by the
// admin and reused on every bid for that client. First Coast Bids prepares
// the bid; the client sets the price -- so these are never our defaults and
// never guessed: a missing number is null (blank, highlighted, named).

export type ClientPricing = {
  suppliesMode: "percent" | "flat";
  suppliesValue: number | null;
  overheadPct: number | null;
  profitPct: number | null;
  productionRate: number | null;
};

// "12%", "$1,500", " 3500 " -> numbers; blank, negative or unreadable -> null.
function readAmount(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const t = typeof v === "number" ? String(v) : String(v).replace(/[,$%\s]/g, "");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function normalizeClientPricing(raw: unknown): ClientPricing {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const rate = readAmount(o.productionRate);
  return {
    suppliesMode: o.suppliesMode === "flat" ? "flat" : "percent",
    suppliesValue: readAmount(o.suppliesValue),
    overheadPct: readAmount(o.overheadPct),
    profitPct: readAmount(o.profitPct),
    productionRate: rate !== null && rate > 0 ? rate : null,
  };
}

export function hasAnyPricing(p: ClientPricing): boolean {
  return p.suppliesValue !== null || p.overheadPct !== null || p.profitPct !== null || p.productionRate !== null;
}

// The price numbers still to get from the client (production rate is named
// by the pre-fill guidance, since it only affects hours).
export function missingPricing(p: ClientPricing): string[] {
  const out: string[] = [];
  if (p.suppliesValue === null) out.push("supplies");
  if (p.overheadPct === null) out.push("overhead %");
  if (p.profitPct === null) out.push("profit %");
  return out;
}
```

`lib/wage/wage-check.ts`:
```ts
import type { WorksheetLine } from "./floor.ts";

// The one read-only line the client sees on their bid (submissions.wage_check).
// Only once the admin has entered a bid price -- never a half-finished number.

export type WageCheck = {
  floor: number;
  bidPrice: number;
  staffing: string;
  wdNumber: string;
  wdRevision: number;
  updatedAt: string;
};

const num = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
const dollars = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

export function staffingText(lines: WorksheetLine[]): string {
  return lines
    .filter((l) => l.workers > 0 && l.hoursPerWeek > 0)
    .map((l) => `${num(l.workers)} × ${l.title} at ${num(l.hoursPerWeek)} hours/week each`)
    .join("; ");
}

export function wageCheckFor(i: {
  floor: number;
  bidPrice: number | null;
  lines: WorksheetLine[];
  wdNumber: string;
  wdRevision: number;
  now: string;
}): WageCheck | null {
  if (i.bidPrice === null || !(i.floor > 0)) return null;
  return {
    floor: i.floor,
    bidPrice: i.bidPrice,
    staffing: staffingText(i.lines),
    wdNumber: i.wdNumber,
    wdRevision: i.wdRevision,
    updatedAt: i.now,
  };
}

export function wageCheckLines(c: WageCheck): { main: string; warning: string | null } {
  return {
    main:
      `Federal wage law requires at least ${dollars(c.floor)}/year in labor for this contract ` +
      `(${c.staffing}, WD ${c.wdNumber} Rev. ${c.wdRevision}). Your price: ${dollars(c.bidPrice)}/year.`,
    warning: c.bidPrice < c.floor ? "This price is below the legal minimum. We'll go over it with you before you submit." : null,
  };
}
```

- [ ] **Step 4: Run them and confirm they pass**

Run: `node --experimental-strip-types --test lib/wage/client-pricing.test.ts lib/wage/wage-check.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/wage/client-pricing.ts lib/wage/client-pricing.test.ts lib/wage/wage-check.ts lib/wage/wage-check.test.ts
git commit -m "Client pricing: normalise a client's numbers; the client's wage-law line"
```

---

### Task 3: Pre-fill from the client, not org defaults

**Files:**
- Modify: `lib/wage/prefill.ts`, `lib/wage/prefill.test.ts`

**Interfaces:**
- Consumes: `ClientPricing` (Task 2).
- Produces:
  - `prefillLines(i: { wd; positionCode: string | null; productionRate: number | null; cleanableSqft: number | null; serviceDaysPerWeek: number | null }): { lines; missingCode; hoursNeeded }`. The `defaults` param is removed.
  - `prefillGuidance(i: { tradeLabel: string | null; positionCode: string | null; clientName: string; productionRate: number | null; cleanableSqft: number | null; missingCode: string | null; missingPricing: string[] }): string[]`
  - `applyPrefilledHours(current: WorksheetLine[], prefilled: WorksheetLine[]): WorksheetLine[]`
  - `readOptionalNumberText(text: string): number | null | undefined`. It returns null for blank, a number for readable text, and undefined for unreadable text (keep the previous value).
  - `PricingDefaults` is **removed**.

- [ ] **Step 1: Update the tests**

In `lib/wage/prefill.test.ts`:
- remove `defaults: {}` / `defaults: {...}` from every `prefillLines` call;
- replace the test at lines 35–37, which used `defaults.serviceDaysPerWeek`, with the "assumed days" test below;
- replace the `prefillGuidance` test (lines 149–164) with the new one;
- add the new tests;
- add `applyPrefilledHours, readOptionalNumberText` to the import on line 3.

```ts
test("service days fall back to 5, and the source says it was assumed", () => {
  const a = prefillLines({ wd: WD, positionCode: "11150", productionRate: 3000, cleanableSqft: 30000, serviceDaysPerWeek: null });
  assert.equal(a.lines[0].hoursPerWeek, 50 / 2);
  assert.equal(a.lines[0].hoursSource, "from 30,000 sq ft at 3,000 sq ft/hr × 5 days (assumed; the solicitation didn't say)");
  const b = prefillLines({ wd: WD, positionCode: "11150", productionRate: 3000, cleanableSqft: 30000, serviceDaysPerWeek: 3 });
  assert.equal(b.lines[0].hoursSource, "from 30,000 sq ft at 3,000 sq ft/hr × 3 days");
});

test("guidance names the client for their numbers, and Settings only for the position code", () => {
  const base = { tradeLabel: "Janitorial", positionCode: "11150", clientName: "Acme Cleaning", productionRate: 3500, cleanableSqft: 45000, missingCode: null, missingPricing: [] };
  assert.deepEqual(prefillGuidance({ ...base, tradeLabel: null }), ["No trade matched this bid, so no position was pre-filled. Add a position below."]);
  assert.deepEqual(prefillGuidance({ ...base, positionCode: null }), [
    "Set a wage worksheet position code for Janitorial in Settings → Trades to pre-fill positions.",
  ]);
  assert.deepEqual(prefillGuidance({ ...base, positionCode: "99999", missingCode: "99999" }), [
    "Position 99999 (the Janitorial default) isn't in this wage determination. Add a position below.",
  ]);
  assert.deepEqual(prefillGuidance({ ...base, productionRate: null }), ["Enter Acme Cleaning's sq ft per hour to pre-fill hours."]);
  assert.deepEqual(prefillGuidance({ ...base, cleanableSqft: null }), ["The solicitation didn't state square footage, so enter hours per week."]);
  assert.deepEqual(prefillGuidance({ ...base, missingPricing: ["overhead %", "profit %"] }), ["Missing Acme Cleaning's overhead % and profit %."]);
  assert.deepEqual(prefillGuidance({ ...base, missingPricing: ["supplies", "overhead %", "profit %"] }), [
    "Missing Acme Cleaning's supplies, overhead % and profit %.",
  ]);
  assert.deepEqual(prefillGuidance(base), []);
});

test("pre-filled hours replace blank or pre-filled ones, never hours the admin typed", () => {
  const pre = [{ code: "11150", title: "Janitor", rate: 17.04, workers: 2, hoursPerWeek: 32.14, hoursSource: "from 45,000 sq ft …" }];
  const blank = [{ ...pre[0], workers: 1, hoursPerWeek: 0, hoursSource: null }];
  assert.deepEqual(applyPrefilledHours(blank, pre), pre);
  const oldPrefill = [{ ...pre[0], workers: 3, hoursPerWeek: 30, hoursSource: "from 45,000 sq ft at 2,000 …" }];
  assert.deepEqual(applyPrefilledHours(oldPrefill, pre), pre);
  const typed = [{ ...pre[0], workers: 2, hoursPerWeek: 36, hoursSource: null }];
  assert.deepEqual(applyPrefilledHours(typed, pre), typed);
  const other = [{ ...pre[0], code: "11210", hoursPerWeek: 0, hoursSource: null }];
  assert.deepEqual(applyPrefilledHours(other, pre), other);
});

test("an optional number box: blank is missing, typed text is read, junk keeps the old value", () => {
  assert.equal(readOptionalNumberText(""), null);
  assert.equal(readOptionalNumberText("  "), null);
  assert.equal(readOptionalNumberText("12"), 12);
  assert.equal(readOptionalNumberText("12."), 12);
  assert.equal(readOptionalNumberText("$1,500"), 1500);
  assert.equal(readOptionalNumberText("0"), 0);
  assert.equal(readOptionalNumberText("abc"), undefined);
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `node --experimental-strip-types --test lib/wage/prefill.test.ts`
Expected: FAIL. The new tests fail on missing exports and on the old guidance wording and hours source.

- [ ] **Step 3: Implement in `lib/wage/prefill.ts`**

**(a)** Delete the `PricingDefaults` type (lines 8–15). Change the header comment's "or the admin's own standing settings" to "or the client's own numbers".

**(b)** Replace `prefillGuidance` with:
```ts
// Exactly what's missing, so a half-filled worksheet says what to get: the
// client's numbers name the client; only the position code is ours (Settings).
export function prefillGuidance(input: {
  tradeLabel: string | null;
  positionCode: string | null;
  clientName: string;
  productionRate: number | null;
  cleanableSqft: number | null;
  missingCode: string | null;
  missingPricing: string[];
}): string[] {
  const out: string[] = [];
  if (!input.tradeLabel) out.push("No trade matched this bid, so no position was pre-filled. Add a position below.");
  else if (input.missingCode) {
    out.push(`Position ${input.missingCode} (the ${input.tradeLabel} default) isn't in this wage determination. Add a position below.`);
  } else if (!input.positionCode) {
    out.push(`Set a wage worksheet position code for ${input.tradeLabel} in Settings → Trades to pre-fill positions.`);
  } else {
    if (!input.productionRate) out.push(`Enter ${input.clientName}'s sq ft per hour to pre-fill hours.`);
    if (!input.cleanableSqft) out.push("The solicitation didn't state square footage, so enter hours per week.");
  }
  if (input.missingPricing.length) {
    const m = input.missingPricing;
    const list = m.length === 1 ? m[0] : `${m.slice(0, -1).join(", ")} and ${m[m.length - 1]}`;
    out.push(`Missing ${input.clientName}'s ${list}.`);
  }
  return out;
}
```

**(c)** In `prefillLines`:
- remove `defaults: PricingDefaults;` from the input type;
- replace the `days` line with:
  ```ts
  const assumed = input.serviceDaysPerWeek === null;
  const days = input.serviceDaysPerWeek ?? 5;
  ```
- make the `hoursSource` template:
  ```ts
  hoursSource: `from ${fmt(input.cleanableSqft)} sq ft at ${fmt(input.productionRate)} sq ft/hr × ${days} days${assumed ? " (assumed; the solicitation didn't say)" : ""}`,
  ```

**(d)** Add after `prefillLines`:
```ts
// Saving a client's numbers the first time re-computes hours -- only on
// lines whose hours are blank or were pre-filled, never hours the admin typed.
export function applyPrefilledHours(current: WorksheetLine[], prefilled: WorksheetLine[]): WorksheetLine[] {
  return current.map((l) => {
    if (l.hoursPerWeek > 0 && l.hoursSource === null) return l;
    const p = prefilled.find((x) => x.code === l.code);
    return p && p.hoursPerWeek > 0 ? { ...l, workers: p.workers, hoursPerWeek: p.hoursPerWeek, hoursSource: p.hoursSource } : l;
  });
}
```

**(e)** Add after `readNumberText`:
```ts
// For boxes where blank means "not given yet" (the client's numbers):
// null = blank, a number = read, undefined = unreadable (keep the old value).
export function readOptionalNumberText(text: string): number | null | undefined {
  if (text.trim() === "") return null;
  const n = readNumberText(text);
  return n === null ? undefined : n;
}
```

- [ ] **Step 4: Run them and confirm they pass**

Run: `node --experimental-strip-types --test lib/wage/prefill.test.ts`
Expected: PASS. `npx tsc --noEmit -p .` will now fail in `app/api/wage-worksheet/route.ts` and `app/admin/settings/PricingDefaultsForm.tsx`. That's expected; Tasks 4 and 6 fix them. Don't commit a broken build: go straight on to Task 4, and commit Tasks 3 and 4 together at the end of Task 4.

---

### Task 4: Routes: the shared pre-fill, client pricing, and wage_check

**Files:**
- Create: `lib/wage/server.ts`, `app/api/wage-worksheet/client-pricing/route.ts`
- Modify: `app/api/wage-worksheet/route.ts`

**Interfaces:**
- Consumes: Tasks 2 and 3.
- Produces:
  - `prefillContext(supabase, orgId, submissionId)` returns `{ trade, facts, client: { id: string; name: string; pricing: ClientPricing }, currentWd } | null`.
  - `guidanceFor(ctx, wd)` returns `{ pre, guidance }`.
  - The POST `/api/wage-worksheet` response gains `client: { name: string; pricing: ClientPricing }`.
  - PUT `/api/wage-worksheet/client-pricing` takes `{ submissionId, pricing }` and returns `{ pricing: ClientPricing, applied: boolean }`. `applied` is true when this was the client's first save, so the worksheet was filled and should be reloaded.

- [ ] **Step 1: Create `lib/wage/server.ts`**

Move `Supabase`, `adminFor`, `prefillContext` and `guidanceFor` out of `app/api/wage-worksheet/route.ts` into this file, exported, with these changes:
```ts
import { createClient } from "@/lib/supabase/server";
import type { ParsedWd } from "@/lib/wage/parse-wd";
import { pickWdSuggestion, prefillGuidance, prefillLines } from "@/lib/wage/prefill";
import { normalizeClientPricing, missingPricing, type ClientPricing } from "@/lib/wage/client-pricing";
import { getOrExtractBidEstimationFacts } from "@/lib/bid-estimation";
import { loadTrades } from "@/lib/trades/server";
import { clientTradeIds } from "@/lib/trades/naics-options";

// Shared by /api/wage-worksheet and /api/wage-worksheet/client-pricing.

export type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function adminFor(supabase: Supabase) { /* unchanged body */ }

export async function prefillContext(supabase: Supabase, orgId: string, submissionId: string) {
  const { data: sub } = await supabase
    .from("submissions")
    .select(
      "id, bid_estimation_facts, bid_estimation_facts_extracted_at, clients!submissions_client_id_fkey(id, company_name, naics_codes, pricing)"
    )
    .eq("id", submissionId)
    .maybeSingle();
  if (!sub) return null;
  const c = sub.clients as unknown as { id: string; company_name: string | null; naics_codes: string[] | null; pricing: unknown } | null;
  if (!c) return null;
  const client: { id: string; name: string; pricing: ClientPricing } = {
    id: c.id,
    name: c.company_name?.trim() || "the client",
    pricing: normalizeClientPricing(c.pricing),
  };
  const trades = await loadTrades(supabase, orgId);
  // ... the audit_log / matched_opportunities trade lookup, unchanged ...
  if (!tradeId) tradeId = clientTradeIds(c.naics_codes ?? [], trades)[0] ?? null;
  const trade = trades.find((t) => t.id === tradeId) ?? null;
  const facts = await getOrExtractBidEstimationFacts(supabase, sub as never);
  const { data: suggestions } = await supabase
    .from("checklist_suggestions")
    .select("kind, dedupe_key, label, status, created_at")
    .eq("submission_id", submissionId);
  return { trade, facts, client, currentWd: pickWdSuggestion(suggestions ?? []) };
}

export type Ctx = NonNullable<Awaited<ReturnType<typeof prefillContext>>>;

// The worksheet's own pricing (possibly different from the client's usual
// numbers) decides what's still missing on this bid.
export function guidanceFor(
  ctx: Ctx,
  wd: ParsedWd,
  current: { suppliesValue: number | null; overheadPct: number | null; profitPct: number | null }
) {
  const pre = prefillLines({
    wd,
    positionCode: ctx.trade?.wdPositionCode ?? null,
    productionRate: ctx.client.pricing.productionRate,
    cleanableSqft: ctx.facts?.cleanable_sqft ?? null,
    serviceDaysPerWeek: ctx.facts?.service_days_per_week ?? null,
  });
  const guidance = prefillGuidance({
    tradeLabel: ctx.trade?.label ?? null,
    positionCode: ctx.trade?.wdPositionCode ?? null,
    clientName: ctx.client.name,
    productionRate: ctx.client.pricing.productionRate,
    cleanableSqft: ctx.facts?.cleanable_sqft ?? null,
    missingCode: pre.missingCode,
    missingPricing: missingPricing({ ...ctx.client.pricing, ...current }),
  });
  return { pre, guidance };
}

// A worksheet's pricing columns, pre-filled from the client's numbers.
export function pricingColumns(p: ClientPricing) {
  return { supplies_mode: p.suppliesMode, supplies_value: p.suppliesValue, overhead_pct: p.overheadPct, profit_pct: p.profitPct };
}
```

**Note:** `lib/trades/types.ts` will lose `productionRate` in Task 6. Nothing here reads `ctx.trade.productionRate`.

- [ ] **Step 2: Update `app/api/wage-worksheet/route.ts`**

1. Import `adminFor`, `prefillContext`, `guidanceFor` and `pricingColumns` from `@/lib/wage/server`. Import `computeFloor` from `@/lib/wage/floor` and `wageCheckFor` from `@/lib/wage/wage-check`. Delete the local copies and the `PricingDefaults` import.
2. Add a helper that reads a worksheet row's current pricing:
   ```ts
   const current = (w: { supplies_value: unknown; overhead_pct: unknown; profit_pct: unknown }) => ({
     suppliesValue: w.supplies_value === null ? null : Number(w.supplies_value),
     overheadPct: w.overhead_pct === null ? null : Number(w.overhead_pct),
     profitPct: w.profit_pct === null ? null : Number(w.profit_pct),
   });
   const clientOut = (ctx: Ctx) => ({ name: ctx.client.name, pricing: ctx.client.pricing });
   ```
3. **Existing worksheet (no change):** `guidanceFor(ctx, wd, current(existing))`, and add `client: clientOut(ctx)` to the JSON.
4. **Refill:** replace the five defaults lines with
   `...pricingColumns(ctx.client.pricing), options: { ...(existing.options as object), includeVacation: true },`.
   Compute guidance with `current` built from the client's pricing:
   `guidanceFor(ctx, wd, ctx.client.pricing)`.
   Add `client: clientOut(ctx)`.
5. **Create:** replace the defaults with
   `options: { includeVacation: true, eo13658: false }, ...pricingColumns(ctx.client.pricing),`.
   Guidance uses `existing ? current(existing) : ctx.client.pricing`.
   Add `client: clientOut(ctx)`.
6. **PATCH:** read the submission's worksheet with `select("wd_parsed, wd_number, wd_revision")`, then change the pricing and bid lines to:
   ```ts
   const lines = sanitizeLines(body?.lines, wd);
   const opts = { includeVacation: options.includeVacation !== false, eo13658: options.eo13658 === true };
   const bid = bidPriceForSave(body?.bidPrice);
   ...
     lines,
     options: opts,
     supplies_mode: body?.suppliesMode === "flat" ? "flat" : "percent",
     supplies_value: sanitizeNumber(body?.suppliesValue, null),
     overhead_pct: sanitizeNumber(body?.overheadPct, null),
     profit_pct: sanitizeNumber(body?.profitPct, null),
     bid_price: bid,
   ```
   After the worksheet update succeeds, write the client's line (null when there's no bid):
   ```ts
   const { total } = computeFloor(lines, wd, opts);
   const check = wageCheckFor({ floor: roundCents(total.floor), bidPrice: bid, lines, wdNumber: ws.wd_number, wdRevision: ws.wd_revision, now: updatedAt });
   const { error: checkError } = await supabase.from("submissions").update({ wage_check: check }).eq("id", submissionId);
   if (checkError) return NextResponse.json({ error: checkError.message }, { status: 500 });
   ```
   Import `roundCents` along with `computeFloor`.

- [ ] **Step 3: Create `app/api/wage-worksheet/client-pricing/route.ts`**

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ParsedWd } from "@/lib/wage/parse-wd";
import { normalizeClientPricing, hasAnyPricing } from "@/lib/wage/client-pricing";
import { applyPrefilledHours } from "@/lib/wage/prefill";
import { adminFor, prefillContext, guidanceFor } from "@/lib/wage/server";
import type { WorksheetLine } from "@/lib/wage/floor";

export const runtime = "nodejs";
export const maxDuration = 60;

// PUT: save the bid's client's usual numbers (clients.pricing). The FIRST
// save for a client also fills this worksheet's blank pricing boxes and
// re-computes pre-filled/blank hours; later saves only change the client
// record (and future bids) -- "Re-fill" applies them to a worksheet.
export async function PUT(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const submissionId = typeof body?.submissionId === "string" ? body.submissionId : null;
  if (!submissionId) return NextResponse.json({ error: "Invalid submissionId." }, { status: 400 });
  const supabase = await createClient();
  const member = await adminFor(supabase);
  if (!member) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  const ctx = await prefillContext(supabase, member.org_id, submissionId);
  if (!ctx) return NextResponse.json({ error: "Submission not found." }, { status: 404 });
  const pricing = normalizeClientPricing(body?.pricing);
  const firstTime = !hasAnyPricing(ctx.client.pricing);

  const { error } = await supabase.from("clients").update({ pricing }).eq("id", ctx.client.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!firstTime) return NextResponse.json({ pricing, applied: false });

  const { data: ws } = await supabase
    .from("wage_worksheets")
    .select("wd_parsed, lines, supplies_mode, supplies_value, overhead_pct, profit_pct")
    .eq("submission_id", submissionId)
    .maybeSingle();
  if (!ws) return NextResponse.json({ pricing, applied: false });
  const next = { ...ctx, client: { ...ctx.client, pricing } };
  const { pre } = guidanceFor(next, ws.wd_parsed as ParsedWd, pricing);
  const blank = ws.supplies_value === null && ws.overhead_pct === null && ws.profit_pct === null;
  const { error: wsError } = await supabase
    .from("wage_worksheets")
    .update({
      lines: applyPrefilledHours(ws.lines as WorksheetLine[], pre.lines),
      ...(blank ? { supplies_mode: pricing.suppliesMode } : {}),
      supplies_value: ws.supplies_value ?? pricing.suppliesValue,
      overhead_pct: ws.overhead_pct ?? pricing.overheadPct,
      profit_pct: ws.profit_pct ?? pricing.profitPct,
      updated_by: member.id,
      updated_at: new Date().toISOString(),
    })
    .eq("submission_id", submissionId);
  if (wsError) return NextResponse.json({ error: wsError.message }, { status: 500 });
  return NextResponse.json({ pricing, applied: true });
}
```

- [ ] **Step 4: Add a pure test for the first-save rule**

The rule is `!hasAnyPricing(previous)`. Append to `lib/wage/client-pricing.test.ts`:
```ts
test("only a client with no saved numbers counts as a first save", () => {
  assert.equal(hasAnyPricing(normalizeClientPricing({})), false);
  assert.equal(hasAnyPricing(normalizeClientPricing({ productionRate: 3500 })), true);
  assert.equal(hasAnyPricing(normalizeClientPricing({ profitPct: 0 })), true);
});
```

- [ ] **Step 5: Verify**

Run: `npm test && npx tsc --noEmit -p .`
Expected: tests PASS. TSC fails only in `app/admin/settings/PricingDefaultsForm.tsx` and `app/admin/inbox/[id]/WageWorksheet.tsx`, or in nothing at all. If so, continue to Task 5 before committing. If TSC is clean, commit now.

- [ ] **Step 6: Commit (with Task 3)**, once TSC is clean after Task 5 (or now if already clean)

```bash
git add lib/wage app/api/wage-worksheet
git commit -m "Wage worksheet pre-fills from the bid's client; saves the client's line for their dashboard"
```

---

### Task 5: Worksheet UI: the client's numbers row

**Files:**
- Create: `app/admin/inbox/[id]/ClientNumbers.tsx`
- Modify: `app/admin/inbox/[id]/WageWorksheet.tsx`

**Interfaces:**
- Consumes: POST `/api/wage-worksheet` → `client: { name, pricing }`; PUT `/api/wage-worksheet/client-pricing`; `readOptionalNumberText` (Task 3).
- Produces: `<ClientNumbers submissionId clientName initial onSaved={(applied: boolean) => void} />`.

- [ ] **Step 1: Create `ClientNumbers.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { readOptionalNumberText } from "@/lib/wage/prefill";
import type { ClientPricing } from "@/lib/wage/client-pricing";

// The client's usual numbers, entered once (from the pricing conversation
// the admin already has) and used for every bid of theirs. Blank = not
// given yet, highlighted -- never guessed.
export function ClientNumbers({
  submissionId,
  clientName,
  initial,
  onSaved,
}: {
  submissionId: string;
  clientName: string;
  initial: ClientPricing;
  onSaved: (applied: boolean) => void;
}) {
  const [p, setP] = useState(initial);
  const [text, setText] = useState({
    suppliesValue: initial.suppliesValue?.toString() ?? "",
    overheadPct: initial.overheadPct?.toString() ?? "",
    profitPct: initial.profitPct?.toString() ?? "",
    productionRate: initial.productionRate?.toString() ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function edit(key: keyof typeof text, value: string) {
    setText({ ...text, [key]: value });
    setSaved(false);
    const n = readOptionalNumberText(value);
    if (n !== undefined) setP({ ...p, [key]: n });
  }

  async function save() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/wage-worksheet/client-pricing", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId, pricing: p }),
    });
    const body = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) return setError(body?.error ?? `Not saved (HTTP ${res.status}).`);
    setSaved(true);
    onSaved(body.applied === true);
  }

  const box = (v: string) =>
    `px-2 py-1 rounded border w-24 text-right ${v.trim() === "" ? "border-error bg-error-container/20" : "border-outline-variant"}`;
  return (
    <fieldset className="mt-4 rounded-lg border border-outline-variant p-3">
      <legend className="px-1 text-label-md font-bold">{clientName}&apos;s numbers</legend>
      <p className="text-body-sm text-on-surface-variant">Used for all {clientName}&apos;s bids. Enter them once.</p>
      <div className="mt-2 flex flex-wrap items-end gap-3 text-body-sm">
        <label className="flex flex-col gap-1">
          Supplies
          <span className="flex items-center gap-1">
            <input className={box(text.suppliesValue)} inputMode="decimal" value={text.suppliesValue} onChange={(e) => edit("suppliesValue", e.target.value)} />
            <select value={p.suppliesMode} onChange={(e) => { setP({ ...p, suppliesMode: e.target.value as "percent" | "flat" }); setSaved(false); }} className="px-1 py-1 rounded border border-outline-variant">
              <option value="percent">% of labor</option>
              <option value="flat">$ per year</option>
            </select>
          </span>
        </label>
        <label className="flex flex-col gap-1">Overhead %<input className={box(text.overheadPct)} inputMode="decimal" value={text.overheadPct} onChange={(e) => edit("overheadPct", e.target.value)} /></label>
        <label className="flex flex-col gap-1">Profit %<input className={box(text.profitPct)} inputMode="decimal" value={text.profitPct} onChange={(e) => edit("profitPct", e.target.value)} /></label>
        <label className="flex flex-col gap-1">Sq ft per hour<input className={box(text.productionRate)} inputMode="decimal" value={text.productionRate} onChange={(e) => edit("productionRate", e.target.value)} /></label>
        <button type="button" onClick={save} disabled={busy} className="px-3 py-1.5 rounded-lg bg-primary text-on-primary text-label-md font-bold flex items-center gap-2 disabled:opacity-40">
          {busy && <Spinner />} Save for {clientName}
        </button>
        {saved && <span className="text-on-surface-variant">Saved</span>}
      </div>
      {error && <p role="alert" className="mt-2 text-error">{error}</p>}
    </fieldset>
  );
}
```

- [ ] **Step 2: Update `WageWorksheet.tsx`**

1. **`Loaded` type:**
   - `supplies_value: number | null; overhead_pct: number | null; profit_pct: number | null;`
   - add `client: { name: string; pricing: ClientPricing };`
   - import `ClientPricing` (type) and `ClientNumbers`;
   - change the guidance comment to "What's missing (the client's numbers, or the trade's position code)".
2. **Pricing state:** make it `{ suppliesMode: "percent" | "flat"; suppliesValue: number | null; overheadPct: number | null; profitPct: number | null }`, initially all null with `"percent"`. In `load`, set it from the worksheet using `v === null ? null : Number(v)`.
3. **`NumberField`:** add an optional-value variant, `OptionalNumberField`, next to it. It takes `value: number | null`, `onChange: (n: number | null) => void` and `className`. It shows `value ?? ""` and reads with `readOptionalNumberText`, calling `onChange` unless the result is `undefined`. It adds `border-error bg-error-container/20` when `value === null`. Use it for the supplies, overhead and profit boxes.
4. **Supplies unit:** replace the `{pricing.suppliesMode === "percent" ? "%" : "$"}` text with a `<select>`:
   - options `percent` ("% of labor") and `flat` ("$ per year");
   - `onChange` sets `pricing.suppliesMode`.

   This also settles review item M6.
5. **Price:**
   ```tsx
   const priceReady = pricing.suppliesValue !== null && pricing.overheadPct !== null && pricing.profitPct !== null;
   const { supplies, price } = computePrice(total.floor, {
     suppliesMode: pricing.suppliesMode, suppliesValue: pricing.suppliesValue ?? 0,
     overheadPct: pricing.overheadPct ?? 0, profitPct: pricing.profitPct ?? 0,
   });
   ```
   Render the resulting-price paragraph only when `priceReady`. Otherwise render:
   ```tsx
   <p className="mt-3 text-body-md text-error font-bold">Enter {data!.client.name}&apos;s numbers to see a price.</p>
   ```
6. **ClientNumbers:** mount it above the supplies, overhead and profit grid:
   ```tsx
   <ClientNumbers
     key={JSON.stringify(data!.client.pricing)}
     submissionId={submissionId}
     clientName={data!.client.name}
     initial={data!.client.pricing}
     onSaved={(applied) => { if (applied) load(); }}
   />
   ```
7. **Re-fill:**
   - button text: `Re-fill from {data!.client.name}'s numbers`;
   - dialog `title`: `` `Re-fill from ${data!.client.name}'s numbers?` ``;
   - `description`: `` `This replaces the positions, hours, supplies, overhead and profit with ${data!.client.name}'s saved numbers. The bid price is kept.` ``.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit -p .`
Expected: the only remaining errors are in `app/admin/settings/PricingDefaultsForm.tsx` (fixed in Task 6).

- [ ] **Step 4: Commit with Tasks 3–4, after Task 6 makes TSC clean.** Continue to Task 6.

---

### Task 6: Settings: remove Pricing defaults and the production rate

**Files:**
- Delete: `app/admin/settings/PricingDefaultsForm.tsx`
- Modify: `app/admin/settings/page.tsx`, `app/admin/settings/TradeForm.tsx`, `app/admin/settings/TradesSettings.tsx`, `app/api/admin/trades/route.ts`, `lib/trades/types.ts`, `lib/trades/validate.ts`, `lib/trades/resort.ts`
- Tests: `lib/trades/validate.test.ts`, `lib/trades/classify.test.ts`, `lib/trades/resort.test.ts`, `lib/trades/naics-options.test.ts`

**Interfaces:**
- Produces:
  - `Trade` and `TradeInput` without `productionRate`;
  - `TRADE_SELECT` without `production_rate_sqft_per_hour`.
  - **Important:** the DB column still exists until Task 8. The code simply stops reading and writing it.

- [ ] **Step 1: Update the tests first**

- Remove `productionRate: null,` from the fixtures in `classify.test.ts:7`, `resort.test.ts:15`, `naics-options.test.ts:18` and `validate.test.ts:15,38`.
- In `validate.test.ts`, change the position-code test (lines 90–99) to:
  ```ts
  const ok = normalizeTradeInput({ label: "Janitorial", keywords: ["janitorial"], wdPositionCode: " 11150 " });
  assert.equal(ok.wdPositionCode, "11150");
  const bad = normalizeTradeInput({ label: "Janitorial", keywords: ["janitorial"], wdPositionCode: "1115" });
  // keep the existing assertion on bad's position-code error; delete any production-rate assertion
  const blank = normalizeTradeInput({ label: "Janitorial", keywords: ["janitorial"], wdPositionCode: "" });
  assert.equal(blank.wdPositionCode, null);
  ```
  Keep the existing assertions about `wdPositionCode`. Remove every `productionRate` assertion.
- Add:
  ```ts
  test("a production rate sent by an old page is ignored, not saved", () => {
    const t = normalizeTradeInput({ label: "Janitorial", keywords: ["janitorial"], productionRate: "3500" }) as Record<string, unknown>;
    assert.equal("productionRate" in t, false);
  });
  ```

- [ ] **Step 2: Run them and confirm they fail**

Run: `node --experimental-strip-types --test lib/trades/*.test.ts`
Expected: FAIL on the new "ignored" test.

- [ ] **Step 3: Remove the field**

- **`lib/trades/types.ts`:**
  - delete `productionRate` from `Trade` (line 17) and `TradeInput` (line 29);
  - delete `, production_rate_sqft_per_hour` from `TRADE_SELECT` (line 33);
  - delete the row type field (line 44) and the mapping (lines 66–69).
- **`lib/trades/validate.ts`:** delete the `productionRate:` normalisation (lines 44–47) and the production-rate validation error (lines 98–100).
- **`lib/trades/resort.ts:28`:** delete `productionRate: change.productionRate ?? null,`.
- **`app/api/admin/trades/route.ts:60`:** delete `production_rate_sqft_per_hour: saved.productionRate,`.
- **`app/admin/settings/TradesSettings.tsx:76`:** delete `productionRate: t.productionRate,`.
- **`app/admin/settings/TradeForm.tsx`:**
  - delete the `productionRate` state (line 27) and its use in the submitted input (line 42);
  - replace the two-column grid at lines 108–120 with:
  ```tsx
  <fieldset className="flex flex-col gap-1 rounded-lg border border-outline-variant p-3">
    <legend className="px-1 text-label-md font-bold text-on-surface">Wage worksheet</legend>
    <label className="flex flex-col gap-1">
      <span className="text-label-md font-bold text-on-surface">Position code</span>
      <span className="text-body-sm text-on-surface-variant">The five-digit code from the wage determination, e.g. 11150 (Janitor). Not a NIGP code.</span>
      <input value={wdPositionCode} onChange={(e) => setWdPositionCode(e.target.value)} className={`${inputClass} font-code`} inputMode="numeric" />
    </label>
  </fieldset>
  ```
- **`app/admin/settings/page.tsx`:**
  - remove the `PricingDefaultsForm` import (line 5);
  - change the select to `"id, lean_package_threshold"`;
  - delete the whole Pricing defaults `<div>` (lines 78–84).
- **Delete** `app/admin/settings/PricingDefaultsForm.tsx`.

- [ ] **Step 4: Verify**

Run:
```bash
npm test && npx tsc --noEmit -p .
grep -rn "productionRate\|production_rate\|PricingDefaults\|pricing_defaults" app lib components
```
Expected:
- tests PASS and TSC is clean;
- grep hits only `lib/wage/client-pricing.ts` and its test, `lib/wage/prefill.test.ts`, `lib/wage/server.ts`, `app/admin/inbox/[id]/ClientNumbers.tsx` (the client's `productionRate`), and `app/api/wage-worksheet/client-pricing`;
- nothing under `lib/trades` or `app/admin/settings`.

- [ ] **Step 5: Commit Tasks 3–6**

```bash
git add -A lib/wage lib/trades app/api/wage-worksheet app/api/admin/trades app/admin/inbox app/admin/settings
git commit -m "Wage worksheet uses each client's numbers, entered once on the worksheet; Settings drops pricing defaults and trade production rate"
```

---

### Task 7: The client's read-only line on the dashboard

**Files:**
- Create: `app/dashboard/WageCheckNotice.tsx`
- Modify: `app/dashboard/page.tsx` (the `Submission` type and the select at line ~118), `app/dashboard/SubmissionCard.tsx`

**Interfaces:**
- Consumes: `WageCheck` and `wageCheckLines` (Task 2).

- [ ] **Step 1: Create `WageCheckNotice.tsx`**

```tsx
import { wageCheckLines, type WageCheck } from "@/lib/wage/wage-check";

// Read-only: the client does nothing here. Shown once we've set a price.
export function WageCheckNotice({ check }: { check: WageCheck }) {
  const { main, warning } = wageCheckLines(check);
  return (
    <div className={`rounded-xl p-space-base border ${warning ? "bg-error-container/10 border-error/30" : "bg-surface-container-lowest border-outline-variant"}`}>
      <p className="text-label-sm text-on-surface-variant font-bold uppercase tracking-wider mb-1">Wage law check</p>
      <p className="text-body-md text-on-surface">{main}</p>
      {warning && <p className="mt-1 text-body-md text-error font-bold">{warning}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Wire it in**

- **`app/dashboard/page.tsx`:**
  - add `wage_check: WageCheck | null;` to `export type Submission`;
  - add `import type { WageCheck } from "@/lib/wage/wage-check";`;
  - append `, wage_check` to the submissions select string.
- **`app/dashboard/SubmissionCard.tsx`:**
  - import `WageCheckNotice`;
  - directly after the deadline/value stats grid, add:
  ```tsx
  {submission.wage_check && <WageCheckNotice check={submission.wage_check} />}
  ```
  - put it in the always-visible part, not the collapsible part, so a below-floor warning can't be hidden.

- [ ] **Step 3: Verify**

Run: `npm test && npx tsc --noEmit -p .`
Expected: PASS and clean.

- [ ] **Step 4: Commit**

```bash
git add app/dashboard
git commit -m "Client dashboard: read-only wage law check on a federal bid once a price is set"
```

---

### Task 8: Dev end-to-end check, then a guarded drop of the old columns

**Files:**
- Create (after the production deploy only): `supabase/migrations/20260925180000_drop_org_pricing_defaults.sql`
- Test helpers (git-ignored): `.superpowers/sdd/2026-09-25-client-pricing/e2e/`

- [ ] **Step 1: Browser e2e on dev**

Reuse the pattern in `.superpowers/sdd/2026-09-25-wage-worksheet/e2e/`: `reset.mjs`, `mkbid.mjs`, and the Playwright script. Check:
1. **A new bid for the QA client** (pricing `{}`):
   - supplies, overhead, profit and sq ft/hour boxes are blank and highlighted;
   - hours are blank;
   - the guidance says "Enter QA Withdraw Test Co's sq ft per hour…" and "Missing … supplies, overhead % and profit %.";
   - "Enter … numbers to see a price" appears;
   - the floor shows once hours are typed.
2. **Enter 8 / 10 / 10 / 3500, then Save for QA Withdraw Test Co:**
   - the worksheet reloads with those values;
   - hours are pre-filled "from … × N days";
   - the price shows.
3. **A second bid for the same client** opens fully pre-filled.
4. **Change profit to 12 and save** (not a first save): the open worksheet's profit stays 10. Re-fill makes it 12, and the bid price is kept.
5. **Bid price $90,000:** `submissions.wage_check` is set. Log in as the QA client (the fixture's client account; reset its password the same way, exactly 1 match), and the card shows "Wage law check" with the below-floor warning if 90,000 < floor.
6. **Clear the bid price:** `wage_check` becomes null, and the client card shows nothing.
7. **A worksheet saved before this change** (the earlier e2e bid `5195b162-8f31-4288-8082-79f3882a1a9a`, overhead 10, profit 10) opens with its values kept. Nothing is highlighted as missing.
8. **Settings:**
   - there's no Pricing defaults section;
   - the trade form shows a "Wage worksheet" group with only "Position code";
   - saving Janitorial still works.

- [ ] **Step 2: Hand off for review and rollout**

Final review, then production: the user runs `! npx supabase db push` (migration 20260925170000). Then merge and push, and wait for the deploy.

- [ ] **Step 3: After production is live, the guarded drop migration**

```sql
-- Settings' pricing defaults and the per-trade production rate moved to each
-- client (clients.pricing, 20260925170000). Dropped only after the code that
-- read them was gone from production. Stops if either still holds data.
do $$
begin
  if exists (select 1 from public.organizations where pricing_defaults <> '{}'::jsonb) then
    raise exception 'organizations.pricing_defaults still has values; clear them first';
  end if;
  if exists (select 1 from public.trades where production_rate_sqft_per_hour is not null) then
    raise exception 'trades.production_rate_sqft_per_hour still has values; clear them first';
  end if;
end $$;

alter table public.organizations drop column pricing_defaults;
alter table public.trades drop column production_rate_sqft_per_hour;
```

**On dev, the guard will fire.** Dev has two rows of QA values from the wage-worksheet e2e:
- org `7a71a421-772e-4f42-85a7-8dd4464751ec` has `pricing_defaults`;
- the Janitorial trade has `production_rate_sqft_per_hour = 3500`.

Clear each with a **single-row** update by id: print the row, confirm exactly 1 match, then update. Then run `db push` on dev. That also tests the guard, because the push fails before the clear.

On production, both are empty (checked 2026-09-25), so the user's `db push` passes the guard.
