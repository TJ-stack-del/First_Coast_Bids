# Submission Checklist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- Read each bid's solicitation files and suggest every required submission item, each with a verified verbatim quote.
- Let an admin approve suggestions onto the shared bid checklist, with an owner (admin or client).
- Clients see only their own items.

**Architecture:**
- **Pure, tested logic in `lib/checklist/`:** quote verification, plain-code detectors for fixed identifiers, merge/dedupe/owner rules, page chunking, AI-output coercion.
- **One scan route orchestrates** text extraction (`unpdf`, `mammoth`), detectors, a chunked parallel AI pass, verification and inserts.
- **Small admin routes** approve, reject, restore and send.
- **A panel on the admin bid page** drives it.
- **RLS narrows client reads** of `checklist_items` to `owner = 'client'`.

**Tech Stack:**
- Next.js 15 App Router, Supabase (Postgres/RLS/storage), TypeScript (`strict: false`);
- `@anthropic-ai/sdk` (model `claude-opus-5`, structured outputs, server-side refusal fallback);
- `unpdf` (new), `mammoth` (existing), `jspdf` (existing, used in tests to build PDF fixtures);
- `node --test`.

**Spec:** `docs/superpowers/specs/2026-09-25-submission-checklist-design.md`

**Two decisions made while planning** (implementation choices within the spec, not scope changes):
1. **PDFs with a text layer go to the AI as page-marked text,** not as PDF blocks. Page numbers are then exact, and quote verification compares against the very text the AI read. Scanned PDFs (no text layer) are still sent as PDF document blocks.
2. **Long documents are split into page-range chunks** (at most 60,000 characters each) and read in **parallel** requests. One request over a 100-page solicitation could run past Vercel's 60-second limit. The merge/dedupe step already folds duplicates across chunks. `pages_read` records any file whose text was cut off by the total cap.

## Global Constraints

- **Model and API:** `claude-opus-5` via `client.beta.messages.create` with `betas: ["server-side-fallback-2026-07-01"]` and `fallbacks: "default"`. Check `stop_reason === "refusal"` before reading content. Set `output_config: { effort: "low", format: { type: "json_schema", schema } }`.
- **Never invent:** detectors quote the matched line verbatim, and AI items must copy quotes verbatim. Quote status is exactly one of `verified`, `not_found`, `unreadable`.
- **Kinds:** `form`, `amendment`, `bond`, `sworn_statement`, `license_insurance`, `submission_rule`, `wage_determination`, `far_provision`, `sam_registration`, `evaluation_method`, `other`.
- **Federal kinds:** `wage_determination`, `far_provision`, `sam_registration`, plus SF forms. They're kept only when `isFederalAgency(agency)` is true or a detector found an SF form or FAR provision in the documents.
- **Default owners:**
  - `client`: `form`, `amendment`, `bond`, `sworn_statement`, `license_insurance`, `far_provision`, `other`;
  - `admin`: `submission_rule`, `evaluation_method`, `wage_determination`, `sam_registration`.
- **Approval:**
  - an approval inserts exactly one `checklist_items` row, and a second approve of the same suggestion is refused (409);
  - approving never emails;
  - "Approve all verified" needs the count the admin saw, and is refused (409) if it changed.
- **RLS:** clients read only `owner = 'client'` checklist items, and suggestions are admin-only.
- **Tests:** `lib/` modules used by tests import with relative `.ts` paths. Run one with `node --experimental-strip-types --test <file>`, all with `npm test`. `npx tsc --noEmit -p .` must pass after every task.
- **Commits:** every message ends with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01VxaQ43PbCfwewBqBw5t8Dd
  ```
- **Branch:** `submission-checklist` (already created, holds the spec).
- **Databases:**
  - `.env.local` is **bidpulse-dev** (`hvrwxcyqgjobrgpcequj`); the CLI link is normally **production** (`rixsgnbivayeaxbdseij`), so check with `cat supabase/.temp/project-ref`.
  - Relink production after any dev work.
  - No production write without the user's explicit yes in that moment.
- **SAM.gov:** don't call the SAM.gov API from dev. It shares production's tiny daily quota.

## Review Focus

1. **A scan killed by Vercel's 60-second limit** leaves `checklist_scan.status = 'running'` forever. The panel must treat a run older than 90 seconds as timed out and offer Check again. The route must not refuse a new run because of a stale "running". Tested in Task 7 (`isScanStale`).
2. **A double-clicked Approve,** or two admins approving at once, must create **one** checklist item, not two. Handled in Task 8 (claim with `status = 'pending'`, refuse when zero rows are claimed). It's a database-conditional update with no pure logic to unit-test, so it's checked in the browser in Task 10 (double-click, then count the checklist items).
3. **A client triggering a scan** of a submission that isn't theirs must get 404, with no service-role work done for them. Handled in Task 7 (read via the caller's RLS session first); verified in Task 10.
4. **PDF text quirks** (ligatures such as "ﬁ", words hyphenated across lines, curly quotes, soft hyphens) must not turn a real quote into "not found". Tested in Task 2.
5. **Square footage written as "SF"** ("10,000 SF 30 days") must not be detected as form SF-30. Tested in Task 3.

---

## File Structure

**Create:**
- `supabase/migrations/20260925120000_add_submission_checklist.sql`
- `lib/checklist/types.ts`: kinds, `Candidate`, `QuoteStatus`, owner/federal rules.
- `lib/checklist/verify-quote.ts` (+ test)
- `lib/checklist/detectors.ts` (+ test)
- `lib/checklist/merge.ts` (+ test)
- `lib/checklist/chunk.ts` (+ test)
- `lib/checklist/extract-text.ts` (+ test)
- `lib/checklist/ai-pass.ts`, with the pure `coerceAiItems` tested in `ai-pass.test.ts`
- `lib/checklist/scan-state.ts` (+ test): `filesFingerprint`, `isScanStale`.
- `lib/checklist/approve.ts`: server helper for approving (claim, then insert).
- `lib/checklist/send-result.ts` (+ test): describes the send-list result.
- `app/api/checklist-scan/route.ts`
- `app/api/checklist-suggestions/[id]/route.ts`
- `app/api/checklist-suggestions/approve-verified/route.ts`
- `app/api/send-checklist-items/route.ts`
- `app/admin/inbox/[id]/ChecklistSuggestionsPanel.tsx`

**Modify:**
- `lib/email/templates.ts` (new template);
- `components/ui/SubmissionDocuments.tsx` (trigger a scan after an RFP upload);
- `app/admin/inbox/[id]/page.tsx` (load suggestions and scan state, mount the panel, owner in the checklist query);
- `app/admin/inbox/[id]/AdminSubmissionActions.tsx` (owner tag);
- `app/dashboard/page.tsx` and `app/dashboard/SubmissionCard.tsx` (show `notes` under client items);
- `package.json` (`unpdf`).

---

### Task 1: Migration, applied to dev

**Files:**
- Create: `supabase/migrations/20260925120000_add_submission_checklist.sql`

**Interfaces:**
- Produces:
  - table `checklist_suggestions` (columns below);
  - `checklist_items.owner` / `source_quote` / `source_page` / `source_file` / `client_notified_at`;
  - `submissions.checklist_scan jsonb`.

- [ ] **Step 1: Write the migration**

```sql
-- Submission checklist (docs/superpowers/specs/2026-09-25-submission-checklist-design.md):
-- items read from a bid's solicitation are suggested to an admin, and
-- approved ones join the shared checklist with an owner. Clients only ever
-- see their own items.

create table public.checklist_suggestions (
  id uuid primary key default extensions.uuid_generate_v4(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('form','amendment','bond','sworn_statement','license_insurance',
    'submission_rule','wage_determination','far_provision','sam_registration','evaluation_method','other')),
  federal boolean not null default false,
  label text not null,
  detail text,
  quote text not null,
  page integer,
  source_file text,
  quote_status text not null check (quote_status in ('verified','not_found','unreadable')),
  found_by text not null check (found_by in ('ai','detector')),
  suggested_owner text not null check (suggested_owner in ('client','admin')),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  dedupe_key text not null,
  checklist_item_id uuid references public.checklist_items(id) on delete set null,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.team_members(id) on delete set null,
  constraint checklist_suggestions_submission_key_unique unique (submission_id, dedupe_key)
);

create index checklist_suggestions_submission_status_idx on public.checklist_suggestions (submission_id, status);

alter table public.checklist_suggestions enable row level security;

create policy "admins manage checklist_suggestions" on public.checklist_suggestions
  using (public.is_admin(org_id))
  with check (public.is_admin(org_id));

grant select, insert, update on public.checklist_suggestions to authenticated;

alter table public.checklist_items
  add column owner text not null default 'client' check (owner in ('client','admin')),
  add column source_quote text,
  add column source_page integer,
  add column source_file text,
  add column client_notified_at timestamptz;

-- Clients see only the items that are theirs to do.
drop policy "clients read their own checklist_items" on public.checklist_items;
create policy "clients read their own checklist_items" on public.checklist_items
  for select using (
    owner = 'client'
    and exists (
      select 1 from public.submissions s
      where s.id = checklist_items.submission_id and public.is_own_client_record(s.client_id)
    )
  );

-- {status: running|done|failed, started_at, finished_at, files_fingerprint,
--  error, pages_read: [{file, total, read}], ai_failed_chunks}
alter table public.submissions add column checklist_scan jsonb;
```

- [ ] **Step 2: Dry-run and apply to dev, then relink production**

```bash
cat supabase/.temp/project-ref                       # remember it (expect rixsgnbivayeaxbdseij)
npx supabase link --project-ref hvrwxcyqgjobrgpcequj
npx supabase db push --dry-run                       # must list ONLY 20260925120000_add_submission_checklist.sql
npx supabase db push --yes
npx supabase link --project-ref rixsgnbivayeaxbdseij
cat supabase/.temp/project-ref                       # expect rixsgnbivayeaxbdseij
```

Expected: exactly one migration is applied. If the dry run lists anything else, stop and report.

- [ ] **Step 3: Verify over REST on dev**

```bash
set -a; . ./.env.local; set +a
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/checklist_suggestions?select=id&limit=1" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/checklist_items?select=owner,client_notified_at&limit=1" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

Expected: `[]`, then either `[]` or rows with `"owner":"client"`. A `PGRST205`/`PGRST204` response means the schema cache is stale; ask the user to run `NOTIFY pgrst, 'reload schema';` on dev.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260925120000_add_submission_checklist.sql
git commit -m "Add checklist_suggestions, checklist item owners, and scan state" -m "<attribution lines from Global Constraints>"
```

---

### Task 2: Types and quote verification

**Files:**
- Create: `lib/checklist/types.ts`, `lib/checklist/verify-quote.ts`, `lib/checklist/verify-quote.test.ts`

**Interfaces:**
- Produces:
  - `type Kind` (the 11 kinds); `const KINDS: readonly Kind[]`;
  - `type Owner = "client" | "admin"`; `type QuoteStatus = "verified" | "not_found" | "unreadable"`;
  - `type Candidate = { kind: Kind; federal: boolean; label: string; detail: string | null; quote: string; page: number | null; source_file: string | null; found_by: "ai" | "detector"; key: string | null; suggested_owner: Owner }`;
  - `function defaultOwner(kind: Kind): Owner`;
  - `function normalizeForMatch(s: string): string`;
  - `function verifyQuote(quote: string, fileText: string | null): QuoteStatus`.

- [ ] **Step 1: Write `lib/checklist/types.ts`**

```ts
// Shared shapes for the submission checklist
// (docs/superpowers/specs/2026-09-25-submission-checklist-design.md).

export const KINDS = [
  "form",
  "amendment",
  "bond",
  "sworn_statement",
  "license_insurance",
  "submission_rule",
  "wage_determination",
  "far_provision",
  "sam_registration",
  "evaluation_method",
  "other",
] as const;
export type Kind = (typeof KINDS)[number];

