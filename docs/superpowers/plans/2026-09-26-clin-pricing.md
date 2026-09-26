# CLIN Pricing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Read a federal solicitation's CLIN price table (AI with verified
quotes), price every line with plain code from the wage worksheet's bid price,
the client's yearly increase and a per-bid split, and write it as the client's
Rate sheet deliverable.

**Architecture:**
- Pure logic lives in `lib/clins/`:
  - `parse.ts` — units, periods, positions, dedupe, CLIN-in-quote;
  - `price.ts` — the math;
  - `rate-sheet.ts` — the deliverable text.
- A focused AI reader, `lib/clins/ai-pass.ts`, is used by a new
  `/api/clin-scan` route, which follows `/api/checklist-scan`'s claim/cache
  pattern.
- Lines live in a new `clin_lines` table and are edited through
  `/api/clin-lines`.
- A `ClinPricingPanel` sits on the bid page under the wage worksheet.
- Package routing adds `rate_sheet` to full packages that have CLINs.

**Tech Stack:** Next.js 15 App Router, Supabase (Postgres, RLS, PostgREST),
TypeScript (`strict: false`), `@anthropic-ai/sdk` (model `claude-opus-5`,
`client.beta.messages.create`, `betas: ["server-side-fallback-2026-07-01"]`,
`fallbacks: "default"`, `output_config: { effort: "low", format: { type:
"json_schema", schema } }`), and `node --experimental-strip-types --test`
with relative `.ts` imports in `lib/`.

**Spec:** `docs/superpowers/specs/2026-09-25-clin-pricing-design.md`

## Global Constraints

- Never fabricate: a number nobody gave us stays blank. In the Rate sheet it's a bracketed placeholder, which `hasUnresolvedPlaceholders` (`/\[[^\[\]]*\]/`) detects.
- Admin efficiency: one person, 48-hour turnaround. Pre-filled, attention-first; checking a typical table takes under a minute.
- Easy for the client: no new client forms or steps.
- **Year price** = `bid × (1 + increase%)^k`, where k = 0 is the base and 1–4 are the option years.
- **Unit price:**
  - `month`: `round2(yearPrice × share / 12)`;
  - `year`: `round2(yearPrice × share)`;
  - `other`: blank unless typed.
- **Amount** = `round2(unitPrice × quantity)`.
- **Total** = the sum of the rounded amounts.
- **Shares:** one line in a period means 100%. Several lines use `clin_shares[position]`, which must sum to 100 (±0.01).
- **Dedupe:** a CLIN listed in several files — the last-uploaded file wins, and `revised_by` names it.
- **Reading runs** only for federal bids: `isFederalAgency(agency)`, or the bid has a `federal = true` checklist suggestion.
- **PostgREST embeds** from `submissions` to `clients` use `clients!submissions_client_id_fkey(...)`.
- **Service-role writes** only after a caller check. `clients.pricing` is written only through `/api/wage-worksheet/client-pricing`.
- **Tests and checks:** `npm test` stays green; `npx tsc --noEmit -p .` is clean.
- **Commit trailer** on every commit:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01VxaQ43PbCfwewBqBw5t8Dd
  ```
- **Dev only:** the Supabase project is `hvrwxcyqgjobrgpcequj`. Production migrations are run by the user via `!`. Never modify more than one row without printing the count first.
- **Spec deviation (ruling):** `deliverables` has no approval status (columns: `id, submission_id, deliverable_type, file_url, content, prepared_by, created_at`), so "goes back to draft" can't exist. Instead, "Update the Rate sheet" asks for confirmation when the bid's stage is `deliverables_ready` or later ("The client can already see this package…"). The confirmation is where the admin's review happens.

## Review Focus

1. **A plain-sequence table with option wording** (MVY `00001–00005`, "Option Year N" in each description) must give periods 0–4, not all 0 (Task 2 test).
2. **A CLIN whose description says both "Option Year 1" and "Base Period 1 May 2027"** (Lake Tahoe) must be period 1 (Task 2 test).
3. **Re-reading after the admin typed a unit price or added a line by hand** keeps both (Task 5 test on `mergeRescan`).
4. **A bid with CLINs but no worksheet or bid price yet** shows every line blank with one clear guidance line, not an error (Task 3 test: `priceLines` with `bidPrice: null`).
5. **"Generate draft" on the Rate sheet of a CLIN bid** must produce the CLIN table, not the empty template, so the admin can't overwrite the priced table by accident (Task 8).

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/20260926090000_add_clin_lines.sql` (new) | `clin_lines` table, `submissions.clin_scan` and `clin_shares` |
| `lib/checklist/scan-state.ts` (+ test) | `claimFilter(now, column = "checklist_scan")`, generalised |
| `lib/clins/types.ts` (new) | `ClinLine`, `UnitKind`, `ClinCandidate` |
| `lib/clins/parse.ts` (+ test) | `unitKind`, `periodIndex`, `assignPeriodsAndPositions`, `dedupeClins`, `clinInQuote` |
| `lib/clins/price.ts` (+ test) | `priceLines` |
| `lib/clins/rate-sheet.ts` (+ test) | `rateSheetText` |
| `lib/clins/rescan.ts` (+ test) | `mergeRescan`: keep admin lines and overrides across re-reads |
| `lib/clins/ai-pass.ts` (+ test for `coerceClinItems`) | the AI reader |
| `lib/clins/server.ts` (new) | `loadClinContext`: lines, shares, bid price, client increase |
| `app/api/clin-scan/route.ts` (new) | read and save lines |
| `app/api/clin-lines/route.ts` (new) | edit, add or remove lines; set shares; write the Rate sheet |
| `lib/wage/client-pricing.ts` (+ test), `app/admin/inbox/[id]/ClientNumbers.tsx` | `yearlyIncreasePct` |
| `lib/deliverables/package-routing.ts` (+ test) | `hasClins`, `isLeanPackage` |
| `app/admin/inbox/[id]/ClinPricingPanel.tsx` (new), `page.tsx` | the panel |
| `app/admin/inbox/[id]/DeliverablesPanel.tsx`, `app/api/advance-if-deliverables-complete/route.ts`, `app/api/generate-draft/route.ts` | the Rate sheet in the package |
| `components/ui/SubmissionDocuments.tsx` | start the CLIN reading after an upload |

---

### Task 1: Migration and the generalised claim filter

**Files:**
- Create: `supabase/migrations/20260926090000_add_clin_lines.sql`
- Modify: `lib/checklist/scan-state.ts`, `lib/checklist/scan-state.test.ts`

**Interfaces:**
- Produces:
  - `claimFilter(now: Date, column?: string): string`
  - the tables and columns listed below.

- [ ] **Step 1: Failing test.** Append to `lib/checklist/scan-state.test.ts`:
```ts
test("the claim filter works for another scan column", () => {
  const f = claimFilter(new Date("2026-09-26T12:00:00.000Z"), "clin_scan");
  assert.ok(f.startsWith("clin_scan.is.null,clin_scan->>status.neq.running,clin_scan->>started_at.lt."));
  assert.ok(claimFilter(new Date("2026-09-26T12:00:00.000Z")).startsWith("checklist_scan.is.null"));
});
```
(Add `claimFilter` to that file's import if it's not there.)

- [ ] **Step 2:** Run `node --experimental-strip-types --test lib/checklist/scan-state.test.ts`. Expected: FAIL, because the first assertion finds `checklist_scan`.

