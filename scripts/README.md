# Inbound bid email pipeline

Second opportunity-ingestion path alongside the JAA scraper
(`lib/scrapers/jaa.ts` + `app/api/scrape/route.ts`): DemandStar,
PublicPurchase, and JTA don't have a scrapable listings page, only email
notifications, so this pipeline forwards those emails to
`app/api/inbound-bid-email/route.ts` instead. Both paths write to the same
`matched_opportunities` table with `assigned_client_id` left null, so
everything lands in the same `/admin/matches` review queue — no new admin
UI, no separate review flow.

## What Mike needs to do (outside this repo)

1. **IONOS forwarding.** Point `bids@firstcoastbids.com` (the current
   brand domain — `bidpulse.co` is being fully decommissioned, 30-day
   sunset as of 2026-09-22, do not set up anything new against it) at a
   real Gmail inbox/alias — this repo has no access to IONOS's mail
   settings.
2. **Gmail label + filter.** In that Gmail account: create a label named
   `BidPulse/Inbound` (or rename it to match the current brand if you
   prefer — the label name only needs to match `LABEL_NAME` in
   `gmail-inbound-bid-trigger.gs`), then a filter that applies it to mail
   arriving at the forwarded address, so the script only ever looks at
   real bid notifications, not everything in the inbox.
3. **Apps Script project.** At script.google.com, create a new project
   under that same Gmail account, paste in
   `gmail-inbound-bid-trigger.gs`'s contents.
4. **Script properties.** In the Apps Script project (gear icon → Script
   properties, or Project Settings), set:
   - `WEBHOOK_URL` → `https://<production-domain>/api/inbound-bid-email`
   - `WEBHOOK_SECRET` → a real random secret, matching Vercel's
     `INBOUND_BID_EMAIL_SECRET` env var exactly (set that on Vercel too —
     see below)
5. **Trigger.** In the Apps Script editor, Triggers → Add Trigger →
   function `processInboundBidEmails`, time-driven, every 15 minutes (or
   whatever cadence feels right — there's no real-time push available for
   a plain Gmail label, so this is inherently polling).
6. **Vercel env var.** Add `INBOUND_BID_EMAIL_SECRET` to the production
   (and preview, if desired) environment on Vercel, same value as the
   Apps Script property above. Without this set, the webhook route
   rejects every request with 401 — it never falls back to "no secret
   required."

## What this repo already does

- `app/api/inbound-bid-email/route.ts` — the webhook. Verifies the
  `Authorization: Bearer <INBOUND_BID_EMAIL_SECRET>` header, sends the
  email's subject/body to Claude for extraction (title, agency,
  solicitation number, due date, scope — same "never invent, return null
  if not stated" discipline as every other extraction route in this
  app), and inserts one `matched_opportunities` row (`status: "new"`,
  `assigned_client_id: null`). Falls back to the raw subject line / a
  flagged placeholder for `source_title`/`source_agency` if extraction
  can't confidently fill them, rather than dropping an under-described
  email silently — this route runs unattended, so there's no admin
  present to catch a gap the way intake's own upload UI lets a client
  fill one in.
- Duplicate guard: skips inserting if a row with the same
  `source_title` + `source_agency` already exists for the org — same
  logic the scraper already uses, so a re-scanned/re-labeled thread
  doesn't create a second row.

## Testing without waiting on Gmail

```bash
curl -X POST https://<domain>/api/inbound-bid-email \
  -H "Authorization: Bearer $INBOUND_BID_EMAIL_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "notifications@demandstar.com",
    "subject": "New Bid Opportunity: Janitorial Services",
    "body": "City of Example, Procurement Division is soliciting bids for Janitorial Services at City Hall. Solicitation #JAN-2026-014. Proposals due 2026-11-01."
  }'
```

Expect a real `matched_opportunities` row (check `/admin/matches`) with
`source_title` ≈ "Janitorial Services" or similar, `source_agency` ≈ "City
of Example, Procurement Division", `solicitation_number` = "JAN-2026-014",
`due_date` = 2026-11-01.