export type Owner = "client" | "admin";
export type QuoteStatus = "verified" | "not_found" | "unreadable";

// One item found in a solicitation, before it's saved as a suggestion.
// `key` identifies the same requirement across detectors, AI chunks and
// re-scans (e.g. "form:sf-1449", "wd:2015-4523"); null means "derive it
// from kind + label".
export type Candidate = {
  kind: Kind;
  federal: boolean;
  label: string;
  detail: string | null;
  quote: string;
  page: number | null;
  source_file: string | null;
  found_by: "ai" | "detector";
  key: string | null;
  suggested_owner: Owner;
};

const ADMIN_KINDS: readonly Kind[] = ["submission_rule", "evaluation_method", "wage_determination", "sam_registration"];

// Who normally handles each kind: the client signs, attaches and certifies;
// the admin checks rules, pricing inputs and registration. The admin can
// change any owner before approving.
export function defaultOwner(kind: Kind): Owner {
  return ADMIN_KINDS.includes(kind) ? "admin" : "client";
}
```

- [ ] **Step 2: Write the failing tests, `lib/checklist/verify-quote.test.ts`**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeForMatch, verifyQuote } from "./verify-quote.ts";
import { defaultOwner } from "./types.ts";

const PAGE =
  "Offerors shall complete blocks 12, 17a, 23, 24, and 30 of the SF 1449.\n" +
  "All sub-\ncontractors must be identified. The ofﬁce of the Contracting Ofﬁcer will\n" +
  "not accept “late” offers. Pre­award survey may apply.";

test("an exact quote is verified", () => {
  assert.equal(verifyQuote("Offerors shall complete blocks 12, 17a, 23, 24, and 30 of the SF 1449.", PAGE), "verified");
});

test("line breaks, ligatures, curly quotes and soft hyphens don't break a real quote", () => {
  assert.equal(verifyQuote("All subcontractors must be identified.", PAGE), "verified");
  assert.equal(verifyQuote("All sub-contractors must be identified.", PAGE), "verified");
  assert.equal(verifyQuote("The office of the Contracting Officer will not accept \"late\" offers.", PAGE), "verified");
  assert.equal(verifyQuote("Preaward survey may apply.", PAGE), "verified");
});

test("a quote that isn't in the document is not found", () => {
  assert.equal(verifyQuote("Offerors shall submit a bid bond of 5 percent.", PAGE), "not_found");
});

test("a very short quote can't be verified", () => {
  assert.equal(verifyQuote("SF", PAGE), "not_found");
});

test("a file with no readable text is unreadable, not 'not found'", () => {
  assert.equal(verifyQuote("anything at all here", null), "unreadable");
  assert.equal(verifyQuote("anything at all here", "   \n "), "unreadable");
});

test("normalizeForMatch lowercases and collapses whitespace", () => {
  assert.equal(normalizeForMatch("  Hello\n\n  World  "), "hello world");
});

test("owners default by kind", () => {
  assert.equal(defaultOwner("form"), "client");
  assert.equal(defaultOwner("sworn_statement"), "client");
  assert.equal(defaultOwner("wage_determination"), "admin");
  assert.equal(defaultOwner("submission_rule"), "admin");
});
```

- [ ] **Step 3: Run the tests to confirm they fail**

Run: `node --experimental-strip-types --test lib/checklist/verify-quote.test.ts`
Expected: FAIL, "Cannot find module ... verify-quote.ts".

- [ ] **Step 4: Write `lib/checklist/verify-quote.ts`**

```ts
import type { QuoteStatus } from "./types.ts";

// Checks that a quote really appears in the document text the app extracted
// itself -- the guard against a suggestion whose "quote" the AI invented.
// Both sides are normalised the same way, because PDF text differs from a
// copied quote in ways that don't change meaning: ligatures ("ﬁ"), words
// hyphenated across line breaks, curly quotes, soft hyphens. Hyphens are
// dropped entirely on both sides so "sub-\ncontractors", "sub-contractors"
// and "subcontractors" all compare equal.
export function normalizeForMatch(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/­/g, "")
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/-\s*\n\s*/g, "")
    .replace(/-/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const MIN_QUOTE_CHARS = 8;

export function verifyQuote(quote: string, fileText: string | null): QuoteStatus {
  if (fileText === null || !fileText.trim()) return "unreadable";
  const q = normalizeForMatch(quote);
  if (q.length < MIN_QUOTE_CHARS) return "not_found";
  return normalizeForMatch(fileText).includes(q) ? "verified" : "not_found";
}
```

- [ ] **Step 5: Run the tests to confirm they pass, then typecheck**

Run: `node --experimental-strip-types --test lib/checklist/verify-quote.test.ts && npx tsc --noEmit -p .`
Expected: 7 pass, and the typecheck is clean.

- [ ] **Step 6: Commit**

```bash
git add lib/checklist/types.ts lib/checklist/verify-quote.ts lib/checklist/verify-quote.test.ts
git commit -m "Checklist: shared types and quote verification against the document's own text" -m "<attribution lines>"
```

---

### Task 3: Plain-code detectors

**Files:**
- Create: `lib/checklist/detectors.ts`, `lib/checklist/detectors.test.ts`

**Interfaces:**
- Consumes: `Candidate`, `defaultOwner` (Task 2)
- Produces:
  - `type FilePages = { fileName: string; pages: string[] | null }`
  - `function detectItems(files: FilePages[]): Candidate[]`: one candidate per `key`, first occurrence, `found_by: "detector"`.
  - `function identifierKey(text: string): string | null`: the key for the first fixed identifier found in `text`. The AI merge (Task 4) uses it too.

- [ ] **Step 1: Write the failing tests, `lib/checklist/detectors.test.ts`**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { detectItems, identifierKey } from "./detectors.ts";

function run(...pages: string[]) {
  return detectItems([{ fileName: "rfq.pdf", pages }]);
}
const keys = (items: { key: string | null }[]) => items.map((i) => i.key).sort();

test("standard forms are detected with page and verbatim line", () => {
  const items = run("Cover page", "Offerors must complete blocks 12, 17a and 30 of the SF 1449 and return it.");
  const sf = items.find((i) => i.key === "form:sf-1449")!;
  assert.equal(sf.kind, "form");
  assert.equal(sf.federal, true);
  assert.equal(sf.page, 2);
  assert.equal(sf.source_file, "rfq.pdf");
  assert.equal(sf.quote, "Offerors must complete blocks 12, 17a and 30 of the SF 1449 and return it.");
  assert.equal(sf.suggested_owner, "client");
});

test("Standard Form spelled out and SF-33 / SF-1442 are detected", () => {
  assert.deepEqual(keys(run("Complete Standard Form 33.", "Use SF-1442 for construction.")), ["form:sf-1442", "form:sf-33"]);
});

test("square footage written as SF is not a form", () => {
  assert.deepEqual(run("Clean 10,000 SF 30 days after award.", "Area: 2,500 SF 18 rooms."), []);
});

test("amendments and addenda each get their own acknowledgment", () => {
  const items = run("Acknowledge Amendment 0001 and Amendment No. 0002 on SF-30.", "See Addendum No. 3.");
  assert.deepEqual(keys(items), ["addendum:3", "amendment:0001", "amendment:0002", "form:sf-30"]);
  assert.equal(items.find((i) => i.key === "amendment:0001")!.kind, "amendment");
});

test("a general 'acknowledge all addenda' rule is detected", () => {
  assert.deepEqual(keys(run("Bidders shall acknowledge receipt of all addenda on the bid form.")), ["addendum:ack-all"]);
});

test("wage determinations with and without revision", () => {
  const a = run("The Service Contract Act applies. WD 2015-4523 (Rev.-27) is attached.");
  assert.equal(a[0].key, "wd:2015-4523");
  assert.match(a[0].label, /2015-4523 \(Rev\. 27\)/);
  assert.equal(a[0].suggested_owner, "admin");
  const b = run("Wage Determination No. 2015-4523 applies.");
  assert.equal(b[0].key, "wd:2015-4523");
});

test("only FAR provisions that need bidder action are detected", () => {
  const items = run("52.212-3 Offeror Representations and Certifications. 52.212-4 Contract Terms. 52.204-26 applies.");
  assert.deepEqual(keys(items), ["far:52.204-26", "far:52.212-3"]);
  assert.ok(items.every((i) => i.federal && i.kind === "far_provision"));
});

test("Florida sworn statements are detected, once each", () => {
  const items = run(
    "Submit the Public Entity Crimes sworn statement.",
    "Drug-Free Workplace form required. Also the Drug Free Workplace certification."
  );
  assert.deepEqual(keys(items), ["sworn:drug-free-workplace", "sworn:public-entity-crimes"]);
  assert.ok(items.every((i) => i.kind === "sworn_statement" && !i.federal));
});

test("SAM registration requirement is detected", () => {
  const items = run("Offerors must be registered in the System for Award Management (SAM) at time of offer.");
  assert.equal(items[0].key, "sam:registration");
  assert.equal(items[0].suggested_owner, "admin");
});

test("unreadable files and empty input yield nothing", () => {
  assert.deepEqual(detectItems([{ fileName: "scan.pdf", pages: null }]), []);
  assert.deepEqual(detectItems([]), []);
});