- [ ] **Step 3: Implement.** In `scan-state.ts`, replace `claimFilter` with:
```ts
export function claimFilter(now: Date, column = "checklist_scan"): string {
  const staleBefore = new Date(now.getTime() - STALE_AFTER_MS).toISOString();
  return `${column}.is.null,${column}->>status.neq.running,${column}->>started_at.lt."${staleBefore}"`;
}
```

- [ ] **Step 4: Migration.**
```sql
-- CLIN pricing (docs/superpowers/specs/2026-09-25-clin-pricing-design.md):
-- the solicitation's own price table, read with verified quotes and priced
-- from the wage worksheet's bid price and the client's yearly increase.

create table public.clin_lines (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  clin text not null,
  description text not null default '',
  quantity numeric,
  unit text,
  unit_kind text not null default 'other' check (unit_kind in ('month','year','other')),
  period_index integer check (period_index between 0 and 9),
  position integer not null default 1,
  quote text,
  page integer,
  source_file text,
  quote_status text not null check (quote_status in ('verified','not_found','unreadable','admin')),
  revised_by text,
  unit_price_override numeric check (unit_price_override >= 0),
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  unique (submission_id, clin)
);
alter table public.clin_lines enable row level security;
create policy "admins manage clin_lines" on public.clin_lines
  using (public.is_admin(org_id))
  with check (public.is_admin(org_id));
grant select, insert, update, delete on public.clin_lines to authenticated;

-- {status, started_at, finished_at, files_fingerprint, error, excel_attachments: [names]}
alter table public.submissions add column clin_scan jsonb;
-- The split between CLINs sharing a period, entered once per bid: {"<position>": pct}.
alter table public.submissions add column clin_shares jsonb not null default '{}'::jsonb;
```

- [ ] **Step 5: Apply to dev.** Link `hvrwxcyqgjobrgpcequj`, then `db push --dry-run` (expect only this file), `db push --yes`, and `NOTIFY pgrst, 'reload schema'`. Relink `rixsgnbivayeaxbdseij` and check `supabase/.temp/project-ref`. Verify `GET /rest/v1/clin_lines?select=id&limit=1` returns `[]`.

- [ ] **Step 6: Commit** the migration and scan-state files: "CLIN pricing: clin_lines, clin_scan, clin_shares; claim filter per scan column".

---

### Task 2: Pure parsing: units, periods, positions, dedupe, CLIN-in-quote

**Files:**
- Create: `lib/clins/types.ts`, `lib/clins/parse.ts`, `lib/clins/parse.test.ts`

**Interfaces:**
- Produces:
```ts
export type UnitKind = "month" | "year" | "other";
export type ClinCandidate = { clin: string; description: string; quantity: number | null; unit: string | null; quote: string; page: number | null; source_file: string | null };
export type ClinLine = {
  id?: string; clin: string; description: string; quantity: number | null; unit: string | null; unit_kind: UnitKind;
  period_index: number | null; position: number; quote: string | null; page: number | null; source_file: string | null;
  quote_status: "verified" | "not_found" | "unreadable" | "admin"; revised_by: string | null; unit_price_override: number | null; sort: number;
};
unitKind(unit: string | null, description?: string): UnitKind
periodIndex(clin: string, description: string, allClins: string[]): number | null
assignPeriodsAndPositions(lines: Omit<ClinLine, "period_index" | "position" | "sort">[]): ClinLine[]
dedupeClins(byFile: { file: string; items: ClinCandidate[] }[]): (ClinCandidate & { revised_by: string | null })[]   // files in upload order
clinInQuote(clin: string, quote: string): boolean
```

- [ ] **Step 1: Failing tests** in `lib/clins/parse.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { unitKind, periodIndex, assignPeriodsAndPositions, dedupeClins, clinInQuote } from "./parse.ts";

test("units: months, years, anything else", () => {
  for (const u of ["MO", "Mo", "MOS", "Months", "month", "12 MO"]) assert.equal(unitKind(u), "month", u);
  for (const u of ["YR", "Year", "years"]) assert.equal(unitKind(u), "year", u);
  for (const u of ["EA", "JB", "HR", "Lot"]) assert.equal(unitKind(u), "other", u);
  assert.equal(unitKind(null), "other");
  assert.equal(unitKind(null, "Custodial services, 12 months"), "other", "the unit column decides, not the description");
});

test("periods from wording: option wording wins over 'Base Period' dates (Lake Tahoe)", () => {
  const all = ["0001", "0002", "1001", "1002"];
  assert.equal(periodIndex("0001", "LTBMU Janitorial Services at the Supervisors Office. Base Period 15 Oct 2026 - 30 April 2027", all), 0);
  assert.equal(periodIndex("1001", "Option Year 1 LTBMU Janitorial Services at the Supervisors Office. Base Period 1 May 2027 - 30 April 2028 (Option Line Item)", all), 1);
  assert.equal(periodIndex("30001", "Option Period Three janitorial", ["00001", "30001"]), 3);
});

test("periods from numbering when the table uses the x001 pattern (JDMTA, Crow Agency)", () => {
  const four = ["0001", "1001", "2001", "3001", "4001"];
  assert.deepEqual(four.map((c) => periodIndex(c, "Custodial Services for JDMTA", four)), [0, 1, 2, 3, 4]);
  const five = ["00001", "10001", "20001"];
  assert.deepEqual(five.map((c) => periodIndex(c, "Janitorial Services for Crow Agency Buildings", five)), [0, 1, 2]);
});

test("a plain sequence: wording decides (MVY); without wording the period is unknown", () => {
  const seq = ["00001", "00002", "00003", "00004", "00005"];
  const descs = ["Base Year MVY janitorial services", "Option Year 1 MVY janitorial", "Option Year 2 MVY", "Option Year 3 MVY", "Option Year 4 MVY"];
  assert.deepEqual(seq.map((c, i) => periodIndex(c, descs[i], seq)), [0, 1, 2, 3, 4]);
  assert.equal(periodIndex("00002", "Janitorial services", seq), null);
});

test("positions number the lines within each period by CLIN, and sort follows period then position", () => {
  const base = { description: "", quantity: 12, unit: "MO", unit_kind: "month" as const, quote: null, page: null, source_file: null, quote_status: "verified" as const, revised_by: null, unit_price_override: null };
  const out = assignPeriodsAndPositions([
    { ...base, clin: "1002", description: "Option Year 1 Meyers" },
    { ...base, clin: "0002", description: "Meyers Work Center" },
    { ...base, clin: "0001", description: "Supervisors Office" },
    { ...base, clin: "1001", description: "Option Year 1 Supervisors" },
  ]);
  assert.deepEqual(out.map((l) => [l.clin, l.period_index, l.position, l.sort]), [
    ["0001", 0, 1, 0], ["0002", 0, 2, 1], ["1001", 1, 1, 2], ["1002", 1, 2, 3],
  ]);
});

test("an amendment re-listing a CLIN wins, and says so", () => {
  const c = (clin: string, description: string) => ({ clin, description, quantity: 12, unit: "MO", quote: `${clin} ${description}`, page: 1, source_file: null });
  const out = dedupeClins([
    { file: "sol.pdf", items: [c("0001", "Old"), c("1001", "Opt 1")] },
    { file: "amd1.pdf", items: [c("0001", "New")] },
  ]);
  assert.deepEqual(out.map((l) => [l.clin, l.description, l.source_file, l.revised_by]), [
    ["0001", "New", "amd1.pdf", "amd1.pdf"],
    ["1001", "Opt 1", "sol.pdf", null],
  ]);
});

test("the quote must contain the CLIN number as a whole token", () => {
  assert.equal(clinInQuote("0001", "0001    Custodial Services for JDMTA            12     Months"), true);
  assert.equal(clinInQuote("0001", "10001  Janitorial"), false);
  assert.equal(clinInQuote("0002AA", "0002AA Carpet cleaning"), true);
});
```

