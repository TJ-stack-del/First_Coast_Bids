# Trade List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace four hardcoded trade/NAICS lists with one admin-managed `trades` table. The table drives:
- SAM.gov search codes;
- the trade of every scraped match, with an "Other trades" tab for everything else;
- the client NAICS checkboxes;
- the NAICS codes the AI document reader accepts.

**Architecture:**
- **Pure, tested logic in `lib/trades/`:** types, classify, validate, resort planning and checkbox options. Thin Supabase glue sits in `lib/trades/server.ts`.
- **Stored trade:** the scrape route classifies each new match and stores `matched_opportunities.trade_id`.
- **Settings:** a Trades section on admin Settings edits trades through two routes, preview then confirm. Confirming re-sorts open (`status='new'`) matches, and only after the admin has seen the count.

**Tech Stack:**
- Next.js 15 App Router;
- Supabase (Postgres, RLS, PostgREST via supabase-js);
- TypeScript;
- `node --test` with `--experimental-strip-types`;
- Tailwind.

**Spec:** `docs/superpowers/specs/2026-09-23-trade-list-design.md`.

**One amendment to the spec, found while planning:**
- **What changes:** RLS allows **anyone (including logged-out visitors) to read *active* trades**, not only authenticated clients.
- **Why:** the intake wizard's NAICS checkboxes are on a public page, and `extract-company-profile` can run before the account exists (intake step 0).
- **Why it's safe:** active trades are the list of codes the business offers, which is not sensitive. Inactive trades and every write stay admin-only.

## Global Constraints

- Only **one organization** exists per database. Code that runs without a session (the scrape route, public reads) must follow the existing pattern (`organizations ... limit(1)`) or read `trades` without an org filter.
- **Trade codes:**
  - NAICS codes are exactly 6 digits: `/^\d{6}$/`.
  - NIGP codes are `NNN-NN`: `/^\d{3}-\d{2}$/`.
  - Codes are never auto-corrected; a bad code is rejected, with a message naming the value.
- **Keywords:**
  - lowercase, trimmed, internal whitespace collapsed, at least 3 characters;
  - matched **only against the bid title**, **only at the start of a word**, via the lookbehind `(?<![a-z0-9])`, with the keyword regex-escaped.
- **A NAICS or NIGP code belongs to at most one trade** per org, whether that trade is active or not.
- **Trades are never hard-deleted by the app.** Switching one off sets `active=false`.
- **Re-sorting:**
  - only ever touches rows with `status = 'new'`;
  - never deletes a row;
  - only runs after the admin confirms a preview count. If the count differs at confirm time, the save is refused (409), and nothing is changed.
- The scrape route **stops with a 500 and a visible error if trades can't be loaded**. There is no fallback list.
- **Tests:** `lib/` modules imported by tests use **relative imports with a `.ts` extension**, not `@/` (e.g. `import { classifyOpportunity } from "./classify.ts"`). Run one file with `node --experimental-strip-types --test <file>`, and all of them with `npm test`.
- **Typecheck:** `npx tsc --noEmit -p .` must pass at the end of every task.
- **Commits:** every commit message ends with these two lines:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01VxaQ43PbCfwewBqBw5t8Dd
  ```
- **Git:** work on branch `trade-list`, created from `main`.
- **Databases:**
  - `.env.local` points at **bidpulse-dev** (`hvrwxcyqgjobrgpcequj`).
  - `npx supabase ... --linked` is currently linked to **production** (`rixsgnbivayeaxbdseij`); check with `cat supabase/.temp/project-ref`.
  - Never run a write against production without the user's explicit go-ahead in that moment (Task 12).
- **Never run `supabase config push`** (CLAUDE.md).

## Review Focus

1. **Keywords with regex characters** ("a/c", "c++", "hvac (rtu)") must match literally and never throw. Covered in Task 2.
2. **Codes typed with spaces or without the dash** ("561 720", "91039") are rejected with a message naming the exact value, not silently fixed or dropped. Covered in Task 3.
3. **A scrape that lands between preview and confirm** changes what would move. The save must refuse with the new count, not apply a change the admin didn't see. Covered in Task 4 (`resortConflict`) and Task 7.
4. **Switching off every trade that has NAICS codes:** SAM.gov is skipped with a stated reason, with no crash, no request using an empty code list, and no backfill with an undefined code. Covered in Task 6.
5. **A client whose saved NAICS code is no longer offered** keeps it checked, labelled with the code alone. It must not be moved into the "Other" text box or dropped on save. Covered in Task 5.

---

## File Structure

**Create:**
- `supabase/migrations/20260923150000_add_trades.sql`: the table, RLS, and `matched_opportunities.trade_id` + `nigp_codes`.
- `supabase/seed/trades.sql`: the approved starting trades, idempotent.
- `lib/trades/types.ts`: `Trade`, `NaicsEntry`, `TradeInput`, `TRADE_COLUMNS`, `rowToTrade`.
- `lib/trades/classify.ts` (+ `.test.ts`): `keywordMatches`, `classifyOpportunity`, `offeredNaicsCodes`.
- `lib/trades/validate.ts` (+ `.test.ts`): `normalizeTradeInput`, `validateTrade`.
- `lib/trades/resort.ts` (+ `.test.ts`): `applyTradeChange`, `planResort`, `summarizeMoves`, `describeSummary`, `resortConflict`.
- `lib/trades/naics-options.ts` (+ `.test.ts`): `offeredNaicsOptions`, `naicsOptionsWithSelected`, `clientTradeLabel`, `clientTradeIds`.
- `lib/trades/server.ts`: `loadTrades`, `loadActiveTrades`, `loadOpenRows`, `planTradeChange` (Supabase glue, not unit-tested).
- `app/api/admin/trades/preview/route.ts` and `app/api/admin/trades/route.ts`.
- `app/admin/settings/TradesSettings.tsx` and `app/admin/settings/TradeForm.tsx`.

**Modify:**
- `lib/scrapers/sam-gov-query.ts` (+ test), `lib/scrapers/sam-gov.ts`, `lib/scrapers/jaa.ts` (the `ScrapedOpportunity` type), `app/api/scrape/route.ts`.
- `lib/matches/rules.ts` (+ test), `app/admin/matches/page.tsx`, `app/admin/matches/MatchesPanel.tsx`.
- `app/admin/settings/page.tsx`.
- `app/intake/page.tsx`, `app/intake/IntakeWizard.tsx`.
- `app/dashboard/profile/page.tsx`, `app/dashboard/profile/CompanyProfileClient.tsx`, `app/dashboard/profile/CompanyInfoForm.tsx`.
- `app/api/extract-from-document/route.ts`, `app/api/extract-company-profile/route.ts`.
- `lib/business-options.ts`: remove `COMMON_NAICS_CODES` and `clientTradeLabel`.

---

### Task 1: Migration, applied to dev

**Files:**
- Create: `supabase/migrations/20260923150000_add_trades.sql`

**Interfaces:**
- Produces:
  - table `public.trades(id, org_id, label, naics jsonb, nigp_codes text[], keywords text[], active, sort_order, created_at, updated_at)`;
  - `public.matched_opportunities.trade_id uuid null` (FK `matched_opportunities_trade_id_fkey`);
  - `public.matched_opportunities.nigp_codes text[] not null default '{}'`.

- [ ] **Step 1: Create the branch**

```bash
cd /workspaces/Bidpulse && git checkout main && git pull --ff-only && git checkout -b trade-list
```

- [ ] **Step 2: Write the migration**

```sql
-- One admin-managed list of the trades First Coast Bids offers
-- (docs/superpowers/specs/2026-09-23-trade-list-design.md). Replaces the
-- hardcoded SAM_NAICS_CODES / COMMON_NAICS_CODES lists: scrapers search and
-- sort by it, and the client NAICS checkboxes are built from it.

create table public.trades (
  id uuid primary key default extensions.uuid_generate_v4(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  label text not null,
  -- [{"code": "561720", "label": "Janitorial Services"}, ...]
  naics jsonb not null default '[]'::jsonb,
  nigp_codes text[] not null default '{}',
  keywords text[] not null default '{}',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trades_label_not_blank check (btrim(label) <> ''),
  constraint trades_naics_is_array check (jsonb_typeof(naics) = 'array')
);

create unique index trades_org_label_unique on public.trades (org_id, lower(label));

alter table public.trades enable row level security;

create policy "admins manage trades" on public.trades
  using (public.is_admin(org_id))
  with check (public.is_admin(org_id));

-- Public on purpose: the intake wizard's NAICS checkboxes render before the
-- visitor has an account, and active trades are just the codes the business
-- offers. Inactive trades stay admin-only.
create policy "anyone reads active trades" on public.trades
  for select using (active);

grant select on public.trades to anon, authenticated;
grant insert, update on public.trades to authenticated;

-- The trade each match was sorted into (null = "Other trades"). Explicitly
-- named so any future embed can use trades!matched_opportunities_trade_id_fkey
-- (CLAUDE.md: PostgREST embeds break when a second FK appears).
alter table public.matched_opportunities
  add column trade_id uuid,
  add column nigp_codes text[] not null default '{}';

alter table public.matched_opportunities
  add constraint matched_opportunities_trade_id_fkey
  foreign key (trade_id) references public.trades(id) on delete set null;

create index matched_opportunities_org_trade_status_idx
  on public.matched_opportunities (org_id, trade_id, status);
```

- [ ] **Step 3: Point the CLI at dev and dry-run**

```bash
cat supabase/.temp/project-ref   # expect rixsgnbivayeaxbdseij (production) -- remember it to relink later
npx supabase link --project-ref hvrwxcyqgjobrgpcequj
npx supabase db push --dry-run
```

Expected: the dry run lists exactly one migration, `20260923150000_add_trades.sql`. If it lists any other migration, **stop and report**; don't push.

- [ ] **Step 4: Apply to dev, then relink production**

```bash
npx supabase db push
npx supabase link --project-ref rixsgnbivayeaxbdseij
cat supabase/.temp/project-ref   # expect rixsgnbivayeaxbdseij
```

- [ ] **Step 5: Check the table is visible over REST (the PGRST205 check)**

```bash
set -a; . ./.env.local; set +a
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/trades?select=id&limit=1" -H "apikey: $NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
```

Expected: `[]`. If the response has code `PGRST205`, run `NOTIFY pgrst, 'reload schema';` in dev's SQL editor (ask the user) and retry.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260923150000_add_trades.sql
git commit -m "Add trades table and matched_opportunities.trade_id" -m "<attribution lines>"
```

---

### Task 2: Types and classification

**Files:**
- Create: `lib/trades/types.ts`, `lib/trades/classify.ts`, `lib/trades/classify.test.ts`

**Interfaces:**
- Produces:
  - `type NaicsEntry = { code: string; label: string }`
  - `type Trade = { id: string; label: string; naics: NaicsEntry[]; nigpCodes: string[]; keywords: string[]; active: boolean; sortOrder: number }`
  - `type TradeInput = { id?: string; label: string; naics: NaicsEntry[]; nigpCodes: string[]; keywords: string[]; active: boolean }`
  - `const TRADE_COLUMNS: string`
  - `function rowToTrade(row: TradeRow): Trade`
  - `function keywordMatches(text: string, keyword: string): boolean`
  - `function classifyOpportunity(o: { title: string; naicsCode?: string | null; nigpCodes?: string[] | null }, trades: Trade[]): string | null`
  - `function offeredNaicsCodes(trades: Trade[]): string[]`

- [ ] **Step 1: Write `lib/trades/types.ts`**

```ts
// Shapes for the admin-managed trade list (public.trades). See
// docs/superpowers/specs/2026-09-23-trade-list-design.md.

export type NaicsEntry = { code: string; label: string };

export type Trade = {
  id: string;
  label: string;
  naics: NaicsEntry[];
  nigpCodes: string[];
  keywords: string[];
  active: boolean;
  sortOrder: number;
};

// What the Trades form submits: a new trade has no id yet.
export type TradeInput = {
  id?: string;
  label: string;
  naics: NaicsEntry[];
  nigpCodes: string[];
  keywords: string[];
  active: boolean;
};

export const TRADE_COLUMNS = "id, label, naics, nigp_codes, keywords, active, sort_order";

export type TradeRow = {
  id: string;
  label: string;
  naics: unknown;
  nigp_codes: string[] | null;
  keywords: string[] | null;
  active: boolean;
  sort_order: number;
};

// naics is jsonb, so it's checked rather than trusted: anything that isn't
// a {code, label} pair of strings is dropped.
export function rowToTrade(row: TradeRow): Trade {
  const naics = Array.isArray(row.naics)
    ? row.naics.flatMap((n) =>
        n && typeof n === "object" && typeof (n as NaicsEntry).code === "string" && typeof (n as NaicsEntry).label === "string"
          ? [{ code: (n as NaicsEntry).code, label: (n as NaicsEntry).label }]
          : []
      )
    : [];
  return {
    id: row.id,
    label: row.label,
    naics,
    nigpCodes: row.nigp_codes ?? [],
    keywords: row.keywords ?? [],
    active: row.active,
    sortOrder: row.sort_order,
  };
}
```

- [ ] **Step 2: Write the failing tests, `lib/trades/classify.test.ts`**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyOpportunity, keywordMatches, offeredNaicsCodes } from "./classify.ts";
import type { Trade } from "./types.ts";