test("identifierKey finds the same keys in free text", () => {
  assert.equal(identifierKey("Sign the SF-1449, block 30"), "form:sf-1449");
  assert.equal(identifierKey("Price per WD 2015-4523"), "wd:2015-4523");
  assert.equal(identifierKey("Complete FAR 52.212-3"), "far:52.212-3");
  assert.equal(identifierKey("Acknowledge Amendment 0002"), "amendment:0002");
  assert.equal(identifierKey("Provide a bid bond"), null);
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `node --experimental-strip-types --test lib/checklist/detectors.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write `lib/checklist/detectors.ts`**

```ts
import { defaultOwner, type Candidate, type Kind } from "./types.ts";

// Plain-code detection of fixed identifiers in solicitation text: standard
// forms, amendment/addendum numbers, wage determinations, FAR provisions
// that need bidder action, Florida sworn statements, and SAM registration.
// Runs on every page of every readable file (unlike the AI pass, which may
// be capped), and quotes the matched line verbatim.

export type FilePages = { fileName: string; pages: string[] | null };

type Rule = {
  pattern: RegExp; // must be global
  // Returns null to skip this match (e.g. square footage).
  build: (m: RegExpExecArray, line: string, textBefore: string) => { key: string; kind: Kind; federal: boolean; label: string; detail: string | null } | null;
};

const FORM_LABELS: Record<string, string> = {
  "1449": "Complete and sign SF-1449 (Solicitation/Contract/Order for Commercial Products and Commercial Services)",
  "1442": "Complete and sign SF-1442 (Solicitation, Offer and Award, Construction)",
  "33": "Complete and sign SF-33 (Solicitation, Offer and Award)",
  "18": "Complete SF-18 (Request for Quotations)",
  "30": "Acknowledge each amendment (SF-30)",
};

const FAR_ACTIONS: Record<string, string> = {
  "52.212-3": "Complete FAR 52.212-3 Offeror Representations and Certifications (or confirm they're current in SAM)",
  "52.204-24": "Complete the FAR 52.204-24 telecommunications representation",
  "52.204-26": "Complete the FAR 52.204-26 telecommunications representation",
  "52.209-5": "Complete the FAR 52.209-5 certification regarding responsibility matters",
  "52.219-1": "Complete the FAR 52.219-1 small business program representations",
  "52.222-22": "Complete the FAR 52.222-22 previous contracts and compliance reports representation",
  "52.222-25": "Complete the FAR 52.222-25 affirmative action compliance representation",
};

const SWORN: { key: string; pattern: RegExp; label: string }[] = [
  { key: "public-entity-crimes", pattern: /public entity crimes?/gi, label: "Public Entity Crimes sworn statement (s. 287.133, F.S.)" },
  { key: "drug-free-workplace", pattern: /drug[- ]free workplace/gi, label: "Drug-Free Workplace form (s. 287.087, F.S.)" },
  { key: "scrutinized-companies", pattern: /scrutinized compan/gi, label: "Scrutinized Companies certification" },
  { key: "e-verify", pattern: /\bE-?Verify\b/gi, label: "E-Verify affidavit" },
  { key: "conflict-of-interest", pattern: /conflict of interest (?:statement|form|disclosure|certification)/gi, label: "Conflict of Interest statement" },
];

// "10,000 SF 30 days" is square footage, not form SF-30.
const SQUARE_FEET_BEFORE = /\d[\d,.]*\s*$/;

const RULES: Rule[] = [
  {
    pattern: /\b(?:SF|Standard Form)[\s-]?(1449|1442|33|18|30)\b/g,
    build: (m, _line, before) => {
      if (m[0].startsWith("SF") && SQUARE_FEET_BEFORE.test(before)) return null;
      const n = m[1];
      return { key: `form:sf-${n}`, kind: n === "30" ? "amendment" : "form", federal: true, label: FORM_LABELS[n], detail: null };
    },
  },
  {
    pattern: /\bAmendment\s+(?:No\.?\s*)?(\d{4})\b/gi,
    build: (m) => ({ key: `amendment:${m[1]}`, kind: "amendment", federal: false, label: `Acknowledge Amendment ${m[1]}`, detail: null }),
  },
  {
    pattern: /\bAddend(?:um|a)\s+(?:No\.?\s*|#\s*)?(\d{1,3})\b/gi,
    build: (m) => ({ key: `addendum:${m[1]}`, kind: "amendment", federal: false, label: `Acknowledge Addendum ${m[1]}`, detail: null }),
  },
  {
    pattern: /\backnowledg\w*\s+(?:receipt\s+of\s+)?(?:all\s+|any\s+)?addend/gi,
    build: () => ({ key: "addendum:ack-all", kind: "amendment", federal: false, label: "Acknowledge all addenda on the bid form", detail: null }),
  },
  {
    pattern: /\b(?:WD|Wage Determination)\s*(?:No\.?|Number|#)?\s*:?\s*(\d{4}-\d{4})(?:\s*\(?\s*Rev(?:ision)?\.?\s*(?:No\.?\s*)?-?\s*(\d{1,3})\)?)?/gi,
    build: (m) => ({
      key: `wd:${m[1]}`,
      kind: "wage_determination",
      federal: true,
      label: `Price labor at or above Wage Determination ${m[1]}${m[2] ? ` (Rev. ${m[2]})` : ""}`,
      detail: null,
    }),
  },
  {
    pattern: /\b52\.2\d{2}-\d{1,3}\b/g,
    build: (m) =>
      FAR_ACTIONS[m[0]]
        ? { key: `far:${m[0]}`, kind: "far_provision", federal: true, label: FAR_ACTIONS[m[0]], detail: null }
        : null,
  },
  {
    pattern: /\b(?:System for Award Management|SAM registration|registered in SAM)\b/gi,
    build: () => ({ key: "sam:registration", kind: "sam_registration", federal: true, label: "Confirm the client's SAM registration is active", detail: null }),
  },
  ...SWORN.map(
    (s): Rule => ({
      pattern: s.pattern,
      build: () => ({ key: `sworn:${s.key}`, kind: "sworn_statement", federal: false, label: s.label, detail: null }),
    })
  ),
];

// The line containing position `index`, trimmed, at most 300 characters.
function lineAt(text: string, index: number): string {
  const start = text.lastIndexOf("\n", index) + 1;
  const endNl = text.indexOf("\n", index);
  const line = text.slice(start, endNl === -1 ? text.length : endNl).trim();
  return line.length <= 300 ? line : line.slice(0, 300);
}

export function detectItems(files: FilePages[]): Candidate[] {
  const found = new Map<string, Candidate>();
  for (const file of files) {
    if (!file.pages) continue;
    file.pages.forEach((pageText, i) => {
      for (const rule of RULES) {
        rule.pattern.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = rule.pattern.exec(pageText)) !== null) {
          const built = rule.build(m, lineAt(pageText, m.index), pageText.slice(Math.max(0, m.index - 20), m.index));
          if (!built || found.has(built.key)) continue;
          found.set(built.key, {
            ...built,
            quote: lineAt(pageText, m.index),
            page: i + 1,
            source_file: file.fileName,
            found_by: "detector",
            suggested_owner: defaultOwner(built.kind),
          });
        }
      }
    });
  }
  return [...found.values()];
}

// The detector key for the first fixed identifier in free text, so an AI
// item about "SF-1449" merges with the detector's "form:sf-1449".
export function identifierKey(text: string): string | null {
  for (const rule of RULES.slice(0, 6)) {
    rule.pattern.lastIndex = 0;
    const m = rule.pattern.exec(text);
    if (!m) continue;
    const built = rule.build(m, text, text.slice(Math.max(0, m.index - 20), m.index));
    if (built) return built.key;
  }
  return null;
}
```

- [ ] **Step 4: Run the tests to confirm they pass, then typecheck**

Run: `node --experimental-strip-types --test lib/checklist/detectors.test.ts && npx tsc --noEmit -p .`
Expected: 11 pass, and the typecheck is clean. If a test fails, fix the detector, never the test's expectation. The only exception is an expectation that contradicts the spec, and that gets a ledger ruling.

- [ ] **Step 5: Commit**

```bash
git add lib/checklist/detectors.ts lib/checklist/detectors.test.ts
git commit -m "Checklist: plain-code detectors for forms, amendments, wage determinations, FAR provisions, sworn statements" -m "<attribution lines>"
```

---

### Task 4: Merge, dedupe and federal filtering

**Files:**
- Create: `lib/checklist/merge.ts`, `lib/checklist/merge.test.ts`

**Interfaces:**
- Consumes: `Candidate` (Task 2); `identifierKey` (Task 3); `isFederalAgency` from `lib/federal-agency.ts`
- Produces:
  - `function candidateKey(c: Candidate): string`;
  - `function mergeCandidates(detected: Candidate[], ai: Candidate[]): Candidate[]`: detectors win on a shared key, and duplicate AI keys keep the first;
  - `function allowFederalItems(agency: string, detected: Candidate[]): boolean`;
  - `function finalizeCandidates(merged: Candidate[], opts: { agency: string; detected: Candidate[]; existingKeys: Set<string> }): (Candidate & { key: string })[]`: drops federal items when not allowed, and drops keys that already exist.

- [ ] **Step 1: Write the failing tests, `lib/checklist/merge.test.ts`**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { candidateKey, mergeCandidates, allowFederalItems, finalizeCandidates } from "./merge.ts";
import type { Candidate } from "./types.ts";

function c(p: Partial<Candidate>): Candidate {
  return {
    kind: "other", federal: false, label: "x", detail: null, quote: "q", page: 1, source_file: "a.pdf",
    found_by: "ai", key: null, suggested_owner: "client", ...p,
  };
}

test("key comes from the identifier, else kind + normalised label", () => {
  assert.equal(candidateKey(c({ kind: "form", label: "Sign the SF-1449, block 30" })), "form:sf-1449");
  assert.equal(candidateKey(c({ kind: "bond", label: "Bid Bond: 5%!" })), "bond:bid bond 5");
  assert.equal(candidateKey(c({ key: "sworn:e-verify", label: "anything" })), "sworn:e-verify");
});

test("a detector item wins over the AI item for the same identifier", () => {
  const det = c({ kind: "form", key: "form:sf-1449", found_by: "detector", quote: "detector line" });
  const ai = c({ kind: "form", label: "Complete SF 1449", quote: "ai line", detail: "blocks 12, 17a" });
  const merged = mergeCandidates([det], [ai]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].quote, "detector line");
  assert.equal(merged[0].detail, "blocks 12, 17a", "keeps the AI's detail when the detector has none");
});

test("duplicate AI items from different chunks collapse to one", () => {
  const merged = mergeCandidates([], [c({ kind: "bond", label: "Bid bond" }), c({ kind: "bond", label: "bid bond" })]);
  assert.equal(merged.length, 1);
});

test("federal items are allowed for federal agencies or when the documents show federal forms", () => {
  assert.equal(allowFederalItems("DEPT OF DEFENSE.DEPT OF THE NAVY", []), true);
  assert.equal(allowFederalItems("City of Jacksonville", []), false);
  assert.equal(allowFederalItems("City of Jacksonville", [c({ key: "far:52.212-3", federal: true, found_by: "detector" })]), true);
  assert.equal(allowFederalItems("Florida Department of Transportation", []), false);
});

test("finalize drops federal items on local bids and keys that already exist", () => {
  const items = [
    c({ kind: "wage_determination", federal: true, key: "wd:2015-4523" }),
    c({ kind: "bond", label: "Bid bond" }),
    c({ kind: "sworn_statement", key: "sworn:e-verify" }),
  ];
  const out = finalizeCandidates(items, { agency: "City of Jacksonville", detected: [], existingKeys: new Set(["sworn:e-verify"]) });
  assert.deepEqual(out.map((o) => o.key), ["bond:bid bond"]);
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `node --experimental-strip-types --test lib/checklist/merge.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write `lib/checklist/merge.ts`**

```ts
import { identifierKey } from "./detectors.ts";
import { isFederalAgency } from "../federal-agency.ts";
import type { Candidate } from "./types.ts";

// Folding detector and AI results into one list of suggestions: one per
// requirement, detectors' verbatim quotes preferred, nothing re-suggested
// that the bid already has (in any status).

function normalizeLabel(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

export function candidateKey(c: Candidate): string {
  if (c.key) return c.key;
  return identifierKey(`${c.label} ${c.detail ?? ""} ${c.quote}`) ?? `${c.kind}:${normalizeLabel(c.label)}`;
}

export function mergeCandidates(detected: Candidate[], ai: Candidate[]): Candidate[] {
  const byKey = new Map<string, Candidate>();
  for (const d of detected) byKey.set(candidateKey(d), { ...d, key: candidateKey(d) });
  for (const a of ai) {
    const key = candidateKey(a);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...a, key });
    } else if (existing.found_by === "detector" && !existing.detail && a.detail) {
      byKey.set(key, { ...existing, detail: a.detail });
    }
  }
  return [...byKey.values()];
}

// Federal-only items (wage determinations, FAR provisions, SAM, SF forms)
// belong on bids for federal agencies, or where the documents themselves
// carry federal forms/provisions (a locally run, federally funded bid).
export function allowFederalItems(agency: string, detected: Candidate[]): boolean {
  if (isFederalAgency(agency)) return true;
  return detected.some((d) => d.key !== null && (d.key.startsWith("form:sf-") || d.key.startsWith("far:")));
}

export function finalizeCandidates(
  merged: Candidate[],
  opts: { agency: string; detected: Candidate[]; existingKeys: Set<string> }
): (Candidate & { key: string })[] {
  const federalOk = allowFederalItems(opts.agency, opts.detected);
  return merged
    .map((c) => ({ ...c, key: candidateKey(c) }))
    .filter((c) => (federalOk || !c.federal) && !opts.existingKeys.has(c.key));
}
```

- [ ] **Step 4: Run the tests to confirm they pass, then typecheck**

Run: `node --experimental-strip-types --test lib/checklist/merge.test.ts && npx tsc --noEmit -p .`
Expected: 5 pass, and the typecheck is clean. `lib/federal-agency.ts` has no imports, so the relative `.ts` import works under `node --test`.

- [ ] **Step 5: Commit**

```bash
git add lib/checklist/merge.ts lib/checklist/merge.test.ts
git commit -m "Checklist: merge detector and AI items, dedupe, keep federal items to federal bids" -m "<attribution lines>"
```

---

### Task 5: Text extraction and chunking

**Files:**
- Modify: `package.json` / `package-lock.json` (`unpdf`)
- Create: `lib/checklist/extract-text.ts`, `lib/checklist/extract-text.test.ts`, `lib/checklist/chunk.ts`, `lib/checklist/chunk.test.ts`

**Interfaces:**
- Consumes: `FilePages` (Task 3)
- Produces:
  - `function extractFileText(fileName: string, buffer: Buffer): Promise<FilePages & { totalPages: number | null }>`: `pages: null` means no readable text.
  - `type Chunk = { fileName: string; startPage: number; endPage: number; text: string }`
  - `function chunkPages(files: FilePages[], maxChars?: number, totalCap?: number): { chunks: Chunk[]; pagesRead: { file: string; total: number; read: number }[] }`

- [ ] **Step 1: Install `unpdf` and check its API**

```bash
npm install unpdf
node -e 'import("unpdf").then(m => console.log(Object.keys(m).filter(k => /extractText|getDocumentProxy/.test(k))))'
```

Expected: `[ 'extractText', 'getDocumentProxy' ]` (order may vary). If the names differ, read `node_modules/unpdf/README.md` and adjust Step 3 to match. Log a ruling.

- [ ] **Step 2: Write the failing tests**

`lib/checklist/chunk.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { chunkPages } from "./chunk.ts";

test("pages are packed into chunks with document and page markers", () => {
  const { chunks, pagesRead } = chunkPages([{ fileName: "a.pdf", pages: ["one", "two", "three"] }], 40);
  assert.ok(chunks.length >= 2);
  assert.match(chunks[0].text, /^--- Document: a\.pdf ---\n--- Page 1 ---\none/);
  assert.equal(chunks[0].startPage, 1);
  assert.equal(chunks.at(-1)!.endPage, 3);
  assert.deepEqual(pagesRead, [{ file: "a.pdf", total: 3, read: 3 }]);
});

test("unreadable files produce no chunks", () => {
  assert.deepEqual(chunkPages([{ fileName: "scan.pdf", pages: null }]).chunks, []);
});

test("the total cap stops reading and records how far each file got", () => {
  const page = "x".repeat(100);
  // Each page block is "--- Page N ---\n" + 100 chars + "\n" = 116 chars: 4 fit in 480, a 5th would not.
  const { chunks, pagesRead } = chunkPages([{ fileName: "big.pdf", pages: Array(10).fill(page) }], 1000, 480);
  assert.equal(chunks.at(-1)!.endPage, 4);
  assert.deepEqual(pagesRead, [{ file: "big.pdf", total: 10, read: 4 }]);
});
```

`lib/checklist/extract-text.test.ts` builds a real two-page PDF with the repo's existing `jspdf`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { jsPDF } from "jspdf";
import { extractFileText } from "./extract-text.ts";

test("a PDF with text returns one string per page", async () => {
  const doc = new jsPDF();
  doc.text("Complete the SF 1449 blocks 12 and 30.", 10, 10);
  doc.addPage();
  doc.text("Acknowledge Amendment 0001.", 10, 10);
  const buffer = Buffer.from(doc.output("arraybuffer"));
  const out = await extractFileText("rfq.pdf", buffer);
  assert.equal(out.totalPages, 2);
  assert.match(out.pages![0], /SF 1449/);
  assert.match(out.pages![1], /Amendment 0001/);
});

test("a PDF with no text is unreadable", async () => {
  const doc = new jsPDF();
  doc.rect(10, 10, 50, 50);
  const out = await extractFileText("scan.pdf", Buffer.from(doc.output("arraybuffer")));
  assert.equal(out.pages, null);
  assert.equal(out.totalPages, 1);
});

test("plain text files are one page", async () => {
  const out = await extractFileText("notes.txt", Buffer.from("Bid bond of 5 percent required."));
  assert.deepEqual(out.pages, ["Bid bond of 5 percent required."]);
});
```

Run: `node --experimental-strip-types --test lib/checklist/chunk.test.ts lib/checklist/extract-text.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Write `lib/checklist/extract-text.ts`**

```ts
import { extractText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";
import { detectDocumentKind } from "../document-parsing.ts";
import type { FilePages } from "./detectors.ts";

// The document's own text, page by page -- what the detectors scan, what the
// AI reads for text-layer PDFs, and what every quote is verified against.
// pages: null means no readable text (e.g. a scanned PDF).
const MIN_READABLE_CHARS = 40;

export async function extractFileText(
  fileName: string,
  buffer: Buffer
): Promise<FilePages & { totalPages: number | null }> {
  const kind = detectDocumentKind("", fileName);
  if (kind === "pdf") {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { totalPages, text } = await extractText(pdf, { mergePages: false });
    const pages = (text as string[]).map((p) => p ?? "");
    const readable = pages.join("").replace(/\s/g, "").length >= MIN_READABLE_CHARS;
    return { fileName, pages: readable ? pages : null, totalPages };
  }
  const text = kind === "docx" ? (await mammoth.extractRawText({ buffer })).value : buffer.toString("utf-8");
  return { fileName, pages: text.trim() ? [text] : null, totalPages: 1 };
}
```

If `lib/document-parsing.ts` imports anything that `node --test` can't resolve, which the test run in Step 5 would show, copy its three-line `detectDocumentKind` logic inline here instead. Log a ruling.

- [ ] **Step 4: Write `lib/checklist/chunk.ts`**

```ts
import type { FilePages } from "./detectors.ts";

// Splits readable text into page-range chunks for parallel AI requests: one
// request over a long solicitation can outlast Vercel's 60-second limit.
// Each chunk carries document and page markers so the AI reports exact
// pages. totalCap bounds the whole reading; pagesRead says how far each
// file got so a partial read is shown, never hidden.
export type Chunk = { fileName: string; startPage: number; endPage: number; text: string };

export function chunkPages(
  files: FilePages[],
  maxChars = 60_000,
  totalCap = 360_000
): { chunks: Chunk[]; pagesRead: { file: string; total: number; read: number }[] } {
  const chunks: Chunk[] = [];
  const pagesRead: { file: string; total: number; read: number }[] = [];
  let used = 0;
  for (const file of files) {
    if (!file.pages) continue;
    let current: Chunk | null = null;
    let read = 0;
    for (let i = 0; i < file.pages.length; i++) {
      const block = `--- Page ${i + 1} ---\n${file.pages[i]}\n`;
      if (used + block.length > totalCap) break;
      if (!current || current.text.length + block.length > maxChars) {
        if (current) chunks.push(current);
        current = { fileName: file.fileName, startPage: i + 1, endPage: i + 1, text: `--- Document: ${file.fileName} ---\n` };
      }
      current.text += block;
      current.endPage = i + 1;
      used += block.length;
      read = i + 1;
    }
    if (current) chunks.push(current);
    pagesRead.push({ file: file.fileName, total: file.pages.length, read });
  }
  return { chunks, pagesRead };
}
```

- [ ] **Step 5: Run the tests to confirm they pass, then typecheck**

Run: `node --experimental-strip-types --test lib/checklist/chunk.test.ts lib/checklist/extract-text.test.ts && npx tsc --noEmit -p .`
Expected: 6 pass, and the typecheck is clean.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json lib/checklist/extract-text.ts lib/checklist/extract-text.test.ts lib/checklist/chunk.ts lib/checklist/chunk.test.ts
git commit -m "Checklist: extract solicitation text per page (unpdf/mammoth) and chunk it for parallel reading" -m "<attribution lines>"
```

---

### Task 6: The AI pass

**Files:**
- Create: `lib/checklist/ai-pass.ts`, `lib/checklist/ai-pass.test.ts`

**Interfaces:**
- Consumes: `Candidate`, `KINDS`, `defaultOwner` (Task 2); `Chunk` (Task 5)
- Produces:
  - `function coerceAiItems(parsed: unknown): Candidate[]` (pure);
  - `function runAiPass(input: { chunks: Chunk[]; scannedPdfs: { fileName: string; buffer: Buffer }[]; agency: string }): Promise<{ items: Candidate[]; failed: string[] }>`: `failed` lists a human-readable reason per chunk or file that failed.

- [ ] **Step 1: Write the failing tests, `lib/checklist/ai-pass.test.ts`**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { coerceAiItems } from "./ai-pass.ts";

test("valid items are kept and normalised", () => {
  const items = coerceAiItems({
    items: [
      { kind: "bond", federal: false, label: " Bid bond ", detail: "5% of bid", quote: "A bid bond of 5% is required.", page: 4, source_file: "rfp.pdf", suggested_owner: "client" },
      { kind: "submission_rule", federal: false, label: "Submit by email", detail: "", quote: "Email offers to the CO.", page: 0, source_file: "", suggested_owner: "admin" },
    ],
  });
  assert.equal(items.length, 2);
  assert.deepEqual(items[0], {
    kind: "bond", federal: false, label: "Bid bond", detail: "5% of bid", quote: "A bid bond of 5% is required.",
    page: 4, source_file: "rfp.pdf", found_by: "ai", key: null, suggested_owner: "client",
  });
  assert.equal(items[1].page, null, "0 means unknown");
  assert.equal(items[1].source_file, null, "empty means unknown");
  assert.equal(items[1].detail, null);
});

test("items with an unknown kind, no label or no quote are dropped", () => {
  const items = coerceAiItems({
    items: [
      { kind: "pizza", label: "x", quote: "long enough quote" },
      { kind: "bond", label: "", quote: "long enough quote" },
      { kind: "bond", label: "Bid bond", quote: "" },
    ],
  });
  assert.deepEqual(items, []);
});

test("a bad owner falls back to the kind's default", () => {
  const [item] = coerceAiItems({ items: [{ kind: "wage_determination", label: "WD", quote: "WD 2015-4523 applies here", suggested_owner: "nobody" }] });
  assert.equal(item.suggested_owner, "admin");
});

test("garbage input yields nothing", () => {
  assert.deepEqual(coerceAiItems(null), []);
  assert.deepEqual(coerceAiItems({ items: "no" }), []);
});
```

Run: `node --experimental-strip-types --test lib/checklist/ai-pass.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 2: Write `lib/checklist/ai-pass.ts`**

```ts
import Anthropic from "@anthropic-ai/sdk";
import { KINDS, defaultOwner, type Candidate, type Kind } from "./types.ts";
import type { Chunk } from "./chunk.ts";

// The AI half of the checklist: lists every item a bidder must submit or do,
// each with a verbatim quote. Quotes are verified afterwards against the
// document text (verify-quote.ts); fixed identifiers are also found by plain
// code (detectors.ts). Chunks are read in parallel to stay inside Vercel's
// 60-second function limit.

const SYSTEM_PROMPT = `You read US government solicitation documents (federal, state, county, city, school district, authority) for a small-business bid-preparation service. List every item the bidder must SUBMIT or DO to have a complete, compliant bid.

Include:
- Required forms and attachments by name, and which parts must be filled in or signed (e.g. "Complete and sign SF 1449, blocks 12, 17a, 23, 24 and 30").
- Every amendment or addendum to acknowledge, and how.
- Bid bond / bid guarantee requirements.
- Required sworn statements, affidavits and certifications (e.g. public entity crimes, drug-free workplace, E-Verify, conflict of interest, FAR representations).
- Licenses, registrations and insurance certificates that must be included with the bid.
- Submission rules: deadline, method (email, portal, sealed envelope), address, number of copies, page limits, file formats, labelling.
- For federal solicitations: the wage determination number and revision, FAR provisions that require a representation or certification from the offeror, SAM registration, and the evaluation method (lowest price technically acceptable, best value, etc.).

Rules:
- Only list items the document actually states. Never invent a requirement, number, form, date or address.
- "quote" must be copied VERBATIM from the document text, character for character, under 300 characters. A program will search for it; a paraphrased quote is treated as invalid.
- "page" is the number from the nearest preceding "--- Page N ---" marker; use 0 if there is none.
- "source_file" is copied from the "--- Document: <name> ---" marker; use "" if unknown.
- "suggested_owner": "client" for things the bidder signs, completes, attaches or certifies; "admin" for rules to check (deadline, method, format, evaluation, wage determination, SAM check).
- "federal": true only for items that exist because the buyer is a federal agency (SF forms, FAR provisions, wage determinations, SAM).
- Do not list background, scope of work, or contract performance terms that need nothing at bid time.`;

const ITEM_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: [...KINDS] },
          federal: { type: "boolean" },
          label: { type: "string" },
          detail: { type: "string" },
          quote: { type: "string" },
          page: { type: "integer" },
          source_file: { type: "string" },
          suggested_owner: { type: "string", enum: ["client", "admin"] },
        },
        required: ["kind", "federal", "label", "detail", "quote", "page", "source_file", "suggested_owner"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
} as const;