- [ ] **Step 2:** Run `node --experimental-strip-types --test lib/clins/parse.test.ts`. Expected: FAIL (the module is missing).

- [ ] **Step 3: Implement** `lib/clins/types.ts` (the types above, verbatim) and `lib/clins/parse.ts`:
```ts
import type { ClinCandidate, ClinLine, UnitKind } from "./types.ts";

// Plain code around the AI's reading of a CLIN table (docs/superpowers/specs/
// 2026-09-25-clin-pricing-design.md): what unit a line is priced in, which
// contract period it belongs to, and which lines are the same building
// across years. Checked against five real solicitations (JDMTA, Lake Tahoe,
// Crow Agency, Montrose, Martha's Vineyard).

export function unitKind(unit: string | null, _description?: string): UnitKind {
  const u = (unit ?? "").trim().toLowerCase().replace(/^\d+\s*/, "");
  if (/^(mo|mos|mon|month|months)\.?$/.test(u)) return "month";
  if (/^(yr|yrs|year|years)\.?$/.test(u)) return "year";
  return "other";
}

const WORD_NUM: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9 };

export function periodIndex(clin: string, description: string, allClins: string[]): number | null {
  const opt = description.match(/\boption\s+(?:year|period)\s+(\d+|one|two|three|four|five|six|seven|eight|nine)\b/i);
  if (opt) return /^\d+$/.test(opt[1]) ? Number(opt[1]) : WORD_NUM[opt[1].toLowerCase()];
  if (/\bbase\b/i.test(description)) return 0;
  // Numbering: 0001/1001/2001 or 00001/10001/20001 -- only when the table
  // really uses a leading period digit (some CLIN starts with 1-9).
  const numeric = allClins.map((c) => c.match(/^(\d)\d{3,4}[A-Z]{0,2}$/));
  if (numeric.every(Boolean) && numeric.some((m) => m![1] !== "0")) {
    const m = clin.match(/^(\d)\d{3,4}[A-Z]{0,2}$/);
    return m ? Number(m[1]) : null;
  }
  return null;
}

export function assignPeriodsAndPositions(lines: Omit<ClinLine, "period_index" | "position" | "sort">[]): ClinLine[] {
  const all = lines.map((l) => l.clin);
  const withPeriod = lines.map((l) => ({ ...l, period_index: periodIndex(l.clin, l.description, all) }));
  const key = (p: number | null) => (p === null ? 99 : p);
  withPeriod.sort((a, b) => key(a.period_index) - key(b.period_index) || a.clin.localeCompare(b.clin));
  const counters = new Map<number | null, number>();
  return withPeriod.map((l, i) => {
    const n = (counters.get(l.period_index) ?? 0) + 1;
    counters.set(l.period_index, n);
    return { ...l, position: n, sort: i };
  });
}

// Files in upload order: a later file's CLIN replaces an earlier one's.
export function dedupeClins(byFile: { file: string; items: ClinCandidate[] }[]): (ClinCandidate & { revised_by: string | null })[] {
  const out = new Map<string, ClinCandidate & { revised_by: string | null }>();
  for (const { file, items } of byFile) {
    for (const it of items) {
      const prior = out.get(it.clin);
      out.set(it.clin, { ...it, source_file: it.source_file ?? file, revised_by: prior ? file : null });
    }
  }
  return [...out.values()];
}

export function clinInQuote(clin: string, quote: string): boolean {
  const esc = clin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^0-9A-Za-z])${esc}([^0-9A-Za-z]|$)`).test(quote);
}
```

- [ ] **Step 4:** Run the tests again. Expected: PASS (7 tests).

- [ ] **Step 5: Commit** "CLIN pricing: units, periods, positions, amendments (plain code)".

---

### Task 3: Pricing (pure), and the client's yearly increase

**Files:**
- Create: `lib/clins/price.ts`, `lib/clins/price.test.ts`
- Modify: `lib/wage/client-pricing.ts`, `lib/wage/client-pricing.test.ts`, `app/admin/inbox/[id]/ClientNumbers.tsx`

**Interfaces:**
- Consumes: `ClinLine` (Task 2).
- Produces:
```ts
export type PricedLine = { clin: string; yearPrice: number | null; share: number | null; unitPrice: number | null; amount: number | null; typed: boolean; problem: "no_bid" | "no_increase" | "no_share" | "unit" | "no_quantity" | "no_period" | null };
export function priceLines(i: { lines: ClinLine[]; bidPrice: number | null; increasePct: number | null; shares: Record<string, number> }):
  { lines: PricedLine[]; total: number | null; missing: number; sharesProblem: string | null };
```
- `ClientPricing` gains `yearlyIncreasePct: number | null`.

- [ ] **Step 1: Failing tests,** in `lib/clins/price.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { priceLines } from "./price.ts";

const L = (clin: string, period_index: number | null, position = 1, extra = {}) => ({
  clin, description: "", quantity: 12, unit: "MO", unit_kind: "month" as const, period_index, position,
  quote: null, page: null, source_file: null, quote_status: "verified" as const, revised_by: null, unit_price_override: null, sort: 0, ...extra,
});

test("one CLIN a year, monthly, 3% a year compounding; total is the sum of rounded amounts", () => {
  const r = priceLines({ lines: [L("0001", 0), L("1001", 1), L("2001", 2)], bidPrice: 90000, increasePct: 3, shares: {} });
  assert.deepEqual(r.lines.map((l) => [l.unitPrice, l.amount]), [[7500, 90000], [7725, 92700], [7956.75, 95481]]);
  assert.equal(r.total, 90000 + 92700 + 95481);
  assert.equal(r.missing, 0);
});

test("a 6-month base: unit is the year's price / 12, amount x 6 (Lake Tahoe)", () => {
  const r = priceLines({ lines: [L("0001", 0, 1, { quantity: 6 })], bidPrice: 100000, increasePct: 0, shares: {} });
  assert.deepEqual([r.lines[0].unitPrice, r.lines[0].amount], [8333.33, 49999.98]);
});

test("two buildings: shares 40/60 carry to the option years; a bad split leaves them blank", () => {
  const lines = [L("0001", 0, 1), L("0002", 0, 2), L("1001", 1, 1), L("1002", 1, 2)];
  const ok = priceLines({ lines, bidPrice: 120000, increasePct: 0, shares: { "1": 40, "2": 60 } });
  assert.deepEqual(ok.lines.map((l) => l.amount), [48000, 72000, 48000, 72000]);
  const bad = priceLines({ lines, bidPrice: 120000, increasePct: 0, shares: { "1": 40, "2": 50 } });
  assert.equal(bad.sharesProblem, "The split adds up to 90%, not 100%.");
  assert.deepEqual(bad.lines.map((l) => [l.amount, l.problem]), [[null, "no_share"], [null, "no_share"], [null, "no_share"], [null, "no_share"]]);
  assert.equal(bad.total, null);
  assert.equal(bad.missing, 4);
});

