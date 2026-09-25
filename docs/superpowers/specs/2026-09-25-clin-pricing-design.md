# CLIN pricing: the solicitation's own price table, filled in as the client's Rate sheet

Date: 2026-09-25. Status: design approved in chat; this spec is awaiting review.

## Why

This is step 3 of 3 of "federal bid mode":
1. the checklist (live);
2. the wage worksheet (live, priced with each client's own numbers);
3. this.

A federal solicitation has its own price table: the CLINs (contract line item
numbers), e.g. "0001 Custodial Services, 12 MO". The bidder must price
exactly those lines, in the agency's numbering, and total them. Today:
- the app's "Rate sheet" deliverable is an empty template;
- it isn't part of a full package at all.

**Constraints:**
- **Admin efficiency** (user, 2026-09-25): one person, a 48-hour turnaround.
  The table arrives pre-filled; checking it against the quotes takes under a
  minute on a typical bid.
- **Easy for the client:** no new forms or steps.
- **Never fabricate:** a number nobody gave us stays blank. Blanks reach the
  client only as bracketed placeholders, which block the download.

## Decisions made with the user

1. **The output** is the client's **Rate sheet** deliverable: the agency's
   CLIN lines with unit and extended prices, plus the grand total. The client
   copies them into the agency's price schedule when submitting.
2. **Option years** go up by a **yearly increase %**, a new fifth number in
   the client's numbers, entered once. Blank means the option years stay
   blank. 0 means flat pricing.
3. **Several CLINs in one year** (e.g. one per building): the admin enters
   the split once per bid, and it carries through every option year. Until
   then those lines stay blank.
4. **Package:** a bid with CLIN lines gets the Rate sheet automatically.
   - A full package becomes four deliverables.
   - A lean package's empty template is replaced by the filled table.
5. **Reading:** a separate, focused AI reading of the price table, run in
   parallel with the checklist reading. Plain code verifies it.

## What real solicitations look like (checked 2026-09-25)

Five public janitorial solicitations were checked, all fetched from SAM.gov's
public site:
- FA252126QB143 JDMTA (Amendment 1);
- 127EAY26Q0143 Lake Tahoe;
- 140A0426Q0016 Crow Agency;
- 140L1726Q0071 Montrose;
- 697DCK-27-R-00001 Martha's Vineyard.

What they showed:
- **Numbering** varies: `0001/1001/2001`, `00001/10001/20001`, or a plain
  sequence `00001–00005`.
- **Base periods** aren't always 12 months: Lake Tahoe is 6 MO, Martha's
  Vineyard 9 months.
- **Several CLINs per period:** Lake Tahoe prices two buildings, as 0001/0002,
  then 1001/1002.
- **Quantity and unit** ("12 MO", "12 Months") are usually present, but
  sometimes wrapped onto another line or missing.
- **Amendments** can re-list the whole table (JDMTA Amendment 1).
- **Excel price schedules:** some solicitations attach one (Lake Tahoe
  "Schedule of Items .xlsx").

These five are the real test set. Their extracted text will be saved as test
fixtures where it helps the plain-code tests; they are public federal
documents.

## Out of scope

- Reading Excel (.xlsx) attachments. The panel says a price schedule may be
  in an attachment it can't read, and the admin adds those lines by hand.
- Filling in the agency's own pricing file (SF-1449 blocks or its
  spreadsheet).
- Local (non-federal) bid forms.
- Pricing CLINs that aren't per month or per year, e.g. per job, per hour, or
  "not separately priced". The admin types those.
- Escalating wages inside the wage worksheet. The yearly increase applies to
  the price, not the floor.

## Data

**New table `clin_lines`** (admin only, RLS `is_admin(org_id)`):

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `submission_id` | uuid, references `submissions` on delete cascade | |
| `org_id` | uuid | |
| `clin` | text not null | as printed, e.g. `0001`, `10001`, `0002AA` |
| `description` | text not null | |
| `quantity` | numeric null | |
| `unit` | text null | as printed, e.g. `MO`, `Months` |
| `unit_kind` | text not null | `month`, `year` or `other`, set by plain code |
| `period_index` | int null | 0 = base, 1–4 = option years; null when unknown (highlighted) |
| `position` | int not null | order within its period (1st, 2nd…); links a building's CLIN across years |
| `quote` | text | verbatim |
| `page` | int | |
| `source_file` | text | |
| `quote_status` | text not null | `verified`, `not_found`, `unreadable`, or `admin` (added by hand) |
| `revised_by` | text null | the later file that re-listed this CLIN |
| `unit_price_override` | numeric null | a unit price the admin typed; wins, and is marked |
| `sort` | int not null | |
| unique | (`submission_id`, `clin`) | |

