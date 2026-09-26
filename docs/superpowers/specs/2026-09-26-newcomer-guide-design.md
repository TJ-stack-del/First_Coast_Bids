# New to bidding: a guide and a "Where do I start?" check for newcomers

Date: 2026-09-26. Status: design approved in chat; this spec is awaiting review.

## Why

The marketing site assumes the reader already bids.
- **The blog** has two posts (2026-07-18 and 2026-08-01), both for people
  already bidding. Its dates make the site look inactive.
- **The "Fit-Score Quiz"** asks about an upcoming RFP deadline, a compliance
  matrix, and WOSB/SDVOSB/8(a)/HUBZone certifications. It tells a newcomer to
  "Send us your RFP".
- **The FAQ** covers the service, not how government bidding works.

A trade business owner who is curious but new hits jargon everywhere, and
has no path unless they already hold an RFP.

**Constraints:**
- **One person runs the business:** nothing may need regular feeding (no
  dated posts).
- **Never fabricate** (PRODUCT.md): no invented statistics, customers,
  stories or win promises. Every factual claim about registration, portals
  or rules is checked against its official source when written, and linked.
- **Voice** (PRODUCT.md): confident, warm, plain-spoken peer-to-peer. About
  an 8th-grade reading level. No "guarantee a win" and no unqualified "free":
  the Pilot is free for the first 10 clients
  ([[project-pilot-free-cohort-cap]]); follow the pricing page's own wording.

## Decisions made with the user

1. **The newcomer's next step** is to learn the basics, get ready (register
   in SAM.gov and/or on local vendor portals, have license and insurance),
   then start with the Pilot. The Pilot starts with the first bid they find,
   or one found for their trade.
2. **The blog is replaced** by an evergreen, undated guide. The two existing
   posts become guide articles without their dates.
3. **The quiz becomes "Where do I start?"**, the front door of the newcomer
   path.

## Out of scope

- New pricing or offers (the Retainer question is separate).
- Any account, data capture or email signup on the guide or the check.
- The admin side, and the bid-sourcing work.
- A CMS. Articles are code, like the rest of the marketing pages.

## Structure

**Menu** (`components/ui/MarketingShell.tsx`):
- "Blog" becomes **"New to bidding?"**, linking to `/guide`.
- "Fit-Score Quiz" becomes **"Where do I start?"**, linking to `/quiz` (the
  URL is kept, so existing links still work).

**Redirect:** `/blog` → `/guide` (permanent), in `next.config.ts`.

**Homepage** (`app/(marketing)/page.tsx`): a small "New to government bids?
Start here →" link to `/guide`, placed:
- near the hero;
- beside the final call to action.

**Guide hub** (`/guide`):
- a title and lede: "Government work for trade businesses, in plain
  English";
- the path in three steps (**Learn → Get ready → Start**), each linking to
  its articles;
- a list of all articles, with a one-line summary each.

**Articles** (`/guide/<slug>`), each short (roughly 400–900 words), answering
one question, undated:

| Slug | Title | Covers |
|---|---|---|
| `what-is-an-rfp` | What's an RFP? | RFP, ITB, RFQ, addendum, pre-bid meeting, site visit, bid bond, "responsive" and "responsible", in plain words |
| `is-government-work-for-me` | Is government work right for my business? | What trade work agencies buy (cleaning, grounds, HVAC, electrical, IT support); the honest trade-offs: steady, reliable payers, but more paperwork, fixed deadlines, sealed prices, and wage rules on federal service jobs |
| `where-bids-are-posted` | Where bids are posted around Jacksonville | SAM.gov (federal); the city, the counties (Duval, Clay, St. Johns, Nassau), the school districts, JEA, JTA and JAXPORT; the platforms they use (DemandStar, Public Purchase, OpenGov, VendorLink, PlanetBids, the state's MyFloridaMarketPlace); that most need a free vendor account to see listings |
| `getting-registered` | Getting registered | SAM.gov entity registration (free; renew yearly; ignore paid "registration services"); local vendor accounts; what to have ready: legal business name and address, tax ID, bank details for federal registration, license, insurance certificate |
| `your-first-bid` | Your first bid, step by step | Find it, read it all, note every date (questions, site visit, due time), download addenda, gather forms, price it, check it, submit on time, what happens after (opening, award, protest window) |
| `before-you-submit` | Five things to check before submitting | The existing blog post, reviewed and undated |
| `compliance-matrix` | Why a compliance matrix matters | The existing blog post, reviewed and undated |

**Every article:**
- ends with a "Next step" block: the "Where do I start?" check, and the
  Pilot (`/intake`);
- ends with **Sources**: links to the official pages its facts came from;
- has a unique `<title>` and meta description (search), plus next/previous
  links along the path.

**Content lives in** `lib/guide/articles.ts`:
- an ordered list of `{ slug, title, summary, step: "learn" | "ready" |
  "start", body, sources: {label, url}[] }`;
- `body` is structured blocks (headings, paragraphs, lists, a callout), not
  raw HTML;
- the hub, the article pages and the check all read from it.

## "Where do I start?" check (`/quiz`, rewritten)

**Four plain yes/no questions:**
1. Have you bid on a government job before?
2. Are you registered in SAM.gov or on a local bid site?
3. Do you have your business license and insurance?
4. Do you have a bid (an RFP or ITB) in hand right now?

**The result is 1–3 next steps**, from a pure function
`nextSteps(answers) → { slug | "pilot", why }[]`:
- **Q4 yes:** the Pilot comes first ("Send it to us: we'll prepare it with
  you").
- **Q2 no:** Getting registered.
- **Q3 no:** Getting registered, with the license and insurance section
  called out.
- **Q1 no:** Your first bid (and What's an RFP? if nothing else applies).
- **All ready and no bid in hand:** Where bids are posted, then the Pilot.

**Other details:**
- It's answered in the browser, like the current quiz. Nothing is stored or
  sent.
- The page title is "Where do I start?", with a lede for newcomers and people
  who have bid alike.
- The old quiz's result copy ("You're a strong fit") is removed.

## Honesty and accuracy

**Facts:** every fact about SAM.gov, portals or local buyers is checked
against the official page on the day it's written, and that page is listed
under Sources. Where a fact varies by agency ("most need a free vendor
account"), the article says so rather than stating it as universal.

**No guesses:**
- no numbers we haven't verified (no "X% of contracts", no time estimates we
  can't back);
- no customer stories;
- no promises of winning.

**Pilot wording** follows the pricing page ("free for our first 10 clients"
or its current equivalent), never a bare "free".

**Review:** a human reads every article before merge (the user). That's the
same rule as deliverables: nothing unreviewed reaches a reader.

## Testing

**Unit tests** (`node --test`):
- `nextSteps` for every answer combination (16), each giving 1–3 steps,
  in the expected order;
- every slug referenced by `nextSteps` or the hub exists in
  `articles.ts`;
- every article has a title, summary, a body, at least one source, and an
  https source URL.

**Browser check on dev:**
- the menu, the redirect `/blog` → `/guide`, the hub and every article, and
  the check's routing for a newcomer and for a bidder with an RFP;
- desktop and phone widths, no horizontal scroll, no page errors.

**Link check:** every source URL answers (HTTP 200 or a redirect), recorded
at build time.

## Rollout

Text and pages only: no database changes. It goes live with a normal merge
and push, after the user has read the articles.