export function coerceAiItems(parsed: unknown): Candidate[] {
  const items = (parsed as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) return [];
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const out: Candidate[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const kind = KINDS.includes(r.kind as Kind) ? (r.kind as Kind) : null;
    const label = str(r.label);
    const quote = str(r.quote);
    if (!kind || !label || !quote) continue;
    const page = typeof r.page === "number" && Number.isInteger(r.page) && r.page > 0 ? r.page : null;
    const owner = r.suggested_owner === "client" || r.suggested_owner === "admin" ? r.suggested_owner : defaultOwner(kind);
    out.push({
      kind,
      federal: r.federal === true,
      label,
      detail: str(r.detail),
      quote,
      page,
      source_file: str(r.source_file),
      found_by: "ai",
      key: null,
      suggested_owner: owner,
    });
  }
  return out;
}

async function readOne(
  client: Anthropic,
  content: Anthropic.Beta.BetaContentBlockParam[],
  agency: string
): Promise<Candidate[]> {
  const response = await client.beta.messages.create({
    model: "claude-opus-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: ITEM_SCHEMA } },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [...content, { type: "text", text: `Buyer: ${agency}. List the required submission items from the document text above.` }],
      },
    ],
  });
  if (response.stop_reason === "refusal") throw new Error("The AI declined to read this part of the document.");
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("The AI returned no result.");
  return coerceAiItems(JSON.parse(text.text));
}

