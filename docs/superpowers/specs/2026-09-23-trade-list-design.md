# Trade list: one admin-managed list of the trades First Coast Bids offers

Date: 2026-09-23. Status: design approved in chat; this spec is awaiting review.

## Why

Scrapers should search only for the trades First Coast Bids currently
offers, and it should be easy to change those trades as the business takes
on new ones, without a code change.

Today:

- **Four hardcoded lists drift apart:**
  - `SAM_NAICS_CODES` (11 codes, `lib/scrapers/sam-gov-query.ts`);
  - `COMMON_NAICS_CODES` (8 codes, `lib/business-options.ts`, the client sign-up and Profile checkboxes);
  - `KNOWN_TRADES` (5 trades, `lib/compliance/known-trades.ts`, compliance coverage plus the homepage grid);
  - `OPPORTUNITY_TRADE_TAGS` (about 10 categories, `lib/opportunity-trade-tag.ts`, Matches page tags).
- **Local scrapers don't filter by trade.** The City of Jacksonville, JAA and Jacksonville Beach scrapers save every posting. On 2026-09-23 production had 79 matches, only 3 of them janitorial, and 63 sitting in New.
- **No NIGP codes exist anywhere.** The local portals planned next (OpenGov, DemandStar, Bonfire) classify by NIGP.

## Decisions made with the user

1. Bids outside the offered trades are **saved but set aside** in an "Other trades" tab, not dropped. That tab shows which trades are in demand.
2. The list is **managed in the app** by an admin (a Trades section on admin Settings), not in a code file.
3. The same list **drives the client NAICS checkboxes** on the sign-up form and the client Profile page.
4. Approach: **store the trade on each match** (`matched_opportunities.trade_id`), and re-sort open matches when trades change, after showing a count and getting confirmation.

## Out of scope

- The homepage "Trades we work with" cards and the compliance content (`KNOWN_TRADES`, `TRADE_SPECIFIC_CERTIFICATIONS`). They are authored copy and stay in code. A trade added in the app works for scraping and matching immediately; its marketing card and compliance notes are written separately. The existing "trade without compliance coverage" flag keeps working.
- New sources (OpenGov, DemandStar, Bonfire, JTA, JAXPORT, DCPS). This work only makes NIGP codes available for them.
- Any AI classification. Sorting is plain, tested code.

## Data

New table `trades`:

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `org_id` | uuid not null, references `organizations` | |
| `label` | text not null | e.g. "Janitorial" |
| `naics` | jsonb not null default `[]` | array of `{code, label}`. The code is 6 digits; the label is shown on the client checkboxes |
| `nigp_codes` | text[] not null default `{}` | format `NNN-NN` (class-item) |
| `keywords` | text[] not null default `{}` | lowercase; matched at the start of a word in the bid title |
| `active` | boolean not null default true | |
| `sort_order` | int not null default 0 | first-match order and display order |
| `created_at` / `updated_at` | timestamptz | |

`matched_opportunities` gains `trade_id uuid null`, with the explicitly named constraint `matched_opportunities_trade_id_fkey` (`references trades(id) on delete set null`). Any embed of `trades(...)` from `matched_opportunities` is written with `!matched_opportunities_trade_id_fkey` from the start, as the CLAUDE.md PostgREST rule advises. Trades are never hard-deleted in the UI; `on delete set null` is only a backstop.

RLS:

- **Admins** (`is_admin(org_id)`) read and write.
- **Authenticated clients** read the active trades of their own org. They need it for the checkboxes, which appear after the intake account is created at step 0.

**Uniqueness:** a NAICS code or NIGP code may belong to only one trade in an org. This is enforced in the save route, which rejects the save with a message naming the other trade. It is not a database constraint, because the codes live inside arrays and jsonb.

Audit: `trade_created`, `trade_updated` and `trade_activated`/`trade_deactivated` rows in `audit_log`, with the before and after values in `event_detail`. `trades_resorted` records the moved counts.

## Classification (pure, `lib/trades/classify.ts`)

`classifyOpportunity(opportunity, activeTrades) → tradeId | null`. The trades are checked in `sort_order`, and the first match wins:

1. `naics_code`: an exact match against a trade's NAICS codes (SAM.gov rows).
2. `nigp_codes`: any overlap with a trade's NIGP codes (future portal scrapers; `ScrapedOpportunity` gains an optional `nigp_codes`).
3. Keywords in the lowercase **title only**. A keyword matches only at the start of a word (`(?<![a-z0-9])keyword`), so "it support" can't match inside "transit support". A keyword can still be a word stem: "landscap" matches "landscaping".

Codes are checked across all trades before any keywords are, so an exact code always beats a keyword hit in an earlier trade. No match gives `null`, which means Other trades. Only active trades are passed in.

**Why the scope is not searched:** tested on 2026-09-23 against all 80 production matches. Construction scopes list incidental work, so scope keywords produce false matches. "McCoy's Creek Greenway", a shared-use path project, matched Landscaping only because its scope mentions "park amenities, and landscaping". A bid whose title doesn't name its trade lands in Other trades, where it stays visible, rather than in the wrong trade. (The Jacksonville Beach janitorial RFP, which once had a placeholder title, now gets its real title from the fixed scraper.)

## Scrape pipeline (`app/api/scrape/route.ts`)

- The route loads the org's active trades once per run. **If loading fails, the run stops with a visible error.** It never falls back to a hardcoded list and never saves bids with a guessed trade.
- Every inserted match gets `trade_id = classifyOpportunity(...)`.
- **SAM.gov:** `SAM_NAICS_CODES` is replaced by the union of the active trades' NAICS codes, passed into `selectSamRows` and `backfillCodeForDate`. It is still one daily request plus one backfill request, so the quota use is unchanged. With zero active NAICS codes, SAM.gov is skipped with a stated reason, and local bids all go to Other trades.
- The `?samBackfill=<NAICS>` validation uses the same union.

## Matches page

- **Existing status tabs** (New, Assigned, Dismissed, Expired, All) show only matches with a `trade_id`.
- **The new "Other trades" tab** shows matches with a null `trade_id`. It has its own status filter, defaulting to New, so dismissed or expired Other trades rows can still be found. It has the same search, paging and bulk dismiss as the other tabs.
- The row tag shows the trade's label when `trade_id` is set. `opportunityTradeTag` stays as the fallback hint on Other trades rows, where it suggests which trade might be worth adding.

## Trades settings (admin Settings page)

- **List:** every trade, with its label, NAICS, NIGP and keyword counts, and an On/Off switch.
- **Add/edit form:**
  - label;
  - NAICS rows (code plus label, each code must be 6 digits);
  - NIGP codes (`NNN-NN`);
  - keywords (trimmed and lowercased, empty values dropped).
  - The form validates each field and rejects a code already used by another trade.
- **Saving is two steps:**
  1. **Preview:** a server route classifies every `new` match against the trades as they would be after the change. It returns `movedIn`/`movedOut` counts per trade and the "Other trades" count. The UI shows, for example, "This moves 12 open matches into Pressure washing and 3 to Other trades."
  2. **Confirm:** save the trade, then re-sort. Only rows whose trade changes are updated. Updates run by id, and the updated count is checked against the preview. A mismatch is reported, not hidden.
- **Scope of re-sorting:** only `status = 'new'` rows are re-sorted. Assigned, dismissed and expired matches keep their trade.
- **Switching a trade off** moves its open matches to Other trades and removes its codes from SAM.gov. Clients who chose its codes keep them. Switching it back on re-sorts again, through the same preview.
- **If re-sorting fails partway,** the error reports how many rows moved and how many didn't. No rows are ever deleted.

## Client forms and AI document reading

- **Checkbox options:** the `IntakeWizard` and `CompanyInfoForm` NAICS checkboxes are built from the active trades' `naics` entries (`code: label`).
- **Existing selections:** codes a client already has that are no longer offered still show as checked, labelled with the code alone. They are never silently removed.
- **AI document reading:** `extract-from-document` and `extract-company-profile` accept codes from the active trades instead of `COMMON_NAICS_CODES`.
- **Trade labels:** `clientTradeLabel` resolves labels from the trades.
- **Removed:** `COMMON_NAICS_CODES`, `SAM_NAICS_CODES` and `OPPORTUNITY_TRADE_TAGS`' role as the matching list are removed once every reader uses the table. `opportunityTradeTag` stays, as the fallback hint only.