test("nothing is guessed: no bid, no increase, other units, no quantity, unknown period", () => {
  const none = priceLines({ lines: [L("0001", 0), L("1001", 1)], bidPrice: null, increasePct: null, shares: {} });
  assert.deepEqual(none.lines.map((l) => l.problem), ["no_bid", "no_bid"]);
  const noInc = priceLines({ lines: [L("0001", 0), L("1001", 1)], bidPrice: 90000, increasePct: null, shares: {} });
  assert.deepEqual(noInc.lines.map((l) => [l.amount, l.problem]), [[90000, null], [null, "no_increase"]]);
  const other = priceLines({ lines: [L("0001", 0, 1, { unit: "JB", unit_kind: "other" }), L("0002", 0, 2, { quantity: null })], bidPrice: 90000, increasePct: 0, shares: { "1": 50, "2": 50 } });
  assert.deepEqual(other.lines.map((l) => l.problem), ["unit", "no_quantity"]);
  const unknown = priceLines({ lines: [L("00002", null)], bidPrice: 90000, increasePct: 0, shares: {} });
  assert.equal(unknown.lines[0].problem, "no_period");
});

test("a unit price the admin typed wins and is marked", () => {
  const r = priceLines({ lines: [L("0001", 0, 1, { unit: "JB", unit_kind: "other", quantity: 4, unit_price_override: 250 })], bidPrice: null, increasePct: null, shares: {} });
  assert.deepEqual([r.lines[0].unitPrice, r.lines[0].amount, r.lines[0].typed, r.lines[0].problem], [250, 1000, true, null]);
  assert.equal(r.total, 1000);
});
```
Append to `lib/wage/client-pricing.test.ts`:
```ts
test("the yearly increase is a client number: read, blank is missing, counts for the first save", () => {
  assert.equal(normalizeClientPricing({ yearlyIncreasePct: "3%" }).yearlyIncreasePct, 3);
  assert.equal(normalizeClientPricing({}).yearlyIncreasePct, null);
  assert.equal(hasAnyPricing(normalizeClientPricing({ yearlyIncreasePct: 0 })), true);
});
```
Update the two existing `deepEqual` expectations in that file (the "empty" and "negative" tests) to include `yearlyIncreasePct: null`, and the "typed text" test to include `yearlyIncreasePct: null`.

- [ ] **Step 2:** Run `node --experimental-strip-types --test lib/clins/price.test.ts lib/wage/client-pricing.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement.**

`lib/wage/client-pricing.ts`:
- add `yearlyIncreasePct: number | null;` to `ClientPricing`;
- in `normalizeClientPricing`, add `yearlyIncreasePct: readAmount(o.yearlyIncreasePct),`;
- in `hasAnyPricing`, add `|| p.yearlyIncreasePct !== null`.

`lib/clins/price.ts`:
```ts
import type { ClinLine } from "./types.ts";

// Every CLIN's price from the agreed yearly bid (the wage worksheet's bid
// price), the client's yearly increase and the per-bid split -- plain code,
// and nothing guessed: a missing input leaves the line blank with a reason.

export type PricedLine = {
  clin: string; yearPrice: number | null; share: number | null; unitPrice: number | null; amount: number | null; typed: boolean;
  problem: "no_bid" | "no_increase" | "no_share" | "unit" | "no_quantity" | "no_period" | null;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function priceLines(i: { lines: ClinLine[]; bidPrice: number | null; increasePct: number | null; shares: Record<string, number> }) {
  const perPeriod = new Map<number, number>();
  for (const l of i.lines) if (l.period_index !== null) perPeriod.set(l.period_index, (perPeriod.get(l.period_index) ?? 0) + 1);
  const positions = [...new Set(i.lines.filter((l) => (perPeriod.get(l.period_index ?? -1) ?? 0) > 1).map((l) => l.position))];
  let sharesProblem: string | null = null;
  if (positions.length > 1) {
    const vals = positions.map((p) => i.shares[String(p)]);
    const sum = vals.reduce((a, v) => a + (typeof v === "number" ? v : 0), 0);
    if (vals.some((v) => typeof v !== "number")) sharesProblem = "Enter the split for each line.";
    else if (Math.abs(sum - 100) > 0.01) sharesProblem = `The split adds up to ${round2(sum)}%, not 100%.`;
  }
  const lines: PricedLine[] = i.lines.map((l) => {
    const blank = (problem: PricedLine["problem"]): PricedLine => ({ clin: l.clin, yearPrice: null, share: null, unitPrice: null, amount: null, typed: false, problem });
    if (l.unit_price_override !== null) {
      const amount = l.quantity === null ? null : round2(l.unit_price_override * l.quantity);
      return { clin: l.clin, yearPrice: null, share: null, unitPrice: l.unit_price_override, amount, typed: true, problem: amount === null ? "no_quantity" : null };
    }
    if (l.period_index === null) return blank("no_period");
    if (l.unit_kind === "other") return blank("unit");
    if (l.quantity === null) return blank("no_quantity");
    if (i.bidPrice === null) return blank("no_bid");
    if (l.period_index > 0 && i.increasePct === null) return blank("no_increase");
    const shared = (perPeriod.get(l.period_index) ?? 0) > 1;
    if (shared && sharesProblem) return blank("no_share");
    const share = shared ? i.shares[String(l.position)] / 100 : 1;
    const yearPrice = i.bidPrice * Math.pow(1 + (i.increasePct ?? 0) / 100, l.period_index);
    const unitPrice = round2((yearPrice * share) / (l.unit_kind === "month" ? 12 : 1));
    return { clin: l.clin, yearPrice: round2(yearPrice), share, unitPrice, amount: round2(unitPrice * l.quantity), typed: false, problem: null };
  });
  const missing = lines.filter((l) => l.amount === null).length;
  const total = missing ? null : round2(lines.reduce((a, l) => a + (l.amount as number), 0));
  return { lines, total, missing, sharesProblem };
}
```

`ClientNumbers.tsx`:
- add `yearlyIncreasePct` to the `text` state;
- add a labelled box "Yearly increase %" after "Sq ft per hour", with the same `box()` highlight.

The spec says to show it "only on bids with option-year CLINs". **Ruling:** always show it. It's one box, and it's harmless on other bids; hiding it would need CLIN data inside the worksheet. The cost if wrong is one unused box.

- [ ] **Step 4:** Run the tests again. Expected: PASS. Run `npx tsc --noEmit -p .`. Expected: clean.

- [ ] **Step 5: Commit** "CLIN pricing: price every line from the bid, yearly increase and split".

---

### Task 4: The Rate sheet text and package routing (pure)