export async function runAiPass(input: {
  chunks: Chunk[];
  scannedPdfs: { fileName: string; buffer: Buffer }[];
  agency: string;
}): Promise<{ items: Candidate[]; failed: string[] }> {
  const client = new Anthropic();
  const jobs: { label: string; run: () => Promise<Candidate[]> }[] = [
    ...input.chunks.map((c) => ({
      label: `${c.fileName} pages ${c.startPage}-${c.endPage}`,
      run: () => readOne(client, [{ type: "text", text: c.text }], input.agency),
    })),
    ...input.scannedPdfs.map((f) => ({
      label: `${f.fileName} (scanned)`,
      run: () =>
        readOne(
          client,
          [
            { type: "text", text: `--- Document: ${f.fileName} ---` },
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: f.buffer.toString("base64") } },
          ],
          input.agency
        ),
    })),
  ];
  const settled = await Promise.allSettled(jobs.map((j) => j.run()));
  const items: Candidate[] = [];
  const failed: string[] = [];
  settled.forEach((s, i) => {
    if (s.status === "fulfilled") items.push(...s.value);
    else failed.push(`${jobs[i].label}: ${s.reason instanceof Error ? s.reason.message : "failed"}`);
  });
  return { items, failed };
}
```

- [ ] **Step 3: Run the tests, then typecheck**

Run: `node --experimental-strip-types --test lib/checklist/ai-pass.test.ts && npx tsc --noEmit -p .`
Expected: 4 pass. If `tsc` rejects `betas`/`fallbacks`/`output_config.format` on `client.beta.messages.create` for the installed SDK version, read the SDK's `resources/beta/messages/messages.d.ts` for the accepted field names and use them. If `fallbacks` isn't typed at all, check `npm view @anthropic-ai/sdk version`, then ask the user before upgrading the SDK. Log a ruling either way. (The live call is exercised in Task 10.)

- [ ] **Step 4: Commit**

```bash
git add lib/checklist/ai-pass.ts lib/checklist/ai-pass.test.ts
git commit -m "Checklist: AI pass with structured output, parallel chunks, refusal fallback" -m "<attribution lines>"
```

---

### Task 7: The scan route

**Files:**
- Create: `lib/checklist/scan-state.ts`, `lib/checklist/scan-state.test.ts`, `app/api/checklist-scan/route.ts`

**Interfaces:**
- Consumes: Tasks 2–6; `isFederalAgency`
- Produces:
  - `type ScanState = { status: "running" | "done" | "failed"; started_at: string; finished_at?: string; files_fingerprint: string; error?: string | null; pages_read?: { file: string; total: number; read: number }[]; ai_failed?: string[] }`
  - `function filesFingerprint(files: { file_name: string; created_at: string }[]): string`
  - `function isScanStale(scan: ScanState | null, now: Date): boolean`: a running scan whose `started_at` is over 90 s old.
  - `POST /api/checklist-scan` with body `{ submissionId: string; force?: boolean }`. It returns:
    - `200 { status: "done" | "failed" | "running" | "no_files", inserted?: number }`;
    - `401` when not logged in;
    - `404` when the submission isn't visible to the caller.

- [ ] **Step 1: Write the failing tests, `lib/checklist/scan-state.test.ts`**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { filesFingerprint, isScanStale } from "./scan-state.ts";

test("fingerprint depends on names and upload times, not order", () => {
  const a = filesFingerprint([{ file_name: "a.pdf", created_at: "2026-09-25T10:00:00Z" }, { file_name: "b.pdf", created_at: "2026-09-25T11:00:00Z" }]);
  const b = filesFingerprint([{ file_name: "b.pdf", created_at: "2026-09-25T11:00:00Z" }, { file_name: "a.pdf", created_at: "2026-09-25T10:00:00Z" }]);
  const c = filesFingerprint([{ file_name: "a.pdf", created_at: "2026-09-25T10:00:00Z" }]);
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test("a running scan older than 90 seconds is stale (the function was killed)", () => {
  const now = new Date("2026-09-25T12:00:00Z");
  const scan = (secondsAgo: number) => ({ status: "running" as const, started_at: new Date(now.getTime() - secondsAgo * 1000).toISOString(), files_fingerprint: "x" });
  assert.equal(isScanStale(scan(30), now), false);
  assert.equal(isScanStale(scan(91), now), true);
  assert.equal(isScanStale({ ...scan(500), status: "done" }, now), false);
  assert.equal(isScanStale(null, now), false);
});
```

Run: `node --experimental-strip-types --test lib/checklist/scan-state.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 2: Write `lib/checklist/scan-state.ts`**

```ts
import { createHash } from "node:crypto";

export type ScanState = {
  status: "running" | "done" | "failed";
  started_at: string;
  finished_at?: string;
  files_fingerprint: string;
  error?: string | null;
  pages_read?: { file: string; total: number; read: number }[];
  ai_failed?: string[];
};

