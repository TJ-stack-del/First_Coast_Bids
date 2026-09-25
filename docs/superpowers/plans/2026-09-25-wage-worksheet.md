# Wage Worksheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On a federal service bid, show an admin a pre-filled worksheet that fetches the Service Contract Act wage determination, computes the legal labor-cost floor with plain code, and warns when the bid price is below it. Confirming it should take about 2–3 minutes.

**Architecture:**
- **Pure, tested modules in `lib/wage/`:**
  - WD reference parsing;
  - WD document parsing;
  - the floor calculator;
  - pre-fill;
  - input sanitising.
- **Server code:**
  - a small fetch helper for SAM.gov's public website endpoints;
  - one admin route that creates/loads the worksheet (`POST`) and saves edits (`PATCH`).
- **UI:** a client component that recomputes the floor live and autosaves.
- **Settings:** a default position and production rate per trade, plus business-wide pricing defaults.

**Tech Stack:** Next.js 15 App Router, Supabase (Postgres/RLS), TypeScript (`strict: false`), `node --test`.

**Spec:** `docs/superpowers/specs/2026-09-25-wage-worksheet-design.md`

## Global Constraints

- **The user's hard constraint:** one person, 48-hour turnaround. The worksheet opens pre-filled. The only field that may start empty is hours, and only when the solicitation gave no square footage (it's then highlighted).
- **No AI in any number.**
  - WD values come from parsing the WD text.
  - Money comes from the formulas below.
  - Everything else comes from the admin's own settings or the solicitation's extracted facts.
- **Formulas, exactly as specified.** 52 weeks, in full precision, rounded to cents only for display and storage of totals:
  - wage = `max(rate, eo13658Min)` if the EO 13658 box is ticked, else `rate`;
  - annualHours = `workers × hoursPerWeek × 52`;
  - wages = `annualHours × wage`;
  - hw = `workers × min(hoursPerWeek,40) × 52 × hwRate`;
  - holidays = `workers × holidays × 8 × (min(hoursPerWeek,40)/40) × wage`;
  - vacation = `workers × vacationWeeks × min(hoursPerWeek,40) × wage` (when includeVacation);
  - sick = `min(annualHours/30, 56 × workers) × wage` (when the WD states EO 13706);
  - fica = `0.0765 × (wages + holidays + vacation + sick)`;
  - floor = the sum of all the above;
  - price = `(floor + supplies) × (1 + overhead%) × (1 + profit%)`, where supplies = `floor × pct/100` or a flat `$`.
- **SAM.gov public website endpoints** (no key; they don't touch the scraper's quota):
  - WD text: `GET https://sam.gov/api/prod/wdol/v1/wd/<number>/<revision>` with `Accept: application/hal+json`; the text is in the `document` field.
  - Latest revision: `GET https://sam.gov/api/prod/sgs/v1/search/?index=wd&q=<number>&page=0&size=5&mode=search` → `_embedded.results[].revisionNumber` for the matching `fullReferenceNumber`.
- **Admin only:** RLS on `wage_worksheets`, and the route checks `team_members.role = 'admin'`.
- **Tests:** relative `.ts` imports in `lib/` test files. Run `npm test` and `npx tsc --noEmit -p .` after every task.
- **Commits:** end every message with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01VxaQ43PbCfwewBqBw5t8Dd
  ```
- **Branch:** `wage-worksheet` (it holds the spec).
- **Supabase link:**
  - The link is normally production (`rixsgnbivayeaxbdseij`); dev is `hvrwxcyqgjobrgpcequj`.
  - Relink production after dev work.
  - Nothing is written to production without the user's yes.
- **Pages must compile:** after UI tasks, `curl` the admin page and check 307, not 500. Client components must not import `node:` modules.

## Review Focus

1. **A WD text where a rate line has a footnote column or an asterisk** (`11150 - Janitor   1   17.04`, `17.04*`) must still parse the rate, not drop the line. Tested in Task 2.
2. **Blank, zero, negative or non-number inputs** (hours cleared while typing, `"abc"`, `-5`) must never produce `NaN` or a negative floor on screen or in the database. Covered by `sanitizeLines` in Task 5, which the UI and the route both use.
3. **A trade default position code missing from this WD** (e.g. the Georgia WD has no such code) shows a clear message and the WD's list to pick from, not an empty worksheet. Tested in Task 4 (pre-fill returns `missingCode`).
4. **The solicitation names no revision** → the latest revision is used, and `wd_revision_source = 'latest'` produces a visible warning. Tested via `parseWdReference` (Task 4) and the route (Task 7, e2e in Task 9).
5. **Autosave while the admin keeps typing** must not lose the last edit or save stale values over newer ones. Handled in Task 8 (debounce that always sends the latest state), checked in Task 9.

---

## File Structure

**Create:**
- `supabase/migrations/20260925150000_add_wage_worksheets.sql`
- `lib/wage/fixtures/wd-2015-4539-r32.txt`, `lib/wage/fixtures/wd-2015-4523-r36.txt` (public-domain WD texts)
- `lib/wage/parse-wd.ts` (+ test): `parseWd`, `ParsedWd`
- `lib/wage/floor.ts` (+ test): `computeFloor`, `computePrice`, types
- `lib/wage/prefill.ts` (+ test): `parseWdReference`, `prefillLines`, `sanitizeLines`
- `lib/wage/fetch-wd.ts`: `fetchWdText`, `extractWdDocument` (the pure part is tested in `fetch-wd.test.ts`)
- `app/api/wage-worksheet/route.ts` (`POST` create/load, `PATCH` save)
- `app/admin/inbox/[id]/WageWorksheet.tsx`
- `app/admin/settings/PricingDefaultsForm.tsx`

**Modify:**
- `lib/trades/types.ts`, `lib/trades/validate.ts`: the two new trade fields.
- `app/api/admin/trades/route.ts`: save the two new fields.
- `app/admin/settings/TradeForm.tsx`, `app/admin/settings/page.tsx`.
- `lib/bid-estimation.ts`: the `service_days_per_week` fact.
- `app/admin/inbox/[id]/page.tsx`: mount the worksheet.

---

### Task 1: Migration, applied to dev

**Files:**
- Create: `supabase/migrations/20260925150000_add_wage_worksheets.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Wage worksheet (docs/superpowers/specs/2026-09-25-wage-worksheet-design.md):
-- the labor-cost floor for a federal service bid, from its Service Contract
-- Act wage determination, pre-filled from per-trade and business defaults.

