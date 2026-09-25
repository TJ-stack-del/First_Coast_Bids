# Submission checklist: required items read from the solicitation, reviewed by an admin

Date: 2026-09-25. Status: design approved in chat; this spec is awaiting review.

## Why

The user asked whether the app can produce federal bids. It finds them, and
its deliverables (capability statement, compliance matrix, technical
narrative) work for federal bids. But nothing tracks what the solicitation
requires to be *submitted*:
- government forms and signatures (SF-1449);
- amendment acknowledgments (SF-30);
- the Service Contract Act wage determination;
- FAR provisions that need action from the bidder;
- submission method and deadline.

Local bids have the same gap, with different items: addenda, bid bond, and Florida sworn statements. Missing any of these can get a bid rejected.

This is the first of three federal-bid pieces the user agreed on, in this order:
1. **This checklist.**
2. Wage-determination pricing help (later, separate spec).
3. A line-item (CLIN) pricing sheet (later, separate spec).

## Decisions made with the user

1. **Documents are uploaded by hand for now.** Automatic download of SAM.gov attachments comes later, once there's a higher-limit SAM.gov API key. Downloads would otherwise spend the scraper's small daily quota.
2. **Suggestions are reviewed by an admin before any client sees them.** Each suggestion carries its verbatim quote and page. This is the same rule as the compliance matrix: nothing the AI read reaches a client unchecked.
3. **Scope: every bid** with a solicitation file. Federal bids get additional federal items.
4. **Approach: AI finds, plain code checks.** An AI pass lists items with verbatim quotes. The app extracts the document text itself so it can:
   - verify every quote appears in the document;
   - detect fixed federal identifiers with plain code.

## Out of scope

- Downloading SAM.gov attachments automatically.
- Wage-determination pricing and the CLIN pricing sheet.
- Filling in government forms.
- Any change to the compliance matrix or its extraction (`lib/rfp-requirements.ts`).

## Data

**New table `checklist_suggestions`:**

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `submission_id` | uuid not null, references `submissions` on delete cascade | |
| `org_id` | uuid not null, references `organizations` | for RLS |
| `kind` | text not null | one of `form`, `amendment`, `bond`, `sworn_statement`, `license_insurance`, `submission_rule`, `wage_determination`, `far_provision`, `sam_registration`, `evaluation_method`, `other` |
| `federal` | boolean not null default false | a federal-only item |
| `label` | text not null | e.g. "Sign SF-1449, blocks 17a and 30" |
| `detail` | text | the specific requirement, as stated |
| `quote` | text not null | verbatim span from the document |
| `page` | int | best-effort page number |
| `source_file` | text | `submission_documents.file_name` |
| `quote_status` | text not null | one of `verified`, `not_found`, `unreadable` (no text layer) |
| `found_by` | text not null | `ai` or `detector` (plain code) |
| `suggested_owner` | text not null | `client` or `admin` |
| `status` | text not null default `pending` | one of `pending`, `approved`, `rejected` |
| `dedupe_key` | text not null | normalised kind + label; unique per submission |
| `checklist_item_id` | uuid null, references `checklist_items` on delete set null | set on approval |
| `created_at`, `decided_at` | timestamptz | |
| `decided_by` | uuid null | `team_members.id` |

**`checklist_items` gains:**
- `owner text not null default 'client'` (check `client`/`admin`). Every existing row becomes `client`, which is what every existing item is.
- `source_quote text`, `source_page int` and `source_file text`, copied on approval.
- `client_notified_at timestamptz null`, set when the item is included in a "Send the client their list" email.

**`submissions` gains** `checklist_scan jsonb`: the last run's status (`running`/`done`/`failed`), error, pages read per file, `files_fingerprint` and `finished_at`. This drives the panel and the cache.

**RLS:**
- `checklist_suggestions`: admins only (`is_admin(org_id)`).
- `checklist_items`: the existing "clients read their own checklist_items" policy is narrowed to `owner = 'client'`. Admin policies are unchanged.

## Reading a solicitation (`lib/checklist/`)

1. **Text extraction** (`extract-text.ts`, server):
   - PDF via a PDF text library, keeping page boundaries;
   - DOCX via the existing `mammoth`;
   - TXT as-is.

   A PDF with no text layer is recorded as unreadable.
2. **Plain-code detectors** (`detectors.ts`, pure, tested). They run on the **full** text of every file and produce suggestions with `found_by = 'detector'` and an exact quote:
   - Standard forms: `SF[- ]?(1449|33|18|30|26)` and "Standard Form 1449". SF-30 matches also yield each amendment number (e.g. "Amendment 0001").
   - Wage determinations: `WD (\d{4}-\d{4})` with `Rev(ision)? (\d+)`, and "Wage Determination No.".
   - FAR provisions needing bidder action, from a fixed table:
     - 52.212-3 (Offeror Representations and Certifications);
     - 52.204-24 / 52.204-26 (telecommunications representations);
     - 52.209-5 (responsibility matters);
     - 52.219-1 (small business program representations);
     - 52.222-22 / 52.222-25 (previous contracts / affirmative action).
   - Florida sworn statements, by name: "Public Entity Crimes" (s. 287.133), "Drug-Free Workplace" (s. 287.087), "Scrutinized Companies", "E-Verify" affidavit, "Conflict of Interest" statement.
   - Addenda: "Addendum No. N" and "acknowledge receipt of addend(a|um)".