**`submissions` gains:**
- `clin_scan jsonb`: `{status, files_fingerprint, finished_at, error, excel_attachments: [names]}`;
- `clin_shares jsonb`: `{ "<position>": pct }`, the split, entered once per bid.

**`clients.pricing` gains `yearlyIncreasePct`,** the fifth client number.
- It's normalised like the others, and blank means null.
- It counts as a client number for the first-save rule (`hasAnyPricing`).
- It's written through the same admin-only service-role route.

## Reading the CLINs (`lib/clins/`)

**Trigger:** POST `/api/clin-scan`.
- It's called where the checklist scan is started: the solicitation upload
  and the checklist panel's auto-start.
- It runs only for bids that are federal, meaning `isFederalAgency(agency)`,
  or the checklist found an SF form or FAR provision.
- It has its own atomic claim and fingerprint cache, like
  `/api/checklist-scan`.
- "Read again" re-runs it.

**Text:** it reuses the checklist's text extraction and page markers
(`lib/checklist/extract-text.ts`, `chunk.ts`).

**AI** (`ai-pass.ts`): model `claude-opus-5`, structured output, the same
call pattern as the checklist.
- The prompt: list every priced line item in the solicitation's price
  schedule (Schedule of Supplies/Services / CLIN table) as
  `{clin, description, quantity|null, unit|null, quote, page, source_file}`.
- Only lines the document states; the quote copied verbatim, under 300
  characters, and containing the CLIN number.
- Chunks are read in parallel.

**Plain code (pure, tested):**
- `verifyQuote` (reused): a quote not in the text becomes `not_found`.
- **The CLIN number must appear in the quote;** otherwise `not_found`.
- **`unitKind(unit, description)`:** `MO`, `MOS`, `MONTH(S)` → `month`;
  `YR`, `YEAR(S)` → `year`; anything else or missing → `other`.
- **`periodIndex(clin, description)`:**
  - "Base" → 0;
  - "Option Year N" or "Option Period N" → N;
  - otherwise from the numbering: a leading digit 1–4 on a 4- or 5-digit CLIN
    whose other CLINs follow the `x001` pattern → that digit, and `0`/`00` → 0;
  - a plain sequence without wording → null (highlighted).
- **`position`:** order within the period, by CLIN number.
- **Dedupe:** by CLIN number. When several files list the same CLIN, the
  file uploaded last wins, and `revised_by` names it.
- **Excel attachments** among the bid's files are listed in `clin_scan` so
  the panel can mention them.

**Re-reading** replaces the AI-found lines. Lines the admin added
(`quote_status = 'admin'`) and admin price overrides are kept when their CLIN
still exists.

## Pricing (`lib/clins/price.ts`, pure, tested)

The inputs:
- the wage worksheet's `bid_price` (the agreed yearly price);
- the client's `yearlyIncreasePct`;
- `clin_shares`;
- the lines.

**Year price for period k:**
- `bid × (1 + increase%)^k`;
- k = 0 needs only the bid;
- k ≥ 1 needs the increase too.

**Share for a line:**
- 100% when it's the only line in its period;
- otherwise `clin_shares[position]`;
- missing → blank.

**Unit price:**
- `month`: `round2(yearPrice × share / 12)`;
- `year`: `round2(yearPrice × share)`;
- `other`: blank unless overridden.

**Amount:**
- `round2(unitPrice × quantity)`;
- blank when either is blank, or the quantity is missing.

**Admin override:** a typed unit price wins over the computed one and is
marked "typed by you".

**Total:** the sum of the amounts. If any amount is blank, the total is
"incomplete" and names how many lines are missing.

**Shares check:** the shares entered must add up to 100%. Otherwise a
warning appears and those lines stay blank.

## Admin UI: "CLIN pricing" panel on the bid page

It sits below the wage worksheet, on bids where the reading ran or lines
exist.

**Status:**
- "Reading the price table…" (polling), with the last run time and **Read
  again**;
- the Excel notice when there is one.

**The table:**
- the columns are CLIN, Description, Qty, Unit, Period, Split %, Unit price
  and Amount;
- the total is at the bottom;
- each line has its quote with a `#page=` link to the file, the same as the
  checklist;
- badges: "Quote verified" / "Quote not found" / "Revised by <file>" /
  "Added by you".