create table public.wage_worksheets (
  submission_id uuid primary key references public.submissions(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  wd_number text not null,
  wd_revision integer not null,
  wd_revision_source text not null check (wd_revision_source in ('solicitation','latest','manual')),
  wd_text text not null,
  wd_parsed jsonb not null,
  lines jsonb not null default '[]'::jsonb,
  options jsonb not null default '{"includeVacation": true, "eo13658": false}'::jsonb,
  supplies_mode text not null default 'percent' check (supplies_mode in ('percent','flat')),
  supplies_value numeric not null default 0,
  overhead_pct numeric not null default 0,
  profit_pct numeric not null default 0,
  bid_price numeric,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.team_members(id) on delete set null
);

alter table public.wage_worksheets enable row level security;
create policy "admins manage wage_worksheets" on public.wage_worksheets
  using (public.is_admin(org_id))
  with check (public.is_admin(org_id));
grant select, insert, update on public.wage_worksheets to authenticated;

-- Per-trade defaults that pre-fill the worksheet (set once in Settings).
alter table public.trades
  add column wd_position_code text,
  add column production_rate_sqft_per_hour numeric;

-- Business-wide pricing defaults (set once in Settings).
-- {suppliesMode, suppliesValue, overheadPct, profitPct, includeVacation, serviceDaysPerWeek}
alter table public.organizations
  add column pricing_defaults jsonb not null default '{}'::jsonb;
```

- [ ] **Step 2: Dry-run and apply to dev, then relink production**

```bash
cat supabase/.temp/project-ref                        # expect rixsgnbivayeaxbdseij
npx supabase link --project-ref hvrwxcyqgjobrgpcequj
npx supabase db push --dry-run                        # must list ONLY 20260925150000_add_wage_worksheets.sql
npx supabase db push --yes
npx supabase link --project-ref rixsgnbivayeaxbdseij
cat supabase/.temp/project-ref                        # expect rixsgnbivayeaxbdseij
```

- [ ] **Step 3: Verify on dev over REST**

```bash
set -a; . ./.env.local; set +a
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/wage_worksheets?select=submission_id&limit=1" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/trades?select=wd_position_code,production_rate_sqft_per_hour&limit=1" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/organizations?select=pricing_defaults&limit=1" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

Expected:
- `[]`;
- rows with `null` for both trade fields;
- `[{"pricing_defaults":{}}]`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260925150000_add_wage_worksheets.sql
git commit -m "Add wage_worksheets, trade pricing defaults, business pricing defaults" -m "<attribution lines>"
```

---

### Task 2: WD fixtures and parser

**Files:**
- Create:
  - `lib/wage/fixtures/wd-2015-4539-r32.txt`, `lib/wage/fixtures/wd-2015-4523-r36.txt`;
  - `lib/wage/fetch-wd.ts` (just `extractWdDocument` in this task);
  - `lib/wage/fetch-wd.test.ts`;
  - `lib/wage/parse-wd.ts`, `lib/wage/parse-wd.test.ts`.

**Interfaces:**
- Produces:
  - `function extractWdDocument(rawJson: string): { number: string; revision: number; text: string }` (throws on bad input);
  - `type WdPosition = { code: string; title: string; rate: number; footnote: string | null }`;
  - `type ParsedWd = { number: string; revision: number; revisedOn: string | null; state: string | null; area: string | null; positions: WdPosition[]; hwPerHour: number; hwEo13706PerHour: number | null; vacationWeeks: number | null; holidays: number | null; eo13658Min: number | null; paidSickLeave: boolean }`;
  - `function parseWd(text: string): { ok: boolean; wd: ParsedWd | null; missing: string[] }`.

- [ ] **Step 1: Save the two real WD texts as fixtures** (one-off download; the WD texts are public-domain federal documents)

```bash
mkdir -p lib/wage/fixtures
for ref in "2015-4539/32:wd-2015-4539-r32" "2015-4523/36:wd-2015-4523-r36"; do
  curl -s "https://sam.gov/api/prod/wdol/v1/wd/${ref%%:*}" -H "Accept: application/hal+json" -o "/tmp/${ref##*:}.json"
  node -e 'const raw=require("fs").readFileSync(process.argv[1],"utf8"); const d=JSON.parse(raw.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,"")); require("fs").writeFileSync(process.argv[2], d.document.replace(/^"|"$/g,"").trim()+"\n")' "/tmp/${ref##*:}.json" "lib/wage/fixtures/${ref##*:}.txt"
done
wc -l lib/wage/fixtures/*.txt
grep -n "11150 - Janitor" lib/wage/fixtures/*.txt
```

Expected: about 675 lines each. Janitor is `17.04` in 4539 and `14.30` in 4523.

If the JSON parse fails because of raw newlines in the string, change the `replace` so it also escapes `\n`/`\r` inside the string: `.replace(/\r?\n/g,"\\n")`. Then re-run. Log a ruling.

- [ ] **Step 2: Write the failing tests**

`lib/wage/fetch-wd.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { extractWdDocument } from "./fetch-wd.ts";

test("the WD text is taken from SAM.gov's JSON, with control characters and wrapping quotes handled", () => {
  const raw = '{"fullReferenceNumber":"2015-4539","revisionNumber":32,"document":"\\"\\n\\nREGISTER OF WAGE DETERMINATIONS\\n11150 - Janitor   17.04\\n\\""}';
  const out = extractWdDocument(raw);
  assert.equal(out.number, "2015-4539");
  assert.equal(out.revision, 32);
  assert.match(out.text, /^REGISTER OF WAGE DETERMINATIONS\n11150 - Janitor/);
});

test("raw control characters inside the document string don't break it", () => {
  const raw = '{"fullReferenceNumber":"2015-4539","revisionNumber":32,"document":"line one\nline two"}';
  assert.equal(extractWdDocument(raw).text, "line one\nline two");
});

test("non-WD JSON throws", () => {
  assert.throws(() => extractWdDocument('{"title":"Not Found","status":404}'));
  assert.throws(() => extractWdDocument("not json"));
});
```

`lib/wage/parse-wd.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseWd } from "./parse-wd.ts";

const FL = readFileSync(new URL("./fixtures/wd-2015-4539-r32.txt", import.meta.url), "utf8");
const GA = readFileSync(new URL("./fixtures/wd-2015-4523-r36.txt", import.meta.url), "utf8");

test("the Jacksonville-area WD parses completely", () => {
  const { ok, wd, missing } = parseWd(FL);
  assert.equal(ok, true, missing.join(", "));
  assert.equal(wd!.number, "2015-4539");
  assert.equal(wd!.revision, 32);
  assert.equal(wd!.revisedOn, "8/27/2026");
  assert.equal(wd!.state, "Florida");
  assert.equal(wd!.area, "Florida Counties of Baker, Clay, Duval, Nassau and Saint Johns");
  assert.equal(wd!.positions.length, 346);
  assert.deepEqual(wd!.positions.find((p) => p.code === "11150"), { code: "11150", title: "Janitor", rate: 17.04, footnote: null });
  assert.equal(wd!.positions.find((p) => p.code === "11210")!.rate, 17.94);
  assert.equal(wd!.hwPerHour, 5.92);
  assert.equal(wd!.hwEo13706PerHour, 5.42);
  assert.equal(wd!.vacationWeeks, 2);
  assert.equal(wd!.holidays, 11);
  assert.equal(wd!.eo13658Min, 13.65);
  assert.equal(wd!.paidSickLeave, true);
});

test("the Georgia WD parses, with its own rates", () => {
  const { ok, wd } = parseWd(GA);
  assert.equal(ok, true);
  assert.equal(wd!.number, "2015-4523");
  assert.equal(wd!.positions.find((p) => p.code === "11150")!.rate, 14.3);
  assert.equal(wd!.area, "Georgia Counties of Appling, Bacon, Jeff Davis and Wayne");
});

test("section headings without a rate are not positions", () => {
  const { wd } = parseWd(FL);
  assert.equal(wd!.positions.some((p) => p.code === "11000"), false);
});

test("footnote columns and asterisks don't lose the rate", () => {
  const text = FL.replace(/^11150 - Janitor\s+17\.04$/m, "11150 - Janitor                                          1     17.04*");
  const { wd } = parseWd(text);
  assert.deepEqual(wd!.positions.find((p) => p.code === "11150"), { code: "11150", title: "Janitor", rate: 17.04, footnote: "1" });
});

test("a truncated WD fails validation and names what's missing", () => {
  const { ok, wd, missing } = parseWd(FL.slice(0, 2000));
  assert.equal(ok, false);
  assert.equal(wd, null);
  assert.ok(missing.includes("health & welfare rate"));
});
```

Run: `node --experimental-strip-types --test lib/wage/fetch-wd.test.ts lib/wage/parse-wd.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Write `lib/wage/fetch-wd.ts`** (the pure part now; the network part is added in Task 6)

```ts
// Fetching Service Contract Act wage determinations from SAM.gov's public
// website endpoints (no API key; these don't count against the scraper's
// quota). extractWdDocument is the pure part: SAM.gov returns JSON whose
// "document" field holds the WD text, sometimes with raw control characters
// and wrapping quotes.

export function extractWdDocument(rawJson: string): { number: string; revision: number; text: string } {
  // Raw newlines/tabs inside the JSON string are invalid JSON: escape them.
  const cleaned = rawJson.replace(/[\u0000-\u001f]/g, (c) =>
    c === "\n" ? "\\n" : c === "\r" ? "\\r" : c === "\t" ? "\\t" : ""
  );
  const d = JSON.parse(cleaned) as { fullReferenceNumber?: unknown; revisionNumber?: unknown; document?: unknown };
  if (typeof d.fullReferenceNumber !== "string" || typeof d.revisionNumber !== "number" || typeof d.document !== "string") {
    throw new Error("SAM.gov didn't return a wage determination.");
  }
  const text = d.document.replace(/^\s*"/, "").replace(/"\s*$/, "").trim();
  return { number: d.fullReferenceNumber, revision: d.revisionNumber, text };
}
```

- [ ] **Step 4: Write `lib/wage/parse-wd.ts`**

```ts
// Reads a Service Contract Act wage determination (the fixed Department of
// Labor text layout) with plain code -- never AI -- because every value here
// becomes money. Verified against two real WDs (2015-4539 Rev. 32,
// Jacksonville area; 2015-4523 Rev. 36, Georgia). If anything required is
// missing, nothing is returned: the worksheet never shows half-read numbers.

export type WdPosition = { code: string; title: string; rate: number; footnote: string | null };

export type ParsedWd = {
  number: string;
  revision: number;
  revisedOn: string | null;
  state: string | null;
  area: string | null;
  positions: WdPosition[];
  hwPerHour: number;
  hwEo13706PerHour: number | null;
  vacationWeeks: number | null;
  holidays: number | null;
  eo13658Min: number | null;
  paidSickLeave: boolean;
};

const WORD_NUMBERS: Record<string, number> = Object.fromEntries(
  "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty"
    .split(" ")
    .map((w, i) => [w, i])
);

function toNumber(word: string): number | null {
  if (/^\d+$/.test(word)) return Number(word);
  return WORD_NUMBERS[word.toLowerCase()] ?? null;
}

// "11150 - Janitor                     17.04"
// "11150 - Janitor              1      17.04*"   (footnote column, asterisk)
const POSITION_LINE = /^(\d{5}) - (.+?)\s{2,}(?:(\d+|\([^)]*\))\s+)?(\d+\.\d{2})\*?\s*$/gm;

export function parseWd(text: string): { ok: boolean; wd: ParsedWd | null; missing: string[] } {
  const flat = text.replace(/\s+/g, " ");
  const number = text.match(/Wage Determination No\.:\s*(\d{4}-\d{4})/)?.[1] ?? null;
  const revision = text.match(/Revision No\.:\s*(\d+)/)?.[1];
  const revisedOn = text.match(/Date Of Last Revision:\s*([\d/]+)/)?.[1] ?? null;
  const state = text.match(/^State:\s*(.+?)\s*$/m)?.[1] ?? null;
  const areaRaw = text.match(/^Area:\s*([\s\S]+?)\n\s*\n/m)?.[1];
  const area = areaRaw ? areaRaw.replace(/\s+/g, " ").trim() : null;

  const positions: WdPosition[] = [];
  POSITION_LINE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = POSITION_LINE.exec(text)) !== null) {
    positions.push({ code: m[1], title: m[2].trim(), rate: Number(m[4]), footnote: m[3] ?? null });
  }

  const hw = flat.match(/HEALTH & WELFARE:\s*\$(\d+\.\d{2}) per hour/);
  const hw13706 = flat.match(/HEALTH & WELFARE EO 13706:\s*\$(\d+\.\d{2}) per hour/);
  const vac = flat.match(/VACATION:\s*(\w+) weeks? paid vacation after (\w+) years?/i);
  const hol = flat.match(/HOLIDAYS:\s*A minimum of (\w+) paid holidays/i);
  const eo = flat.match(/Executive Order 13658[\s\S]{0,600}?at least \$(\d+\.\d{2}) per hour/);
  const paidSickLeave = /1 hour of paid sick leave for every 30 hours/i.test(flat);

  const missing: string[] = [];
  if (!number) missing.push("wage determination number");
  if (!revision) missing.push("revision number");
  if (positions.length === 0) missing.push("position rates");
  if (!hw) missing.push("health & welfare rate");
  if (missing.length > 0) return { ok: false, wd: null, missing };

  return {
    ok: true,
    missing: [],
    wd: {
      number: number!,
      revision: Number(revision),
      revisedOn,
      state,
      area,
      positions,
      hwPerHour: Number(hw![1]),
      hwEo13706PerHour: hw13706 ? Number(hw13706[1]) : null,
      vacationWeeks: vac ? toNumber(vac[1]) : null,
      holidays: hol ? toNumber(hol[1]) : null,
      eo13658Min: eo ? Number(eo[1]) : null,
      paidSickLeave,
    },
  };
}
```

- [ ] **Step 5: Run the tests, then typecheck**

Run: `node --experimental-strip-types --test lib/wage/fetch-wd.test.ts lib/wage/parse-wd.test.ts && npx tsc --noEmit -p .`
Expected: 8 pass, and the typecheck is clean.

If the position count differs from 346, investigate with `grep -cE "^[0-9]{5} - .*[0-9]+\.[0-9]{2}\*?\s*$" lib/wage/fixtures/wd-2015-4539-r32.txt`. Fix the parser, not the test, unless the fixture itself shows another number. In that case, correct the expected value and log a ruling.

- [ ] **Step 6: Commit**

```bash
git add lib/wage
git commit -m "Wage worksheet: read SCA wage determinations with plain code (real Jacksonville and Georgia WDs as fixtures)" -m "<attribution lines>"
```

---

### Task 3: The floor calculator

**Files:**
- Create: `lib/wage/floor.ts`, `lib/wage/floor.test.ts`

**Interfaces:**
- Consumes: `ParsedWd` (Task 2)
- Produces:
  - `type WorksheetLine = { code: string; title: string; rate: number; workers: number; hoursPerWeek: number; hoursSource: string | null }`
  - `type WorksheetOptions = { includeVacation: boolean; eo13658: boolean }`
  - `type FloorBreakdown = { wages: number; hw: number; holidays: number; vacation: number; sick: number; fica: number; floor: number; annualHours: number; wage: number }`
  - `function computeLine(line: WorksheetLine, wd: ParsedWd, options: WorksheetOptions): FloorBreakdown`
  - `function computeFloor(lines: WorksheetLine[], wd: ParsedWd, options: WorksheetOptions): { lines: FloorBreakdown[]; total: FloorBreakdown }`
  - `type PricingInputs = { suppliesMode: "percent" | "flat"; suppliesValue: number; overheadPct: number; profitPct: number }`
  - `function computePrice(floor: number, p: PricingInputs): { supplies: number; price: number }`
  - `function belowFloor(bidPrice: number | null, floor: number): number | null` (the shortfall, or null)
  - `function roundCents(n: number): number`

- [ ] **Step 1: Write the failing tests, `lib/wage/floor.test.ts`**

The expected numbers are worked out by hand from the spec's formulas.

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeLine, computeFloor, computePrice, belowFloor, roundCents } from "./floor.ts";
import type { ParsedWd } from "./parse-wd.ts";

const WD: ParsedWd = {
  number: "2015-4539", revision: 32, revisedOn: null, state: "Florida", area: null,
  positions: [{ code: "11150", title: "Janitor", rate: 17.04, footnote: null }],
  hwPerHour: 5.92, hwEo13706PerHour: 5.42, vacationWeeks: 2, holidays: 11, eo13658Min: 13.65, paidSickLeave: true,
};
const ON = { includeVacation: true, eo13658: false };
const janitors = (workers: number, hoursPerWeek: number) => ({ code: "11150", title: "Janitor", rate: 17.04, workers, hoursPerWeek, hoursSource: null });

test("two full-time janitors on the Jacksonville WD (worked by hand)", () => {
  const r = computeLine(janitors(2, 40), WD, ON);
  assert.equal(r.annualHours, 4160);
  assert.equal(roundCents(r.wages), 70886.4);
  assert.equal(roundCents(r.hw), 24627.2);
  assert.equal(roundCents(r.holidays), 2999.04);
  assert.equal(roundCents(r.vacation), 2726.4);
  assert.equal(roundCents(r.sick), 1908.48, "sick leave capped at 56 h per worker");
  assert.equal(roundCents(r.fica), 6006.8);
  assert.equal(roundCents(r.floor), 109154.32);
});

test("a part-time janitor is prorated (20 h/week)", () => {
  const r = computeLine(janitors(1, 20), WD, ON);
  assert.equal(roundCents(r.hw), 6156.8);
  assert.equal(roundCents(r.holidays), 749.76);
  assert.equal(roundCents(r.vacation), 681.6);
  assert.equal(roundCents(r.sick), 590.72, "1 h per 30 worked, under the cap");
  assert.equal(roundCents(r.floor), 27410.87);
});

test("health & welfare, holidays and vacation stop at 40 hours a week", () => {
  const r45 = computeLine(janitors(1, 45), WD, ON);
  const r40 = computeLine(janitors(1, 40), WD, ON);
  assert.equal(r45.hw, r40.hw);
  assert.equal(r45.holidays, r40.holidays);
  assert.equal(r45.vacation, r40.vacation);
  assert.ok(r45.wages > r40.wages);
});

test("vacation off removes vacation; EO 13658 only raises a rate below its minimum", () => {
  assert.equal(computeLine(janitors(1, 40), WD, { includeVacation: false, eo13658: false }).vacation, 0);
  const low = { ...janitors(1, 40), rate: 12.0 };
  assert.equal(computeLine(low, WD, { includeVacation: true, eo13658: true }).wage, 13.65);
  assert.equal(computeLine(janitors(1, 40), WD, { includeVacation: true, eo13658: true }).wage, 17.04);
  assert.equal(computeLine(low, WD, ON).wage, 12.0, "box unticked: the listed rate");
});

test("no paid sick leave when the WD doesn't state EO 13706", () => {
  assert.equal(computeLine(janitors(1, 40), { ...WD, paidSickLeave: false }, ON).sick, 0);
});

test("missing WD holidays/vacation count as zero, never NaN", () => {
  const r = computeLine(janitors(1, 40), { ...WD, holidays: null, vacationWeeks: null }, ON);
  assert.equal(r.holidays, 0);
  assert.equal(r.vacation, 0);
  assert.ok(Number.isFinite(r.floor));
});

test("computeFloor totals the lines", () => {
  const { total, lines } = computeFloor([janitors(2, 40), janitors(1, 20)], WD, ON);
  assert.equal(lines.length, 2);
  assert.equal(roundCents(total.floor), roundCents(109154.32448 + 27410.87152));
});

test("price = (floor + supplies) x (1 + overhead) x (1 + profit)", () => {
  const p = computePrice(109154.32448, { suppliesMode: "percent", suppliesValue: 8, overheadPct: 10, profitPct: 10 });
  assert.equal(roundCents(p.supplies), 8732.35);
  assert.equal(roundCents(p.price), 142642.87);
  const flat = computePrice(100000, { suppliesMode: "flat", suppliesValue: 5000, overheadPct: 0, profitPct: 0 });
  assert.equal(flat.price, 105000);
});

test("below-floor shortfall", () => {
  assert.equal(belowFloor(100000, 109154.32), 9154.32);
  assert.equal(belowFloor(120000, 109154.32), null);
  assert.equal(belowFloor(null, 109154.32), null);
});
```

Run: `node --experimental-strip-types --test lib/wage/floor.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 2: Write `lib/wage/floor.ts`**

```ts
import type { ParsedWd } from "./parse-wd.ts";

// The legal labor-cost floor for a Service Contract Act bid: plain-code
// arithmetic over the wage determination (spec:
// docs/superpowers/specs/2026-09-25-wage-worksheet-design.md). 52 weeks;
// full precision throughout, rounded to cents only for display/storage.

export type WorksheetLine = {
  code: string;
  title: string;
  rate: number;
  workers: number;
  hoursPerWeek: number;
  hoursSource: string | null;
};
export type WorksheetOptions = { includeVacation: boolean; eo13658: boolean };
export type FloorBreakdown = {
  wages: number;
  hw: number;
  holidays: number;
  vacation: number;
  sick: number;
  fica: number;
  floor: number;
  annualHours: number;
  wage: number;
};
export type PricingInputs = { suppliesMode: "percent" | "flat"; suppliesValue: number; overheadPct: number; profitPct: number };

const WEEKS = 52;
const FICA = 0.0765;
const SICK_HOURS_PER_WORKED = 1 / 30;
const SICK_CAP_PER_WORKER = 56;

export function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeLine(line: WorksheetLine, wd: ParsedWd, options: WorksheetOptions): FloorBreakdown {
  const wage = options.eo13658 && wd.eo13658Min !== null ? Math.max(line.rate, wd.eo13658Min) : line.rate;
  const capped = Math.min(line.hoursPerWeek, 40);
  const annualHours = line.workers * line.hoursPerWeek * WEEKS;
  const wages = annualHours * wage;
  const hw = line.workers * capped * WEEKS * wd.hwPerHour;
  const holidays = line.workers * (wd.holidays ?? 0) * 8 * (capped / 40) * wage;
  const vacation = options.includeVacation ? line.workers * (wd.vacationWeeks ?? 0) * capped * wage : 0;
  const sick = wd.paidSickLeave ? Math.min(annualHours * SICK_HOURS_PER_WORKED, SICK_CAP_PER_WORKER * line.workers) * wage : 0;
  const fica = FICA * (wages + holidays + vacation + sick);
  return { wages, hw, holidays, vacation, sick, fica, floor: wages + hw + holidays + vacation + sick + fica, annualHours, wage };
}

export function computeFloor(
  lines: WorksheetLine[],
  wd: ParsedWd,
  options: WorksheetOptions
): { lines: FloorBreakdown[]; total: FloorBreakdown } {
  const each = lines.map((l) => computeLine(l, wd, options));
  const total = each.reduce(
    (t, r) => ({
      wages: t.wages + r.wages,
      hw: t.hw + r.hw,
      holidays: t.holidays + r.holidays,
      vacation: t.vacation + r.vacation,
      sick: t.sick + r.sick,
      fica: t.fica + r.fica,
      floor: t.floor + r.floor,
      annualHours: t.annualHours + r.annualHours,
      wage: 0,
    }),
    { wages: 0, hw: 0, holidays: 0, vacation: 0, sick: 0, fica: 0, floor: 0, annualHours: 0, wage: 0 }
  );
  return { lines: each, total };
}

export function computePrice(floor: number, p: PricingInputs): { supplies: number; price: number } {
  const supplies = p.suppliesMode === "percent" ? (floor * p.suppliesValue) / 100 : p.suppliesValue;
  const price = (floor + supplies) * (1 + p.overheadPct / 100) * (1 + p.profitPct / 100);
  return { supplies, price };
}

// How far a bid price is below the floor (per year), or null if it isn't.
export function belowFloor(bidPrice: number | null, floor: number): number | null {
  if (bidPrice === null || !Number.isFinite(bidPrice)) return null;
  const gap = roundCents(floor) - roundCents(bidPrice);
  return gap > 0 ? roundCents(gap) : null;
}
```

- [ ] **Step 3: Run the tests, then typecheck**

Run: `node --experimental-strip-types --test lib/wage/floor.test.ts && npx tsc --noEmit -p .`
Expected: 9 pass, and the typecheck is clean.

- [ ] **Step 4: Commit**

```bash
git add lib/wage/floor.ts lib/wage/floor.test.ts
git commit -m "Wage worksheet: labor-cost floor calculator (hand-checked against the Jacksonville WD)" -m "<attribution lines>"
```

---

### Task 4: Pre-fill, WD reference and input sanitising

**Files:**
- Create: `lib/wage/prefill.ts`, `lib/wage/prefill.test.ts`

**Interfaces:**
- Consumes: `ParsedWd` (Task 2); `WorksheetLine` (Task 3)
- Produces:
  - `function parseWdReference(text: string): { number: string; revision: number | null } | null`
  - `type PricingDefaults = { suppliesMode?: "percent" | "flat"; suppliesValue?: number; overheadPct?: number; profitPct?: number; includeVacation?: boolean; serviceDaysPerWeek?: number }`
  - `function prefillLines(input: { wd: ParsedWd; positionCode: string | null; productionRate: number | null; cleanableSqft: number | null; serviceDaysPerWeek: number | null; defaults: PricingDefaults }): { lines: WorksheetLine[]; missingCode: string | null; hoursNeeded: boolean }`
  - `function sanitizeLines(raw: unknown, wd: ParsedWd): WorksheetLine[]`
  - `function sanitizeNumber(v: unknown, fallback: number): number` (finite and ≥ 0, else the fallback)

- [ ] **Step 1: Write the failing tests, `lib/wage/prefill.test.ts`**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseWdReference, prefillLines, sanitizeLines, sanitizeNumber } from "./prefill.ts";
import type { ParsedWd } from "./parse-wd.ts";

const WD: ParsedWd = {
  number: "2015-4539", revision: 32, revisedOn: null, state: "Florida", area: null,
  positions: [
    { code: "11150", title: "Janitor", rate: 17.04, footnote: null },
    { code: "11210", title: "Laborer, Grounds Maintenance", rate: 17.94, footnote: null },
  ],
  hwPerHour: 5.92, hwEo13706PerHour: 5.42, vacationWeeks: 2, holidays: 11, eo13658Min: 13.65, paidSickLeave: true,
};

test("the checklist's WD label gives number and revision", () => {
  assert.deepEqual(parseWdReference("Price labor at or above Wage Determination 2015-4523 (Rev. 27)"), { number: "2015-4523", revision: 27 });
  assert.deepEqual(parseWdReference("WD 2015-4539"), { number: "2015-4539", revision: null });
  assert.equal(parseWdReference("no wage determination here"), null);
});

test("hours come from square footage, production rate and days; split into full-time workers", () => {
  const { lines, missingCode, hoursNeeded } = prefillLines({
    wd: WD, positionCode: "11150", productionRate: 3500, cleanableSqft: 45000, serviceDaysPerWeek: 5, defaults: {},
  });
  assert.equal(missingCode, null);
  assert.equal(hoursNeeded, false);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].rate, 17.04);
  assert.equal(lines[0].workers, 2, "64.29 h/week needs 2 workers");
  assert.equal(lines[0].hoursPerWeek, 32.14);
  assert.equal(lines[0].hoursSource, "from 45,000 sq ft at 3,500 sq ft/hr × 5 days");
});

test("service days fall back to the business default, then to 5", () => {
  const a = prefillLines({ wd: WD, positionCode: "11150", productionRate: 3000, cleanableSqft: 30000, serviceDaysPerWeek: null, defaults: { serviceDaysPerWeek: 3 } });
  assert.equal(a.lines[0].workers * a.lines[0].hoursPerWeek, 30);
  const b = prefillLines({ wd: WD, positionCode: "11150", productionRate: 3000, cleanableSqft: 30000, serviceDaysPerWeek: null, defaults: {} });
  assert.equal(b.lines[0].workers * b.lines[0].hoursPerWeek, 50);
});

test("no square footage (or no production rate): hours are left for the admin, flagged", () => {
  const { lines, hoursNeeded } = prefillLines({ wd: WD, positionCode: "11150", productionRate: null, cleanableSqft: 45000, serviceDaysPerWeek: 5, defaults: {} });
  assert.equal(hoursNeeded, true);
  assert.equal(lines[0].workers, 1);
  assert.equal(lines[0].hoursPerWeek, 0);
});

test("a default position missing from this WD is reported, not guessed", () => {
  const { lines, missingCode } = prefillLines({ wd: WD, positionCode: "99999", productionRate: 3500, cleanableSqft: 45000, serviceDaysPerWeek: 5, defaults: {} });
  assert.equal(missingCode, "99999");
  assert.deepEqual(lines, []);
});

test("sanitizing: blank, negative, text and unknown codes never become NaN or negative", () => {
  const out = sanitizeLines(
    [
      { code: "11150", workers: "", hoursPerWeek: "abc" },
      { code: "11210", workers: -3, hoursPerWeek: 20 },
      { code: "00000", workers: 1, hoursPerWeek: 40 },
      "junk",
    ],
    WD
  );
  assert.deepEqual(out.map((l) => [l.code, l.rate, l.workers, l.hoursPerWeek]), [
    ["11150", 17.04, 0, 0],
    ["11210", 17.94, 0, 20],
  ]);
  assert.equal(sanitizeNumber("12.5", 0), 12.5);
  assert.equal(sanitizeNumber(Infinity, 7), 7);
  assert.equal(sanitizeNumber(-1, 7), 7);
});
```

Run: `node --experimental-strip-types --test lib/wage/prefill.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 2: Write `lib/wage/prefill.ts`**

```ts
import type { ParsedWd } from "./parse-wd.ts";
import type { WorksheetLine } from "./floor.ts";

// Opening the worksheet already filled in (the user's hard constraint: one
// person, 48-hour turnaround). Every value comes from the solicitation's
// facts, the WD, or the admin's own standing settings -- never a guess.

export type PricingDefaults = {
  suppliesMode?: "percent" | "flat";
  suppliesValue?: number;
  overheadPct?: number;
  profitPct?: number;
  includeVacation?: boolean;
  serviceDaysPerWeek?: number;
};

// "Wage Determination 2015-4523 (Rev. 27)", "WD 2015-4539".
export function parseWdReference(text: string): { number: string; revision: number | null } | null {
  const m = text.match(/(\d{4}-\d{4})(?:\s*\(\s*Rev(?:ision)?\.?\s*(\d{1,3})\s*\))?/i);
  return m ? { number: m[1], revision: m[2] ? Number(m[2]) : null } : null;
}

export function sanitizeNumber(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

const fmt = (n: number) => n.toLocaleString("en-US");

export function prefillLines(input: {
  wd: ParsedWd;
  positionCode: string | null;
  productionRate: number | null;
  cleanableSqft: number | null;
  serviceDaysPerWeek: number | null;
  defaults: PricingDefaults;
}): { lines: WorksheetLine[]; missingCode: string | null; hoursNeeded: boolean } {
  const code = input.positionCode;
  const position = code ? input.wd.positions.find((p) => p.code === code) : undefined;
  if (code && !position) return { lines: [], missingCode: code, hoursNeeded: true };
  if (!position) return { lines: [], missingCode: null, hoursNeeded: true };

  const days = input.serviceDaysPerWeek ?? input.defaults.serviceDaysPerWeek ?? 5;
  if (!input.cleanableSqft || !input.productionRate) {
    return {
      lines: [{ code: position.code, title: position.title, rate: position.rate, workers: 1, hoursPerWeek: 0, hoursSource: null }],
      missingCode: null,
      hoursNeeded: true,
    };
  }
  const totalHours = (input.cleanableSqft / input.productionRate) * days;
  const workers = Math.max(1, Math.ceil(totalHours / 40));
  return {
    lines: [
      {
        code: position.code,
        title: position.title,
        rate: position.rate,
        workers,
        hoursPerWeek: Math.round((totalHours / workers) * 100) / 100,
        hoursSource: `from ${fmt(input.cleanableSqft)} sq ft at ${fmt(input.productionRate)} sq ft/hr × ${days} days`,
      },
    ],
    missingCode: null,
    hoursNeeded: false,
  };
}

// Lines as sent by the browser: rates always come from the WD (never the
// client), unknown codes are dropped, and numbers are finite and >= 0.
export function sanitizeLines(raw: unknown, wd: ParsedWd): WorksheetLine[] {
  if (!Array.isArray(raw)) return [];
  const out: WorksheetLine[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const position = wd.positions.find((p) => p.code === o.code);
    if (!position) continue;
    out.push({
      code: position.code,
      title: position.title,
      rate: position.rate,
      workers: sanitizeNumber(o.workers, 0),
      hoursPerWeek: sanitizeNumber(o.hoursPerWeek, 0),
      hoursSource: typeof o.hoursSource === "string" ? o.hoursSource : null,
    });
  }
  return out;
}
```

- [ ] **Step 3: Run the tests, then typecheck**

Run: `node --experimental-strip-types --test lib/wage/prefill.test.ts && npx tsc --noEmit -p .`
Expected: 6 pass, and the typecheck is clean.

Note that `sanitizeLines` drops the `-3` workers to 0 through the fallback, which the test expects. `hoursSource` is kept only if it's a string.

- [ ] **Step 4: Commit**

```bash
git add lib/wage/prefill.ts lib/wage/prefill.test.ts
git commit -m "Wage worksheet: pre-fill from facts and settings, WD reference parsing, input sanitising" -m "<attribution lines>"
```

---

### Task 5: Trade defaults and business pricing defaults in Settings

**Files:**
- Modify:
  - `lib/trades/types.ts`, `lib/trades/validate.ts`, `lib/trades/validate.test.ts`;
  - `app/api/admin/trades/route.ts`;
  - `app/admin/settings/TradeForm.tsx`, `app/admin/settings/TradesSettings.tsx`;
  - `app/admin/settings/page.tsx`.
- Create: `app/admin/settings/PricingDefaultsForm.tsx`

**Interfaces:**
- Produces:
  - `Trade.wdPositionCode: string | null`, `Trade.productionRate: number | null`;
  - the same two fields on `TradeInput`;
  - `TRADE_COLUMNS` includes `wd_position_code, production_rate_sqft_per_hour`.

- [ ] **Step 1: Write the failing test** (append to `lib/trades/validate.test.ts`)

```ts
test("wage-worksheet defaults: a 5-digit position code and a positive production rate", () => {
  const ok = normalizeTradeInput({ label: "Janitorial", keywords: ["janitorial"], wdPositionCode: " 11150 ", productionRate: "3500" });
  assert.equal(ok.wdPositionCode, "11150");
  assert.equal(ok.productionRate, 3500);
  assert.deepEqual(validateTrade(ok, []).errors, []);
  const bad = normalizeTradeInput({ label: "Janitorial", keywords: ["janitorial"], wdPositionCode: "1115", productionRate: "-2" });
  assert.ok(validateTrade(bad, []).errors.includes('Position code "1115" must be 5 digits, like 11150.'));
  assert.ok(validateTrade(bad, []).errors.includes("Production rate must be a positive number of square feet per hour."));
  const blank = normalizeTradeInput({ label: "Janitorial", keywords: ["janitorial"], wdPositionCode: "", productionRate: "" });
  assert.equal(blank.wdPositionCode, null);
  assert.equal(blank.productionRate, null);
});
```

Run: `node --experimental-strip-types --test lib/trades/validate.test.ts`
Expected: FAIL. The fields are undefined, and the first assertion gives `undefined !== "11150"`.

- [ ] **Step 2: Implement**

**`lib/trades/types.ts`:**
- Add `wdPositionCode: string | null; productionRate: number | null;` to `Trade`, and the same as optional fields to `TradeInput`.
- `TRADE_COLUMNS` becomes `"id, label, naics, nigp_codes, keywords, active, sort_order, wd_position_code, production_rate_sqft_per_hour"`.
- Add `wd_position_code: string | null; production_rate_sqft_per_hour: number | string | null;` to `TradeRow`.
- In `rowToTrade`, add:
  ```ts
    wdPositionCode: row.wd_position_code ?? null,
    productionRate: row.production_rate_sqft_per_hour === null || row.production_rate_sqft_per_hour === undefined ? null : Number(row.production_rate_sqft_per_hour),
  ```

**`lib/trades/validate.ts`**, in `normalizeTradeInput`'s returned object:
```ts
    wdPositionCode: typeof obj.wdPositionCode === "string" && obj.wdPositionCode.trim() ? obj.wdPositionCode.trim() : null,
    productionRate:
      obj.productionRate === "" || obj.productionRate === null || obj.productionRate === undefined
        ? null
        : Number(obj.productionRate),
```
Then in `validateTrade`, before the final return:
```ts
  if (input.wdPositionCode && !/^\d{5}$/.test(input.wdPositionCode)) {
    errors.push(`Position code "${input.wdPositionCode}" must be 5 digits, like 11150.`);
  }
  if (input.productionRate !== null && input.productionRate !== undefined && !(Number.isFinite(input.productionRate) && input.productionRate > 0)) {
    errors.push("Production rate must be a positive number of square feet per hour.");
  }
```
Update the existing "normalises…" test's expected object: it gains `wdPositionCode: null, productionRate: null`.

**`lib/trades/resort.ts` `applyTradeChange`:** add `wdPositionCode: change.wdPositionCode ?? null, productionRate: change.productionRate ?? null` to `updated`.

**`app/api/admin/trades/route.ts`:** add to `row`:
```ts
      wd_position_code: saved.wdPositionCode,
      production_rate_sqft_per_hour: saved.productionRate,
```

**`app/admin/settings/TradeForm.tsx`:**
- State:
  ```ts
  const [wdPositionCode, setWdPositionCode] = useState(initial?.wdPositionCode ?? "");
  const [productionRate, setProductionRate] = useState(initial?.productionRate?.toString() ?? "");
  ```
- Pass `wdPositionCode, productionRate` into `normalizeTradeInput({...})`.
- Add these fields before the keywords label:
  ```tsx
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-label-md font-bold text-on-surface">Wage worksheet position code</span>
          <span className="text-body-sm text-on-surface-variant">From the wage determination, e.g. 11150 (Janitor).</span>
          <input value={wdPositionCode} onChange={(e) => setWdPositionCode(e.target.value)} className={`${inputClass} font-code`} inputMode="numeric" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-label-md font-bold text-on-surface">Production rate (sq ft per hour)</span>
          <span className="text-body-sm text-on-surface-variant">Used to pre-fill hours from a bid&apos;s square footage.</span>
          <input value={productionRate} onChange={(e) => setProductionRate(e.target.value)} className={inputClass} inputMode="decimal" />
        </label>
      </div>
  ```

**`app/admin/settings/TradesSettings.tsx` `toggle()`:** include `wdPositionCode: t.wdPositionCode, productionRate: t.productionRate` in the `input` object.

- [ ] **Step 3: Write `app/admin/settings/PricingDefaultsForm.tsx`**

```tsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/Toast";
import type { PricingDefaults } from "@/lib/wage/prefill";
import { sanitizeNumber } from "@/lib/wage/prefill";

// Set once; every wage worksheet opens with these (one person, 48-hour
// turnaround -- nothing is re-typed per bid).
export function PricingDefaultsForm({ orgId, initial }: { orgId: string; initial: PricingDefaults }) {
  const supabase = createClient();
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [v, setV] = useState({
    suppliesMode: initial.suppliesMode ?? "percent",
    suppliesValue: String(initial.suppliesValue ?? ""),
    overheadPct: String(initial.overheadPct ?? ""),
    profitPct: String(initial.profitPct ?? ""),
    includeVacation: initial.includeVacation ?? true,
    serviceDaysPerWeek: String(initial.serviceDaysPerWeek ?? 5),
  });
  const input =
    "w-full px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const pricing_defaults: PricingDefaults = {
      suppliesMode: v.suppliesMode as "percent" | "flat",
      suppliesValue: sanitizeNumber(v.suppliesValue, 0),
      overheadPct: sanitizeNumber(v.overheadPct, 0),
      profitPct: sanitizeNumber(v.profitPct, 0),
      includeVacation: v.includeVacation,
      serviceDaysPerWeek: Math.min(7, sanitizeNumber(v.serviceDaysPerWeek, 5)),
    };
    const { error } = await supabase.from("organizations").update({ pricing_defaults }).eq("id", orgId);
    setSaving(false);
    showToast(error ? error.message : "Pricing defaults saved.", error ? "error" : "success");
  }

  return (
    <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1">
        <span className="text-label-md font-bold">Supplies</span>
        <div className="flex gap-2">
          <input value={v.suppliesValue} onChange={(e) => setV({ ...v, suppliesValue: e.target.value })} className={input} inputMode="decimal" />
          <select value={v.suppliesMode} onChange={(e) => setV({ ...v, suppliesMode: e.target.value as "percent" | "flat" })} className={input}>
            <option value="percent">% of labor</option>
            <option value="flat">$ per year</option>
          </select>
        </div>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-label-md font-bold">Overhead %</span>
        <input value={v.overheadPct} onChange={(e) => setV({ ...v, overheadPct: e.target.value })} className={input} inputMode="decimal" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-label-md font-bold">Profit %</span>
        <input value={v.profitPct} onChange={(e) => setV({ ...v, profitPct: e.target.value })} className={input} inputMode="decimal" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-label-md font-bold">Default service days per week</span>
        <input value={v.serviceDaysPerWeek} onChange={(e) => setV({ ...v, serviceDaysPerWeek: e.target.value })} className={input} inputMode="numeric" />
      </label>
      <label className="flex items-center gap-2 sm:col-span-2">
        <input type="checkbox" checked={v.includeVacation} onChange={(e) => setV({ ...v, includeVacation: e.target.checked })} />
        <span className="text-body-md">Include vacation in the labor floor (safer on successor contracts)</span>
      </label>
      <button type="submit" disabled={saving} className="sm:col-span-2 justify-self-start px-4 py-2 rounded-lg bg-primary text-on-primary text-label-md font-bold flex items-center gap-2 disabled:opacity-40">
        {saving && <Spinner />} Save pricing defaults
      </button>
    </form>
  );
}
```

**`app/admin/settings/page.tsx`:**
- Select `pricing_defaults` alongside `lean_package_threshold`.
- Import `PricingDefaultsForm`.
- After the Trades section, add:
  ```tsx
      <div className="mt-6 bg-surface-container-lowest border border-outline-variant rounded-xl p-6 max-w-3xl">
        <h2 className="text-title-lg text-primary mb-2">Pricing defaults</h2>
        <p className="text-body-md text-on-surface-variant mb-4">
          Every wage worksheet opens with these. Set them once; adjust per bid only when a job is different.
        </p>
        {org ? <PricingDefaultsForm orgId={org.id} initial={(org as any).pricing_defaults ?? {}} /> : null}
      </div>
  ```

- [ ] **Step 4: Test, typecheck, check the page compiles, commit**

Run: `npm test && npx tsc --noEmit -p .` (all pass), then `curl -s -o /dev/null -w "%{http_code}\n" localhost:3000/admin/settings`, which should give 307.

```bash
git add lib/trades app/api/admin/trades app/admin/settings
git commit -m "Settings: per-trade wage position and production rate; business pricing defaults" -m "<attribution lines>"
```

---

### Task 6: Fetching WDs, and the service-days fact

**Files:**
- Modify: `lib/wage/fetch-wd.ts`, `lib/bid-estimation.ts`

**Interfaces:**
- Produces:
  - `function fetchWdText(number: string, revision: number | null): Promise<{ text: string; revision: number; revisionSource: "solicitation" | "latest" }>`;
  - `BidEstimationFacts.service_days_per_week: number | null`.

- [ ] **Step 1: Add the network part to `lib/wage/fetch-wd.ts`**

```ts
const SAM = "https://sam.gov/api/prod";
const HEADERS = { Accept: "application/hal+json" };

// The latest revision of a WD, from SAM.gov's public search.
async function latestRevision(number: string): Promise<number> {
  const res = await fetch(`${SAM}/sgs/v1/search/?index=wd&q=${encodeURIComponent(number)}&page=0&size=5&mode=search`, { headers: HEADERS });
  if (!res.ok) throw new Error(`SAM.gov search failed (${res.status}).`);
  const body = (await res.json()) as { _embedded?: { results?: { fullReferenceNumber?: string; revisionNumber?: number }[] } };
  const hit = body._embedded?.results?.find((r) => r.fullReferenceNumber === number);
  if (!hit || typeof hit.revisionNumber !== "number") throw new Error(`Wage determination ${number} wasn't found on SAM.gov.`);
  return hit.revisionNumber;
}

// The WD text for the revision the solicitation names, or the latest when
// it names none (the worksheet then warns the admin to confirm).
export async function fetchWdText(
  number: string,
  revision: number | null
): Promise<{ text: string; revision: number; revisionSource: "solicitation" | "latest" }> {
  const rev = revision ?? (await latestRevision(number));
  const res = await fetch(`${SAM}/wdol/v1/wd/${encodeURIComponent(number)}/${rev}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`SAM.gov didn't return wage determination ${number} Rev. ${rev} (${res.status}).`);
  const doc = extractWdDocument(await res.text());
  return { text: doc.text, revision: doc.revision, revisionSource: revision === null ? "latest" : "solicitation" };
}
```

- [ ] **Step 2: Check it live** (one request per call to SAM.gov's public website endpoints, no API key)

```bash
cat > /tmp/wd-live.ts <<'EOF'
import { fetchWdText } from "/workspaces/Bidpulse/lib/wage/fetch-wd.ts";
import { parseWd } from "/workspaces/Bidpulse/lib/wage/parse-wd.ts";
(async () => {
  const a = await fetchWdText("2015-4539", 32);
  console.log(a.revision, a.revisionSource, parseWd(a.text).wd?.positions.find((p) => p.code === "11150"));
  const b = await fetchWdText("2015-4539", null);
  console.log("latest:", b.revision, b.revisionSource);
})();
EOF
node --experimental-strip-types /tmp/wd-live.ts
```

Expected:
```
32 solicitation { code: '11150', title: 'Janitor', rate: 17.04, footnote: null }
latest: <n> latest
```
where `<n>` is at least 32.

- [ ] **Step 3: Add `service_days_per_week` to the bid-estimation facts** (`lib/bid-estimation.ts`)

- In `BidEstimationFacts`, add `service_days_per_week: number | null;` after `term_years`.
- In `SYSTEM_PROMPT`'s key list, after the `term_years` line, add:
  ```
  - "service_days_per_week": how many days per week the service is performed, as a number from 1 to 7, ONLY if the document states a schedule (e.g. "Monday through Friday" is 5; "three times per week" is 3); otherwise null.
  ```
- In `coerceFacts`, add `service_days_per_week: null,` to `empty`. In the return, add:
  ```ts
    service_days_per_week: (() => {
      const n = asPositiveNumber(record.service_days_per_week);
      return n !== null && n <= 7 ? n : null;
    })(),
  ```

`lib/bid-estimation.ts` imports `@/…` paths, so it can't be unit-tested under `node --test`. It's covered by the typecheck and the end-to-end run in Task 10. Log a ruling.

- [ ] **Step 4: Typecheck, test, commit**

Run: `npx tsc --noEmit -p . && npm test`
Expected: clean, and everything passes. Any other constructor of `BidEstimationFacts` found by `tsc` gets `service_days_per_week: null`.

```bash
git add lib/wage/fetch-wd.ts lib/bid-estimation.ts
git commit -m "Wage worksheet: fetch WDs from SAM.gov's public site; extract service days per week" -m "<attribution lines>"
```

---

### Task 7: The worksheet API route

**Files:**
- Create: `app/api/wage-worksheet/route.ts`

**Interfaces:**
- Consumes: Tasks 2–6; `getOrExtractBidEstimationFacts` (`lib/bid-estimation.ts`); `loadTrades` (`lib/trades/server.ts`); `clientTradeIds` (`lib/trades/naics-options.ts`)
- Produces:
  - `POST /api/wage-worksheet` with body `{ submissionId: string; wdNumber?: string; wdRevision?: number | null }`. Returns `200 { worksheet, parsed, missingCode, hoursNeeded, defaults }`, or `404 { error: "no_wd" }` when no WD is known and none was given, or `422 { error, missing }` on a parse failure, or `502 { error }` when the fetch fails.
  - `PATCH /api/wage-worksheet` with body `{ submissionId, lines, options, suppliesMode, suppliesValue, overheadPct, profitPct, bidPrice }`. Returns `200 { ok: true, updatedAt }`.

- [ ] **Step 1: Write the route**

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchWdText } from "@/lib/wage/fetch-wd";
import { parseWd, type ParsedWd } from "@/lib/wage/parse-wd";
import { parseWdReference, prefillLines, sanitizeLines, sanitizeNumber, type PricingDefaults } from "@/lib/wage/prefill";
import { getOrExtractBidEstimationFacts } from "@/lib/bid-estimation";
import { loadTrades } from "@/lib/trades/server";
import { clientTradeIds } from "@/lib/trades/naics-options";

export const runtime = "nodejs";
export const maxDuration = 60;

// The wage worksheet (docs/superpowers/specs/2026-09-25-wage-worksheet-design.md).
// POST creates it pre-filled on first open (or returns the saved one);
// PATCH autosaves edits. Admin only.

async function adminFor(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("team_members").select("id, org_id").eq("auth_user_id", user.id).eq("role", "admin").maybeSingle();
  return data;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const submissionId = typeof body?.submissionId === "string" ? body.submissionId : null;
  if (!submissionId) return NextResponse.json({ error: "Invalid submissionId." }, { status: 400 });
  const supabase = await createClient();
  const member = await adminFor(supabase);
  if (!member) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  const { data: existing } = await supabase.from("wage_worksheets").select("*").eq("submission_id", submissionId).maybeSingle();
  const { data: org } = await supabase.from("organizations").select("pricing_defaults").eq("id", member.org_id).single();
  const defaults = ((org?.pricing_defaults ?? {}) as PricingDefaults) || {};
  if (existing && typeof body?.wdNumber !== "string") {
    return NextResponse.json({ worksheet: existing, parsed: existing.wd_parsed, missingCode: null, hoursNeeded: false, defaults });
  }

  // Which WD: the admin's entry, else the checklist's wage-determination item.
  let ref = typeof body?.wdNumber === "string" ? parseWdReference(body.wdNumber) : null;
  let revisionSource: "solicitation" | "latest" | "manual" = "manual";
  if (ref && typeof body?.wdRevision === "number") ref = { ...ref, revision: body.wdRevision };
  if (!ref) {
    const { data: s } = await supabase
      .from("checklist_suggestions")
      .select("label, dedupe_key")
      .eq("submission_id", submissionId)
      .like("dedupe_key", "wd:%")
      .limit(1)
      .maybeSingle();
    ref = s ? parseWdReference(s.label) : null;
    revisionSource = "solicitation";
  }
  if (!ref) return NextResponse.json({ error: "no_wd" }, { status: 404 });

  let fetched: Awaited<ReturnType<typeof fetchWdText>>;
  try {
    fetched = await fetchWdText(ref.number, ref.revision);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't fetch the wage determination." }, { status: 502 });
  }
  const parsed = parseWd(fetched.text);
  if (!parsed.ok) {
    return NextResponse.json({ error: "The wage determination couldn't be read.", missing: parsed.missing }, { status: 422 });
  }
  const wd = parsed.wd as ParsedWd;
  if (fetched.revisionSource === "latest") revisionSource = "latest";

  // The bid's trade: from the match it came from, else the client's NAICS.
  const trades = await loadTrades(supabase, member.org_id);
  const { data: sub } = await supabase
    .from("submissions")
    .select("id, bid_estimation_facts, bid_estimation_facts_extracted_at, clients!submissions_client_id_fkey(naics_codes)")
    .eq("id", submissionId)
    .single();
  const { data: link } = await supabase
    .from("audit_log")
    .select("event_detail")
    .eq("submission_id", submissionId)
    .eq("event_type", "submission_created_from_match")
    .limit(1)
    .maybeSingle();
  const opportunityId = (link?.event_detail as { opportunity_id?: string } | null)?.opportunity_id;
  let tradeId: string | null = null;
  if (opportunityId) {
    const { data: m } = await supabase.from("matched_opportunities").select("trade_id").eq("id", opportunityId).maybeSingle();
    tradeId = m?.trade_id ?? null;
  }
  if (!tradeId) {
    const naics = (sub?.clients as unknown as { naics_codes: string[] | null } | null)?.naics_codes ?? [];
    tradeId = clientTradeIds(naics, trades)[0] ?? null;
  }
  const trade = trades.find((t) => t.id === tradeId) ?? null;
  const facts = sub ? await getOrExtractBidEstimationFacts(supabase, sub as never) : null;

  const pre = prefillLines({
    wd,
    positionCode: trade?.wdPositionCode ?? null,
    productionRate: trade?.productionRate ?? null,
    cleanableSqft: facts?.cleanable_sqft ?? null,
    serviceDaysPerWeek: facts?.service_days_per_week ?? null,
    defaults,
  });

  const row = {
    submission_id: submissionId,
    org_id: member.org_id,
    wd_number: wd.number,
    wd_revision: wd.revision,
    wd_revision_source: revisionSource,
    wd_text: fetched.text,
    wd_parsed: wd,
    lines: pre.lines,
    options: { includeVacation: defaults.includeVacation ?? true, eo13658: false },
    supplies_mode: defaults.suppliesMode ?? "percent",
    supplies_value: defaults.suppliesValue ?? 0,
    overhead_pct: defaults.overheadPct ?? 0,
    profit_pct: defaults.profitPct ?? 0,
    updated_by: member.id,
    updated_at: new Date().toISOString(),
  };
  const { data: saved, error } = await supabase.from("wage_worksheets").upsert(row).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ worksheet: saved, parsed: wd, missingCode: pre.missingCode, hoursNeeded: pre.hoursNeeded, defaults });
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const submissionId = typeof body?.submissionId === "string" ? body.submissionId : null;
  if (!submissionId) return NextResponse.json({ error: "Invalid submissionId." }, { status: 400 });
  const supabase = await createClient();
  const member = await adminFor(supabase);
  if (!member) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  const { data: ws } = await supabase.from("wage_worksheets").select("wd_parsed").eq("submission_id", submissionId).maybeSingle();
  if (!ws) return NextResponse.json({ error: "Worksheet not found." }, { status: 404 });
  const wd = ws.wd_parsed as ParsedWd;
  const options = (body?.options ?? {}) as Record<string, unknown>;
  const updatedAt = new Date().toISOString();
  const { error } = await supabase
    .from("wage_worksheets")
    .update({
      lines: sanitizeLines(body?.lines, wd),
      options: { includeVacation: options.includeVacation !== false, eo13658: options.eo13658 === true },
      supplies_mode: body?.suppliesMode === "flat" ? "flat" : "percent",
      supplies_value: sanitizeNumber(body?.suppliesValue, 0),
      overhead_pct: sanitizeNumber(body?.overheadPct, 0),
      profit_pct: sanitizeNumber(body?.profitPct, 0),
      bid_price: body?.bidPrice === null || body?.bidPrice === "" || body?.bidPrice === undefined ? null : sanitizeNumber(body.bidPrice, 0),
      updated_by: member.id,
      updated_at: updatedAt,
    })
    .eq("submission_id", submissionId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, updatedAt });
}
```

- [ ] **Step 2: Typecheck, check it refuses logged-out callers, commit**

Run `npx tsc --noEmit -p .`. If the typecheck rejects `getOrExtractBidEstimationFacts(supabase, sub as never)`, pass the object shape it expects instead (see its signature at `lib/bid-estimation.ts:99`). Log a ruling.

Then:
```bash
curl -s -X POST localhost:3000/api/wage-worksheet -H 'Content-Type: application/json' -d '{"submissionId":"x"}'   # {"error":"Admin access required."}
git add app/api/wage-worksheet
git commit -m "Wage worksheet route: create pre-filled from the WD, trade and facts; autosave edits" -m "<attribution lines>"
```

---

### Task 8: The worksheet on the bid page

**Files:**
- Create: `app/admin/inbox/[id]/WageWorksheet.tsx`
- Modify: `app/admin/inbox/[id]/page.tsx`

**Interfaces:**
- Consumes: `computeFloor`, `computePrice`, `belowFloor`, `roundCents` (Task 3); `sanitizeNumber` (Task 4); the route (Task 7)
- Produces: `<WageWorksheet submissionId={string} />`, which loads itself via POST.

- [ ] **Step 1: Write `app/admin/inbox/[id]/WageWorksheet.tsx`**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { computeFloor, computePrice, belowFloor, roundCents, type WorksheetLine } from "@/lib/wage/floor";
import type { ParsedWd } from "@/lib/wage/parse-wd";

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

type Loaded = {
  worksheet: {
    wd_number: string;
    wd_revision: number;
    wd_revision_source: "solicitation" | "latest" | "manual";
    lines: WorksheetLine[];
    options: { includeVacation: boolean; eo13658: boolean };
    supplies_mode: "percent" | "flat";
    supplies_value: number;
    overhead_pct: number;
    profit_pct: number;
    bid_price: number | null;
  };
  parsed: ParsedWd;
  missingCode: string | null;
  hoursNeeded: boolean;
};

// Opens pre-filled; the admin checks the highlighted numbers and adjusts.
// Recomputes live with plain code; autosaves ~0.8 s after the last change,
// always sending the latest values.
export function WageWorksheet({ submissionId }: { submissionId: string }) {
  const [state, setState] = useState<"loading" | "no_wd" | "error" | "ready">("loading");
  const [error, setError] = useState<string | null>(null);
  const [wdInput, setWdInput] = useState("");
  const [data, setData] = useState<Loaded | null>(null);
  const [lines, setLines] = useState<WorksheetLine[]>([]);
  const [opts, setOpts] = useState({ includeVacation: true, eo13658: false });
  const [pricing, setPricing] = useState({ suppliesMode: "percent" as "percent" | "flat", suppliesValue: 0, overheadPct: 0, profitPct: 0 });
  const [bidPrice, setBidPrice] = useState<string>("");
  const [saveState, setSaveState] = useState<"saved" | "saving" | "idle">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedOnce = useRef(false);

  async function load(wdNumber?: string) {
    setState("loading");
    const res = await fetch("/api/wage-worksheet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId, ...(wdNumber ? { wdNumber } : {}) }),
    });
    const body = await res.json().catch(() => null);
    if (res.status === 404 && body?.error === "no_wd") return setState("no_wd");
    if (!res.ok) {
      setError(body?.missing ? `${body.error} Missing: ${body.missing.join(", ")}.` : body?.error ?? `HTTP ${res.status}`);
      return setState("error");
    }
    const d = body as Loaded;
    setData(d);
    setLines(d.worksheet.lines);
    setOpts(d.worksheet.options);
    setPricing({
      suppliesMode: d.worksheet.supplies_mode,
      suppliesValue: Number(d.worksheet.supplies_value),
      overheadPct: Number(d.worksheet.overhead_pct),
      profitPct: Number(d.worksheet.profit_pct),
    });
    setBidPrice(d.worksheet.bid_price === null ? "" : String(d.worksheet.bid_price));
    loadedOnce.current = false;
    setState("ready");
  }

  useEffect(() => {
    load();
  }, [submissionId]);

  // Autosave: every change restarts the timer; the save sends current state.
  useEffect(() => {
    if (state !== "ready") return;
    if (!loadedOnce.current) {
      loadedOnce.current = true;
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    setSaveState("saving");
    timer.current = setTimeout(async () => {
      await fetch("/api/wage-worksheet", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId, lines, options: opts, ...pricing, bidPrice: bidPrice === "" ? null : Number(bidPrice) }),
      });
      setSaveState("saved");
    }, 800);
  }, [lines, opts, pricing, bidPrice]);

  const box = "mt-6 bg-surface-container-lowest border border-outline-variant rounded-xl p-6";
  if (state === "loading")
    return (
      <section className={box}>
        <p className="flex items-center gap-2"><Spinner /> Preparing the wage worksheet…</p>
      </section>
    );
  if (state === "no_wd" || state === "error")
    return (
      <section className={box} aria-labelledby="wage-worksheet">
        <h2 id="wage-worksheet" className="text-title-lg text-primary">Wage worksheet</h2>
        {state === "error" && <p className="mt-2 text-error">{error}</p>}
        <p className="mt-2 text-body-md text-on-surface-variant">Enter the wage determination from the solicitation (e.g. 2015-4539 (Rev. 32)).</p>
        <form onSubmit={(e) => { e.preventDefault(); load(wdInput); }} className="mt-3 flex gap-2">
          <input value={wdInput} onChange={(e) => setWdInput(e.target.value)} placeholder="2015-4539 (Rev. 32)" className="px-3 py-2 rounded border border-outline-variant font-code" />
          <button type="submit" className="px-4 py-2 rounded-lg bg-primary text-on-primary text-label-md font-bold">Fetch</button>
        </form>
      </section>
    );

  const wd = data!.parsed;
  const { lines: per, total } = computeFloor(lines, wd, opts);
  const { supplies, price } = computePrice(total.floor, pricing);
  const bid = bidPrice === "" ? null : Number(bidPrice);
  const short = belowFloor(bid !== null && Number.isFinite(bid) ? bid : null, total.floor);
  const num = (v: string) => (v === "" ? 0 : Number(v));
  const cell = "px-2 py-1 rounded border border-outline-variant w-24 text-right";

  return (
    <section className={box} aria-labelledby="wage-worksheet">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="wage-worksheet" className="text-title-lg text-primary">Wage worksheet</h2>
        <span className="text-body-sm text-on-surface-variant">{saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : ""}</span>
      </div>
      <p className="mt-1 text-body-sm text-on-surface-variant">
        WD {wd.number} Rev. {wd.revision} · {wd.area ?? wd.state} · check this area matches the place of performance.
      </p>
      {data!.worksheet.wd_revision_source === "latest" && (
        <p className="mt-1 text-body-sm text-error">The solicitation didn&apos;t name a revision; this is the latest. Confirm it with the solicitation.</p>
      )}
      {data!.missingCode && (
        <p className="mt-1 text-body-sm text-error">Position {data!.missingCode} (your trade&apos;s default) isn&apos;t in this WD. Add a position below.</p>
      )}

      <table className="mt-4 w-full text-body-sm">
        <thead>
          <tr className="text-left text-on-surface-variant">
            <th>Position</th><th>Rate</th><th>Workers</th><th>Hours/week each</th><th className="text-right">Floor/year</th><th />
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} className="border-t border-outline-variant">
              <td className="py-2">{l.code} {l.title}{l.hoursSource && <span className="block text-on-surface-variant">{l.hoursSource}</span>}</td>
              <td>{money(per[i].wage)}</td>
              <td><input className={cell} inputMode="decimal" value={l.workers} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, workers: num(e.target.value) } : x)))} /></td>
              <td>
                <input
                  className={`${cell} ${l.hoursPerWeek === 0 ? "border-error bg-error-container/20" : ""}`}
                  inputMode="decimal"
                  value={l.hoursPerWeek}
                  onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, hoursPerWeek: num(e.target.value), hoursSource: null } : x)))}
                />
              </td>
              <td className="text-right font-code">{money(roundCents(per[i].floor))}</td>
              <td><button type="button" onClick={() => setLines(lines.filter((_, j) => j !== i))} className="text-error text-label-sm">Remove</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <select
        className="mt-2 px-2 py-1 rounded border border-outline-variant text-body-sm"
        value=""
        onChange={(e) => {
          const p = wd.positions.find((x) => x.code === e.target.value);
          if (p) setLines([...lines, { code: p.code, title: p.title, rate: p.rate, workers: 1, hoursPerWeek: 0, hoursSource: null }]);
        }}
      >
        <option value="">+ Add a position from this WD…</option>
        {wd.positions.map((p) => <option key={p.code} value={p.code}>{p.code} {p.title} ({money(p.rate)})</option>)}
      </select>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-body-sm max-w-lg">
        <dt>Wages</dt><dd className="text-right font-code">{money(roundCents(total.wages))}</dd>
        <dt>Health &amp; welfare ({money(wd.hwPerHour)}/h, up to 40 h/wk)</dt><dd className="text-right font-code">{money(roundCents(total.hw))}</dd>
        <dt>Holidays ({wd.holidays ?? 0})</dt><dd className="text-right font-code">{money(roundCents(total.holidays))}</dd>
        <dt><label className="flex items-center gap-2"><input type="checkbox" checked={opts.includeVacation} onChange={(e) => setOpts({ ...opts, includeVacation: e.target.checked })} /> Vacation ({wd.vacationWeeks ?? 0} wks)</label></dt><dd className="text-right font-code">{money(roundCents(total.vacation))}</dd>
        <dt>Paid sick leave (EO 13706)</dt><dd className="text-right font-code">{money(roundCents(total.sick))}</dd>
        <dt>Employer FICA (7.65%)</dt><dd className="text-right font-code">{money(roundCents(total.fica))}</dd>
        <dt className="font-bold">Labor-cost floor</dt><dd className="text-right font-code font-bold">{money(roundCents(total.floor))}</dd>
      </dl>
      {wd.eo13658Min !== null && (
        <label className="mt-2 flex items-center gap-2 text-body-sm">
          <input type="checkbox" checked={opts.eo13658} onChange={(e) => setOpts({ ...opts, eo13658: e.target.checked })} />
          Contract covered by EO 13658 (awarded 2015–2022, not renewed since): minimum {money(wd.eo13658Min)}/h
        </label>
      )}

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl text-body-sm">
        <label>Supplies <input className={cell} inputMode="decimal" value={pricing.suppliesValue} onChange={(e) => setPricing({ ...pricing, suppliesValue: num(e.target.value) })} /> {pricing.suppliesMode === "percent" ? "%" : "$"}</label>
        <label>Overhead % <input className={cell} inputMode="decimal" value={pricing.overheadPct} onChange={(e) => setPricing({ ...pricing, overheadPct: num(e.target.value) })} /></label>
        <label>Profit % <input className={cell} inputMode="decimal" value={pricing.profitPct} onChange={(e) => setPricing({ ...pricing, profitPct: num(e.target.value) })} /></label>
      </div>
      <p className="mt-3 text-body-md">Supplies {money(roundCents(supplies))} · <strong>Resulting price {money(roundCents(price))}/year</strong></p>

      <label className="mt-3 flex items-center gap-2 text-body-md">
        Bid price ($/year) <input className={`${cell} w-36`} inputMode="decimal" value={bidPrice} onChange={(e) => setBidPrice(e.target.value)} />
      </label>
      {short !== null && (
        <p role="alert" className="mt-2 text-body-md font-bold text-error">Below the labor-cost floor by {money(short)}/year.</p>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Mount it on `app/admin/inbox/[id]/page.tsx`**

Import `WageWorksheet` and `isFederalAgency` (`@/lib/federal-agency`, if not already imported). After the `<ChecklistSuggestionsPanel … />` element, add:
```tsx
          {(isFederalAgency(submission.agency) || (suggestions ?? []).some((s: any) => s.kind === "wage_determination")) && (
            <WageWorksheet submissionId={submission.id} />
          )}
```

- [ ] **Step 3: Typecheck, check the page compiles, commit**

Run: `npx tsc --noEmit -p . && npm test`, then `curl -s -o /dev/null -w "%{http_code}\n" localhost:3000/admin/inbox/x`, which should give 307, not 500.

```bash
git add "app/admin/inbox/[id]/WageWorksheet.tsx" "app/admin/inbox/[id]/page.tsx"
git commit -m "Wage worksheet on the bid page: pre-filled, live floor, below-floor warning, autosave" -m "<attribution lines>"
```

---

### Task 9: End to end on dev, with timing

This task uses dev only. It spends one estimation-facts AI call per new bid and a few free SAM.gov public requests.

- [ ] **Step 1: Set up on dev**
  - In dev Settings (as the QA admin): Janitorial trade → position code `11150`, production rate `3500`. Pricing defaults: supplies 8%, overhead 10%, profit 10%, 5 days, vacation on.
  - Create a dev test bid (inserts only) for the test client "QA Withdraw Test Co", agency `DEPT OF DEFENSE.DEPT OF THE AIR FORCE`.
  - Upload a small text solicitation with `Wage Determination No. 2015-4539 (Rev. 32)`, `45,000 square feet` and `Monday through Friday`. The checklist reads it and finds the WD; the estimation facts get the square footage and 5 days.

- [ ] **Step 2: Browser check with Playwright, as the QA admin, timed from opening the page**
  - The worksheet appears pre-filled: WD 2015-4539 Rev. 32; Florida Counties of Baker, Clay, Duval, Nassau and Saint Johns; Janitor $17.04; 2 workers at 32.14 h ("from 45,000 sq ft at 3,500 sq ft/hr × 5 days").
  - The floor matches `computeFloor` for those inputs.
  - Supplies, overhead and profit are 8/10/10.
  - Change workers to 3: the floor updates, and "Saved" appears within ~1 s. Reload: the value persists.
  - Type a bid price below the floor: the red warning shows. Type one above: it goes away.
  - Type fast into hours (5 keystrokes in 300 ms), wait, reload: the **last** value is saved.
  - Record: the time from page open to the worksheet shown, and the number of edits needed.

- [ ] **Step 3: Failure checks**
  - A bid with no WD suggestion gives the "Enter the wage determination" form; entering `2015-4539` gives a latest-revision warning.
  - A trade with position code `99999` gives the "isn't in this WD" message and the add-position list.

- [ ] **Step 4: Record the evidence in the ledger, commit only if code changed**

---

### Task 10: Production rollout (only with the user's explicit go-ahead)

- [ ] Ask: "Merge `wage-worksheet`, apply the migration to production, then push?" Wait for a yes.
- [ ] **Migration:** `cat supabase/.temp/project-ref` gives `rixsgnbivayeaxbdseij`. The dry run lists only `20260925150000_add_wage_worksheets.sql`. Then `db push --yes`, then `NOTIFY pgrst, 'reload schema'`.
- [ ] **Merge and push:** merge to `main`, run `npm test` and `npx tsc`, push, and wait for the Vercel deploy to be Ready.
- [ ] **Tell the user the one-time setup:** Settings → Trades (position code and production rate per trade) and Settings → Pricing defaults.

---

## Self-review notes

- **Spec coverage:**

  | Spec requirement | Task |
  |---|---|
  | Data | 1 |
  | WD source (checklist ref, revision, latest, fetch, snapshot) | 2, 4, 6, 7 |
  | Parser and validation | 2 |
  | Calculation | 3 |
  | Pre-fill | 4, 7 |
  | Settings UI | 5 |
  | `service_days_per_week` fact | 6 |
  | Worksheet UI, warnings, autosave | 8 |
  | Failure handling | 7, 8, 9 |
  | Testing, real WDs and timing | 2, 3, 4, 9 |
  | Rollout | 10 |

- **Not built:** the spec's "upload the WD file" fallback. The manual WD-number entry (Task 8) covers the case where the checklist didn't find the WD, and fetching a named WD can't fail on file format. An upload fallback would matter only if SAM.gov were down. **Deferred and stated to the user.**