// Same files, same fingerprint: a finished scan of them is reused instead of
// paying for another AI reading.
export function filesFingerprint(files: { file_name: string; created_at: string }[]): string {
  const parts = files.map((f) => `${f.file_name}@${f.created_at}`).sort();
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

// Vercel stops the function at 60 seconds and nothing records the kill, so
// "running" for more than 90 seconds means it died: show it as timed out
// and allow a new run.
const STALE_AFTER_MS = 90_000;

export function isScanStale(scan: ScanState | null, now: Date): boolean {
  if (!scan || scan.status !== "running") return false;
  return now.getTime() - new Date(scan.started_at).getTime() > STALE_AFTER_MS;
}
```

Run the test again: all 2 pass.

- [ ] **Step 3: Write `app/api/checklist-scan/route.ts`**

```ts
import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { extractFileText } from "@/lib/checklist/extract-text";
import { detectItems, type FilePages } from "@/lib/checklist/detectors";
import { chunkPages } from "@/lib/checklist/chunk";
import { runAiPass } from "@/lib/checklist/ai-pass";
import { verifyQuote } from "@/lib/checklist/verify-quote";
import { mergeCandidates, finalizeCandidates } from "@/lib/checklist/merge";
import { filesFingerprint, isScanStale, type ScanState } from "@/lib/checklist/scan-state";

export const runtime = "nodejs";
export const maxDuration = 60;

// Reads a bid's solicitation files and saves checklist suggestions for an
// admin to review (docs/superpowers/specs/2026-09-25-submission-checklist-design.md).
// Called right after a solicitation upload -- by the admin or by the client
// -- and by the panel's "Check again". Access is checked with the caller's
// own session first (RLS: the bid's admin or its own client can read the
// submission); only then does the service role do the reading and writing,
// because suggestions are admin-only rows.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const submissionId = body && typeof body === "object" ? (body as { submissionId?: unknown }).submissionId : null;
  const force = !!(body && typeof body === "object" && (body as { force?: unknown }).force === true);
  if (typeof submissionId !== "string") return NextResponse.json({ error: "Invalid submissionId." }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { data: visible } = await supabase.from("submissions").select("id").eq("id", submissionId).maybeSingle();
  if (!visible) return NextResponse.json({ error: "Submission not found." }, { status: 404 });

  const service = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: submission } = await service
    .from("submissions")
    .select("id, agency, checklist_scan, clients!submissions_client_id_fkey(org_id)")
    .eq("id", submissionId)
    .single();
  const orgId = (submission?.clients as unknown as { org_id: string } | null)?.org_id;
  if (!submission || !orgId) return NextResponse.json({ error: "Submission not found." }, { status: 404 });

  const { data: docs } = await service
    .from("submission_documents")
    .select("file_name, file_url, created_at")
    .eq("submission_id", submissionId)
    .eq("document_type", "rfp_file")
    .order("created_at", { ascending: true });
  if (!docs || docs.length === 0) return NextResponse.json({ status: "no_files" });

  const fingerprint = filesFingerprint(docs);
  const previous = submission.checklist_scan as ScanState | null;
  const now = new Date();
  if (!force && previous?.status === "done" && previous.files_fingerprint === fingerprint) {
    return NextResponse.json({ status: "done", inserted: 0 });
  }
  if (previous?.status === "running" && !isScanStale(previous, now)) {
    return NextResponse.json({ status: "running" });
  }

  const started: ScanState = { status: "running", started_at: now.toISOString(), files_fingerprint: fingerprint };
  await service.from("submissions").update({ checklist_scan: started }).eq("id", submissionId);

  try {
    // Download and read every file's own text.
    const files: (FilePages & { buffer: Buffer })[] = [];
    for (const doc of docs) {
      const { data: blob } = await service.storage.from("rfp-documents").download(doc.file_url);
      if (!blob) continue;
      const buffer = Buffer.from(await blob.arrayBuffer());
      const text = await extractFileText(doc.file_name, buffer);
      files.push({ fileName: doc.file_name, pages: text.pages, buffer });
    }

    const detected = detectItems(files);
    const { chunks, pagesRead } = chunkPages(files);
    const scannedPdfs = files
      .filter((f) => f.pages === null && f.fileName.toLowerCase().endsWith(".pdf"))
      .map((f) => ({ fileName: f.fileName, buffer: f.buffer }));
    const ai = await runAiPass({ chunks, scannedPdfs, agency: submission.agency });

    const { data: existing } = await service
      .from("checklist_suggestions")
      .select("dedupe_key")
      .eq("submission_id", submissionId);
    const finalized = finalizeCandidates(mergeCandidates(detected, ai.items), {
      agency: submission.agency,
      detected,
      existingKeys: new Set((existing ?? []).map((e) => e.dedupe_key)),
    });

    const textByFile = new Map(files.map((f) => [f.fileName, f.pages ? f.pages.join("\n") : null]));
    const allText = [...textByFile.values()].filter(Boolean).join("\n") || null;
    const rows = finalized.map((c) => {
      // Verify against the named file; if the AI named no file or a file
      // that doesn't exist, verify against all the text rather than calling
      // the quote unreadable.
      const fileText = c.source_file && textByFile.has(c.source_file) ? textByFile.get(c.source_file)! : allText;
      return {
        submission_id: submissionId,
        org_id: orgId,
        kind: c.kind,
        federal: c.federal,
        label: c.label,
        detail: c.detail,
        quote: c.quote,
        page: c.page,
        source_file: c.source_file,
        quote_status: c.found_by === "detector" ? "verified" : verifyQuote(c.quote, fileText),
        found_by: c.found_by,
        suggested_owner: c.suggested_owner,
        dedupe_key: c.key,
      };
    });
    if (rows.length > 0) {
      const { error } = await service.from("checklist_suggestions").upsert(rows, { onConflict: "submission_id,dedupe_key", ignoreDuplicates: true });
      if (error) throw new Error(`Couldn't save suggestions: ${error.message}`);
    }

    const allAiFailed = ai.failed.length > 0 && ai.failed.length === chunks.length + scannedPdfs.length;
    const finished: ScanState = {
      ...started,
      status: allAiFailed ? "failed" : "done",
      finished_at: new Date().toISOString(),
      error: allAiFailed ? `The AI reading failed: ${ai.failed[0]}` : null,
      pages_read: pagesRead,
      ai_failed: ai.failed,
    };
    await service.from("submissions").update({ checklist_scan: finished }).eq("id", submissionId);
    return NextResponse.json({ status: finished.status, inserted: rows.length });
  } catch (err) {
    const failed: ScanState = {
      ...started,
      status: "failed",
      finished_at: new Date().toISOString(),
      error: err instanceof Error ? err.message : "The scan failed.",
    };
    await service.from("submissions").update({ checklist_scan: failed }).eq("id", submissionId);
    return NextResponse.json({ status: "failed", error: failed.error }, { status: 500 });
  }
}
```

- [ ] **Step 4: Typecheck, test, and check it refuses logged-out callers**

Run: `npx tsc --noEmit -p . && npm test` (all pass). With the dev server running:
```bash
curl -s -X POST localhost:3000/api/checklist-scan -H 'Content-Type: application/json' -d '{"submissionId":"x"}'
```
Expected: `{"error":"Not authenticated."}`.

- [ ] **Step 5: Commit**

```bash
git add lib/checklist/scan-state.ts lib/checklist/scan-state.test.ts app/api/checklist-scan/route.ts
git commit -m "Checklist scan route: read files, detect, AI pass, verify quotes, save suggestions" -m "<attribution lines>"
```

---

### Task 8: Approve, reject, restore, approve-all and send routes

**Files:**
- Create:
  - `lib/checklist/approve.ts`;
  - `lib/checklist/send-result.ts`, `lib/checklist/send-result.test.ts`;
  - `app/api/checklist-suggestions/[id]/route.ts`;
  - `app/api/checklist-suggestions/approve-verified/route.ts`;
  - `app/api/send-checklist-items/route.ts`.
- Modify: `lib/email/templates.ts`

**Interfaces:**
- Produces:
  - `function approveSuggestion(supabase, suggestionId: string, owner: "client" | "admin" | null, actorId: string): Promise<{ ok: true; checklistItemId: string } | { ok: false; status: 409 | 500; error: string }>`
  - `PATCH /api/checklist-suggestions/[id]` with body `{ action: "approve" | "reject" | "restore"; owner?: "client" | "admin" }`
  - `POST /api/checklist-suggestions/approve-verified` with body `{ submissionId: string; expected: number }`, returning `200 { approved: number }` or `409 { error, count }`
  - `POST /api/send-checklist-items` with body `{ submissionId: string }`, returning `{ sent: boolean; count?: number; reason?: string; error?: string }`
  - `function describeSendResult(status: number, body): { sent: boolean; message: string }`
  - `function getChecklistItemsEmail(agency: string, companyName: string, items: { label: string; detail: string | null }[]): { subject: string; html: string }`

- [ ] **Step 1: Write the failing test, `lib/checklist/send-result.test.ts`**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { describeSendResult } from "./send-result.ts";

test("sent reports the count", () => {
  assert.deepEqual(describeSendResult(200, { sent: true, count: 3 }), { sent: true, message: "Sent the client their list (3 items)." });
  assert.equal(describeSendResult(200, { sent: true, count: 1 }).message, "Sent the client their list (1 item).");
});
test("known reasons read plainly", () => {
  assert.match(describeSendResult(200, { sent: false, reason: "nothing_new" }).message, /nothing new/i);
  assert.match(describeSendResult(200, { sent: false, reason: "no_client_email" }).message, /no email address/i);
  assert.match(describeSendResult(200, { sent: false, reason: "test_submission" }).message, /test submission/i);
});
test("failures are never reported as sent", () => {
  const r = describeSendResult(502, { error: "Resend: rate limited" });
  assert.equal(r.sent, false);
  assert.match(r.message, /rate limited/);
  assert.equal(describeSendResult(0, null).sent, false);
});
```

Run: `node --experimental-strip-types --test lib/checklist/send-result.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 2: Write `lib/checklist/send-result.ts`**

```ts
// What the admin sees after "Send the client their list". Anything not
// explicitly sent is reported as not sent.
type Body = { sent?: boolean; count?: number; reason?: string; error?: string } | null;

export function describeSendResult(status: number, body: Body): { sent: boolean; message: string } {
  if (status >= 200 && status < 300 && body?.sent === true) {
    const n = body.count ?? 0;
    return { sent: true, message: `Sent the client their list (${n} ${n === 1 ? "item" : "items"}).` };
  }
  if (body?.reason === "nothing_new") return { sent: false, message: "There's nothing new to send the client." };
  if (body?.reason === "no_client_email") return { sent: false, message: "The client has no email address on file, so nothing was sent." };
  if (body?.reason === "test_submission") return { sent: false, message: "This is a test submission, so no email was sent." };
  const detail = body?.error ? ` (${body.error})` : status ? ` (HTTP ${status})` : "";
  return { sent: false, message: `The email didn't send${detail}.` };
}
```

Run the test again: all 3 pass.

- [ ] **Step 3: Add the email template** (`lib/email/templates.ts`, before `getContactMessageEmail`)

```ts
// "Send the client their list" on the admin bid page: the items from the
// solicitation that are the client's to do (sign, attach, certify).
export function getChecklistItemsEmail(
  agency: string,
  companyName: string,
  items: { label: string; detail: string | null }[]
) {
  const list = items
    .map((i) => `<li>${escapeHtml(i.label)}${i.detail ? ` <br><span style="color:#555">${escapeHtml(i.detail)}</span>` : ""}</li>`)
    .join("");
  return {
    subject: `What we need from you for the ${agency} bid`,
    html: `
      <p>Hi ${escapeHtml(companyName)},</p>
      <p>We read through the ${escapeHtml(agency)} solicitation. To complete your bid, we need you to take care of these:</p>
      <ul>${list}</ul>
      <p>You'll also see this list on your dashboard. Reply or message us there with any questions.</p>
      <p>— First Coast Bids</p>
    `,
  };
}
```

If `lib/email/templates.ts` has no `escapeHtml` helper (`grep -n "escapeHtml" lib/email/templates.ts`), add this one above the new function:
```ts
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
```

- [ ] **Step 4: Write `lib/checklist/approve.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

// Approving a suggestion: claim it (only while still pending, so a double
// click or two admins approving at once create ONE checklist item), then
// add the checklist item with its owner and source, then link them. If the
// insert fails, the claim is released so the admin can retry.
export async function approveSuggestion(
  supabase: SupabaseClient,
  suggestionId: string,
  owner: "client" | "admin" | null,
  actorId: string
): Promise<{ ok: true; checklistItemId: string } | { ok: false; status: 409 | 500; error: string }> {
  const { data: claimed, error: claimError } = await supabase
    .from("checklist_suggestions")
    .update({ status: "approved", decided_at: new Date().toISOString(), decided_by: actorId, ...(owner ? { suggested_owner: owner } : {}) })
    .eq("id", suggestionId)
    .eq("status", "pending")
    .select("id, submission_id, label, detail, quote, page, source_file, suggested_owner");
  if (claimError) return { ok: false, status: 500, error: claimError.message };
  if (!claimed || claimed.length !== 1) return { ok: false, status: 409, error: "This suggestion was already decided." };
  const s = claimed[0];

  const { data: item, error: insertError } = await supabase
    .from("checklist_items")
    .insert({
      submission_id: s.submission_id,
      label: s.label,
      notes: s.detail,
      owner: s.suggested_owner,
      source_quote: s.quote,
      source_page: s.page,
      source_file: s.source_file,
    })
    .select("id")
    .single();
  if (insertError || !item) {
    await supabase.from("checklist_suggestions").update({ status: "pending", decided_at: null, decided_by: null }).eq("id", suggestionId);
    return { ok: false, status: 500, error: insertError?.message ?? "Couldn't add the checklist item." };
  }
  await supabase.from("checklist_suggestions").update({ checklist_item_id: item.id }).eq("id", suggestionId);
  return { ok: true, checklistItemId: item.id };
}
```

- [ ] **Step 5: Write the three routes**

All three authenticate like `app/api/withdraw-assigned-match/route.ts`: a user, then a `team_members` row with `.eq("role", "admin")`. They use the caller's session, so RLS (admin-only) applies to every read and write.

`app/api/checklist-suggestions/[id]/route.ts`:
```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { approveSuggestion } from "@/lib/checklist/approve";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const action = body && typeof body === "object" ? (body as { action?: unknown }).action : null;
  const ownerRaw = body && typeof body === "object" ? (body as { owner?: unknown }).owner : null;
  const owner = ownerRaw === "client" || ownerRaw === "admin" ? ownerRaw : null;
  if (action !== "approve" && action !== "reject" && action !== "restore") {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { data: member } = await supabase
    .from("team_members")
    .select("id")
    .eq("auth_user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  if (action === "approve") {
    const result = await approveSuggestion(supabase, id, owner, member.id);
    return result.ok
      ? NextResponse.json({ ok: true, checklistItemId: result.checklistItemId })
      : NextResponse.json({ error: result.error }, { status: result.status });
  }

  const from = action === "reject" ? "pending" : "rejected";
  const update =
    action === "reject"
      ? { status: "rejected", decided_at: new Date().toISOString(), decided_by: member.id }
      : { status: "pending", decided_at: null, decided_by: null };
  const { data, error } = await supabase.from("checklist_suggestions").update(update).eq("id", id).eq("status", from).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length !== 1) return NextResponse.json({ error: "This suggestion was already changed." }, { status: 409 });
  return NextResponse.json({ ok: true });
}
```

`app/api/checklist-suggestions/approve-verified/route.ts`:
```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { approveSuggestion } from "@/lib/checklist/approve";

