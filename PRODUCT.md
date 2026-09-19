# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Small trade contractors and service businesses — sole proprietors up through small crews, in HVAC, janitorial, landscaping, IT/computer support, and electrical — who occasionally or regularly bid on local/state government contracts. The owner/operator is the decision-maker in nearly every case: this is a single-persona business (user, champion, decision-maker, and financial buyer are the same person), not a multi-stakeholder B2B buying committee.

Primary situation: "I found a government bid I could actually do the work for, but I don't have the time or expertise to produce a compliant submission package before the deadline."

## Product Purpose

Done-for-you compliance paperwork for government bids. A client uploads an RFP/solicitation; a real person on the First Coast Bids team turns it into a ready-to-submit capability statement, compliance matrix, and technical narrative, tailored to the client's trade and the agency's actual requirements. The client reviews, signs, and submits it themselves through their own government vendor portal account — First Coast Bids never touches the agency relationship or the client's credentials, and never submits on the client's behalf.

Success means: a real contract the contractor was qualified to win isn't lost on paperwork technicality (a missing form, a wrong certification claim, a missed mandatory site visit) instead of on price or capability.

## Positioning

Combines real human bid-prep expertise with narrow, deterministic tooling (document extraction, compliance-rule detection, placeholder-enforcement) instead of either fully-manual bid consulting (too slow/expensive for this deal size) or an unsupervised AI writing the whole submission (fast and cheap, but will confidently fabricate a certification number, a past-project detail, or a compliance claim that isn't true).

The mechanism a neighboring product could not truthfully copy: **never fabricates a fact.** Any detail not explicitly provided by the client renders as a visible bracketed placeholder rather than an invented value, and a client cannot download a packet with unresolved placeholders in it. Real, agency-specific compliance detection (school → background checks, airport → SIDA badging, transit → DBE goals, VA → CUI/508, detention → PREA/bloodborne training) is derived from the agency name and the RFP's own text, not generic boilerplate. Compliance-matrix rows extracted from the uploaded RFP carry the exact page number and verbatim quoted source sentence, so a human reviewer verifies against the real document without re-reading all of it.

## Operating Context

Client-side flow: intake (company info, agency/job details, bid file upload) → admin team prepares the three deliverables → client previews a real excerpt of each for free → pricing confirmed manually/invoiced (no self-serve checkout) → full package unlocks on payment → client reviews, signs, and submits it themselves through their own agency portal account.

Admin-side: an ops platform (admin inbox, deliverables pipeline, compliance-matrix extraction with page-number-and-quoted-source citations, a fit-check readiness signal, an audit trail on every status change).

The product is pre-revenue / early-stage and currently runs on test/demo data throughout.

## Capabilities and Constraints

- Manually confirmed, invoiced pricing — no self-serve checkout. Three packages: **Pilot** (free for the first 10 clients, no commitment after), **One-off** (starting at $399), **Retainer** (starting at $649/mo, up to 2 full bids/month). Below a configurable dollar threshold (org-set, default informed by FL Statute 287.017 Category Two), a reduced "lean package" (Rate Sheet + Executive Cover + Certificate of Insurance) is offered instead of the full 3-deliverable set.
- 48-hour typical turnaround (a site claim, not yet customer-validated at volume).
- Never guarantees a win, anywhere — the fit-check readiness signal (strong/moderate/weak) is explicitly scoped to "is this submission well-formed," never framed as a win-probability.
- No named competitors are positioned against on any marketing page yet; the realistic alternatives a prospect actually compares against are traditional bid-writing consultants, DIY generic AI tools, or not bidding on government work at all.
- Undecided: how the product is described once real customer conversations happen (Customer Language and Competitive Landscape in the marketing-context doc are both explicitly marked as pre-verification placeholders to revisit).

## Brand Commitments

Name: **First Coast Bids** (renamed from "BidPulse" in September 2026 — the full rebrand across marketing pages, admin/dashboard UI, wordmark, PDF packet footer, email sender name, OG image, and PWA manifest is complete; the production domain (bidpulse.co) and two already-rendered launch videos are a deliberately separate, not-yet-executed follow-up).

Visual identity: Navy (#0C2D52) + Gold (#C19349), a shield-with-checkmark-and-growth-arrow mark.

Voice: Confident, warm, plain-spoken. Direct and respectful, never corporate or salesy — speaks to blue-collar small business owners as peers, not as marks for a tech pitch. Brand personality: grounded, trustworthy, no-nonsense, competent, unglamorous-on-purpose.

Words to avoid: "guarantee a win," unqualified "free" (the actual offer is "no card required" / Pilot "on us," not blanket free), AI-generated buzzwords ("cutting-edge," "revolutionary"), corporate tech-startup tone.

## Evidence on Hand

No verified metrics, named customers, or testimonials exist yet — this is a pre-revenue product. **Do not fabricate placeholder metrics, quotes, or customer names anywhere in generated content.** Current site claims ("Most bids ready in 48 hours," "No card required to get started") are positioning statements, not yet customer-validated data.

Where example content is needed (e.g. the Gallery page), it must be clearly labeled as a synthetic/demo example, never presented as a real client's work.

## Product Principles

1. **Never fabricate a fact.** A missing detail becomes a visible placeholder, not an invented value — and a packet with an unresolved placeholder can't ship to a client.
2. **Honest scope, always.** No guarantee of winning, no win-probability framing, no blanket "free" claim — pricing and outcomes are stated exactly as confirmed, never rounded up to sound better.
3. **The client stays in control.** The product prepares the package but never touches the agency relationship, the client's own portal credentials, or submits anything on their behalf.
4. **Speed and affordability without losing the human in the loop.** Deterministic tooling handles extraction and compliance-detection; a real person still prepares and reviews every deliverable.
5. **Plain-spoken, peer-to-peer voice.** No corporate or tech-startup tone — explain things the way one tradesperson would explain them to another.

## Accessibility & Inclusion

No accessibility standard or specific user need has been established yet (confirmed 2026-09-19). Do not invent a requirement; revisit this section once one is set.

## Changelog

- v1 (2026-09-19) — Initial PRODUCT.md, drafted from the existing `.agents/product-marketing.md` (v5) and the live codebase rather than a full interview, since that document already contained strong, current, first-party product evidence. Accessibility was the one confirmed gap, checked directly with the user rather than inferred.
