# Wage worksheet: the client's pricing numbers, not ours

Date: 2026-09-25. Status: design approved in chat; this spec is awaiting review.

## Why

First Coast Bids is a done-for-you service. **The client does the work and
sets the price**; we prepare the bid. The live wage worksheet
(`2026-09-25-wage-worksheet-design.md`) pre-fills pricing from **our**
business defaults:
- **Settings → Pricing defaults:** supplies, overhead, profit, service days;
- **the per-trade production rate:** square feet cleaned per hour.

That's backwards. Those are each client's own numbers, and pricing a
client's bid from figures nobody gave us breaks the "never fabricates a
fact" rule (PRODUCT.md).

**Constraints (user, 2026-09-25):**
- **Easy for the client:** they hired us so it takes less of their time.
  There are no new forms or steps for them.
- **Efficient for the admin:** one person, a 48-hour turnaround. The
  worksheet check stays at about 2–3 minutes per bid, and each client's
  numbers are entered once, not every bid.

## Decisions made with the user

1. **The client does nothing extra.** The admin gets the client's numbers in
   the pricing conversation they already have, and enters them once. Every
   later bid for that client pre-fills from them.
2. **Split visibility** (like the submission checklist):
   - the admin keeps the full worksheet;
   - the client sees one read-only line on their federal bid.
3. **Missing numbers are never guessed.** A blank box is highlighted, and the
   admin asks the client however they normally would.
4. **Settings loses** "Pricing defaults" and the per-trade production rate.
   The per-trade **position code** stays: it only picks which line of the WD
   to read, which is a lookup, not a business number.

## Out of scope

- Any client-side form, Profile field or intake question for pricing.
- Automatic checklist items asking the client for numbers.
- Changes to the floor calculation (`lib/wage/floor.ts`) or WD fetching and
  parsing.
- A separate admin "client record" page. The numbers are edited from the
  worksheet itself, where the admin already is.

## Data

**`clients` gains `pricing jsonb not null default '{}'`:**
`{suppliesMode, suppliesValue, overheadPct, profitPct, productionRate}`.
- **Reading:** admins read it through the existing admin policies on
  `clients`.
- **Writing:** only through the admin-checked route below.
- **Clients** can read their own row as today, which shows them their own
  numbers. That's fine: they gave us them.

**`submissions` gains `wage_check jsonb` (null by default):** the one line
the client sees, written by the worksheet route. The shape is
`{floor, bidPrice, staffing, wdNumber, wdRevision, updatedAt}`:
- `staffing` is plain text, e.g. "2 janitors at 32 hours/week";
- the field is set only when a bid price is entered, and cleared when the
  bid price is cleared;
- clients already read their own submissions, so **no RLS change** is
  needed and nothing internal (overhead, profit, the WD text) is exposed.

**Removed** (the migration first checks they're unused, and stops with an
error otherwise):
- `organizations.pricing_defaults`;
- `trades.production_rate_sqft_per_hour`.

Both were added today and are empty on production. That was checked on
2026-09-25: every trade's production rate is null. The migration re-checks
`pricing_defaults = '{}'` itself.

`wage_worksheets` keeps its per-bid `supplies_value`, `overhead_pct` and
`profit_pct`, so one bid can differ from the client's usual numbers. These
three become **nullable**: null means "not given yet", which is how a blank,
highlighted box is stored, never as 0.

## Pre-fill

When a worksheet is created, or re-filled:
- **Supplies, overhead and profit** come from the bid's client's `pricing`.
  If one is missing, that box is blank and highlighted, and the worksheet
  says "Missing Acme Cleaning's overhead %".
- **Hours per week:** `cleanable_sqft / client.productionRate × service days`.
  - If the client has no production rate, or the solicitation gave no square
    footage, hours start blank and highlighted, as today when square footage
    is missing.
  - **Service days** come from the solicitation's `service_days_per_week`.
    Otherwise 5 is used, and the hours source says so: "from 45,000 sq ft at
    3,500 sq ft/hr × 5 days (assumed; the solicitation didn't say)".
- **Positions:** unchanged (the trade's position code).
- **Resulting price:** the floor always shows. The resulting price shows
  only once supplies, overhead and profit are all set. Until then the
  worksheet says "Enter Acme Cleaning's numbers to see a price". The bid
  price and the below-floor warning work either way.
- **Include vacation:** on by default, as the worksheet switch already is.
  There's no longer a Settings default.

## Admin UI (the worksheet on the bid page)

**A new "Acme Cleaning's numbers" row** above supplies, overhead and profit.
It has four small boxes: supplies (%/$), overhead %, profit %, sq ft per hour.
- It shows the client's saved numbers and says "Used for all Acme Cleaning's
  bids".
- **When the client has none saved yet** (first bid), the admin types them
  here once. Saving updates the client record **and** fills this worksheet:
  any blank supplies, overhead and profit boxes are filled, and hours are
  re-computed only when they're still blank or were pre-filled
  from square footage. Hours the admin typed are never overwritten.
- **Editing them later** only changes the client record and future bids.
  The current worksheet's own supplies, overhead and profit boxes stay as
  they are, and "Re-fill from Acme Cleaning's numbers" applies them.

**Renamed:** "Re-fill from Settings" becomes "Re-fill from Acme Cleaning's
numbers". The confirm dialog's wording changes to match. The bid price is
still kept.

**Guidance messages** now name the client, not Settings, e.g. "Enter Acme
Cleaning's sq ft per hour to pre-fill hours". "Set a position code for
Janitorial in Settings → Trades" stays, since that one is ours.

**Settings:**
- the Pricing defaults section is removed;
- the trade form's production rate box is removed;
- the position code box stays, grouped under a small "Wage worksheet"
  heading so it can't be confused with NIGP codes (a real mix-up on
  2026-09-25).

## Client UI (dashboard, the bid's card)

On a bid with `wage_check` set, one read-only block:

> **Wage law check** — Federal wage law requires at least **$86,427/year** in
> labor for this contract (2 janitors at 32 hours/week, WD 2015-4539 Rev. 32).
> Your price: **$112,943/year.**

If the bid price is below the floor, an extra line appears, shown as a
warning:

> This price is below the legal minimum. We'll go over it with you before
> you submit.

It has no inputs, and nothing appears until the admin has entered a bid
price.

## Testing

- **Unit tests** (`node --test`, pure):
  - pre-fill reads the client's numbers, and missing ones stay blank and are
    named;
  - the hours source says "assumed" when days fall back to 5;
  - `wageCheckFor(worksheet totals, bid)`: null without a bid price, correct
    staffing text, and the below-floor flag;
  - saving the client's numbers never overwrites hours the admin typed.
- **Dev, end to end, in a browser:**
  - a bid for a client with no saved numbers opens with the boxes blank and
    highlighted;
  - entering them once fills the worksheet;
  - a second bid for the same client opens fully pre-filled;
  - the client's dashboard shows the Wage law check line after the admin
    enters a bid price, including the below-floor wording.
- **The migration's guard:** it refuses to run when `pricing_defaults` isn't
  empty (tested on dev with a temporary value, then reset).

## Rollout

As before:
1. Dev: dry run, then push.
2. Production only with the user's go-ahead. The user runs `db push` via
   `!`, because agent-run production migrations are blocked.
3. The code deploy follows the migration.

Settings on production needs no data move, since the removed fields are
empty.