// "Approve all verified": approves every pending suggestion with a verified
// quote, but only if the count still matches what the admin confirmed.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const submissionId = body && typeof body === "object" ? (body as { submissionId?: unknown }).submissionId : null;
  const expected = body && typeof body === "object" ? (body as { expected?: unknown }).expected : null;
  if (typeof submissionId !== "string" || typeof expected !== "number") {
    return NextResponse.json({ error: "Missing submissionId or expected." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { data: member } = await supabase
    .from("team_members")
    .select("id")
    .eq("auth_user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  const { data: pending, error } = await supabase
    .from("checklist_suggestions")
    .select("id")
    .eq("submission_id", submissionId)
    .eq("status", "pending")
    .eq("quote_status", "verified");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if ((pending ?? []).length !== expected) {
    return NextResponse.json(
      { error: `The list changed: ${(pending ?? []).length} verified suggestions are waiting now, not ${expected}. Check and confirm again.`, count: (pending ?? []).length },
      { status: 409 }
    );
  }

  let approved = 0;
  const errors: string[] = [];
  for (const s of pending ?? []) {
    const result = await approveSuggestion(supabase, s.id, null, member.id);
    if (result.ok) approved++;
    else errors.push(result.error);
  }
  return NextResponse.json({ approved, failed: errors.length, errors });
}
```

`app/api/send-checklist-items/route.ts`:
```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";
import { getChecklistItemsEmail } from "@/lib/email/templates";

// Emails the client every approved client-owned item they haven't been told
// about yet, once, then marks exactly those items notified.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const submissionId = body && typeof body === "object" ? (body as { submissionId?: unknown }).submissionId : null;
  if (typeof submissionId !== "string") return NextResponse.json({ error: "Invalid submissionId." }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { data: member } = await supabase
    .from("team_members")
    .select("id, org_id")
    .eq("auth_user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  const { data: submission } = await supabase
    .from("submissions")
    .select("id, agency, is_test, clients!submissions_client_id_fkey(company_name, email)")
    .eq("id", submissionId)
    .maybeSingle();
  if (!submission) return NextResponse.json({ error: "Submission not found." }, { status: 404 });

  const { data: items } = await supabase
    .from("checklist_items")
    .select("id, label, notes")
    .eq("submission_id", submissionId)
    .eq("owner", "client")
    .is("client_notified_at", null)
    .not("status", "in", "(done,waived)");
  if (!items || items.length === 0) return NextResponse.json({ sent: false, reason: "nothing_new" });
  if (submission.is_test) return NextResponse.json({ sent: false, reason: "test_submission" });
  const client = submission.clients as unknown as { company_name: string; email: string | null } | null;
  if (!client?.email) return NextResponse.json({ sent: false, reason: "no_client_email" });

  const email = getChecklistItemsEmail(
    submission.agency,
    client.company_name,
    items.map((i) => ({ label: i.label, detail: i.notes }))
  );
  try {
    await sendEmail({ to: client.email, subject: email.subject, html: email.html });
  } catch (err) {
    return NextResponse.json({ sent: false, error: err instanceof Error ? err.message : "Send failed." }, { status: 502 });
  }

  const ids = items.map((i) => i.id);
  await supabase.from("checklist_items").update({ client_notified_at: new Date().toISOString() }).in("id", ids);
  await supabase.from("audit_log").insert({
    submission_id: submissionId,
    org_id: member.org_id,
    actor_id: member.id,
    event_type: "checklist_items_sent_to_client",
    event_detail: { to: client.email, checklist_item_ids: ids },
  });
  return NextResponse.json({ sent: true, count: ids.length });
}
```

- [ ] **Step 6: Typecheck, test, and commit**

Run: `npx tsc --noEmit -p . && npm test`
Expected: everything passes.

```bash
git add lib/checklist/approve.ts lib/checklist/send-result.ts lib/checklist/send-result.test.ts lib/email/templates.ts app/api/checklist-suggestions app/api/send-checklist-items
git commit -m "Checklist: approve/reject/restore, approve-all-verified with count check, send the client their list" -m "<attribution lines>"
```

---

### Task 9: Admin panel, upload trigger, owner tags, client notes

**Files:**
- Create: `app/admin/inbox/[id]/ChecklistSuggestionsPanel.tsx`
- Modify:
  - `app/admin/inbox/[id]/page.tsx`, `app/admin/inbox/[id]/AdminSubmissionActions.tsx`;
  - `components/ui/SubmissionDocuments.tsx`;
  - `app/dashboard/page.tsx`, `app/dashboard/SubmissionCard.tsx`.

**Interfaces:**
- Consumes:
  - the routes from Tasks 7–8;
  - `ScanState`, `isScanStale` (Task 7);
  - `describeSendResult` (Task 8);
  - `ConfirmDialog` (`components/ui/ConfirmDialog.tsx`: `open, onClose, onConfirm, title, description, confirmLabel`);
  - `useToast` (`components/Toast`); `Spinner` (`components/ui/Spinner`).
- Produces: `<ChecklistSuggestionsPanel submissionId initialScan initialSuggestions rfpDocumentUrls hasRfpFiles unsentClientItems />`

- [ ] **Step 1: Write `app/admin/inbox/[id]/ChecklistSuggestionsPanel.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/Toast";
import { isScanStale, type ScanState } from "@/lib/checklist/scan-state";
import { describeSendResult } from "@/lib/checklist/send-result";

export type Suggestion = {
  id: string;
  kind: string;
  federal: boolean;
  label: string;
  detail: string | null;
  quote: string;
  page: number | null;
  source_file: string | null;
  quote_status: "verified" | "not_found" | "unreadable";
  found_by: "ai" | "detector";
  suggested_owner: "client" | "admin";
  status: "pending" | "approved" | "rejected";
};

const GROUPS: { title: string; kinds: string[] }[] = [
  { title: "Forms & signatures", kinds: ["form", "sworn_statement", "bond", "license_insurance", "other"] },
  { title: "Amendments", kinds: ["amendment"] },
  { title: "Submission rules", kinds: ["submission_rule", "evaluation_method"] },
  { title: "Federal", kinds: ["far_provision", "wage_determination", "sam_registration"] },
];

const QUOTE_BADGE: Record<Suggestion["quote_status"], { text: string; className: string }> = {
  verified: { text: "Quote verified", className: "bg-secondary-container text-on-secondary-container" },
  not_found: { text: "Quote not found", className: "bg-error-container text-on-error-container" },
  unreadable: { text: "Couldn't verify: scanned document", className: "bg-surface-container-high text-on-surface-variant" },
};

// Suggested checklist items read from the solicitation
// (docs/superpowers/specs/2026-09-25-submission-checklist-design.md). Nothing
// here reaches the client until an admin approves it with an owner.
export function ChecklistSuggestionsPanel({
  submissionId,
  initialScan,
  initialSuggestions,
  rfpDocumentUrls,
  hasRfpFiles,
  unsentClientItems,
}: {
  submissionId: string;
  initialScan: ScanState | null;
  initialSuggestions: Suggestion[];
  rfpDocumentUrls: Record<string, string>;
  hasRfpFiles: boolean;
  unsentClientItems: number;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [scan, setScan] = useState(initialScan);
  const [owners, setOwners] = useState<Record<string, "client" | "admin">>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [showRejected, setShowRejected] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);

  const running = scan?.status === "running" && !isScanStale(scan, new Date());
  const timedOut = scan?.status === "running" && isScanStale(scan, new Date());

  // While a scan runs, poll its state; refresh the page when it finishes.
  useEffect(() => {
    if (!running) return;
    const supabase = createClient();
    const timer = setInterval(async () => {
      const { data } = await supabase.from("submissions").select("checklist_scan").eq("id", submissionId).single();
      const next = (data?.checklist_scan ?? null) as ScanState | null;
      setScan(next);
      if (next?.status !== "running") router.refresh();
    }, 3000);
    return () => clearInterval(timer);
  }, [running, submissionId, router]);

  async function checkAgain() {
    setScan({ status: "running", started_at: new Date().toISOString(), files_fingerprint: "" });
    const res = await fetch("/api/checklist-scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId, force: true }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) showToast(body?.error ?? `The check failed (HTTP ${res.status}).`, "error");
    router.refresh();
  }

  async function decide(s: Suggestion, action: "approve" | "reject" | "restore") {
    setBusy(s.id);
    const res = await fetch(`/api/checklist-suggestions/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, owner: owners[s.id] ?? s.suggested_owner }),
    });
    const body = await res.json().catch(() => null);
    setBusy(null);
    if (!res.ok) showToast(body?.error ?? `That didn't work (HTTP ${res.status}).`, "error");
    router.refresh();
  }

  const pending = initialSuggestions.filter((s) => s.status === "pending");
  const verifiedPending = pending.filter((s) => s.quote_status === "verified");
  const rejected = initialSuggestions.filter((s) => s.status === "rejected");

  async function approveAll() {
    setConfirmAll(false);
    setBusy("all");
    const res = await fetch("/api/checklist-suggestions/approve-verified", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId, expected: verifiedPending.length }),
    });
    const body = await res.json().catch(() => null);
    setBusy(null);
    if (!res.ok) showToast(body?.error ?? `That didn't work (HTTP ${res.status}).`, "error");
    else showToast(`Approved ${body.approved}${body.failed ? `, ${body.failed} failed` : ""}.`, body.failed ? "error" : "success");
    router.refresh();
  }

  async function sendList() {
    setBusy("send");
    const res = await fetch("/api/send-checklist-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId }),
    });
    const result = describeSendResult(res.status, await res.json().catch(() => null));
    setBusy(null);
    showToast(result.message, result.sent ? "success" : "error");
    router.refresh();
  }

  function row(s: Suggestion) {
    const docUrl = s.source_file ? rfpDocumentUrls[s.source_file] : undefined;
    const owner = owners[s.id] ?? s.suggested_owner;
    return (
      <li key={s.id} className="py-3 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-body-md font-bold text-on-surface">{s.label}</span>
          <span className={`px-2 py-0.5 rounded text-label-sm font-bold ${QUOTE_BADGE[s.quote_status].className}`}>
            {QUOTE_BADGE[s.quote_status].text}
          </span>
          {s.found_by === "detector" && <span className="text-label-sm text-on-surface-variant">Found by: plain-code check</span>}
        </div>
        {s.detail && <p className="text-body-sm text-on-surface-variant">{s.detail}</p>}
        <blockquote className="text-body-sm text-on-surface-variant border-l-2 border-outline-variant pl-3 italic">
          &ldquo;{s.quote}&rdquo;
          {docUrl && s.page != null ? (
            <a href={`${docUrl}#page=${s.page}`} target="_blank" rel="noreferrer" className="not-italic ml-2 text-primary font-bold underline">
              {s.source_file}, p. {s.page}
            </a>
          ) : (
            <span className="not-italic ml-2">
              {s.source_file ?? ""}
              {s.page != null ? `, p. ${s.page}` : ""}
            </span>
          )}
        </blockquote>
        {s.status === "pending" ? (
          <div className="flex flex-wrap items-center gap-3">
            <div role="group" aria-label="Owner" className="inline-flex rounded-lg border border-outline-variant overflow-hidden">
              {(["admin", "client"] as const).map((o) => (
                <button
                  key={o}
                  type="button"
                  aria-pressed={owner === o}
                  onClick={() => setOwners((m) => ({ ...m, [s.id]: o }))}
                  className={`px-3 py-1 text-label-sm font-bold ${owner === o ? "bg-primary text-on-primary" : "bg-surface text-on-surface"}`}
                >
                  {o === "admin" ? "Me" : "Client"}
                </button>
              ))}
            </div>
            <button type="button" disabled={busy !== null} onClick={() => decide(s, "approve")} className="px-3 py-1.5 rounded-lg bg-primary text-on-primary text-label-sm font-bold disabled:opacity-40">
              Approve
            </button>
            <button type="button" disabled={busy !== null} onClick={() => decide(s, "reject")} className="px-3 py-1.5 rounded-lg border border-outline-variant text-on-surface text-label-sm font-bold disabled:opacity-40">
              Reject
            </button>
            {busy === s.id && <Spinner />}
          </div>
        ) : (
          <button type="button" disabled={busy !== null} onClick={() => decide(s, "restore")} className="self-start text-primary text-label-sm font-bold">
            Restore
          </button>
        )}
      </li>
    );
  }

  return (
    <section aria-labelledby="checklist-suggestions" className="mt-6 bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="checklist-suggestions" className="text-title-lg text-primary">Checklist suggestions</h2>
        <div className="flex items-center gap-3">
          {scan?.finished_at && <span className="text-body-sm text-on-surface-variant">Last read {new Date(scan.finished_at).toLocaleString()}</span>}
          <button type="button" onClick={checkAgain} disabled={running || !hasRfpFiles} className="px-3 py-1.5 rounded-lg border border-outline-variant text-label-sm font-bold disabled:opacity-40">
            Check again
          </button>
        </div>
      </div>

      {!hasRfpFiles && <p className="mt-3 text-body-md text-on-surface-variant">Upload the agency&apos;s solicitation file to get suggestions.</p>}
      {running && (
        <p className="mt-3 text-body-md text-on-surface flex items-center gap-2">
          <Spinner /> Reading the solicitation…
        </p>
      )}
      {timedOut && <p className="mt-3 text-body-md text-error">The last reading timed out. Check again to retry.</p>}
      {scan?.status === "failed" && <p className="mt-3 text-body-md text-error">{scan.error ?? "The last reading failed."} Check again to retry.</p>}
      {scan?.pages_read
        ?.filter((p) => p.read < p.total)
        .map((p) => (
          <p key={p.file} className="mt-2 text-body-sm text-on-surface-variant">
            Only pages 1–{p.read} of {p.file} were read.
          </p>
        ))}
      {scan?.ai_failed && scan.ai_failed.length > 0 && scan.status === "done" && (
        <p className="mt-2 text-body-sm text-error">Part of the document couldn&apos;t be read: {scan.ai_failed.join("; ")}</p>
      )}

      {GROUPS.map((g) => {
        const items = pending.filter((s) => g.kinds.includes(s.kind));
        if (items.length === 0) return null;
        return (
          <div key={g.title} className="mt-5">
            <h3 className="text-label-md uppercase tracking-wider font-bold text-on-surface-variant">{g.title}</h3>
            <ul className="divide-y divide-outline-variant">{items.map(row)}</ul>
          </div>
        );
      })}

      <div className="mt-5 flex flex-wrap gap-3">
        {verifiedPending.length > 0 && (
          <button type="button" disabled={busy !== null} onClick={() => setConfirmAll(true)} className="px-4 py-2 rounded-lg bg-primary text-on-primary text-label-md font-bold disabled:opacity-40">
            Approve all verified ({verifiedPending.length})
          </button>
        )}
        {unsentClientItems > 0 && (
          <button type="button" disabled={busy !== null} onClick={sendList} className="px-4 py-2 rounded-lg border border-primary text-primary text-label-md font-bold flex items-center gap-2 disabled:opacity-40">
            {busy === "send" && <Spinner />}
            Send the client their list ({unsentClientItems})
          </button>
        )}
        {rejected.length > 0 && (
          <button type="button" onClick={() => setShowRejected((v) => !v)} className="text-on-surface-variant text-label-md font-bold">
            {showRejected ? "Hide rejected" : `Show rejected (${rejected.length})`}
          </button>
        )}
      </div>
      {showRejected && <ul className="mt-3 divide-y divide-outline-variant opacity-80">{rejected.map(row)}</ul>}

      <ConfirmDialog
        open={confirmAll}
        onClose={() => setConfirmAll(false)}
        onConfirm={approveAll}
        title="Approve all verified suggestions?"
        description={`This adds ${verifiedPending.length} items to the bid's checklist, each with the owner shown. Nothing is emailed until you send the client their list.`}
        confirmLabel="Approve all"
      />
    </section>
  );
}
```

"Approve all" uses each suggestion's stored `suggested_owner`, not any unsaved Me/Client toggles on screen. That's intended: the dialog says "each with the owner shown". An admin who wants a different owner approves that item on its own first.

- [ ] **Step 2: Load and mount on `app/admin/inbox/[id]/page.tsx`**

- Change the checklist query's select to `"id, label, status, notes, owner, client_notified_at"`.
- Add `checklist_scan` to the page's main `submissions` select. Find it with `grep -n '.from("submissions")' app/admin/inbox/\[id\]/page.tsx`.
- After the `rfpDocumentUrls` block, add:
  ```ts
  const { data: suggestions } = await supabase
    .from("checklist_suggestions")
    .select("id, kind, federal, label, detail, quote, page, source_file, quote_status, found_by, suggested_owner, status")
    .eq("submission_id", id)
    .order("created_at", { ascending: true });
  // Same rule as /api/send-checklist-items: client items not yet emailed and not finished.
  const unsentClientItems = (checklist ?? []).filter(
    (c: any) => c.owner === "client" && !c.client_notified_at && c.status !== "done" && c.status !== "waived"
  ).length;
  ```
- Import `ChecklistSuggestionsPanel` and render it right before `<AdminSubmissionActions`:
  ```tsx
  <ChecklistSuggestionsPanel
    submissionId={submission.id}
    initialScan={(submission.checklist_scan ?? null) as any}
    initialSuggestions={(suggestions ?? []) as any}
    rfpDocumentUrls={rfpDocumentUrls}
    hasRfpFiles={(rfpDocs ?? []).length > 0}
    unsentClientItems={unsentClientItems}
  />
  ```

- [ ] **Step 3: Owner tag in `AdminSubmissionActions.tsx`**

Add `owner?: string` to its `ChecklistItem` type (find it with `grep -n "type ChecklistItem" app/admin/inbox/\[id\]/AdminSubmissionActions.tsx`). In the checklist row, next to the item's label, render:
```tsx
<span className="ml-2 px-1.5 py-0.5 rounded text-label-sm font-bold bg-surface-container-high text-on-surface-variant">
  {item.owner === "admin" ? "You" : "Client"}
</span>
```
Find the row with `grep -n "localChecklist.map" app/admin/inbox/\[id\]/AdminSubmissionActions.tsx`, and use the loop variable's actual name.

- [ ] **Step 4: Trigger a scan after an RFP upload** (`components/ui/SubmissionDocuments.tsx`)

In `handleUpload`, right after the successful `submission_documents` insert, add:
```ts
      // Read the new solicitation for checklist suggestions. Not awaited:
      // the upload is done; the admin panel shows the reading's progress.
      if (docType === "rfp_file") {
        fetch("/api/checklist-scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ submissionId }),
        }).catch(() => {});
      }
```
That's after the success branch, where the error branch has already returned. Check the local variable names with `sed -n 58,110p components/ui/SubmissionDocuments.tsx`.

- [ ] **Step 5: Client dashboard shows each item's detail**

- `app/dashboard/page.tsx`: `ChecklistItem` becomes `{ id: string; submission_id: string; label: string; status: string; notes: string | null }`, and the select becomes `"id, submission_id, label, status, notes"`. RLS already limits clients to their own items.
- `app/dashboard/SubmissionCard.tsx`: replace the item's label `<span>` with:
  ```tsx
  <span className={`text-body-md text-on-surface ${item.status === "done" ? "line-through" : ""}`}>
    {item.label}
    {item.notes && <span className="block text-body-sm text-on-surface-variant">{item.notes}</span>}
  </span>
  ```

- [ ] **Step 6: Typecheck, test, compile, commit**

Run: `npx tsc --noEmit -p . && npm test`, then with the dev server running: `curl -s -o /dev/null -w "%{http_code}\n" localhost:3000/admin/inbox/x` gives 307 (compiles, redirects to login).

```bash
git add app/admin/inbox components/ui/SubmissionDocuments.tsx app/dashboard
git commit -m "Checklist suggestions panel, scan on RFP upload, owner tags, client item details" -m "<attribution lines>"
```

---

### Task 10: Real documents end to end on dev

This task spends real AI API money (a few requests). It uses dev only.

- [ ] **Step 1: Get two real solicitations**
  - **Federal:** the public attachments of SAM.gov notice **36C24826Q1287** (VA "Boilers PM & Testing"), from the notice page on sam.gov in a browser, or the public download link the page uses. **Don't use the SAM.gov API** (Global Constraints).
  - **Local:** a public Northeast Florida RFP or ITB PDF (for example Clay, Nassau or St. Johns County, or the City of Jacksonville), from a site that serves it without a login or bot check.
  - If either can't be downloaded, **stop and ask the user** to supply one.
  - Save them to the session scratchpad, not the repo.

- [ ] **Step 2: Create one dev test bid for each document, as an admin in the browser**
  - Reset the dev QA admin's password (`qa-admin-matches@firstcoastbids-example.test`) the same way as before: `listUsers` paging, **exactly 1 match required**, then `updateUserById`.
  - Assign one dev match per document to the existing dev test client "QA Withdraw Test Co" (email `delivered@resend.dev`), or create a submission for it by inserting only: one `submissions` row plus its `submission_created_from_match` audit row.
  - On each bid's admin page, upload the document as "The agency's RFP file".

- [ ] **Step 3: Check the results with Playwright** (see the earlier session scripts)
  - The panel shows "Reading the solicitation…", then suggestions within 60 seconds.
  - **Federal RFQ:** check each suggestion by hand against the PDF, including the SF-1449 blocks, the amendments, the wage determination number, FAR 52.212-3 and the submission email.
  - **Local RFP:** check the addenda acknowledgment, the sworn statements and the bond.
  - Count "quote verified" vs "not found". **Any "not found" whose quote actually is in the PDF is a bug:** fix it in `verify-quote.ts` with a new failing test first.
  - **Approving and sending:** approve 2 items (one Me, one Client). Double-click Approve on a third and check only one checklist item appears. Use "Approve all verified", then "Send the client their list". The toast says it was sent, and `delivered@resend.dev` gets it.
  - **Client session:** log in as the test client (reset its password the same way), open the dashboard, and see **only** the client-owned items with their details.
  - **Access:** that client's `POST /api/checklist-scan` for a different client's submission gets `404`.

- [ ] **Step 4: Record the evidence**

Write it in the ledger: counts, the verified/not-found split, screenshots, anything the user should know (e.g. what the AI missed on either document). Commit only if code changed.

---

### Task 11: Production rollout (only with the user's explicit go-ahead)

- [ ] **Step 1:** Ask the user: "Merge `submission-checklist`, apply the migration to production, then push?" Wait for a yes.
- [ ] **Step 2: Production migration first.** Confirm `cat supabase/.temp/project-ref` gives `rixsgnbivayeaxbdseij`. The `npx supabase db push --dry-run` must list only `20260925120000_add_submission_checklist.sql`. Then `npx supabase db push --yes`, then `npx supabase db query --linked "NOTIFY pgrst, 'reload schema'"`.
- [ ] **Step 3: Check nothing changed for clients.** `select owner, count(*) from checklist_items group by 1` gives only `client`.
- [ ] **Step 4: Merge and push.** `git checkout main && git pull --ff-only && git merge --no-ff submission-checklist`, run `npm test` and `npx tsc --noEmit -p .`, then `git push origin main`. Wait for the Vercel deploy with an until-loop on `npx vercel inspect <newest>`.
- [ ] **Step 5: Tell the user how to use it.** Upload the solicitation on a bid, review the suggestions, approve with owners, send the client their list.

---

## Self-review notes

- **Spec coverage:**

  | Spec requirement | Task |
  |---|---|
  | Data and RLS | 1 |
  | Detectors | 3 |
  | Quote verification | 2 |
  | Merge/dedupe | 4 |
  | Federal marking | 4 |
  | Owners | 2 |
  | Text extraction | 5 |
  | AI pass | 6 |
  | Trigger, cache, stale "running", failures, partial reads | 7 (+ 9 for display) |
  | Approve / reject / restore / approve-all | 8 |
  | Send list and email | 8 |
  | Admin UI | 9 |
  | Client view (RLS + details) | 1 + 9 |
  | Testing with real documents | 10 |
  | Rollout | 11 |

- **Deliberate deviations:** the two planning decisions at the top (text for text-layer PDFs, parallel chunks).
- **Type names are consistent across tasks:** `Candidate`, `FilePages`, `Chunk`, `ScanState`, `approveSuggestion`, `describeSendResult`, `getChecklistItemsEmail`.