**Files:**
- Create: `lib/clins/rate-sheet.ts`, `lib/clins/rate-sheet.test.ts`
- Modify: `lib/deliverables/package-routing.ts`, and its test (create `lib/deliverables/package-routing.test.ts` if there isn't one)

**Interfaces:**
- Produces:
  - `rateSheetText(i: { agency: string; solicitationNumber: string | null; lines: ClinLine[]; priced: ReturnType<typeof priceLines> }): string`
  - `getRequiredDeliverableTypes(mode: PackageMode, hasClins = false): readonly string[]`
  - `isLeanPackage(existingTypes: string[], hasClins: boolean): boolean`

- [ ] **Step 1: Failing tests.**

`lib/clins/rate-sheet.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { rateSheetText } from "./rate-sheet.ts";
import { priceLines } from "./price.ts";
import { hasUnresolvedPlaceholders } from "../pdf/placeholder-check.ts";

const L = (clin: string, period_index: number, description: string, extra = {}) => ({
  clin, description, quantity: 12, unit: "MO", unit_kind: "month" as const, period_index, position: 1,
  quote: null, page: null, source_file: null, quote_status: "verified" as const, revised_by: null, unit_price_override: null, sort: period_index, ...extra,
});

test("a fully priced table: one row per CLIN and the total; no placeholders", () => {
  const lines = [L("0001", 0, "Custodial Services for JDMTA"), L("1001", 1, "Option Year 1 Custodial Services for JDMTA")];
  const text = rateSheetText({ agency: "DEPT OF THE AIR FORCE", solicitationNumber: "FA252126QB143", lines, priced: priceLines({ lines, bidPrice: 90000, increasePct: 3, shares: {} }) });
  assert.equal(text, [
    "RATE SHEET — DEPT OF THE AIR FORCE — Solicitation FA252126QB143",
    "",
    "CLIN | Description | Qty | Unit | Unit price | Amount",
    "0001 | Custodial Services for JDMTA | 12 | MO | $7,500.00 | $90,000.00",
    "1001 | Option Year 1 Custodial Services for JDMTA | 12 | MO | $7,725.00 | $92,700.00",
    "",
    "Total (base + all option years): $182,700.00",
  ].join("\n"));
  assert.equal(hasUnresolvedPlaceholders(text), false);
});

test("blanks become bracketed placeholders, so the client's download is blocked", () => {
  const lines = [L("0001", 0, "Custodial"), L("1001", 1, "Option Year 1 Custodial")];
  const text = rateSheetText({ agency: "X", solicitationNumber: null, lines, priced: priceLines({ lines, bidPrice: 90000, increasePct: null, shares: {} }) });
  assert.match(text, /1001 \| Option Year 1 Custodial \| 12 \| MO \| \[unit price — CLIN 1001\] \| \[amount — CLIN 1001\]/);
  assert.match(text, /Total \(base \+ all option years\): \[total — 1 line not priced yet\]/);
  assert.equal(hasUnresolvedPlaceholders(text), true);
});
```

`lib/deliverables/package-routing.test.ts` (append if the file exists):
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { getRequiredDeliverableTypes, isLeanPackage } from "./package-routing.ts";

test("a full package with CLINs adds the Rate sheet; lean is unchanged", () => {
  assert.deepEqual([...getRequiredDeliverableTypes("full", true)], ["capability_statement", "compliance_matrix", "technical_narrative", "rate_sheet"]);
  assert.deepEqual([...getRequiredDeliverableTypes("full")], ["capability_statement", "compliance_matrix", "technical_narrative"]);
  assert.deepEqual([...getRequiredDeliverableTypes("lean", true)], ["rate_sheet", "executive_cover", "certificate_of_insurance"]);
});

test("a federal bid's Rate sheet doesn't flip it into the lean package", () => {
  assert.equal(isLeanPackage(["rate_sheet"], true), false);
  assert.equal(isLeanPackage(["rate_sheet"], false), true);
  assert.equal(isLeanPackage(["executive_cover"], true), true);
  assert.equal(isLeanPackage(["capability_statement"], false), false);
});
```

- [ ] **Step 2:** Run both test files. Expected: FAIL.

- [ ] **Step 3: Implement.**

`lib/clins/rate-sheet.ts`:
```ts
import type { ClinLine } from "./types.ts";
import type { priceLines } from "./price.ts";

// The client's Rate sheet: the agency's CLINs, in the agency's numbering,
// priced. A blank is a [bracketed placeholder] so hasUnresolvedPlaceholders
// blocks the client's download until it's filled (never a guessed number).

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const qty = (n: number | null) => (n === null ? "[qty]" : n.toLocaleString("en-US", { maximumFractionDigits: 2 }));

export function rateSheetText(i: { agency: string; solicitationNumber: string | null; lines: ClinLine[]; priced: ReturnType<typeof priceLines> }): string {
  const rows = i.lines.map((l, k) => {
    const p = i.priced.lines[k];
    const unitPrice = p.unitPrice === null ? `[unit price — CLIN ${l.clin}]` : money(p.unitPrice);
    const amount = p.amount === null ? `[amount — CLIN ${l.clin}]` : money(p.amount);
    return `${l.clin} | ${l.description} | ${qty(l.quantity)} | ${l.unit ?? "[unit]"} | ${unitPrice} | ${amount}`;
  });
  const m = i.priced.missing;
  const total = i.priced.total === null ? `[total — ${m} line${m === 1 ? "" : "s"} not priced yet]` : money(i.priced.total);
  return [
    `RATE SHEET — ${i.agency}${i.solicitationNumber ? ` — Solicitation ${i.solicitationNumber}` : ""}`,
    "",
    "CLIN | Description | Qty | Unit | Unit price | Amount",
    ...rows,
    "",
    `Total (base + all option years): ${total}`,
  ].join("\n");
}
```

`lib/deliverables/package-routing.ts`: change `getRequiredDeliverableTypes` to
```ts
export function getRequiredDeliverableTypes(mode: PackageMode, hasClins = false): readonly string[] {
  if (mode === "lean") return LEAN_DELIVERABLE_TYPES;
  return hasClins ? [...FULL_DELIVERABLE_TYPES, "rate_sheet"] : FULL_DELIVERABLE_TYPES;
}

// Lean is sticky once a lean-only deliverable exists. A Rate sheet alone
// means lean only when the bid has no CLIN table (a federal full package
// has one too).
export function isLeanPackage(existingTypes: string[], hasClins: boolean): boolean {
  if (existingTypes.some((t) => t === "executive_cover" || t === "certificate_of_insurance")) return true;
  return !hasClins && existingTypes.includes("rate_sheet");
}
```

- [ ] **Step 4:** Run the tests. Expected: PASS. Run `npm test`. Expected: green.

- [ ] **Step 5: Commit** "CLIN pricing: Rate sheet text with placeholders; full federal packages include it".

---

### Task 5: The AI reader, re-read merging, and `/api/clin-scan`

**Files:**
- Create: `lib/clins/ai-pass.ts`, `lib/clins/ai-pass.test.ts`, `lib/clins/rescan.ts`, `lib/clins/rescan.test.ts`, `app/api/clin-scan/route.ts`
- Modify: `components/ui/SubmissionDocuments.tsx`

**Interfaces:**
- Consumes: `chunkPages` and `Chunk` (lib/checklist/chunk), `extractFileText`, `verifyQuote`, `filesFingerprint`, `isScanStale`, `claimFilter(now, "clin_scan")`, and Task 2's functions.
- Produces:
  - `coerceClinItems(parsed: unknown): ClinCandidate[]`
  - `runClinPass(i: { chunks: Chunk[]; agency: string }): Promise<{ byFile: { file: string; items: ClinCandidate[] }[]; failed: { file: string; message: string }[] }>`
  - `mergeRescan(existing: ClinLine[], fresh: ClinLine[]): ClinLine[]`
  - POST `/api/clin-scan` `{ submissionId, force? }` → `{ status, lines? }`

- [ ] **Step 1: Failing tests.**

`lib/clins/ai-pass.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { coerceClinItems } from "./ai-pass.ts";

test("AI output is coerced: bad rows dropped, numbers kept, blanks null", () => {
  const out = coerceClinItems({ lines: [
    { clin: " 0001 ", description: "Custodial", quantity: 12, unit: "MO", quote: "0001 Custodial 12 MO", page: 3, source_file: "a.pdf" },
    { clin: "", description: "x", quantity: 1, unit: "EA", quote: "q", page: 1, source_file: "" },
    { clin: "1001", description: "Opt 1", quantity: null, unit: null, quote: "1001 Opt 1", page: 0, source_file: "" },
  ] });
  assert.deepEqual(out, [
    { clin: "0001", description: "Custodial", quantity: 12, unit: "MO", quote: "0001 Custodial 12 MO", page: 3, source_file: "a.pdf" },
    { clin: "1001", description: "Opt 1", quantity: null, unit: null, quote: "1001 Opt 1", page: null, source_file: null },
  ]);
  assert.deepEqual(coerceClinItems(null), []);
});
```

`lib/clins/rescan.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeRescan } from "./rescan.ts";