## Starting trades (seed)

These are created on each database only after the user approves this exact table. They carry over today's lists.

| trade | NAICS | title keywords |
|---|---|---|
| Janitorial | 561720 Janitorial Services, 561740 Carpet and Upholstery Cleaning Services, 561790 Other Services to Buildings and Dwellings, 561210 Facilities Support Services | janitorial, custodial, day porter, building cleaning, office cleaning, carpet cleaning, floor care, window cleaning, pressure washing |
| Landscaping / Grounds | 561730 Landscaping Services | landscap, lawn care, lawn maintenance, grounds maintenance, mowing, tree trimming, irrigation maintenance, irrigation repair, turf maintenance |
| HVAC / Plumbing | 238220 Plumbing, Heating, and Air-Conditioning Contractors, 238290 Other Building Equipment Contractors | hvac, air condition, refrigerant, chiller, heat pump, ductwork, heating and cooling, plumbing, plumber, backflow, water heater, boiler |
| Electrical | 238210 Electrical Contractors | electrician, electrical contractor, electrical services, electrical repair, electrical maintenance, electrical installation, switchgear, panel upgrade, lighting retrofit |
| IT / Computer Support | 541512, 541519, 518210 | computer support, it services, it support, information technology, network administration, help desk, desktop support, cybersecurity, software development, web application |

**Decided by the user (2026-09-23):**

- 238220 belongs to one **HVAC / Plumbing** trade.
- 561210 Facilities Support goes under **Janitorial**, with no separate trade.
- The keywords are **tightened**:
  - dropped: broad words such as "electrical", "wiring", "conduit", "turf", "ornamental", "irrigation" and "cleaning services";
  - replaced with the specific phrases above;
  - matched at word starts, in titles only (see Classification).

**Measured on 2026-09-23 against the 80 production matches, with these final rules:**

- **2 match a trade, both correctly:**
  - "Boilers PM & Testing" → HVAC / Plumbing, by NAICS code;
  - the Jacksonville Beach janitorial RFP → Janitorial, by the real title "Citywide Janitorial Services" that the fixed scraper now supplies. The old stored row still has the placeholder title, so it would not match; it has been withdrawn and dismissed anyway.
- **The other 78 go to Other trades,** and none of them is in an offered trade: roads, drainage, bridges, sidewalks, engineering and CEI services, software licences, and so on. "McCoy's Creek Greenway" matched Landscaping under scope matching; it no longer does.
- **Where the volume sits:** today's local sources post almost nothing in the offered trades. The trade list mainly cleans up the queue; finding more real bids in these trades depends on adding the new sources (OpenGov, DemandStar, Bonfire).

**NIGP codes:** none are seeded unless verified against an official NIGP code listing during implementation. Gemini's "910-39" and "958-63" are not taken as fact.

## Rollout

1. Migration on `bidpulse-dev` first, with a dry run, then `db push`.
2. Seed the approved trades on dev. The first classification of the existing `new` matches goes through the same preview-and-confirm path.
3. End-to-end browser test on dev:
   - add a trade, and check the preview count matches the actual moves;
   - switch a trade off and on;
   - sign up as a client;
   - Profile checkboxes;
   - a real scrape run.
4. Production:
   - confirm the linked project ref is `rixsgnbivayeaxbdseij`, as CLAUDE.md requires;
   - `db push`;
   - verify the new table over REST (PGRST205 check);
   - seed with approval;
   - the admin runs the first re-sort through the UI.

## Testing

Unit tests (`node --test`, as in the rest of `lib/`):

- `classifyOpportunity`: NAICS, NIGP, title keyword, scope keyword, first-match order, codes before keywords, inactive trades ignored, null when nothing matches.
- Trade form validation: NAICS and NIGP formats, duplicate code across trades, keyword normalising.
- Re-sort planning: a pure function that takes current rows and the old and new trades, and returns the per-trade moves that the preview shows and the confirm step applies.
- SAM helpers: taking the code list as a parameter instead of a constant.