function trade(p: Partial<Trade> & { id: string }): Trade {
  return { label: p.id, naics: [], nigpCodes: [], keywords: [], active: true, sortOrder: 0, ...p };
}

const JANITORIAL = trade({
  id: "jan",
  sortOrder: 1,
  naics: [{ code: "561720", label: "Janitorial Services" }],
  nigpCodes: ["910-39"],
  keywords: ["janitorial", "custodial"],
});
const HVAC = trade({
  id: "hvac",
  sortOrder: 2,
  naics: [{ code: "238220", label: "Plumbing, Heating, and Air-Conditioning Contractors" }],
  keywords: ["hvac", "boiler"],
});
const IT = trade({ id: "it", sortOrder: 3, keywords: ["it support", "a/c", "c++"] });
const ALL = [HVAC, IT, JANITORIAL]; // deliberately not in sort order

test("an exact NAICS code wins", () => {
  assert.equal(classifyOpportunity({ title: "Annual contract", naicsCode: "238220" }, ALL), "hvac");
});

test("codes beat keywords, even a keyword hit in an earlier trade", () => {
  // Title says "janitorial" (trade 1) but the code is HVAC's (trade 2).
  assert.equal(classifyOpportunity({ title: "Janitorial boiler room", naicsCode: "238220" }, ALL), "hvac");
});

test("NIGP codes match when there's no NAICS match", () => {
  assert.equal(classifyOpportunity({ title: "Services", nigpCodes: ["999-99", "910-39"] }, ALL), "jan");
});

test("title keywords match at the start of a word", () => {
  assert.equal(classifyOpportunity({ title: "Citywide Janitorial Services" }, ALL), "jan");
  assert.equal(classifyOpportunity({ title: "Boilers PM & Testing" }, ALL), "hvac");
});

test("a keyword inside another word does not match", () => {
  assert.equal(keywordMatches("Transit Support Services", "it support"), false);
  assert.equal(classifyOpportunity({ title: "Transit Support Services" }, ALL), null);
});

test("keywords with regex characters match literally and never throw", () => {
  assert.equal(keywordMatches("A/C unit replacement", "a/c"), true);
  assert.equal(keywordMatches("C++ developer", "c++"), true);
  assert.equal(keywordMatches("abc", "(("), false);
});

test("first trade in sort order wins when two keywords match", () => {
  assert.equal(classifyOpportunity({ title: "Custodial and HVAC services" }, ALL), "jan");
});

test("inactive trades are ignored", () => {
  const off = { ...JANITORIAL, active: false };
  assert.equal(classifyOpportunity({ title: "Janitorial", naicsCode: "561720" }, [off, HVAC]), null);
});

test("no match means Other trades (null)", () => {
  assert.equal(classifyOpportunity({ title: "Bridge Replacement" }, ALL), null);
  assert.equal(classifyOpportunity({ title: "Anything" }, []), null);
});

test("offeredNaicsCodes lists active trades' codes once, in sort order", () => {
  const dup = trade({ id: "x", sortOrder: 9, naics: [{ code: "561720", label: "dup" }] });
  const off = trade({ id: "off", active: false, naics: [{ code: "111111", label: "off" }] });
  assert.deepEqual(offeredNaicsCodes([HVAC, off, JANITORIAL, dup]), ["561720", "238220"]);
});
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `node --experimental-strip-types --test lib/trades/classify.test.ts`
Expected: FAIL, "Cannot find module ... classify.ts".

- [ ] **Step 4: Write `lib/trades/classify.ts`**

```ts
import type { Trade } from "./types.ts";

// Which offered trade a bid belongs to -- plain code, no AI
// (docs/superpowers/specs/2026-09-23-trade-list-design.md). Codes first
// across all trades, then title keywords. The scope/description is never
// searched: on 2026-09-23, construction scopes produced false matches
// ("McCoy's Creek Greenway" mentions landscaping in passing).

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}

// Matches only at the start of a word, so "it support" never matches
// "transit support". A keyword may be a stem: "landscap" matches
// "landscaping".
export function keywordMatches(text: string, keyword: string): boolean {
  const k = keyword.trim().toLowerCase();
  if (!k) return false;
  return new RegExp(`(?<![a-z0-9])${escapeRegExp(k)}`).test(text.toLowerCase());
}

function activeInOrder(trades: Trade[]): Trade[] {
  return trades.filter((t) => t.active).sort((a, b) => a.sortOrder - b.sortOrder);
}

// Returns the trade id, or null for "Other trades".
export function classifyOpportunity(
  o: { title: string; naicsCode?: string | null; nigpCodes?: string[] | null },
  trades: Trade[]
): string | null {
  const active = activeInOrder(trades);
  if (o.naicsCode) {
    const byNaics = active.find((t) => t.naics.some((n) => n.code === o.naicsCode));
    if (byNaics) return byNaics.id;
  }
  if (o.nigpCodes && o.nigpCodes.length > 0) {
    const byNigp = active.find((t) => t.nigpCodes.some((c) => o.nigpCodes!.includes(c)));
    if (byNigp) return byNigp.id;
  }
  const byKeyword = active.find((t) => t.keywords.some((k) => keywordMatches(o.title, k)));
  return byKeyword ? byKeyword.id : null;
}

// The NAICS codes SAM.gov searches for: every active trade's codes, once.
export function offeredNaicsCodes(trades: Trade[]): string[] {
  const seen = new Set<string>();
  for (const t of activeInOrder(trades)) for (const n of t.naics) seen.add(n.code);
  return [...seen];
}
```

- [ ] **Step 5: Run the tests to confirm they pass**

Run: `node --experimental-strip-types --test lib/trades/classify.test.ts`
Expected: all 10 pass.

- [ ] **Step 6: Typecheck and commit**

```bash
npx tsc --noEmit -p .
git add lib/trades/types.ts lib/trades/classify.ts lib/trades/classify.test.ts
git commit -m "Trade classification: codes first, then title keywords at word starts" -m "<attribution lines>"
```

---

### Task 3: Trade form validation

**Files:**
- Create: `lib/trades/validate.ts`, `lib/trades/validate.test.ts`

**Interfaces:**
- Consumes: `Trade`, `TradeInput`, `NaicsEntry` from `./types.ts`
- Produces:
  - `function normalizeTradeInput(raw: unknown): TradeInput`
  - `function validateTrade(input: TradeInput, allTrades: Trade[]): { ok: true } | { ok: false; errors: string[] }`. `allTrades` may include the trade being edited; it's excluded by `input.id`.

- [ ] **Step 1: Write the failing tests, `lib/trades/validate.test.ts`**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeTradeInput, validateTrade } from "./validate.ts";
import type { Trade } from "./types.ts";

const EXISTING: Trade = {
  id: "jan",
  label: "Janitorial",
  naics: [{ code: "561720", label: "Janitorial Services" }],
  nigpCodes: ["910-39"],
  keywords: ["janitorial"],
  active: false, // inactive trades still own their codes
  sortOrder: 1,
};

function errorsOf(raw: unknown, all: Trade[] = [EXISTING]): string[] {
  const r = validateTrade(normalizeTradeInput(raw), all);
  return r.ok ? [] : r.errors;
}

test("normalises: trims, lowercases and dedupes keywords; drops empty rows", () => {
  const t = normalizeTradeInput({
    label: "  Pressure washing ",
    naics: [{ code: " 561790 ", label: " Other Services " }, { code: "", label: "" }],
    nigpCodes: [" 910-52 ", "", "910-52"],
    keywords: ["  Pressure   WASH ", "", "pressure wash"],
  });
  assert.deepEqual(t, {
    id: undefined,
    label: "Pressure washing",
    naics: [{ code: "561790", label: "Other Services" }],
    nigpCodes: ["910-52"],
    keywords: ["pressure wash"],
    active: true,
  });
});

test("a valid new trade passes", () => {
  assert.deepEqual(errorsOf({ label: "Pressure washing", keywords: ["pressure wash"] }), []);
});

test("codes typed with spaces or without the dash are rejected, naming the value", () => {
  const errs = errorsOf({ label: "X", naics: [{ code: "561 720", label: "Y" }], nigpCodes: ["91039"] });
  assert.ok(errs.includes('NAICS code "561 720" must be exactly 6 digits.'));
  assert.ok(errs.includes('NIGP code "91039" must look like 910-39.'));
});

test("a NAICS code needs a label", () => {
  assert.ok(errorsOf({ label: "X", naics: [{ code: "561790", label: "" }] }).includes("NAICS code 561790 needs a label."));
});

test("a code already in another trade is rejected, even if that trade is off", () => {
  const errs = errorsOf({ label: "Cleaning", naics: [{ code: "561720", label: "J" }], nigpCodes: ["910-39"] });
  assert.ok(errs.includes("NAICS code 561720 is already in Janitorial."));
  assert.ok(errs.includes("NIGP code 910-39 is already in Janitorial."));
});

test("editing a trade doesn't conflict with its own codes", () => {
  assert.deepEqual(errorsOf({ id: "jan", label: "Janitorial", naics: [{ code: "561720", label: "J" }] }), []);
});

test("duplicate label (any case) is rejected", () => {
  assert.ok(errorsOf({ label: "JANITORIAL", keywords: ["mop"] }).includes('A trade called "JANITORIAL" already exists.'));
});

test("a trade that can't match anything is rejected", () => {
  assert.ok(
    errorsOf({ label: "Empty" }).includes("Add at least one NAICS code, NIGP code or keyword, or this trade can't match any bid.")
  );
});

test("keywords shorter than 3 characters are rejected", () => {
  assert.ok(errorsOf({ label: "IT", keywords: ["it"] }).includes('Keyword "it" is too short. Use at least 3 characters.'));
});

test("label is required and at most 60 characters", () => {
  assert.ok(errorsOf({ label: "  ", keywords: ["mop"] }).includes("Give the trade a name."));
  assert.ok(errorsOf({ label: "x".repeat(61), keywords: ["mop"] }).includes("Keep the trade name under 60 characters."));
});