const line = (clin: string, extra = {}) => ({ clin, description: clin, quantity: 12, unit: "MO", unit_kind: "month" as const, period_index: 0, position: 1, quote: clin, page: 1, source_file: "a.pdf", quote_status: "verified" as const, revised_by: null, unit_price_override: null, sort: 0, ...extra });

test("re-reading keeps lines the admin added and prices the admin typed", () => {
  const existing = [line("0001", { unit_price_override: 7000 }), line("9999", { quote_status: "admin", quote: null }), line("0002")];
  const fresh = [line("0001", { description: "Custodial (amended)" }), line("1001", { period_index: 1 })];
  const out = mergeRescan(existing, fresh);
  assert.deepEqual(out.map((l) => [l.clin, l.description, l.unit_price_override, l.quote_status]), [
    ["0001", "Custodial (amended)", 7000, "verified"],
    ["1001", "1001", null, "verified"],
    ["9999", "9999", null, "admin"],
  ]);
});
```

- [ ] **Step 2:** Run both. Expected: FAIL.

- [ ] **Step 3: Implement.**

`lib/clins/rescan.ts`:
```ts
import type { ClinLine } from "./types.ts";

// A re-read replaces what the AI found, but never the admin's own work:
// lines added by hand stay, and a typed unit price stays on its CLIN.
export function mergeRescan(existing: ClinLine[], fresh: ClinLine[]): ClinLine[] {
  const typed = new Map(existing.filter((l) => l.unit_price_override !== null).map((l) => [l.clin, l.unit_price_override]));
  const freshClins = new Set(fresh.map((l) => l.clin));
  const kept = existing.filter((l) => l.quote_status === "admin" && !freshClins.has(l.clin));
  return [...fresh.map((l) => ({ ...l, unit_price_override: typed.get(l.clin) ?? l.unit_price_override })), ...kept];
}
```

`lib/clins/ai-pass.ts`, following `lib/checklist/ai-pass.ts`'s call pattern:
```ts
import Anthropic from "@anthropic-ai/sdk";
import type { Chunk } from "../checklist/chunk.ts";
import type { ClinCandidate } from "./types.ts";

// The AI half of CLIN pricing: lists the priced line items of a
// solicitation's price schedule, each with a verbatim quote. Plain code
// (parse.ts, verify-quote.ts) checks everything afterwards.

const SYSTEM_PROMPT = `You read US federal solicitation documents for a small-business bid-preparation service. List every priced line item (CLIN / ITEM NO.) in the solicitation's price schedule -- the "Schedule of Supplies/Services", "Price Schedule" or CLIN table the offeror must price.

For each line:
- "clin": the item number exactly as printed (e.g. "0001", "10001", "0002AA").
- "description": the line's own description, including words like "Base Year", "Option Year 2", building or site names. Join wrapped lines with spaces. Leave out delivery dates, product/service codes and accounting data.
- "quantity" and "unit": as printed (e.g. 12 and "MO"); null when the line doesn't state them.
- "quote": copied VERBATIM from the document text, under 300 characters, and it MUST include the item number. A program will search for it.
- "page": from the nearest preceding "--- Page N ---" marker; 0 if none.
- "source_file": from the "--- Document: <name> ---" marker; "" if unknown.

Rules:
- Only lines the document actually lists in a price schedule. Never invent a line, number, quantity or unit. Never include prices.
- Do not list sub-line informational items that are not separately priced ("NSP" or "not separately priced") unless they have their own item number.
- If there is no price schedule in this text, return an empty list.`;

const SCHEMA = {
  type: "object",
  properties: {
    lines: {
      type: "array",
      items: {
        type: "object",
        properties: {
          clin: { type: "string" },
          description: { type: "string" },
          quantity: { type: ["number", "null"] },
          unit: { type: ["string", "null"] },
          quote: { type: "string" },
          page: { type: "integer" },
          source_file: { type: "string" },
        },
        required: ["clin", "description", "quantity", "unit", "quote", "page", "source_file"],
        additionalProperties: false,
      },
    },
  },
  required: ["lines"],
  additionalProperties: false,
} as const;

export function coerceClinItems(parsed: unknown): ClinCandidate[] {
  const lines = (parsed as { lines?: unknown } | null)?.lines;
  if (!Array.isArray(lines)) return [];
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const out: ClinCandidate[] = [];
  for (const raw of lines) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const clin = str(r.clin);
    const quote = str(r.quote);
    if (!clin || !quote) continue;
    out.push({
      clin,
      description: str(r.description) ?? "",
      quantity: typeof r.quantity === "number" && Number.isFinite(r.quantity) && r.quantity >= 0 ? r.quantity : null,
      unit: str(r.unit),
      quote,
      page: typeof r.page === "number" && Number.isInteger(r.page) && r.page > 0 ? r.page : null,
      source_file: str(r.source_file),
    });
  }
  return out;
}

async function readOne(client: Anthropic, text: string, agency: string): Promise<ClinCandidate[]> {
  const response = await client.beta.messages.create({
    model: "claude-opus-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: [{ type: "text", text }, { type: "text", text: `Buyer: ${agency}. List the priced line items (CLINs) from the document text above.` }] }],
  });
  if (response.stop_reason === "refusal") throw new Error("The AI declined to read this part of the document.");
  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new Error("The AI returned no result.");
  return coerceClinItems(JSON.parse(block.text));
}