**Only what needs attention is highlighted:**
- an unverified quote;
- an unknown period;
- a missing split;
- an `other` unit or a missing quantity;
- a blank price because the bid price or the yearly increase is missing.

The guidance names which of these it is, e.g. "Enter Acme's yearly increase
% to price the option years".

**Split %:**
- the box appears only on the base-period lines, when that period has more
  than one line;
- option-year lines show the carried share.

**Editing:**
- the CLIN, description, quantity, unit and period can be corrected;
- lines can be added or removed;
- a unit price can be typed;
- it autosaves, like the worksheet.

**"Update the Rate sheet"** writes the Rate sheet deliverable's draft (below).

**The client's numbers row on the wage worksheet** gains "Yearly increase %",
highlighted when blank, only on bids with option-year CLINs.

## The Rate sheet deliverable

**Content** (plain text, the same pipe-table style the other drafts use):
```
RATE SHEET — <agency> — Solicitation <number>

CLIN | Description | Qty | Unit | Unit price | Amount
0001 | Custodial Services for JDMTA | 12 | MO | $7,500.00 | $90,000.00
1001 | Option Year 1 Custodial Services for JDMTA | 12 | MO | $7,725.00 | $92,700.00
...
Total (base + all option years): $477,822.74
```
- A blank price is written as a bracketed placeholder, e.g.
  `[unit price — CLIN 0002]`, so `hasUnresolvedPlaceholders` blocks the
  client's download until it's resolved.

**Writing it:**
- "Update the Rate sheet" upserts the `rate_sheet` deliverable's draft
  content for the bid.
- If that deliverable was already approved, it goes back to draft, with a
  note that the admin must review it again.
- It never auto-sends anything.

**Package:**
- `getRequiredDeliverableTypes` gains a `hasClins` input. A full package plus
  CLIN lines gives the three full types **plus** `rate_sheet`; a lean package
  is unchanged.
- **DeliverablesPanel's "sticky lean" check** treats a bid as lean only when
  a lean-only type (`executive_cover` or `certificate_of_insurance`) exists,
  or `rate_sheet` exists and the bid has no CLIN lines. Otherwise a federal
  bid's Rate sheet would flip it into lean mode.
- **The "advance when deliverables complete" check** uses the same required
  set, so a federal full package isn't complete without its Rate sheet.

## Failure handling

| Failure | What happens |
|---|---|
| The AI reading fails or times out | `clin_scan.status = failed` with the error; Read again; the admin can add lines by hand |
| No CLIN table found | "No price table found in the uploaded files" (plus the Excel notice if any); nothing is added to the package |
| A quote not found | The line is kept, highlighted "Quote not found"; its numbers still count |
| No bid price or yearly increase yet | The affected prices are blank and highlighted with guidance; the Rate sheet shows placeholders |
| Shares don't add up to 100% | A warning; the split lines stay blank |

## Testing

**Unit tests** (`node --test`):
- `unitKind`: MO, Months, 12 MOS, YR, EA, JB, missing;
- `periodIndex`: "Base", "Option Year 3", `1001`, `20001`, a plain `00001–00005`
  sequence with wording, and one without (null);
- `position` and dedupe: an amendment re-listing CLINs wins, and `revised_by`
  is set;
- CLIN-in-quote verification;
- **pricing:**
  - a 6-month base, where the unit is year/12 and the amount unit × 6;
  - compounding at 3% over four option years;
  - shares 40/60 carried to option years;
  - shares that don't add up;
  - `other` units;
  - an override winning;
  - the total and incomplete counts;
  - cents rounding, where the total equals the sum of the rounded amounts;
- Rate sheet text, and the placeholders `hasUnresolvedPlaceholders` detects;
- package routing: full + CLINs = 4 types; lean unchanged; the sticky-lean
  rule.

**Real documents, on dev:**
- run the reading on all five real solicitations;
- check every CLIN by hand against the document: number, description,
  quantity, unit and period;
- record the found / missed / wrong counts;
- time the reading.

**Browser check on dev:**
- upload the JDMTA amendment;
- the CLIN table fills in from the worksheet's bid price and the client's
  increase;
- enter a split on a two-building bid;
- "Update the Rate sheet" gives a four-deliverable package;
- the client's download is blocked while a placeholder remains.

## Rollout

As before:
1. Migration on dev (dry run, then push).
2. Production only with the user's go-ahead: the user runs `db push` via
   `!`, then the reload.
3. Then the merge, push and deploy check.

The migration is additive.