test("garbage input normalises to an empty trade instead of throwing", () => {
  assert.equal(normalizeTradeInput(null).label, "");
  assert.deepEqual(normalizeTradeInput({ naics: "nope", keywords: 5 }).naics, []);
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `node --experimental-strip-types --test lib/trades/validate.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write `lib/trades/validate.ts`**

```ts
import type { NaicsEntry, Trade, TradeInput } from "./types.ts";

// Normalising and checking a trade before it's saved. Used by the Trades
// form (instant feedback) and again by the save route (the real gate).
// Bad codes are rejected with the exact value named, never auto-corrected.

const NAICS_RE = /^\d{6}$/;
const NIGP_RE = /^\d{3}-\d{2}$/;

function strings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export function normalizeTradeInput(raw: unknown): TradeInput {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const naics: NaicsEntry[] = Array.isArray(obj.naics)
    ? obj.naics
        .map((n) => {
          const e = (n && typeof n === "object" ? n : {}) as Record<string, unknown>;
          return {
            code: typeof e.code === "string" ? e.code.trim() : "",
            label: typeof e.label === "string" ? e.label.trim().replace(/\s+/g, " ") : "",
          };
        })
        .filter((n) => n.code || n.label)
    : [];
  return {
    id: typeof obj.id === "string" && obj.id ? obj.id : undefined,
    label: typeof obj.label === "string" ? obj.label.trim().replace(/\s+/g, " ") : "",
    naics,
    nigpCodes: unique(strings(obj.nigpCodes).map((c) => c.trim()).filter(Boolean)),
    keywords: unique(
      strings(obj.keywords)
        .map((k) => k.trim().toLowerCase().replace(/\s+/g, " "))
        .filter(Boolean)
    ),
    active: obj.active === false ? false : true,
  };
}

export function validateTrade(
  input: TradeInput,
  allTrades: Trade[]
): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const others = allTrades.filter((t) => t.id !== input.id);

  if (!input.label) errors.push("Give the trade a name.");
  else if (input.label.length > 60) errors.push("Keep the trade name under 60 characters.");
  else if (others.some((t) => t.label.toLowerCase() === input.label.toLowerCase())) {
    errors.push(`A trade called "${input.label}" already exists.`);
  }

  const seenNaics = new Set<string>();
  for (const n of input.naics) {
    if (!NAICS_RE.test(n.code)) {
      errors.push(`NAICS code "${n.code}" must be exactly 6 digits.`);
      continue;
    }
    if (!n.label) errors.push(`NAICS code ${n.code} needs a label.`);
    if (seenNaics.has(n.code)) errors.push(`NAICS code ${n.code} is listed twice.`);
    seenNaics.add(n.code);
    const owner = others.find((t) => t.naics.some((o) => o.code === n.code));
    if (owner) errors.push(`NAICS code ${n.code} is already in ${owner.label}.`);
  }

  for (const c of input.nigpCodes) {
    if (!NIGP_RE.test(c)) {
      errors.push(`NIGP code "${c}" must look like 910-39.`);
      continue;
    }
    const owner = others.find((t) => t.nigpCodes.includes(c));
    if (owner) errors.push(`NIGP code ${c} is already in ${owner.label}.`);
  }

  for (const k of input.keywords) {
    if (k.length < 3) errors.push(`Keyword "${k}" is too short. Use at least 3 characters.`);
  }

  if (input.naics.length === 0 && input.nigpCodes.length === 0 && input.keywords.length === 0) {
    errors.push("Add at least one NAICS code, NIGP code or keyword, or this trade can't match any bid.");
  }

  return errors.length ? { ok: false, errors } : { ok: true };
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `node --experimental-strip-types --test lib/trades/validate.test.ts`
Expected: all 11 pass.

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit -p .
git add lib/trades/validate.ts lib/trades/validate.test.ts
git commit -m "Trade form validation: code formats, one trade per code, no empty trades" -m "<attribution lines>"
```

---

### Task 4: Re-sort planning

**Files:**
- Create: `lib/trades/resort.ts`, `lib/trades/resort.test.ts`

**Interfaces:**
- Consumes: `classifyOpportunity` (Task 2); `Trade`, `TradeInput` (Task 2)
- Produces:
  - `type ResortRow = { id: string; title: string; naicsCode: string | null; nigpCodes: string[]; tradeId: string | null }`
  - `type ResortMove = { id: string; from: string | null; to: string | null }`
  - `type ResortSummary = { total: number; into: { tradeId: string | null; label: string; count: number }[] }`
  - `function applyTradeChange(trades: Trade[], change: (TradeInput & { id: string }) | null): Trade[]`
  - `function planResort(rows: ResortRow[], tradesAfter: Trade[]): ResortMove[]`
  - `function summarizeMoves(moves: ResortMove[], tradesAfter: Trade[]): ResortSummary`
  - `function describeSummary(s: ResortSummary): string`
  - `function resortConflict(actualMoves: number, expectedMoves: number): string | null`

- [ ] **Step 1: Write the failing tests, `lib/trades/resort.test.ts`**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyTradeChange, planResort, summarizeMoves, describeSummary, resortConflict } from "./resort.ts";
import type { Trade } from "./types.ts";

const JAN: Trade = {
  id: "jan",
  label: "Janitorial",
  naics: [{ code: "561720", label: "Janitorial Services" }],
  nigpCodes: [],
  keywords: ["janitorial"],
  active: true,
  sortOrder: 1,
};
const rows = [
  { id: "r1", title: "Citywide Janitorial Services", naicsCode: null, nigpCodes: [], tradeId: null },
  { id: "r2", title: "Pressure Washing of Sidewalks", naicsCode: null, nigpCodes: [], tradeId: null },
  { id: "r3", title: "Bridge Replacement", naicsCode: null, nigpCodes: [], tradeId: null },
  { id: "r4", title: "Custodial", naicsCode: "561720", nigpCodes: [], tradeId: "jan" },
];

test("adding a trade moves matching open rows into it and leaves the rest", () => {
  const after = applyTradeChange([JAN], {
    id: "pw",
    label: "Pressure washing",
    naics: [],
    nigpCodes: [],
    keywords: ["pressure wash"],
    active: true,
  });
  assert.equal(after.find((t) => t.id === "pw")?.sortOrder, 2, "new trades go last");
  const moves = planResort(rows, after);
  // r1 was never sorted (seed happened after it was scraped) -> Janitorial.
  assert.deepEqual(moves, [
    { id: "r1", from: null, to: "jan" },
    { id: "r2", from: null, to: "pw" },
  ]);
});

test("switching a trade off moves its rows to Other trades", () => {
  const after = applyTradeChange([JAN], { ...JAN, active: false });
  assert.deepEqual(planResort(rows, after), [{ id: "r4", from: "jan", to: null }]);
});

test("a re-sort with no change moves only rows whose stored trade is stale", () => {
  assert.deepEqual(planResort(rows, [JAN]), [{ id: "r1", from: null, to: "jan" }]);
});

test("NIGP codes stored on a row count when re-sorting", () => {
  const nigp: Trade = { ...JAN, id: "n", label: "N", naics: [], keywords: [], nigpCodes: ["910-39"], sortOrder: 2 };
  const moves = planResort([{ id: "x", title: "Services", naicsCode: null, nigpCodes: ["910-39"], tradeId: null }], [JAN, nigp]);
  assert.deepEqual(moves, [{ id: "x", from: null, to: "n" }]);
});

test("summary groups by destination and reads plainly", () => {
  const after = applyTradeChange([JAN], { ...JAN, active: false });
  const moves = [...planResort(rows, after), { id: "z", from: null, to: "jan" }];
  const s = summarizeMoves(moves, [JAN]);
  assert.deepEqual(s, {
    total: 2,
    into: [
      { tradeId: "jan", label: "Janitorial", count: 1 },
      { tradeId: null, label: "Other trades", count: 1 },
    ],
  });
  assert.equal(describeSummary(s), "This moves 2 open matches: 1 into Janitorial, 1 to Other trades.");
  assert.equal(describeSummary({ total: 0, into: [] }), "No open matches change trade.");
  assert.equal(
    describeSummary({ total: 1, into: [{ tradeId: "jan", label: "Janitorial", count: 1 }] }),
    "This moves 1 open match: 1 into Janitorial."
  );
});

test("a count that changed since the preview is a conflict", () => {
  assert.equal(resortConflict(3, 3), null);
  assert.equal(
    resortConflict(5, 3),
    "Matches changed since the preview: 5 would move now, not 3. Check the new count and confirm again."
  );
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `node --experimental-strip-types --test lib/trades/resort.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write `lib/trades/resort.ts`**

```ts
import { classifyOpportunity } from "./classify.ts";
import type { Trade, TradeInput } from "./types.ts";

// Planning a re-sort of open matches after a trade change. Pure, so the
// preview the admin sees and the change the save route applies come from
// the same function. Only status='new' rows are ever passed in (the caller
// filters); nothing here deletes anything.

export type ResortRow = { id: string; title: string; naicsCode: string | null; nigpCodes: string[]; tradeId: string | null };
export type ResortMove = { id: string; from: string | null; to: string | null };
export type ResortSummary = { total: number; into: { tradeId: string | null; label: string; count: number }[] };

// The trade list as it would be after saving `change` (null = no change,
// used by "Re-sort open matches"). A new trade goes last in sort order.
export function applyTradeChange(trades: Trade[], change: (TradeInput & { id: string }) | null): Trade[] {
  if (!change) return trades;
  const existing = trades.find((t) => t.id === change.id);
  const sortOrder = existing ? existing.sortOrder : Math.max(0, ...trades.map((t) => t.sortOrder)) + 1;
  const updated: Trade = {
    id: change.id,
    label: change.label,
    naics: change.naics,
    nigpCodes: change.nigpCodes,
    keywords: change.keywords,
    active: change.active,
    sortOrder,
  };
  return existing ? trades.map((t) => (t.id === change.id ? updated : t)) : [...trades, updated];
}

export function planResort(rows: ResortRow[], tradesAfter: Trade[]): ResortMove[] {
  const moves: ResortMove[] = [];
  for (const r of rows) {
    const to = classifyOpportunity({ title: r.title, naicsCode: r.naicsCode, nigpCodes: r.nigpCodes }, tradesAfter);
    if (to !== r.tradeId) moves.push({ id: r.id, from: r.tradeId, to });
  }
  return moves;
}

export function summarizeMoves(moves: ResortMove[], tradesAfter: Trade[]): ResortSummary {
  const counts = new Map<string | null, number>();
  for (const m of moves) counts.set(m.to, (counts.get(m.to) ?? 0) + 1);
  const into = [...counts.entries()]
    .map(([tradeId, count]) => ({
      tradeId,
      label: tradeId === null ? "Other trades" : tradesAfter.find((t) => t.id === tradeId)?.label ?? "Unknown trade",
      count,
    }))
    // Trades in sort order, Other trades last.
    .sort((a, b) => {
      if (a.tradeId === null) return 1;
      if (b.tradeId === null) return -1;
      const order = (id: string) => tradesAfter.find((t) => t.id === id)?.sortOrder ?? 0;
      return order(a.tradeId) - order(b.tradeId);
    });
  return { total: moves.length, into };
}

export function describeSummary(s: ResortSummary): string {
  if (s.total === 0) return "No open matches change trade.";
  const parts = s.into.map((g) => (g.tradeId === null ? `${g.count} to Other trades` : `${g.count} into ${g.label}`));
  return `This moves ${s.total} open ${s.total === 1 ? "match" : "matches"}: ${parts.join(", ")}.`;
}

// The save route re-plans at confirm time; if the count differs from what
// the admin confirmed (a scrape landed in between), nothing is applied.
export function resortConflict(actualMoves: number, expectedMoves: number): string | null {
  if (actualMoves === expectedMoves) return null;
  return `Matches changed since the preview: ${actualMoves} would move now, not ${expectedMoves}. Check the new count and confirm again.`;
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `node --experimental-strip-types --test lib/trades/resort.test.ts`
Expected: all 6 pass.

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit -p .
git add lib/trades/resort.ts lib/trades/resort.test.ts
git commit -m "Re-sort planning: preview and apply come from the same pure function" -m "<attribution lines>"
```

---

### Task 5: NAICS checkbox options and client trade labels

**Files:**
- Create: `lib/trades/naics-options.ts`, `lib/trades/naics-options.test.ts`

**Interfaces:**
- Consumes: `Trade` (Task 2)
- Produces:
  - `type NaicsOption = { value: string; label: string }`
  - `function offeredNaicsOptions(trades: Trade[]): NaicsOption[]`: active trades' codes, labelled `"561720: Janitorial Services"`.
  - `function naicsOptionsWithSelected(offered: NaicsOption[], selected: string[]): NaicsOption[]`
  - `function clientTradeLabel(naicsCodes: string[] | null | undefined, trades: Trade[]): string | null`
  - `function clientTradeIds(naicsCodes: string[] | null | undefined, trades: Trade[]): string[]`

- [ ] **Step 1: Write the failing tests, `lib/trades/naics-options.test.ts`**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { offeredNaicsOptions, naicsOptionsWithSelected, clientTradeLabel, clientTradeIds } from "./naics-options.ts";
import type { Trade } from "./types.ts";

const JAN: Trade = {
  id: "jan",
  label: "Janitorial",
  naics: [
    { code: "561720", label: "Janitorial Services" },
    { code: "561740", label: "Carpet and Upholstery Cleaning Services" },
  ],
  nigpCodes: [],
  keywords: [],
  active: true,
  sortOrder: 1,
};
const ELEC: Trade = { ...JAN, id: "elec", label: "Electrical", naics: [{ code: "238210", label: "Electrical Contractors" }], sortOrder: 2 };
const OFF: Trade = { ...JAN, id: "off", label: "Roofing", naics: [{ code: "238160", label: "Roofing Contractors" }], active: false, sortOrder: 3 };

test("offered options are active trades' codes in sort order, labelled code: label", () => {
  assert.deepEqual(offeredNaicsOptions([ELEC, OFF, JAN]), [
    { value: "561720", label: "561720: Janitorial Services" },
    { value: "561740", label: "561740: Carpet and Upholstery Cleaning Services" },
    { value: "238210", label: "238210: Electrical Contractors" },
  ]);
});

test("a client's saved code that is no longer offered stays as an option, labelled with the code alone", () => {
  const offered = offeredNaicsOptions([JAN]);
  assert.deepEqual(naicsOptionsWithSelected(offered, ["561720", "238160"]), [
    ...offered,
    { value: "238160", label: "238160" },
  ]);
});

test("no duplicate option when the saved code is offered", () => {
  const offered = offeredNaicsOptions([JAN]);
  assert.deepEqual(naicsOptionsWithSelected(offered, ["561720"]), offered);
});

test("client trade label uses trade names, including switched-off trades, and raw codes otherwise", () => {
  assert.equal(clientTradeLabel(["561740", "561720", "238160", "999999"], [JAN, OFF]), "Janitorial, Roofing, 999999");
  assert.equal(clientTradeLabel([], [JAN]), null);
  assert.equal(clientTradeLabel(null, [JAN]), null);
});

test("client trade ids list each matching trade once", () => {
  assert.deepEqual(clientTradeIds(["561720", "561740", "238210"], [JAN, ELEC]), ["jan", "elec"]);
  assert.deepEqual(clientTradeIds(undefined, [JAN]), []);
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `node --experimental-strip-types --test lib/trades/naics-options.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write `lib/trades/naics-options.ts`**

```ts
import type { Trade } from "./types.ts";

// NAICS checkboxes for the client forms (intake wizard, Company Profile)
// and trade labels for clients, both from the admin-managed trade list.

export type NaicsOption = { value: string; label: string };

export function offeredNaicsOptions(trades: Trade[]): NaicsOption[] {
  const seen = new Set<string>();
  const options: NaicsOption[] = [];
  for (const t of trades.filter((t) => t.active).sort((a, b) => a.sortOrder - b.sortOrder)) {
    for (const n of t.naics) {
      if (seen.has(n.code)) continue;
      seen.add(n.code);
      options.push({ value: n.code, label: `${n.code}: ${n.label}` });
    }
  }
  return options;
}

// A client keeps a code they already chose even if that trade was switched
// off: it stays a checked option (code alone as its label) rather than
// being dropped or pushed into the free-text "Other" box.
export function naicsOptionsWithSelected(offered: NaicsOption[], selected: string[]): NaicsOption[] {
  const offeredCodes = new Set(offered.map((o) => o.value));
  const extra = [...new Set(selected)].filter((c) => !offeredCodes.has(c)).map((c) => ({ value: c, label: c }));
  return [...offered, ...extra];
}

// "Janitorial, Electrical" for the admin assign picker. Switched-off trades
// still name a client's codes; unknown codes show as the raw code.
export function clientTradeLabel(naicsCodes: string[] | null | undefined, trades: Trade[]): string | null {
  if (!naicsCodes || naicsCodes.length === 0) return null;
  const labels = naicsCodes.map((code) => trades.find((t) => t.naics.some((n) => n.code === code))?.label ?? code);
  return [...new Set(labels)].join(", ");
}

export function clientTradeIds(naicsCodes: string[] | null | undefined, trades: Trade[]): string[] {
  if (!naicsCodes) return [];
  const ids: string[] = [];
  for (const code of naicsCodes) {
    const t = trades.find((t) => t.naics.some((n) => n.code === code));
    if (t && !ids.includes(t.id)) ids.push(t.id);
  }
  return ids;
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `node --experimental-strip-types --test lib/trades/naics-options.test.ts`
Expected: all 5 pass.

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit -p .
git add lib/trades/naics-options.ts lib/trades/naics-options.test.ts
git commit -m "NAICS checkbox options and client trade labels from the trade list" -m "<attribution lines>"
```

---

### Task 6: Server loaders, SAM.gov and the scrape route

**Files:**
- Create: `lib/trades/server.ts`
- Modify: `lib/scrapers/sam-gov-query.ts`, `lib/scrapers/sam-gov-query.test.ts`, `lib/scrapers/sam-gov.ts`, `lib/scrapers/jaa.ts` (`ScrapedOpportunity`), `app/api/scrape/route.ts`

**Interfaces:**
- Consumes:
  - `Trade`, `TRADE_COLUMNS`, `rowToTrade`, `TradeInput`, `TradeRow` (Task 2);
  - `classifyOpportunity`, `offeredNaicsCodes` (Task 2);
  - `normalizeTradeInput`, `validateTrade` (Task 3);
  - `applyTradeChange`, `planResort`, `ResortRow`, `ResortMove` (Task 4).
- Produces:
  - `loadTrades(supabase, orgId): Promise<Trade[]>`, which throws on error;
  - `loadActiveTrades(supabase): Promise<Trade[]>`, a public read that throws on error;
  - `loadOpenRows(supabase, orgId): Promise<ResortRow[]>`;
  - `planTradeChange(supabase, orgId, rawTrade: unknown | null): Promise<{ ok: false; status: 400; errors: string[] } | { ok: true; trades: Trade[]; tradesAfter: Trade[]; change: (TradeInput & { id: string }) | null; isNew: boolean; moves: ResortMove[] }>`;
  - `selectSamRows(rows, now, codes: readonly string[])`;
  - `backfillCodeForDate(now, codes: readonly string[]): string | null`;
  - `scrapeSamGov(codes)`, `scrapeSamGovBackfill(naicsCode, codes)`;
  - `ScrapedOpportunity.nigp_codes?: string[] | null`.

- [ ] **Step 1: Update the SAM tests first** (`lib/scrapers/sam-gov-query.test.ts`)

Remove `SAM_NAICS_CODES` from the import list, and replace the three tests `"selectSamRows keeps only our trade codes..."`, `"all 11 trade codes are covered"` and `"backfillCodeForDate rotates..."` with:

```ts
const CODES = ["561720", "238210", "238220"];

test("selectSamRows keeps only the given trade codes that are biddable and still open", () => {
  const rows = [
    { id: "keep", naicsCode: "561720", type: "Solicitation", responseDeadLine: "2026-10-01T12:00:00-04:00" },
    { id: "keep-no-deadline", naicsCode: "238210", type: "Presolicitation", responseDeadLine: null },
    { id: "other-trade", naicsCode: "336411", type: "Solicitation", responseDeadLine: "2026-10-01T12:00:00-04:00" },
    { id: "no-naics", naicsCode: null, type: "Solicitation", responseDeadLine: "2026-10-01T12:00:00-04:00" },
    { id: "award", naicsCode: "561720", type: "Award Notice", responseDeadLine: "2026-10-01T12:00:00-04:00" },
    { id: "closed", naicsCode: "561720", type: "Solicitation", responseDeadLine: "2026-09-01T12:00:00-04:00" },
  ];
  assert.deepEqual(
    selectSamRows(rows, NOW, CODES).map((r) => r.id),
    ["keep", "keep-no-deadline"]
  );
});

test("with no trade codes, nothing is selected", () => {
  const rows = [{ id: "a", naicsCode: "561720", type: "Solicitation", responseDeadLine: null }];
  assert.deepEqual(selectSamRows(rows, NOW, []), []);
});

test("backfillCodeForDate rotates through the given codes, one per UTC day", () => {
  const start = Date.UTC(2026, 8, 23);
  const DAY = 24 * 60 * 60 * 1000;
  const codes = Array.from({ length: CODES.length }, (_, i) => backfillCodeForDate(new Date(start + i * DAY), CODES));
  assert.deepEqual([...codes].sort(), [...CODES].sort(), "each code once per cycle");
  assert.equal(backfillCodeForDate(new Date(start + CODES.length * DAY), CODES), codes[0], "then the cycle repeats");
});

test("backfillCodeForDate returns null when there are no codes", () => {
  assert.equal(backfillCodeForDate(NOW, []), null);
});
```

Run: `node --experimental-strip-types --test lib/scrapers/sam-gov-query.test.ts`
Expected: FAIL. `selectSamRows` ignores its third argument, so "with no trade codes" fails, and `backfillCodeForDate(NOW, [])` returns a code, not null.

- [ ] **Step 2: Change `lib/scrapers/sam-gov-query.ts`**

Delete the `SAM_NAICS_CODES` constant and its comment block (the lines from `// The full, real set of NAICS codes` through `] as const;`). Replace `selectSamRows` and `backfillCodeForDate` with:

```ts
// Keep rows in one of the offered trade codes (the active trades in
// public.trades, passed in by the scrape route) that are biddable and still
// open (lib/matches/rules.ts decides "biddable" and "still open").
export function selectSamRows<T extends SamRow>(rows: T[], now: Date, codes: readonly string[]): T[] {
  const wanted = new Set<string>(codes);
  return rows.filter((r) => !!r.naicsCode && wanted.has(r.naicsCode) && shouldKeepSamNotice(r, now));
}

// The daily run's rolling catch-up (decided 2026-09-23): each UTC day it
// also runs the 12-month backfill for ONE offered trade code, rotating
// through all of them, so older still-open Florida postings are caught
// without anyone calling the route by hand. Costs one extra request a day;
// title+agency dedup makes repeats free. Null when no trade has a code.
export function backfillCodeForDate(now: Date, codes: readonly string[]): string | null {
  if (codes.length === 0) return null;
  const utcDay = Math.floor(now.getTime() / DAY_MS);
  return codes[utcDay % codes.length];
}
```

In the file's top comment, replace "with our trade codes picked out locally from each row's naicsCode" with "with the offered trades' codes (public.trades) picked out locally from each row's naicsCode".

Run: `node --experimental-strip-types --test lib/scrapers/sam-gov-query.test.ts`
Expected: PASS.

- [ ] **Step 3: Thread the codes through `lib/scrapers/sam-gov.ts`**

- `fetchAndSelect(params, now, label)` becomes `fetchAndSelect(params, now, label, codes: readonly string[])`, and its `selectSamRows(rows, now)` becomes `selectSamRows(rows, now, codes)`.
- `export async function scrapeSamGov(): ...` becomes `export async function scrapeSamGov(codes: readonly string[]): ...`, passing `codes` as the last argument of `fetchAndSelect`.
- `export async function scrapeSamGovBackfill(naicsCode: string): ...` becomes `export async function scrapeSamGovBackfill(naicsCode: string, codes: readonly string[]): ...`, again passing `codes` as the last argument of `fetchAndSelect`.

- [ ] **Step 4: Add `nigp_codes` to `ScrapedOpportunity`** (`lib/scrapers/jaa.ts`, inside the type, after `naics_code`)

```ts
  // Optional -- for portal scrapers whose listings carry NIGP commodity
  // codes (OpenGov, DemandStar, Bonfire). Used to sort the bid into a trade
  // (lib/trades/classify.ts) and stored on matched_opportunities.nigp_codes.
  nigp_codes?: string[] | null;
```

- [ ] **Step 5: Write `lib/trades/server.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { TRADE_COLUMNS, rowToTrade, type Trade, type TradeInput, type TradeRow } from "./types";
import { normalizeTradeInput, validateTrade } from "./validate";
import { applyTradeChange, planResort, type ResortMove, type ResortRow } from "./resort";

// Supabase glue for the trade list. The logic lives in the pure modules
// next to this file; this only loads and shapes rows.

export async function loadTrades(supabase: SupabaseClient, orgId: string): Promise<Trade[]> {
  const { data, error } = await supabase.from("trades").select(TRADE_COLUMNS).eq("org_id", orgId);
  if (error) throw new Error(`Couldn't load trades: ${error.message}`);
  return ((data ?? []) as TradeRow[]).map(rowToTrade);
}

// Public read (RLS: anyone reads active trades). One org per database, so
// no org filter -- used by the intake wizard before the visitor has an
// account, and by the document-reading routes.
export async function loadActiveTrades(supabase: SupabaseClient): Promise<Trade[]> {
  const { data, error } = await supabase.from("trades").select(TRADE_COLUMNS).eq("active", true);
  if (error) throw new Error(`Couldn't load trades: ${error.message}`);
  return ((data ?? []) as TradeRow[]).map(rowToTrade);
}

// Every open (status='new') match, paged past PostgREST's 1,000-row cap.
export async function loadOpenRows(supabase: SupabaseClient, orgId: string): Promise<ResortRow[]> {
  const PAGE = 1000;
  const rows: ResortRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("matched_opportunities")
      .select("id, source_title, naics_code, nigp_codes, trade_id")
      .eq("org_id", orgId)
      .eq("status", "new")
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Couldn't load open matches: ${error.message}`);
    for (const r of data ?? []) {
      rows.push({
        id: r.id,
        title: r.source_title,
        naicsCode: r.naics_code,
        nigpCodes: r.nigp_codes ?? [],
        tradeId: r.trade_id,
      });
    }
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

// Shared by the preview and save routes, so both plan the exact same
// change. rawTrade null = "re-sort only" (no trade edited).
export async function planTradeChange(
  supabase: SupabaseClient,
  orgId: string,
  rawTrade: unknown | null
): Promise<
  | { ok: false; status: 400; errors: string[] }
  | {
      ok: true;
      trades: Trade[];
      tradesAfter: Trade[];
      change: (TradeInput & { id: string }) | null;
      isNew: boolean;
      moves: ResortMove[];
    }
> {
  const trades = await loadTrades(supabase, orgId);
  let change: (TradeInput & { id: string }) | null = null;
  let isNew = false;
  if (rawTrade !== null) {
    const input = normalizeTradeInput(rawTrade);
    if (input.id && !trades.some((t) => t.id === input.id)) {
      return { ok: false, status: 400, errors: ["That trade no longer exists. Reload the page."] };
    }
    const result = validateTrade(input, trades);
    if (!result.ok) return { ok: false, status: 400, errors: result.errors };
    isNew = !input.id;
    change = { ...input, id: input.id ?? crypto.randomUUID() };
  }
  const tradesAfter = applyTradeChange(trades, change);
  const moves = planResort(await loadOpenRows(supabase, orgId), tradesAfter);
  return { ok: true, trades, tradesAfter, change, isNew, moves };
}
```

Note: `server.ts` imports without `.ts` extensions (it's only imported by Next.js code, never by a test), the same as `lib/scrapers/sam-gov.ts`.

- [ ] **Step 6: Change `app/api/scrape/route.ts`**

Replace the imports:
```ts
import { SAM_NAICS_CODES, backfillCodeForDate } from "@/lib/scrapers/sam-gov-query";
```
with:
```ts
import { backfillCodeForDate } from "@/lib/scrapers/sam-gov-query";
import { loadTrades } from "@/lib/trades/server";
import { classifyOpportunity, offeredNaicsCodes } from "@/lib/trades/classify";
import type { Trade } from "@/lib/trades/types";
```

Remove the `{ name: "sam-gov", run: scrapeSamGov },` line from the `SCRAPERS` constant; SAM.gov is added per run below, because it needs the trade codes.

Right after the `org` lookup's error check, add:
```ts
  // The trade list decides which SAM.gov codes are searched and which
  // trade each new match is sorted into. No fallback list: if it can't be
  // loaded, the run stops here, visibly, and tries again tomorrow.
  let trades: Trade[];
  try {
    trades = await loadTrades(supabase, org.id);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't load trades." }, { status: 500 });
  }
  const samCodes = offeredNaicsCodes(trades);
```

Change the `results` type to allow a note:
```ts
  const results: Record<
    string,
    { found: number; inserted: number; skipped: number; errors?: string[]; note?: string }
  > = {};
```

Replace the backfill validation and the `scrapers` construction (from `const backfillCode = ...` through the `: [ ...SCRAPERS, ... ];` expression) with:
```ts
  const backfillCode = request.nextUrl.searchParams.get("samBackfill");
  if (backfillCode !== null && !samCodes.includes(backfillCode)) {
    return NextResponse.json(
      { error: `samBackfill must be one of the active trades' NAICS codes: ${samCodes.join(", ") || "(none)"}` },
      { status: 400 }
    );
  }
  // The scheduled run also does one rotating backfill code per day (see
  // backfillCodeForDate), so the catch-up needs no manual calls. With no
  // active trade codes, SAM.gov is skipped and says why.
  const dailyBackfillCode = backfillCodeForDate(new Date(), samCodes);
  const samScrapers =
    samCodes.length === 0
      ? []
      : [
          { name: "sam-gov", run: () => scrapeSamGov(samCodes) },
          ...(dailyBackfillCode
            ? [{ name: `sam-gov-backfill-${dailyBackfillCode}`, run: () => scrapeSamGovBackfill(dailyBackfillCode, samCodes) }]
            : []),
        ];
  if (samCodes.length === 0 && !backfillCode) {
    results["sam-gov"] = { found: 0, inserted: 0, skipped: 0, note: "Skipped: no active trade has a NAICS code." };
  }
  const scrapers = backfillCode
    ? [{ name: `sam-gov-backfill-${backfillCode}`, run: () => scrapeSamGovBackfill(backfillCode, samCodes) }]
    : [...SCRAPERS, ...samScrapers];
```

In the insert call, add two fields after `naics_code: item.naics_code ?? null,`:
```ts
          nigp_codes: item.nigp_codes ?? [],
          trade_id: classifyOpportunity(
            { title: item.source_title, naicsCode: item.naics_code ?? null, nigpCodes: item.nigp_codes ?? null },
            trades
          ),
```

- [ ] **Step 7: Run all tests and typecheck**

Run: `npm test && npx tsc --noEmit -p .`
Expected: all tests pass and the typecheck is clean. If `tsc` reports another caller of `scrapeSamGov`, `scrapeSamGovBackfill` or `SAM_NAICS_CODES`, update it the same way.

- [ ] **Step 8: Commit**

```bash
git add lib/trades/server.ts lib/scrapers/sam-gov-query.ts lib/scrapers/sam-gov-query.test.ts lib/scrapers/sam-gov.ts lib/scrapers/jaa.ts app/api/scrape/route.ts
git commit -m "Scrape by the trade list: SAM.gov codes from active trades, every match sorted into a trade" -m "<attribution lines>"
```

---

### Task 7: Trade preview and save routes

**Files:**
- Create: `app/api/admin/trades/preview/route.ts`, `app/api/admin/trades/route.ts`

**Interfaces:**
- Consumes: `planTradeChange` (Task 6); `summarizeMoves`, `describeSummary`, `resortConflict` (Task 4)
- Produces:
  - `POST /api/admin/trades/preview`
    - body: `{ trade: object | null }`
    - returns: `200 { moves: number; message: string; summary: ResortSummary }` | `400 { errors: string[] }` | `401` | `403` | `500 { error }`
  - `POST /api/admin/trades`
    - body: `{ trade: object | null; expectedMoves: number }`
    - returns: `200 { saved: boolean; tradeId: string | null; moved: number; expected: number; failed: number; message: string }` | `409 { error: string; moves: number; message: string; summary: ResortSummary }` | `400 { errors }` | `401` | `403` | `500 { error }`

- [ ] **Step 1: Write the preview route, `app/api/admin/trades/preview/route.ts`**

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { planTradeChange } from "@/lib/trades/server";
import { summarizeMoves, describeSummary } from "@/lib/trades/resort";

// Step 1 of saving a trade: shows how many open matches would change trade,
// before anything is written. Read-only.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || !("trade" in body)) {
    return NextResponse.json({ error: "Missing trade." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { data: member } = await supabase
    .from("team_members")
    .select("id, org_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  try {
    const plan = await planTradeChange(supabase, member.org_id, body.trade);
    if (!plan.ok) return NextResponse.json({ errors: plan.errors }, { status: 400 });
    const summary = summarizeMoves(plan.moves, plan.tradesAfter);
    return NextResponse.json({ moves: plan.moves.length, message: describeSummary(summary), summary });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Preview failed." }, { status: 500 });
  }
}
```

- [ ] **Step 2: Write the save route, `app/api/admin/trades/route.ts`**

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { planTradeChange } from "@/lib/trades/server";
import { summarizeMoves, describeSummary, resortConflict } from "@/lib/trades/resort";

// Step 2 of saving a trade: re-plans the change, refuses if the number of
// matches that would move differs from what the admin confirmed (a scrape
// landed in between), then saves the trade and re-sorts. Only
// status='new' rows are touched, by id, and nothing is deleted
// (CLAUDE.md: bulk changes are counted and confirmed first).
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || !("trade" in body) || typeof body.expectedMoves !== "number") {
    return NextResponse.json({ error: "Missing trade or expectedMoves." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { data: member } = await supabase
    .from("team_members")
    .select("id, org_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  let plan: Awaited<ReturnType<typeof planTradeChange>>;
  try {
    plan = await planTradeChange(supabase, member.org_id, body.trade);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't plan the change." }, { status: 500 });
  }
  if (!plan.ok) return NextResponse.json({ errors: plan.errors }, { status: 400 });

  const conflict = resortConflict(plan.moves.length, body.expectedMoves);
  if (conflict) {
    const summary = summarizeMoves(plan.moves, plan.tradesAfter);
    return NextResponse.json(
      { error: conflict, moves: plan.moves.length, message: describeSummary(summary), summary },
      { status: 409 }
    );
  }

  // Save the trade itself first; a failed save changes nothing else.
  const { change, isNew } = plan;
  if (change) {
    const saved = plan.tradesAfter.find((t) => t.id === change.id)!;
    const before = plan.trades.find((t) => t.id === change.id) ?? null;
    const row = {
      label: saved.label,
      naics: saved.naics,
      nigp_codes: saved.nigpCodes,
      keywords: saved.keywords,
      active: saved.active,
      sort_order: saved.sortOrder,
      updated_at: new Date().toISOString(),
    };
    const { error } = isNew
      ? await supabase.from("trades").insert({ id: saved.id, org_id: member.org_id, ...row })
      : await supabase.from("trades").update(row).eq("id", saved.id).eq("org_id", member.org_id);
    if (error) return NextResponse.json({ error: `Couldn't save the trade: ${error.message}` }, { status: 500 });

    const onlyActiveChanged =
      before !== null &&
      before.active !== saved.active &&
      JSON.stringify({ ...before, active: saved.active }) === JSON.stringify(saved);
    await supabase.from("audit_log").insert({
      org_id: member.org_id,
      actor_id: member.id,
      event_type: isNew
        ? "trade_created"
        : onlyActiveChanged
          ? saved.active
            ? "trade_activated"
            : "trade_deactivated"
          : "trade_updated",
      event_detail: { trade_id: saved.id, before, after: saved },
    });
  }

  // Re-sort: one update per destination trade, in chunks, each checked by
  // the number of rows it actually changed.
  const byTarget = new Map<string | null, string[]>();
  for (const m of plan.moves) byTarget.set(m.to, [...(byTarget.get(m.to) ?? []), m.id]);
  let moved = 0;
  const errors: string[] = [];
  for (const [to, ids] of byTarget) {
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const { data, error } = await supabase
        .from("matched_opportunities")
        .update({ trade_id: to })
        .in("id", chunk)
        .eq("org_id", member.org_id)
        .eq("status", "new")
        .select("id");
      if (error) errors.push(error.message);
      moved += data?.length ?? 0;
    }
  }
  const failed = plan.moves.length - moved;

  if (plan.moves.length > 0) {
    await supabase.from("audit_log").insert({
      org_id: member.org_id,
      actor_id: member.id,
      event_type: "trades_resorted",
      event_detail: { trade_id: change?.id ?? null, expected: plan.moves.length, moved, failed, errors },
    });
  }

  const summary = summarizeMoves(plan.moves, plan.tradesAfter);
  const message =
    failed === 0
      ? `${change ? "Saved. " : ""}${plan.moves.length === 0 ? "No open matches changed trade." : describeSummary(summary).replace("This moves", "Moved")}`
      : `${change ? "Saved, but " : ""}${failed} of ${plan.moves.length} matches didn't move${errors[0] ? ` (${errors[0]})` : ""}. Run "Re-sort open matches" to retry.`;

  return NextResponse.json({
    saved: change !== null,
    tradeId: change?.id ?? null,
    moved,
    expected: plan.moves.length,
    failed,
    message,
  });
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: clean.

- [ ] **Step 4: Check the routes refuse an unauthenticated request** (dev server running: `npm run dev`)

```bash
curl -s -X POST localhost:3000/api/admin/trades/preview -H 'Content-Type: application/json' -d '{"trade":null}'
curl -s -X POST localhost:3000/api/admin/trades -H 'Content-Type: application/json' -d '{"trade":null,"expectedMoves":0}'
```

Expected: `{"error":"Not authenticated."}` from both. The full flow is exercised through the UI in Task 11.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/trades
git commit -m "Trade preview and save routes: count first, refuse if it changed, then re-sort" -m "<attribution lines>"
```

---

### Task 8: Trades section on admin Settings

**Files:**
- Create: `app/admin/settings/TradesSettings.tsx`, `app/admin/settings/TradeForm.tsx`
- Modify: `app/admin/settings/page.tsx`

**Interfaces:**
- Consumes: `Trade`, `TradeInput` (Task 2); `normalizeTradeInput`, `validateTrade` (Task 3); the preview and save routes (Task 7); `ConfirmDialog` (`components/ui/ConfirmDialog.tsx`: props `open, onClose, onConfirm, title, description, confirmLabel`); `useToast` (`components/Toast`); `Spinner` (`components/ui/Spinner`); `loadTrades` (Task 6).
- Produces: `<TradesSettings trades={Trade[]} />`

- [ ] **Step 1: Write `app/admin/settings/TradeForm.tsx`**

```tsx
"use client";

import { useState } from "react";
import type { Trade, TradeInput } from "@/lib/trades/types";
import { normalizeTradeInput, validateTrade } from "@/lib/trades/validate";

// Add/edit form for one trade. Validation here is for instant feedback;
// the save route runs the same checks again.
export function TradeForm({
  initial,
  allTrades,
  busy,
  onSubmit,
  onCancel,
}: {
  initial: Trade | null;
  allTrades: Trade[];
  busy: boolean;
  onSubmit: (input: TradeInput) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [naics, setNaics] = useState(initial?.naics.length ? initial.naics : [{ code: "", label: "" }]);
  const [nigp, setNigp] = useState((initial?.nigpCodes ?? []).join(", "));
  const [keywords, setKeywords] = useState((initial?.keywords ?? []).join(", "));
  const [errors, setErrors] = useState<string[]>([]);

  const inputClass =
    "w-full px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const input = normalizeTradeInput({
      id: initial?.id,
      label,
      naics,
      nigpCodes: nigp.split(/[,\n]/),
      keywords: keywords.split(/[,\n]/),
      active: initial?.active ?? true,
    });
    const result = validateTrade(input, allTrades);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors([]);
    onSubmit(input);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 border border-outline-variant rounded-lg p-4 bg-surface">
      <label className="flex flex-col gap-1">
        <span className="text-label-md font-bold text-on-surface">Trade name</span>
        <input value={label} onChange={(e) => setLabel(e.target.value)} className={inputClass} placeholder="Pressure washing" />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-label-md font-bold text-on-surface mb-1">NAICS codes</legend>
        <p className="text-body-sm text-on-surface-variant">
          6 digits each. The label is what clients see next to the checkbox.
        </p>
        {naics.map((n, i) => (
          <div key={i} className="flex gap-2">
            <input
              aria-label={`NAICS code ${i + 1}`}
              value={n.code}
              onChange={(e) => setNaics(naics.map((x, j) => (j === i ? { ...x, code: e.target.value } : x)))}
              className={`${inputClass} w-32 font-code`}
              placeholder="561790"
              inputMode="numeric"
            />
            <input
              aria-label={`NAICS label ${i + 1}`}
              value={n.label}
              onChange={(e) => setNaics(naics.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
              className={inputClass}
              placeholder="Other Services to Buildings and Dwellings"
            />
            <button
              type="button"
              onClick={() => setNaics(naics.filter((_, j) => j !== i))}
              className="px-2 text-error text-label-sm font-bold"
              aria-label={`Remove NAICS code ${i + 1}`}
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setNaics([...naics, { code: "", label: "" }])}
          className="self-start text-primary text-label-md font-bold"
        >
          + Add a NAICS code
        </button>
      </fieldset>

      <label className="flex flex-col gap-1">
        <span className="text-label-md font-bold text-on-surface">NIGP codes</span>
        <span className="text-body-sm text-on-surface-variant">Class-item, comma separated, like 910-39.</span>
        <input value={nigp} onChange={(e) => setNigp(e.target.value)} className={`${inputClass} font-code`} />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-label-md font-bold text-on-surface">Title keywords</span>
        <span className="text-body-sm text-on-surface-variant">
          Comma separated. Matched against bid titles, at the start of a word: &quot;landscap&quot; matches
          &quot;landscaping&quot;.
        </span>
        <textarea value={keywords} onChange={(e) => setKeywords(e.target.value)} rows={3} className={inputClass} />
      </label>

      {errors.length > 0 && (
        <ul role="alert" className="list-disc pl-5 text-body-sm text-error">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={busy}
          className="px-4 py-2 rounded-lg bg-primary text-on-primary text-label-md font-bold disabled:opacity-40"
        >
          Review changes
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg text-on-surface text-label-md font-bold">
          Cancel
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Write `app/admin/settings/TradesSettings.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Trade, TradeInput } from "@/lib/trades/types";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/Toast";
import { TradeForm } from "./TradeForm";

type Pending = { trade: TradeInput | null; moves: number; message: string; title: string };

// The trades First Coast Bids offers. Every change is previewed (how many
// open matches would change trade), then confirmed. See
// docs/superpowers/specs/2026-09-23-trade-list-design.md.
export function TradesSettings({ trades }: { trades: Trade[] }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [editing, setEditing] = useState<Trade | "new" | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);

  const sorted = [...trades].sort((a, b) => a.sortOrder - b.sortOrder);

  async function preview(trade: TradeInput | null, title: string) {
    setBusy(true);
    const res = await fetch("/api/admin/trades/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trade }),
    });
    const body = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      showToast(body?.errors?.join(" ") ?? body?.error ?? `Preview failed (HTTP ${res.status}).`, "error");
      return;
    }
    setPending({ trade, moves: body.moves, message: body.message, title });
  }

  async function confirm() {
    if (!pending) return;
    const current = pending;
    setPending(null);
    setBusy(true);
    const res = await fetch("/api/admin/trades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trade: current.trade, expectedMoves: current.moves }),
    });
    const body = await res.json().catch(() => null);
    setBusy(false);
    if (res.status === 409 && body) {
      // Matches changed since the preview: show the new count, ask again.
      setPending({ ...current, moves: body.moves, message: `${body.error} ${body.message}` });
      return;
    }
    if (!res.ok) {
      showToast(body?.errors?.join(" ") ?? body?.error ?? `Save failed (HTTP ${res.status}).`, "error");
      return;
    }
    showToast(body.message, body.failed > 0 ? "error" : "success");
    setEditing(null);
    router.refresh();
  }

  function toggle(t: Trade) {
    const input: TradeInput = { id: t.id, label: t.label, naics: t.naics, nigpCodes: t.nigpCodes, keywords: t.keywords, active: !t.active };
    preview(input, t.active ? `Switch off ${t.label}?` : `Switch on ${t.label}?`);
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="divide-y divide-outline-variant border border-outline-variant rounded-lg">
        {sorted.length === 0 && <li className="p-4 text-body-md text-on-surface-variant">No trades yet.</li>}
        {sorted.map((t) => (
          <li key={t.id} className="p-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="min-w-0 flex-1">
              <p className="text-body-md font-bold text-on-surface">
                {t.label}{" "}
                {!t.active && <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">(off)</span>}
              </p>
              <p className="text-body-sm text-on-surface-variant font-code">
                {t.naics.length} NAICS · {t.nigpCodes.length} NIGP · {t.keywords.length} keywords
              </p>
            </div>
            <button type="button" onClick={() => setEditing(t)} disabled={busy} className="text-primary text-label-md font-bold disabled:opacity-40">
              Edit
            </button>
            <button type="button" onClick={() => toggle(t)} disabled={busy} className="text-on-surface text-label-md font-bold disabled:opacity-40">
              {t.active ? "Switch off" : "Switch on"}
            </button>
          </li>
        ))}
      </ul>

      {editing ? (
        <TradeForm
          key={editing === "new" ? "new" : editing.id}
          initial={editing === "new" ? null : editing}
          allTrades={trades}
          busy={busy}
          onCancel={() => setEditing(null)}
          onSubmit={(input) => preview(input, input.id ? `Save changes to ${input.label}?` : `Add ${input.label}?`)}
        />
      ) : (
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => setEditing("new")} disabled={busy} className="px-4 py-2 rounded-lg bg-primary text-on-primary text-label-md font-bold disabled:opacity-40">
            Add a trade
          </button>
          <button
            type="button"
            onClick={() => preview(null, "Re-sort open matches?")}
            disabled={busy}
            className="px-4 py-2 rounded-lg border border-outline-variant text-on-surface text-label-md font-bold flex items-center gap-2 disabled:opacity-40"
          >
            {busy && <Spinner />}
            Re-sort open matches
          </button>
        </div>
      )}

      <ConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={confirm}
        title={pending?.title ?? ""}
        description={pending?.message ?? ""}
        confirmLabel={pending?.trade ? "Save" : "Re-sort"}
      />
    </div>
  );
}
```

- [ ] **Step 3: Add the section to `app/admin/settings/page.tsx`**

Add these imports:
```ts
import { TradesSettings } from "./TradesSettings";
import { loadTrades } from "@/lib/trades/server";
import type { Trade } from "@/lib/trades/types";
```

After the `org` query, add:
```ts
  let trades: Trade[] = [];
  let tradesError: string | null = null;
  try {
    trades = await loadTrades(supabase, member.org_id);
  } catch (err) {
    tradesError = err instanceof Error ? err.message : "Couldn't load trades.";
  }
```

After the threshold `<div>` block and before `</>`, add:
```tsx
      <div className="mt-6 bg-surface-container-lowest border border-outline-variant rounded-xl p-6 max-w-3xl">
        <h2 className="text-title-lg text-primary mb-2 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[20px]">construction</span>
          Trades
        </h2>
        <p className="text-body-md text-on-surface-variant mb-4">
          The trades you offer. The daily scrape searches SAM.gov for these NAICS codes and sorts every new match
          into a trade by its codes or title. Anything else goes to Other trades on the Matches page. Clients pick
          from these NAICS codes when they sign up.
        </p>
        {tradesError ? <p className="text-body-md text-error">{tradesError}</p> : <TradesSettings trades={trades} />}
      </div>
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add app/admin/settings
git commit -m "Trades section on admin Settings: add, edit, switch off/on, re-sort with preview" -m "<attribution lines>"
```

---

### Task 9: Matches page, "Your trades" and "Other trades"

**Files:**
- Modify: `lib/matches/rules.ts`, `lib/matches/rules.test.ts`, `app/admin/matches/page.tsx`, `app/admin/matches/MatchesPanel.tsx`

**Interfaces:**
- Consumes:
  - `loadTrades` (Task 6);
  - `clientTradeLabel`, `clientTradeIds` (Task 5);
  - `Trade` (Task 2).
- Produces:
  - `MatchFilters.view: "trades" | "other"` (default `"trades"`);
  - `MatchesPanel` props `trades: Trade[]` and `viewCounts: { trades: number; other: number }`;
  - `Match.trade_id: string | null`.

- [ ] **Step 1: Write the failing test** (append to `lib/matches/rules.test.ts`)

```ts
test("view defaults to trades and only accepts trades or other", () => {
  assert.equal(parseMatchFilters({}).view, "trades");
  assert.equal(parseMatchFilters({ view: "other" }).view, "other");
  assert.equal(parseMatchFilters({ view: "drop table" }).view, "trades");
});
```

`parseMatchFilters` is already imported at the top of the file.

Two existing tests compare the whole filter object and must gain the new field, or they fail for the wrong reason:
- in `"parseMatchFilters defaults to live matches, soonest deadline first, page 1"`, add `view: "trades",` as the first property of the expected object;
- in `"parseMatchFilters accepts valid values and ignores unknown ones"`, add `view: "trades",` as the first property of the second argument of the first `assert.deepEqual`.

Run: `node --experimental-strip-types --test lib/matches/rules.test.ts`
Expected: FAIL, `view` is undefined.

- [ ] **Step 2: Add `view` to `lib/matches/rules.ts`**

In `MatchFilters`, add `view: "trades" | "other";` as the first field. In `parseMatchFilters`'s returned object, add as the first entry:
```ts
    view: oneOf(first(sp.view), ["trades", "other"] as const, "trades"),
```

Run: `node --experimental-strip-types --test lib/matches/rules.test.ts`
Expected: PASS.

- [ ] **Step 3: Filter by view in `app/admin/matches/page.tsx`**

- Add `trade_id` to the `columns` string (after `naics_code`).
- In `filtered(...)`, change the signature to `filtered(select, options, status, view: MatchFilters["view"] = filters.view)`. After the `status` line, add:
  ```ts
      q = view === "trades" ? q.not("trade_id", "is", null) : q.is("trade_id", null);
  ```
- Change the `Promise.all` to also count both views for the current status:
  ```ts
    const [pageResult, tradesViewCount, otherViewCount, ...countResults] = await Promise.all([
      pageQuery.range(from, from + MATCHES_PAGE_SIZE - 1),
      filtered("id", { count: "exact", head: true }, filters.status, "trades"),
      filtered("id", { count: "exact", head: true }, filters.status, "other"),
      ...tabs.map((status) => filtered("id", { count: "exact", head: true }, status)),
    ]);
    const viewCounts = { trades: tradesViewCount.count ?? 0, other: otherViewCount.count ?? 0 };
  ```
- Load the trades (for labels and the assign check), after the clients query:
  ```ts
    let trades: Trade[] = [];
    try {
      trades = await loadTrades(supabase, member.org_id);
    } catch (err) {
      console.error("[admin/matches] failed to load trades", { message: err instanceof Error ? err.message : err });
    }
  ```
  with the imports `import { loadTrades } from "@/lib/trades/server";` and `import type { Trade } from "@/lib/trades/types";`.
- Pass `trades={trades}` and `viewCounts={viewCounts}` to `<MatchesPanel ...>`.

- [ ] **Step 4: Update `app/admin/matches/MatchesPanel.tsx`**

- **Match type:** add `trade_id: string | null;` to `Match`.
- **Imports:** replace `import { clientTradeLabel } from "@/lib/business-options";` with:
  ```ts
  import { clientTradeLabel, clientTradeIds } from "@/lib/trades/naics-options";
  import type { Trade } from "@/lib/trades/types";
  ```
- **`clientOptionLabel`:** change it to take the trades: `function clientOptionLabel(client: Client, trades: Trade[]): string`, using `clientTradeLabel(client.naics_codes, trades)`, and update its call sites to pass `trades`.
- **Default filters:** add `view: "trades",` to `DEFAULT_FILTERS`.
- **`filtersHref`:** add `if (f.view !== DEFAULT_FILTERS.view) params.set("view", f.view);`.
- **Props:** add `trades: Trade[]; viewCounts: { trades: number; other: number };` to the `MatchesPanel` props type and destructuring.
- **Assign mismatch check:** replace the block that computes `opportunityTrade`/`clientTrade` in the assign handler with:
  ```ts
      // Warn when the match's trade isn't one of the client's trades. Other
      // trades rows have no trade to compare, so no warning.
      if (match.trade_id) {
        const clientTrades = clientTradeIds(client.naics_codes, trades);
        if (clientTrades.length > 0 && !clientTrades.includes(match.trade_id)) {
          setMismatchTarget({
            matchId,
            opportunityTrade: trades.find((t) => t.id === match.trade_id)?.label ?? "Unknown trade",
            clientTrade: clientTradeLabel(client.naics_codes, trades) ?? "",
          });
          return;
        }
      }
  ```
- **View switch:** in the filter bar component that renders the `Match status` `<nav>`, add these props: `viewCounts: { trades: number; other: number }` and `viewHref: (view: MatchFilters["view"]) => string`. Pass `viewCounts={viewCounts}` and `viewHref={(view) => filtersHref(pathname, { ...filters, view, page: 1 })}`. Render this above the status `<nav>`:
  ```tsx
        <nav aria-label="Trade view" className="flex flex-wrap gap-2">
          {([
            ["trades", "Your trades"],
            ["other", "Other trades"],
          ] as const).map(([key, label]) => {
            const active = filters.view === key;
            return (
              <Link
                key={key}
                href={viewHref(key)}
                aria-current={active ? "page" : undefined}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-label-md font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  active ? "bg-primary text-on-primary" : "bg-surface-container-low text-on-surface hover:bg-surface-container-high"
                }`}
              >
                {label}
                <span className="font-code text-body-sm">{viewCounts[key]}</span>
              </Link>
            );
          })}
        </nav>
  ```
- **Trade badge:** `<TradeTagBadge title={m.source_title} scope={m.scope} />` is rendered in **two** places (the desktop table and the phone cards; `grep -n "TradeTagBadge title" app/admin/matches/MatchesPanel.tsx` shows both). Replace **both** so each renders the stored trade when there is one, and keeps the keyword hint only for Other trades rows:
  ```tsx
      {m.trade_id ? (
        <span className="inline-flex px-2 py-0.5 rounded text-label-sm font-bold uppercase tracking-wider bg-secondary-container text-on-secondary-container">
          {trades.find((t) => t.id === m.trade_id)?.label ?? "Trade"}
        </span>
      ) : (
        <TradeTagBadge title={m.source_title} scope={m.scope} />
      )}
  ```

- [ ] **Step 5: Test and typecheck**

Run: `npm test && npx tsc --noEmit -p .`
Expected: all pass, and the typecheck is clean.

- [ ] **Step 6: Commit**

```bash
git add lib/matches/rules.ts lib/matches/rules.test.ts app/admin/matches
git commit -m "Matches: Your trades / Other trades views, stored trade badge, trade-based assign warning" -m "<attribution lines>"
```

---

### Task 10: Client forms and the AI document reader

**Files:**
- Modify:
  - `app/intake/page.tsx`, `app/intake/IntakeWizard.tsx`;
  - `app/dashboard/profile/page.tsx`, `app/dashboard/profile/CompanyProfileClient.tsx`, `app/dashboard/profile/CompanyInfoForm.tsx`;
  - `app/api/extract-from-document/route.ts`, `app/api/extract-company-profile/route.ts`;
  - `lib/business-options.ts`.

**Interfaces:**
- Consumes:
  - `loadActiveTrades` (Task 6);
  - `offeredNaicsOptions`, `naicsOptionsWithSelected`, `NaicsOption` (Task 5);
  - `offeredNaicsCodes` (Task 2).
- Produces:
  - `IntakeWizard` prop `offeredNaics: NaicsOption[]`;
  - `CompanyProfileClient` and `CompanyInfoForm` prop `offeredNaics: NaicsOption[]`.

- [ ] **Step 1: The intake page loads the offered codes** (`app/intake/page.tsx`)

- Make the page async: `export default async function IntakePage() {`.
- Add the imports `import { createClient } from "@/lib/supabase/server";`, `import { loadActiveTrades } from "@/lib/trades/server";` and `import { offeredNaicsOptions, type NaicsOption } from "@/lib/trades/naics-options";`.
- At the top of the function, add:
  ```ts
    // Public read (RLS: anyone reads active trades). If it fails, the wizard
    // still works; the NAICS checkboxes are empty and the free-text "Other"
    // field still takes codes.
    let offeredNaics: NaicsOption[] = [];
    try {
      offeredNaics = offeredNaicsOptions(await loadActiveTrades(await createClient()));
    } catch (err) {
      console.error("[intake] failed to load trades", { message: err instanceof Error ? err.message : err });
    }
  ```
- Render `<IntakeWizard offeredNaics={offeredNaics} />`.

- [ ] **Step 2: The wizard uses them** (`app/intake/IntakeWizard.tsx`)

- `export function IntakeWizard() {` becomes `export function IntakeWizard({ offeredNaics }: { offeredNaics: NaicsOption[] }) {`.
- Replace `import { COMMON_NAICS_CODES } from "@/lib/business-options";` with `import { naicsOptionsWithSelected, type NaicsOption } from "@/lib/trades/naics-options";`.
- In the retainer `CheckboxGroup`, replace `options={COMMON_NAICS_CODES.map((n) => ({ value: n.code, label: \`${n.code}: ${n.label}\` }))}` with:
  ```tsx
                options={naicsOptionsWithSelected(offeredNaics, retainerProfile.naicsCodes)}
  ```

- [ ] **Step 3: The Profile page loads them** (`app/dashboard/profile/page.tsx`)

- Add the same three imports as in Step 1.
- After the client query, add:
  ```ts
    let offeredNaics: NaicsOption[] = [];
    try {
      offeredNaics = offeredNaicsOptions(await loadActiveTrades(supabase));
    } catch (err) {
      console.error("[profile] failed to load trades", { message: err instanceof Error ? err.message : err });
    }
  ```
  Use the page's existing server Supabase client variable, which is named `supabase` if it follows the other pages.
- Pass `offeredNaics={offeredNaics}` to `<CompanyProfileClient ...>`.
- In `CompanyProfileClient.tsx`, add `offeredNaics: NaicsOption[]` to its props (with `import type { NaicsOption } from "@/lib/trades/naics-options";`) and pass it on: `<CompanyInfoForm key={version} clientId={clientId} initialInfo={info} offeredNaics={offeredNaics} />`.

- [ ] **Step 4: The Profile form uses them** (`app/dashboard/profile/CompanyInfoForm.tsx`)

- Add the prop `offeredNaics: NaicsOption[]`, with the import `import { naicsOptionsWithSelected, type NaicsOption } from "@/lib/trades/naics-options";`.
- Remove `COMMON_NAICS_CODES` from the `@/lib/business-options` import, keeping `SMALL_BUSINESS_STATUSES` and `COMMON_SET_ASIDES`.
- Replace:
  ```ts
    const naicsKnownCodes = COMMON_NAICS_CODES.map((n) => n.code);
    const initialNaics = splitKnown(initialInfo.naics_codes, naicsKnownCodes);
  ```
  with:
  ```ts
    // Every code the client already saved stays a checked option, even if
    // that trade was switched off since (see naicsOptionsWithSelected).
    const naicsOptions = naicsOptionsWithSelected(offeredNaics, initialInfo.naics_codes);
    const initialNaics = splitKnown(initialInfo.naics_codes, naicsOptions.map((o) => o.value));
  ```
- In the NAICS `CheckboxGroup`, replace the `options={COMMON_NAICS_CODES.map(...)}` expression with `options={naicsOptions}`.

- [ ] **Step 5: The AI document reader accepts the offered codes**

In **`app/api/extract-from-document/route.ts`**:
- Remove `COMMON_NAICS_CODES` from the `@/lib/business-options` import.
- Add `import { loadActiveTrades } from "@/lib/trades/server";` and `import { offeredNaicsCodes } from "@/lib/trades/classify";`.
- Give the field-coercion function a `knownNaics: string[]` parameter. It's the function containing the `naicsCodes: asKnownArray(` block; find it with `grep -n "function coerce\|asKnownArray(" app/api/extract-from-document/route.ts`.
- Replace `COMMON_NAICS_CODES.map((n) => n.code)` inside it with `knownNaics`.
- In `POST`, before that function is called, add:
  ```ts
    // Codes the reader may return: the offered trades' codes. If the list
    // can't be loaded, no codes are prefilled (the client can still tick
    // them), rather than accepting anything the model says.
    let knownNaics: string[] = [];
    try {
      knownNaics = offeredNaicsCodes(await loadActiveTrades(supabase));
    } catch (err) {
      console.error("[extract-from-document] failed to load trades", { message: err instanceof Error ? err.message : err });
    }
  ```
  Use the route's existing server Supabase client variable, and pass `knownNaics` at the call site.

In **`app/api/extract-company-profile/route.ts`**, do the same:
- Change `coerceFields(parsed: unknown)` to `coerceFields(parsed: unknown, knownNaics: string[])`.
- Delete the line `const knownNaics = COMMON_NAICS_CODES.map((n) => n.code);`.
- Remove the `COMMON_NAICS_CODES` import, add the same two imports, load `knownNaics` in `POST` the same way (log prefix `[extract-company-profile]`), and pass it to `coerceFields(`.
- Find the call with `grep -n "coerceFields(" app/api/extract-company-profile/route.ts`.

Both prompts also tell the model which codes exist. If a prompt string interpolates `COMMON_NAICS_CODES`, build that text from `knownNaics` instead. Check with `grep -n "COMMON_NAICS_CODES" app/api/extract-*/route.ts`, which must print nothing at the end of this step.

- [ ] **Step 6: Remove the old list** (`lib/business-options.ts`)

Delete `COMMON_NAICS_CODES` and `clientTradeLabel`, including their comments, and the `KNOWN_TRADES` import if nothing else in the file uses it. Then:

Run: `grep -rn "COMMON_NAICS_CODES\|SAM_NAICS_CODES" app lib components`
Expected: no output.

- [ ] **Step 7: Test and typecheck**

Run: `npm test && npx tsc --noEmit -p .`
Expected: all pass, and the typecheck is clean.

- [ ] **Step 8: Commit**

```bash
git add app/intake app/dashboard/profile app/api/extract-from-document app/api/extract-company-profile lib/business-options.ts
git commit -m "Client NAICS checkboxes and document reader use the trade list; remove hardcoded lists" -m "<attribution lines>"
```

---

### Task 11: Seed dev and verify end to end

**Files:**
- Create: `supabase/seed/trades.sql`

- [ ] **Step 1: Write the idempotent seed** (the table the user approved on 2026-09-23)

```sql
-- Starting trades, approved by the user 2026-09-23
-- (docs/superpowers/specs/2026-09-23-trade-list-design.md, "Starting trades").
-- Idempotent: skips any trade whose label already exists. One org per database.
with org as (select id from public.organizations limit 1),
seed(label, sort_order, naics, keywords) as (values
  ('Janitorial', 1,
   '[{"code":"561720","label":"Janitorial Services"},{"code":"561740","label":"Carpet and Upholstery Cleaning Services"},{"code":"561790","label":"Other Services to Buildings and Dwellings"},{"code":"561210","label":"Facilities Support Services"}]'::jsonb,
   array['janitorial','custodial','day porter','building cleaning','office cleaning','carpet cleaning','floor care','window cleaning','pressure washing']),
  ('Landscaping / Grounds', 2,
   '[{"code":"561730","label":"Landscaping Services"}]'::jsonb,
   array['landscap','lawn care','lawn maintenance','grounds maintenance','mowing','tree trimming','irrigation maintenance','irrigation repair','turf maintenance']),
  ('HVAC / Plumbing', 3,
   '[{"code":"238220","label":"Plumbing, Heating, and Air-Conditioning Contractors"},{"code":"238290","label":"Other Building Equipment Contractors"}]'::jsonb,
   array['hvac','air condition','refrigerant','chiller','heat pump','ductwork','heating and cooling','plumbing','plumber','backflow','water heater','boiler']),
  ('Electrical', 4,
   '[{"code":"238210","label":"Electrical Contractors"}]'::jsonb,
   array['electrician','electrical contractor','electrical services','electrical repair','electrical maintenance','electrical installation','switchgear','panel upgrade','lighting retrofit']),
  ('IT / Computer Support', 5,
   '[{"code":"541512","label":"Computer Systems Design Services"},{"code":"541519","label":"Other Computer Related Services"},{"code":"518210","label":"Data Processing, Hosting, and Related Services"}]'::jsonb,
   array['computer support','it services','it support','information technology','network administration','help desk','desktop support','cybersecurity','software development','web application'])
)
insert into public.trades (org_id, label, sort_order, naics, keywords)
select org.id, seed.label, seed.sort_order, seed.naics, seed.keywords
from seed cross join org
where not exists (
  select 1 from public.trades t where t.org_id = org.id and lower(t.label) = lower(seed.label)
);
```

No NIGP codes are seeded. The spec allows them only once they're verified against an official NIGP listing; they can be added later through the Trades form.

- [ ] **Step 2: Check dev has exactly one org, then seed dev**

```bash
npx supabase link --project-ref hvrwxcyqgjobrgpcequj
npx supabase db query --linked "select count(*) from organizations"   # must be 1 -- stop and report otherwise
npx supabase db query --linked -f supabase/seed/trades.sql
npx supabase db query --linked "select label, active, jsonb_array_length(naics) as naics, array_length(keywords,1) as keywords from trades order by sort_order"
npx supabase link --project-ref rixsgnbivayeaxbdseij
cat supabase/.temp/project-ref   # expect rixsgnbivayeaxbdseij
```

Expected: 5 rows, Janitorial through IT / Computer Support, all active, with NAICS counts 4, 1, 2, 1, 3.


- [ ] **Step 3: Browser test on dev as the QA admin**

- Log in as `qa-admin-matches@firstcoastbids-example.test`. Its password is not stored; reset it only after confirming with `listUsers()` that exactly one user has that email (CLAUDE.md rule 3).
- Run `npm run dev`, then use Playwright as in earlier sessions (`playwright-core` from `~/.npm/_npx/705bc6b22212b352/node_modules`, Chromium at `~/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`) to check:
  1. `/admin/settings` shows 5 trades.
  2. **Re-sort open matches:** the dialog shows a count. Record it, then confirm. The toast says "Moved N…". Check in SQL that `select count(*) from matched_opportunities where status='new' and trade_id is not null` equals N.
  3. **Add a trade:** "QA Test Trade", keyword `bridge`. The preview count must equal the number of `new` Other trades rows whose title has a word starting with "bridge". Confirm, and check the count in SQL.
  4. **Switch "QA Test Trade" off:** the preview says those rows go to Other trades. Confirm.
  5. **Validation:** add a trade with NAICS `561 720`. The form shows `NAICS code "561 720" must be exactly 6 digits.`, and no request is sent.
  6. **`/admin/matches`:** "Your trades" and "Other trades" show counts; each view lists the right rows; trade rows show the trade badge.
  7. **`/intake` (logged out):** the NAICS checkboxes list the 11 offered codes. Reach the retainer step with a throwaway email such as `qa-trades-<timestamp>@firstcoastbids-example.test`, using a new email for each attempt (CLAUDE.md rule 2), and see the checkboxes there.
  8. **Scrape run:** `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/scrape` with dev's `.env.local` `CRON_SECRET`. The response has `results` and no `"Couldn't load trades"`; newly inserted rows have `trade_id` set when their title or NAICS code matches.
- "QA Test Trade" stays in dev, switched off. **Don't delete it:** the app never hard-deletes trades, and cleanup needs the user's say-so.

- [ ] **Step 4: Commit the seed and report to the user**

```bash
git add supabase/seed/trades.sql
git commit -m "Seed: the five approved starting trades" -m "<attribution lines>"
```

Report each check's actual result, with numbers and screenshots, to the user. Stop here until the user approves merging and the production rollout.

---

### Task 12: Production rollout (only with the user's explicit go-ahead)

- [ ] **Step 1: Ask the user:** "Merge `trade-list` to main, push, apply the migration and seed to production?" Wait for a yes.

- [ ] **Step 2: Apply the migration to production before deploying the code**

The scrape route would fail without the table, which is why the migration goes first.

```bash
cat supabase/.temp/project-ref            # must be rixsgnbivayeaxbdseij
npx supabase db push --dry-run            # must list only 20260923150000_add_trades.sql
npx supabase db push
```

Then check it over REST with production's publishable key, which is not in `.env.local`. Ask the user for it, or check in the browser against `https://www.firstcoastbids.com`:

```bash
curl -s "https://rixsgnbivayeaxbdseij.supabase.co/rest/v1/trades?select=id&limit=1" -H "apikey: <production publishable key>"
```

Expected: `[]`. A `PGRST205` response means the user runs `NOTIFY pgrst, 'reload schema';` in production's SQL editor.

- [ ] **Step 3: Seed production**

```bash
npx supabase db query --linked "select count(*) from organizations"   # must be 1
npx supabase db query --linked -f supabase/seed/trades.sql
npx supabase db query --linked "select label, active from trades order by sort_order"
```

- [ ] **Step 4: Merge, push, and wait for the deploy**

```bash
git checkout main && git merge --no-ff trade-list -m "Merge branch 'trade-list'" -m "<attribution lines>"
npm test && npx tsc --noEmit -p .
git push origin main
npx vercel ls | head -3        # then npx vercel inspect <newest url> until status Ready
```

- [ ] **Step 5: Hand the first re-sort to the user**

Tell the user: open **Settings → Trades → Re-sort open matches** in production. The dialog will show how many open matches move into trades. Expect a very small number: the 2026-09-23 measurement found only one open production row in an offered trade, the SAM.gov "Boilers PM & Testing". Everything else goes to Other trades, where it already sits, because `trade_id` starts null. Confirming it is theirs to do. From the next daily scrape on, new matches are sorted automatically.

---

## Self-review notes

- **Spec coverage:**

  | Spec requirement | Task |
  |---|---|
  | Data | 1 |
  | Classification | 2 |
  | Scrape pipeline and SAM.gov | 6 |
  | Matches page | 9 |
  | Trades settings | 3, 4, 7, 8 |
  | Client forms and AI reader | 5, 10 |
  | Seed | 11 |
  | Rollout | 11, 12 |
  | Testing | 2–6, 9 |
  | Audit events | 7 |
  | "Never hard-delete" | no delete path exists anywhere in 7 or 8 |

- **Deliberate gap:** re-sorting only covers `status='new'`, as the spec says. Other trades rows in dismissed or expired status keep a null `trade_id`, and the Other trades view's status tabs show them.
