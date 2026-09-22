# BidPulse: Self-Serve → Done-for-You Migration Plan

## The core change
BidPulse was self-serve: a contractor logs in and does their own bid work.
The done-for-you model has a contractor submit their info, and
**you** (the admin/team) prepare the capability statement, compliance
matrix, and technical narrative for them.

This changes the roles on nearly every page: what was "the contractor's
own dashboard" becomes "the client's read-only status view," and a new
"admin operations" side gets added where the real work happens.

## What carries over as-is
- Supabase auth pattern, RLS pattern, `AppShell` design system/tokens
- `bid_documents` (RFP upload) — becomes the "Your bid file" step of intake
- `audit_log` — same purpose, still needed
- The JEA/JAA/Atlantic Beach/Jacksonville Beach scrapers — still valuable,
  just feed an admin-curated queue instead of a client-facing feed
- `lib/pdf/bid-packet.ts` — evolves into the capability statement /
  compliance matrix / technical narrative generator, but admin-triggered
  instead of client-triggered

## What needs to change structurally
- **Roles.** Current `team_members.role` values (`contractor_owner`,
  `contractor_member`, etc.) assumed every org manages its own bids.
  New model needs two clearly separate roles: `admin` (you/your team —
  sees every client) and `client` (a contractor — sees only their own
  submission).
- **`bids` table** effectively becomes each client's "package/submission"
  — add fields for package type (one-off / retainer / pilot), status
  (matches the 6-stage pilot timeline), and whether it's a real order or
  an internal test ("Waived/Test").
- **`organizations`** shifts to represent *your* business, not each
  contractor's. A new `clients` concept is needed for each contractor who
  submits intake — they're not full multi-person orgs with their own
  team necessarily, just a submitter tied to one package.
- **Matched opportunities** move from client-facing to admin-curated: you
  review what the scraper found, then assign relevant ones to specific
  clients, who see them added to their pipeline.

## What's genuinely new
- **Public marketing site**: home, pricing/pilot offer, fit-score quiz,
  capability-statement gallery, worked example, FAQ/blog
- **3-step client intake wizard**: About you (company info, NAICS codes,
  small-business/set-aside status) → About the bid (agency, solicitation,
  due date) → Your bid file (RFP upload) — with save-draft and
  submit-lock
- **Client dashboard**: package status, pending-info checklist, 6-stage
  pilot timeline, deliverable access — all read-only status, not editing
  tools
- **Admin operations inbox**: every client's intake, status editing,
  internal notes, compliance-readiness checklist, test/waived filtering
- **Payments**: pricing packages, a pilot offer, checkout — needs a real
  payment processor (Stripe is the standard choice), not built yet
  anywhere
- **Confirmation emails**: post-payment and post-submission

## Two decisions needed before building
1. **Payments**: wire up real Stripe checkout now, or start with manual
   invoicing and add Stripe later?
2. **Existing data**: is there any real contractor data in BidPulse worth
   keeping (test accounts, anything real), or is this a clean restart on
   the same Supabase project?