export async function runClinPass(i: { chunks: Chunk[]; agency: string }) {
  const client = new Anthropic();
  const results = await Promise.allSettled(i.chunks.map((c) => readOne(client, c.text, i.agency)));
  const byFileMap = new Map<string, ClinCandidate[]>();
  const failed: { file: string; message: string }[] = [];
  results.forEach((r, k) => {
    const file = i.chunks[k].fileName;
    if (r.status === "fulfilled") byFileMap.set(file, [...(byFileMap.get(file) ?? []), ...r.value.map((v) => ({ ...v, source_file: v.source_file ?? file }))]);
    else failed.push({ file, message: r.reason instanceof Error ? r.reason.message : String(r.reason) });
  });
  const order = [...new Set(i.chunks.map((c) => c.fileName))];
  return { byFile: order.filter((f) => byFileMap.has(f)).map((file) => ({ file, items: byFileMap.get(file)! })), failed };
}
```

`app/api/clin-scan/route.ts`: follow `app/api/checklist-scan/route.ts`'s structure:
- **Access:** check with the caller's session; `force` needs an admin.
- **Load:** use the service client (`createServiceClient` from `@/lib/supabase/service`) to load the submission (`id, agency, clin_scan, clients!submissions_client_id_fkey(org_id)`).
- **Federal check:** return `{status: "not_federal"}` unless `isFederalAgency(agency)` or a `checklist_suggestions` row with `federal = true` exists.
- **Files:** load `rfp_file` docs in upload order. List `excel_attachments` as the names ending in `.xlsx` or `.xls`.
- **Cache and claim:** the fingerprint and running checks as in the checklist route; claim with `.or(claimFilter(now, "clin_scan"))`.
- **Read:** download, `extractFileText`, `chunkPages(files)` (defaults), then `runClinPass`.
- **Verify:** `dedupeClins(byFile)`. For each candidate, `quote_status` is:
  - `verified` when `verifyQuote(quote, fileText) === "verified" && clinInQuote(clin, quote)`;
  - `unreadable` when the file has no text;
  - otherwise `not_found`.
- **Build lines:** `unit_kind = unitKind(unit)`, then `assignPeriodsAndPositions`.
- **Save:** `mergeRescan(existingRows, fresh)`, then replace the bid's rows: delete the bid's `clin_lines` whose clin isn't in the merged set, and upsert the merged set on `(submission_id, clin)` with `org_id`.
- **Finish:** save `clin_scan` `{status: allFailed ? "failed" : "done", started_at, finished_at, files_fingerprint, error, excel_attachments}` and return `{status, lines: merged.length}`.
- **Errors:** any throw saves `failed` with the message, the same as the checklist route.

`components/ui/SubmissionDocuments.tsx`: next to the existing `fetch("/api/checklist-scan", …)`, add the same call to `/api/clin-scan` (not awaited, `.catch(() => {})`). The route itself decides if the bid is federal.

- [ ] **Step 4: Run** `node --experimental-strip-types --test lib/clins/*.test.ts` and `npx tsc --noEmit -p .`. Expected: PASS and clean.

- [ ] **Step 5: Measure on the five real solicitations (dev, before building UI).** Write a git-ignored script `.superpowers/sdd/2026-09-26-clin-pricing/real-docs.ts`. It downloads the five files below from SAM.gov's public endpoint (`https://sam.gov/api/prod/opps/v3/opportunities/resources/files/<resourceId>/download`, no key), runs `extractFileText`, `chunkPages`, `runClinPass`, dedupe, verification and `assignPeriodsAndPositions` exactly as the route does, and prints every line:
- JDMTA Amendment 1, `abf846d381a74fa197f4e01cae1fdb98`;
- Lake Tahoe, `0a431cd3c5834913999032eb1210e990`;
- Crow Agency, `5f2501b44d064943a349dc75bc75004d`;
- Montrose, `38c91136897041d39d1d1df3d2fe88b8`;
- Martha's Vineyard, `3f431f8eb89f46eaae8962b788dd8597`.

Check every line by hand against `pdftotext -layout` output: CLIN, description, quantity, unit and period. Ledger the found / missed / wrong counts and the reading time per document. Any wrong period or unit found here gets a failing test in `parse.test.ts` first, then the fix.

- [ ] **Step 6: Commit** "CLIN pricing: read the price table with verified quotes (/api/clin-scan)".

---

### Task 6: `/api/clin-lines`: edits, shares, and writing the Rate sheet

**Files:**
- Create: `lib/clins/server.ts`, `app/api/clin-lines/route.ts`

**Interfaces:**
- Consumes: `priceLines`, `rateSheetText`, `normalizeClientPricing`, and `adminFor` from `@/lib/wage/server`.
- Produces:
  - `loadClinContext(supabase, submissionId)` returns `{ submission: {id, agency, solicitation_number, stage, clin_shares, clin_scan}, lines: ClinLine[], bidPrice: number | null, increasePct: number | null, clientName: string } | null`
  - `/api/clin-lines`:
    - `GET ?submissionId=` → `{ lines, priced, shares, scan, bidPrice, increasePct, clientName }`
    - `PATCH { submissionId, id, clin?, description?, quantity?, unit?, period_index?, unit_price_override? }` — edits one line; `unit_kind` is recomputed from the unit
    - `POST { submissionId, action: "add" }` — adds a blank `admin` line with clin `NEW-<n>`
    - `DELETE { submissionId, id }` — removes one line
    - `PUT { submissionId, shares }` — sets `clin_shares`
    - `POST { submissionId, action: "rate_sheet", confirm? }` → `{ written: true }`, or `{ needsConfirm: true }` when the stage is `deliverables_ready` or later and `confirm` isn't true

- [ ] **Step 1: Implement `lib/clins/server.ts`:**
```ts
import type { Supabase } from "@/lib/wage/server";
import { normalizeClientPricing } from "@/lib/wage/client-pricing";
import type { ClinLine } from "@/lib/clins/types";

// Everything the CLIN panel and the Rate sheet need, read with the admin's
// own session (RLS: admin-only clin_lines and wage_worksheets).
export async function loadClinContext(supabase: Supabase, submissionId: string) {
  const { data: submission } = await supabase
    .from("submissions")
    .select("id, agency, solicitation_number, stage, clin_shares, clin_scan, clients!submissions_client_id_fkey(company_name, pricing)")
    .eq("id", submissionId)
    .maybeSingle();
  if (!submission) return null;
  const { data: lines } = await supabase.from("clin_lines").select("*").eq("submission_id", submissionId).order("sort");
  const { data: ws } = await supabase.from("wage_worksheets").select("bid_price").eq("submission_id", submissionId).maybeSingle();
  const client = submission.clients as unknown as { company_name: string | null; pricing: unknown } | null;
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return {
    submission,
    lines: ((lines ?? []) as ClinLine[]).map((l) => ({ ...l, quantity: num(l.quantity), unit_price_override: num(l.unit_price_override) })),
    bidPrice: num(ws?.bid_price ?? null),
    increasePct: normalizeClientPricing(client?.pricing).yearlyIncreasePct,
    clientName: client?.company_name?.trim() || "the client",
  };
}
```

- [ ] **Step 2: Implement the route.**
- Every method first calls `adminFor(supabase)` (403 if null), then `loadClinContext` (404 if null).
- Writes use the admin's session: RLS allows it.
- **PATCH:** sanitise with `sanitizeNumber(v, null)` from `@/lib/wage/prefill`. Trim `clin` and `description`. `period_index` is an integer 0–9 or null. Recompute `unit_kind` with `unitKind(unit)`. On a clin change, return 409 if the new clin is already used on this bid.
- **After any edit:** recompute positions only, from the stored periods,
  with `assignPositions` (below). Periods are never re-derived from text
  after the reading, so a period the admin picked is kept. Update each row's
  `position` and `sort`.
- **Rate sheet:**
  - build it with `rateSheetText({ agency, solicitationNumber, lines, priced: priceLines(...) })`;
  - then upsert the `deliverables` row (`submission_id`, `deliverable_type = 'rate_sheet'`, `content`, `prepared_by = member.id`): update if one exists for the bid, else insert;
  - insert an `audit_log` row `{submission_id, org_id, actor_id: member.id, event_type: "rate_sheet_updated", event_detail: {lines: n, total}}` (use the column names the existing `audit_log` inserts use, e.g. in `app/api/withdraw-assigned-match`);
  - **needsConfirm:** return it when the stage is any stage after `in_review` in the app's stage order (read it from `LifecycleStepper`'s `stageNumber`: `stageNumber(stage) > stageNumber("in_review")`).

**Ruling:** the spec's automatic period assignment runs only on what the
reading returns. An admin's period choice is stored and kept, so positions
(and so shares) follow the stored periods. The cost if wrong: an admin who
wants a period re-derived must pick it again.

Add to `lib/clins/parse.ts`, splitting `assignPeriodsAndPositions` into
periods, then `assignPositions`:
```ts
export function assignPositions(lines: ClinLine[]): ClinLine[] {
  const key = (p: number | null) => (p === null ? 99 : p);
  const sorted = [...lines].sort((a, b) => key(a.period_index) - key(b.period_index) || a.clin.localeCompare(b.clin));
  const counters = new Map<number | null, number>();
  return sorted.map((l, i) => {
    const n = (counters.get(l.period_index) ?? 0) + 1;
    counters.set(l.period_index, n);
    return { ...l, position: n, sort: i };
  });
}
```
`assignPeriodsAndPositions` then becomes `assignPositions(lines.map((l) => ({ ...l, period_index: periodIndex(l.clin, l.description, all), position: 0, sort: 0 })))`.

Test first, in `parse.test.ts`:
```ts
test("positions follow the stored periods (an admin-set period is kept)", () => {
  const base = { description: "Janitorial", quantity: 12, unit: "MO", unit_kind: "month" as const, quote: null, page: null, source_file: null, quote_status: "admin" as const, revised_by: null, unit_price_override: null, position: 0, sort: 0 };
  const out = assignPositions([{ ...base, clin: "00002", period_index: 1 }, { ...base, clin: "00001", period_index: 0 }]);
  assert.deepEqual(out.map((l) => [l.clin, l.period_index, l.position, l.sort]), [["00001", 0, 1, 0], ["00002", 1, 1, 1]]);
});
```

- [ ] **Step 3: Verify** with `npx tsc --noEmit -p .` and `npm test`.

- [ ] **Step 4: Commit** "CLIN pricing: edit lines, set the split, write the Rate sheet (/api/clin-lines)".

---

### Task 7: The CLIN pricing panel on the bid page

**Files:**
- Create: `app/admin/inbox/[id]/ClinPricingPanel.tsx`
- Modify: `app/admin/inbox/[id]/page.tsx`

**Interfaces:**
- Consumes: `/api/clin-scan`, `/api/clin-lines`; `priceLines` (client-side, for live totals); `ConfirmDialog`; `rfpDocumentUrls` (for `#page=` links, the same as ChecklistSuggestionsPanel).

- [ ] **Step 1: Build the panel:**
  - **Load:** GET `/api/clin-lines` on mount. Poll every 3 s while `scan.status === "running"`, as the checklist panel does. Refresh after every edit.
  - **Header:** "CLIN pricing". Status text:
    - "Reading the price table…";
    - "Read <time>" + **Read again** (POST `/api/clin-scan` `{force: true}`);
    - "No price table found in the uploaded files.";
    - the failure text with **Read again**.
  - **Before any reading** (`scan === null`), show **Read the price table**.
  - **Excel notice:** "A price schedule may be in <names>, which can't be read here. Add those lines by hand."
  - **Guidance lines, only when they apply:**
    - "Enter a bid price on the wage worksheet to price these lines." (no_bid);
    - "Enter <client>'s yearly increase % (in <client>'s numbers above) to price the option years." (no_increase);
    - the `sharesProblem` text;
    - "N lines need a unit price typed (not priced per month or year).".
  - **Table:** columns CLIN | Description | Qty | Unit | Period | Split % | Unit price | Amount | (Remove).
    - CLIN, Description, Qty and Unit are inline text inputs; blur saves via PATCH.
    - Period is a `<select>`: Base, Option 1–4, "?".
    - Split % is a number input only on base-period lines in a period with more than one line; option-year lines show the carried share as text.
    - Unit price is text; typing sets `unit_price_override` (blank clears it); a typed price shows "typed".
    - Under each line, in small text: the quote (italic), a page link, and badges ("Quote verified" / "Quote not found" / "Couldn't verify: scanned document" / "Revised by <file>" / "Added by you").
  - **Highlighting:** only lines with a `problem`, or a quote status of `not_found` / `unreadable`, get `border-error bg-error-container/20` on the relevant cell.
  - **Bottom:** "Total (base + all option years): $X", or "Total: N lines not priced yet". Then **+ Add a line** and **Update the Rate sheet**.
    - If the response is `needsConfirm`, show a `ConfirmDialog`: "The client can already see this package. Update the Rate sheet anyway?", then re-POST with `confirm: true`.
    - Then a toast: "Rate sheet updated — review it under Deliverables."
- [ ] **Step 2: Mount** the panel in `page.tsx`, right after the `WageWorksheet` block, under the same federal condition: `<ClinPricingPanel submissionId={submission.id} rfpDocumentUrls={rfpDocumentUrls} />`.
- [ ] **Step 3: Verify** with `npx tsc --noEmit -p .`.
- [ ] **Step 4: Commit** "CLIN pricing: the panel on the bid page".

---

### Task 8: The Rate sheet in the package

**Files:**
- Modify: `app/admin/inbox/[id]/DeliverablesPanel.tsx`, `app/admin/inbox/[id]/page.tsx`, `app/api/advance-if-deliverables-complete/route.ts`, `app/api/generate-draft/route.ts`

- [ ] **Step 1:**
  - **`page.tsx`:** count the bid's `clin_lines` (`select("id", { count: "exact", head: true })`) and pass `hasClins={count > 0}` to `DeliverablesPanel`.
  - **`DeliverablesPanel.tsx`:**
    - add a `hasClins: boolean` prop;
    - the sticky lean state becomes `useState(() => isLeanPackage(initialDeliverables.map((d) => d.deliverable_type), hasClins))`;
    - the full list becomes `getRequiredDeliverableTypes("full", hasClins)` mapped to `{value, label}`, the same as the existing constant mapping.
  - **`advance-if-deliverables-complete/route.ts`:** replace the hardcoded `REQUIRED_TYPES` with
    ```ts
    const { count: clinCount } = await supabase.from("clin_lines").select("id", { count: "exact", head: true }).eq("submission_id", submissionId);
    const REQUIRED_TYPES = getRequiredDeliverableTypes("full", (clinCount ?? 0) > 0);
    ```
    (move it inside the handler, and keep the rest unchanged).
  - **`generate-draft/route.ts`:** for `rate_sheet`, when the bid has `clin_lines`, return the CLIN table instead of the template. Use `loadClinContext` + `priceLines` + `rateSheetText` (Review Focus #5).
- [ ] **Step 2:** Add a test to `lib/deliverables/package-routing.test.ts` pinning the advance rule: `getRequiredDeliverableTypes("full", true).includes("rate_sheet") === true`. It's already covered in Task 4; confirm it and skip if it's duplicate. Run `npm test` and `npx tsc --noEmit -p .`.
- [ ] **Step 3: Commit** "CLIN pricing: federal full packages include the Rate sheet; draft uses the CLIN table".

---

### Task 9: End-to-end check on dev

- [ ] **Step 1:** Using the e2e helper pattern from the client-pricing run (reset exactly one admin and one client password, list-then-count; create test bids for Sunrise Janitorial), upload **the real JDMTA Amendment 1 PDF** to a new federal test bid, and check:
  1. The CLIN panel shows "Reading the price table…", then 5 lines (0001, 1001–4001), each "Quote verified", with periods Base and Option 1–4 and 12 MO.
  2. With no bid price, every line is blank with the "Enter a bid price on the wage worksheet…" guidance.
  3. After the worksheet's bid price is set to $90,000 and the client's yearly increase to 3, the prices are $7,500.00 / $90,000.00 … and the total matches the hand calculation `90000 × (1 + 1.03 + 1.03² + 1.03³ + 1.03⁴)`, rounded per line.
  4. **Lake Tahoe PDF on a second bid:** two lines per period. The split guidance shows; entering 40 / 60 prices all lines, and the option years carry the split.
  5. "Update the Rate sheet" means the Deliverables panel shows four deliverables (full package) and the Rate sheet content is the table.
  6. With the yearly increase cleared, "Update the Rate sheet" puts placeholders in the Rate sheet, and "advance when complete" refuses with `has_placeholders`.
  7. Typing a unit price on one line is kept after **Read again**.
- [ ] **Step 2:** Ledger the results and the admin time from the upload to a finished table. Screenshot the panel and the Rate sheet.
- [ ] **Step 3:** Final review, then rollout as before: the user runs `! npx supabase db push` and the reload, then merge, push, and the deploy check.
