# Wage worksheet: the labor-cost floor for federal service bids, pre-filled

Date: 2026-09-25. Status: design approved in chat (efficient version); this spec is awaiting review.

## Why

On federal service contracts (janitorial, grounds and similar), the Service
Contract Act wage determination (WD) sets the minimum pay and benefits for
each job title. A price below that labor cost loses money, or breaks the law.
Today the app only flags that a WD exists.

This is step 2 of 3 of "federal bid mode": checklist (live), then this, then a
line-item (CLIN) pricing sheet.

**Hard constraint (user, 2026-09-25):** one person does all the bid work on a
48-hour turnaround. The worksheet must arrive **pre-filled** and take about
**2–3 minutes** to confirm. It never starts empty.

## Decisions made with the user

1. **Who it's for:** designed for "you work the price out with the client".
   It also checks a price the client brings. It never suggests a price.
   Everything comes from the documents, the WD, or the admin's own standing
   settings.
2. **Getting the WD:** fetched automatically from SAM.gov by the number the
   checklist finds, with upload as the fallback. Checked 2026-09-25: public
   website endpoints return the WD text with no API key.
3. **Reading the WD:** plain code, not AI.
4. **Who sees it:** admin only.
5. **Scope:** SCA wage determinations only.
6. **The efficient version:** positions, hours, supplies, overhead and profit
   are pre-filled from per-trade and business-wide defaults, set once in
   Settings, plus the solicitation's own facts.

## Out of scope

- Davis-Bacon (construction) wage determinations.
- State unemployment tax: the admin includes it in overhead.
- Showing the worksheet to clients.
- Feeding the rate-sheet deliverable (step 3).
- More than one WD per bid.
- Collective-bargaining (successor) wage rates.

## Where the WD comes from

**The number and revision:**
1. From the bid's checklist suggestion with key `wd:NNNN-NNNN`. The revision
   comes from its label ("(Rev. 27)").
2. Or typed by the admin on the worksheet.

**The right revision:**
- Use the revision the solicitation names; that is the one the bid must be
  priced on.
- If none is named, use the latest, found via
  `GET https://sam.gov/api/prod/sgs/v1/search/?index=wd&q=<number>&page=0&size=5&mode=search`
  (`_embedded.results[].revisionNumber`). The worksheet then says
  "Solicitation didn't state a revision; using the latest (Rev. N). Confirm
  with the solicitation."

**Fetching:**
- `GET https://sam.gov/api/prod/wdol/v1/wd/<number>/<revision>`, with
  `Accept: application/hal+json`. The response is JSON whose `document` field
  holds the WD text.
- Parse it with `JSON.parse` in non-strict mode, or strip control characters
  first, and remove the wrapping quotes.
- These are SAM.gov's public website endpoints: no API key, and they don't
  count against the scraper's quota.

**Saved with the bid:** the fetched text, as proof of exactly what the price
was based on.

**Fallback:** the admin uploads the WD, as a PDF or text file. Its text is
extracted with the checklist's `extractFileText` and read by the same parser.

## Reading the WD (`lib/wage/parse-wd.ts`, pure, tested)

The parser extracts:

- **Header:**
  - `Wage Determination No.: 2015-4539`
  - `Revision No.: 32`
  - `Date Of Last Revision: 8/12/2026`
  - `State: Florida`
  - `Area: Florida Counties of ...` (can wrap onto the next line)
- **Positions:** every line matching `^(\d{5}) - (title)\s+(footnote)?\s*(\d+\.\d{2})\s*$`,
  giving `{ code, title, rate, footnote }`. Section headings such as
  `11000 - General Services And Support Occupations` have no rate and are
  skipped.
- **Health & welfare:**
  - `HEALTH & WELFARE: $X per hour`, the standard rate;
  - `HEALTH & WELFARE EO 13706: $Y per hour`, the alternative rate when paid
    sick leave is provided separately under EO 13706.
- **Vacation:** the first tier, e.g. `2 weeks paid vacation after 1 year`,
  gives 2 weeks.
- **Holidays:** `A minimum of eleven paid holidays` gives 11 (written-out
  numbers one to twenty are converted).
- **EO 13658 minimum:** `at least $13.65 per hour` gives 13.65, recorded with
  its conditions.
- **Paid sick leave (EO 13706):** whether the WD states it (1 hour per 30
  hours worked, up to 56 hours a year).

**Validation:** at least one position and the standard health & welfare rate
are required. Anything else missing is reported by name. **The worksheet never
shows half-read numbers:** on a parse failure it says what's missing and offers
the upload fallback.

**Real test texts:**
- **Primary, Jacksonville area:** WD 2015-4539 Rev. 32 (Florida: Baker, Clay,
  Duval, Nassau, St. Johns). Janitor 17.04; Laborer, Grounds Maintenance
  17.94; health & welfare 5.92; 11 holidays; 2 weeks' vacation. 346 position
  lines.
- **Second:** WD 2015-4523 Rev. 36 (Georgia). Janitor 14.30; health & welfare
  5.92; EO 13658 minimum 13.65.

Both are public-domain federal documents, saved as test fixtures under
`lib/wage/fixtures/`.

## The calculation (`lib/wage/floor.ts`, pure, tested)

For each position line `{ rate, workers, hoursPerWeek }`, using 52 weeks:

| Component | Formula |
|---|---|
| Wage/hour | `max(rate, eo13658Min)` when the admin ticks "contract covered by EO 13658"; otherwise `rate` |
| Annual hours | `workers × hoursPerWeek × 52` |
| Wages | `annual hours × wage` |
| Health & welfare | `workers × min(hoursPerWeek, 40) × 52 × H&W` (the WD's weekly cap) |
| Holidays | `workers × holidays × 8 × (min(hoursPerWeek, 40) / 40) × wage` |
| Vacation | `workers × vacationWeeks × min(hoursPerWeek, 40) × wage`, on by default (switch) |
| Paid sick leave | `min(annual hours / 30, 56 × workers) × wage`, when the WD states EO 13706 |
| Employer FICA | `7.65% × (wages + holidays + vacation + sick leave)` |
| **Floor** | the sum of the components above |

**On top of the floor**, the admin's own inputs:
- supplies, as a % of the labor floor or a flat $ per year;
- overhead %;
- profit %.

The resulting price is `(floor + supplies) × (1 + overhead%) × (1 + profit%)`.

**Warning:** if the bid price the admin enters is below the floor, the worksheet
says "Below the labor-cost floor by $X/year."

All amounts are rounded to cents only at the end. Every figure shows its
formula on hover or expand, so any number can be checked.

## Pre-fill (the efficient version)

The worksheet opens already complete.

**Positions:**
- The trade's default position code, set once per trade in Settings → Trades
  (e.g. Janitorial → 11150 Janitor; Landscaping → 11210 Laborer, Grounds
  Maintenance).
- The bid's trade comes from the matched opportunity's `trade_id` when the bid
  came from Matches; otherwise the first trade matching the client's NAICS
  codes.
- The rate is looked up in the parsed WD. If the code isn't in this WD, the
  worksheet says so and the admin picks from the WD's list.

**Hours:**
- Hours per week = `cleanable_sqft / production rate (sq ft per hour) ×
  service days per week`.
- `cleanable_sqft` comes from the existing bid-estimation facts (read from the
  solicitation).
- The production rate is set once per trade in Settings (e.g. 3,500 sq ft/hr).
- Service days per week comes from a new `service_days_per_week` fact,
  extracted with the others, or else the business default (5).
- Workers = `ceil(hoursPerWeek / 40)`; hours per worker =
  `hoursPerWeek / workers`.
- **Shown with its source:** "from 45,000 sq ft at 3,500 sq ft/hr × 5 days".
- If no square footage was found, hours start blank and are highlighted: the
  one thing the admin must enter.

**Supplies, overhead, profit and the vacation switch:** the business defaults
from Settings → Pricing defaults.

**Saving:** changes save automatically, with no Save button.

**Target:** open, check the 3–4 highlighted numbers, adjust, done, in about
**2–3 minutes**.

## Data

**New table `wage_worksheets`**, one per submission:

| column | type | notes |
|---|---|---|
| `submission_id` | uuid, primary key | references `submissions`, on delete cascade |
| `org_id` | uuid | |
| `wd_number`, `wd_revision` | text, int | |
| `wd_revision_source` | text | `solicitation`, `latest` or `manual` |
| `wd_text` | text | the snapshot |
| `wd_parsed` | jsonb | |
| `lines` | jsonb | `[{code, title, rate, workers, hoursPerWeek, hoursSource}]` |
| `options` | jsonb | `{includeVacation, eo13658}` |
| `supplies_mode`, `supplies_value` | text, numeric | |
| `overhead_pct`, `profit_pct` | numeric | |
| `bid_price` | numeric | |
| `updated_at`, `updated_by` | | |

RLS: admin only, via `is_admin(org_id)`.

**`trades` gains** `wd_position_code text` and `production_rate_sqft_per_hour numeric`, both nullable.

**`organizations` gains** `pricing_defaults jsonb`: `{suppliesMode, suppliesValue, overheadPct, profitPct, includeVacation, serviceDaysPerWeek}`, with sensible empty defaults. The admin sets them once.

**Bid-estimation facts gain** `service_days_per_week`, extracted with the existing facts. The cache rule is unchanged.

## UI

- **Settings → Trades:** each trade's form gains "Default wage-determination
  position (code)" and "Production rate (sq ft per hour)".
- **Settings → Pricing defaults** (new small section):
  - supplies (% of labor or $ per year);
  - overhead %;
  - profit %;
  - include vacation;
  - default service days per week.
- **Bid page → Wage worksheet:** shown when the bid is federal
  (`isFederalAgency`) or has a WD suggestion. Contents:
  - WD summary: number, revision and its source, area, and "Check the area
    matches the place of performance";
  - positions table: editable, with the source of each pre-filled number;
  - cost breakdown;
  - floor;
  - supplies, overhead and profit;
  - resulting price;
  - bid price field and the below-floor warning.

## Failure handling

| Failure | What happens |
|---|---|
| SAM.gov unreachable, or WD not found | Error message plus the upload fallback |
| Parser can't find positions or H&W | Names what's missing plus the upload fallback; no numbers shown |
| Default position not in this WD | Says so; the admin picks from the WD's list |
| No square footage | Hours highlighted as the one required entry |
| Revision not stated in the solicitation | Latest used, with a warning |

## Testing

- **Parser:** tested on both real WD fixtures (header, number of positions,
  specific rates, H&W, EO 13706 alternative, vacation, holidays, EO 13658
  minimum). Plus: section headings skipped, a wrapped Area line, and a
  truncated text failing validation.
- **Calculator:** a worked example with every component checked by hand.
  Plus: the hours cap at 40, part-time proration, sick-leave cap, the EO 13658
  switch, vacation off, supplies % vs $, and the below-floor warning.
- **Pre-fill:** hours from square footage, rate and days; the workers split;
  a missing square footage; a default code not found in the WD.
- **Dev, end to end:** a bid with WD 2015-4539 Rev. 32 opens pre-filled. The
  admin changes one number, and the floor updates. Time to confirm is
  measured.

## Rollout

Migration to dev first, then production only with the user's go-ahead, as
before. The migration is additive. The new Settings fields are empty until
set, and the worksheet says which default is missing ("Set a production rate
for Janitorial in Settings to pre-fill hours").