3. **AI pass** (`ai-pass.ts`). It uses the same document-sending approach as `lib/rfp-requirements.ts` with its own prompt. It returns `{kind, federal, label, detail, quote, page, source_file, suggested_owner}` for every required submission item. It must copy quotes verbatim and never invent items.
4. **Quote verification** (`verify-quote.ts`, pure, tested). An AI quote is `verified` if its normalised form appears in the normalised text of its file. Normalising:
   - lowercases;
   - collapses whitespace and line breaks;
   - joins words hyphenated across lines;
   - straightens curly quotes and dashes;
   - drops soft hyphens.

   Otherwise the quote is `not_found`, or `unreadable` when the file had no text.
5. **Merge and dedupe** (`merge.ts`, pure, tested):
   - A detector item and an AI item about the same thing (same kind and the same form, amendment, WD or FAR number) are merged, keeping the detector's quote.
   - Items whose `dedupe_key` already exists for the submission, in any status, are not inserted again.
6. **Federal marking.** `federal = true` for kinds `wage_determination`, `far_provision` and `sam_registration`, and for SF forms. Federal items are only produced for a bid that `isFederalAgency(agency)` recognises, or when the document itself contains an SF form or FAR provision. That keeps FDOT-style state bids clean.

**Default owners:**
- **client:** signatures, sworn statements, bond, licenses and insurance certificates, amendment acknowledgments.
- **admin:** submission rules, evaluation method, wage determination, SAM registration check.

The admin can change any owner before approving.

## Triggers, speed and cost

- **When it runs:** after a solicitation file (`document_type = 'rfp_file'`) is uploaded, the admin bid page (or the client's upload UI) POSTs `/api/checklist-scan` with the submission id. The route has `maxDuration = 60` and runs steps 1–5. The upload itself never waits for it.
- **Caching:** `files_fingerprint` is built from the rfp files' names and upload times. When it matches the last successful run, the route returns the cached result without an AI call, as `rfp_requirements_extracted_at` does today.
- **Check again:** the button re-runs unconditionally.
- **Long documents:** the AI pass reads only as many pages as the model accepts per document. `checklist_scan.pages_read` records the pages read against each file's total, and the panel states "Only pages 1–N of <file> were read." Detectors always cover the full text.
- **Failures:** a failed run sets `checklist_scan.status = 'failed'` with the error, which the panel shows with Check again. Detector suggestions from the same run are still saved if the AI pass alone failed.

## Admin UI (`app/admin/inbox/[id]/`)

**The "Checklist suggestions" panel:**
- **Status:** "Reading the solicitation…" (it polls `checklist_scan` while running), last run time, a partial-read notice, and **Check again**.
- **Pending suggestions,** grouped as *Forms & signatures*, *Amendments*, *Submission rules* and *Federal*. Each shows:
  - label and detail;
  - the quote, with a link opening the file at the page (the same `#page=` link the compliance matrix rows use in `DeliverablesPanel.tsx`);
  - the `quote_status` badge ("Quote verified" / "Quote not found" / "Couldn't verify: scanned document");
  - "Found by: plain-code check" for detector items;
  - a **Me / Client** owner switch;
  - **Approve** and **Reject** buttons.
- **Approve all verified:** approves every pending item with a verified quote, after showing a confirmation with the count.
- **Show rejected:** reveals rejected items, which can be restored to pending.

**Approving** inserts one `checklist_items` row with the owner and source fields, and links it back. An item is approved exactly once: a second approve is a no-op.

**The bid's checklist on the admin page** shows every item with an owner tag.

**"Send the client their list"** is enabled when there are approved client items with `client_notified_at` null. A new route, `/api/send-checklist-items`, emails the client one message listing those items. It uses a new template in `lib/email/templates.ts`, in the same plain style as the others, and the existing `sendEmail`. The route then sets `client_notified_at` on exactly those items and records an audit row.

The existing `/api/request-info` isn't reused, because it sends one message about one item. As with `notify-matched-opportunity`:
- test submissions and clients without an email get a stated "not sent" result;
- a send failure is shown to the admin, never reported as sent.

Approval itself never emails.

**Client dashboard:** only `owner = 'client'` items, enforced by RLS, under the existing "what we still need from you". It shows the label, plus the detail when present.

## Testing

- **Unit tests (`node --test`):**
  - detectors: each pattern, including negatives such as "SF" inside words, and WD numbers with and without revision;
  - quote normalisation and verification: line breaks, hyphenation, curly quotes, soft hyphens;
  - merge and dedupe: detector wins, the same key isn't re-inserted, statuses are respected;
  - owner defaults;
  - federal marking.
- **Real documents on dev, end to end in a browser:**
  - the public SAM.gov solicitation for the VA boiler RFQ (36C24826Q1287);
  - a public local Northeast Florida RFP, found by the implementer since the user didn't supply one.

  Every suggestion is checked by hand against the document.
- **Checks:**
  - the RLS change: a client session sees only client-owned items;
  - an admin session sees suggestions, and a client session gets none.

## Rollout

1. The migration on `bidpulse-dev` first (dry run, then push), as with the trade list.
2. Production only with the user's explicit go-ahead: the migration first, then the code deploy. Existing checklist items become `owner = 'client'`, so clients see no change.
