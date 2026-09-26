import type { Metadata } from "next";
import Link from "next/link";
import { PricingSpec } from "@/components/marketing/PricingSpec";
import s from "@/components/marketing/press.module.css";
import { pilotPriceLine } from "@/lib/pilot-offer";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Simple, manually-confirmed pricing for done-for-you bid prep. Pilot, one-off, and retainer options.",
};

// Manual invoicing for now per BUILD-ORDER-BIDPULSE.md's "decisions
// already made" — no Stripe checkout, so every offer ends in "Get started"
// (the intake wizard) or a mailto, not a payment button. Mirrors
// packages.package_type: 'one_off' | 'retainer' | 'pilot'.

// Real starting-at figures, published 2026-09-16 -- a persona-based
// research pass (a skeptical first-time-bidder test walking the actual
// intake flow) found the previous fully-opaque pricing ("we confirm
// pricing with you directly," no number anywhere on the page or FAQ) was
// the single biggest trust gap in an otherwise well-built flow: a
// prospect filled in their entire business profile without ever learning
// what this costs. These are the founder's real internal target numbers
// (already used to quote real clients) published as "starting at" rather
// than fixed, since actual price is still confirmed per-job -- that
// framing keeps the manual-invoicing model intact while closing the
// opacity gap. Update alongside the internal pricing memory if these
// change.
const ONE_OFF_STARTING_PRICE = "Starting at $399";
const RETAINER_STARTING_PRICE = "Starting at $649/mo";

// Manual "flip" for the Pilot free cohort -- unlimited free Pilots is an
// open-ended labor/API-cost liability (each one is a real bid a real
// person prepares), so the free offer is capped to the first N clients
// rather than a standing one. Deliberately NOT an automated DB
// counter/admin toggle: pre-revenue with zero real signups yet, so
// building real-time cap enforcement now would mean sizing a threshold
// with no actual demand data behind it. Flip PILOT_FREE_COHORT_OPEN (lib/pilot-offer.ts) to
// false by hand (ask Claude, or edit directly) once PILOT_COHORT_SIZE
// free Pilots have gone out, and redeploy. What Pilot costs after that
// point is deliberately undecided -- real cost-per-bid and conversion
// data from this first cohort is what should set that number, not a
// guess made before a single real bid has been completed (see
// project_bidpulse_package_pricing.md) -- so post-cap Pilot falls back
// to the same "confirmed with you directly" pattern already used
// elsewhere on this page, not a fabricated number.
// The flip itself now lives in lib/pilot-offer.ts (shared with the homepage
// and the guide, 2026-09-26), so the price line can't drift between pages.
const PILOT_PRICE_LINE = pilotPriceLine();

const PACKAGES = [
  {
    type: "pilot",
    name: "Pilot",
    tagline: "A low-commitment first bid, on us to prove the process.",
    priceLine: PILOT_PRICE_LINE,
    features: ["One full bid, done for you", "See how the process works", "No commitment after"],
    cta: { label: "Start a pilot bid", href: "/intake?package=pilot" },
    // Moved here from One-off -- the badge previously read "Most popular"
    // with zero real usage data to back that claim on a pre-revenue
    // product (a direct fabricated-social-proof problem the same research
    // pass flagged), on the one tier that contradicts the site's own
    // stated funnel strategy of starting prospects on the free Pilot.
    // "Start here" is an honest recommendation, not a usage stat.
    highlight: true,
    badgeLabel: "Start here",
  },
  {
    type: "one_off",
    name: "One-off",
    tagline: "A single bid, fully prepared.",
    priceLine: ONE_OFF_STARTING_PRICE,
    features: ["The write-up about your company", "A checklist matching the agency's rules", "The technical write-up"],
    cta: { label: "Start a one-off bid", href: "/intake?package=one_off" },
    highlight: false,
    badgeLabel: null,
  },
  {
    type: "retainer",
    name: "Retainer",
    tagline: "Ongoing coverage for teams bidding regularly.",
    priceLine: RETAINER_STARTING_PRICE,
    features: ["We watch for new bids every month", "Up to 2 full bids a month", "One person who knows your file"],
    // Used to be a mailto: dead end -- a retainer prospect who clicked it
    // never became a clients/submissions row at all, and was invisible to
    // the admin inbox and daily digest alike (no account exists to show
    // up anywhere). Routing through /intake like the other two tiers means
    // a real account gets created immediately; the admin assigns the
    // actual package_type (already supported -- see
    // app/admin/inbox/[id]/PaymentStatus.tsx's package selector) once they
    // follow up, exactly like every Pilot/One-off client today.
    //
    // ?package=retainer (same on every tier's href here) is read by
    // IntakeWizard.tsx and logged to audit_log once the submission is
    // created, so an admin following up sees which tier was actually
    // clicked -- an impeccable critique pass (2026-09-16) found the old
    // /intake-for-everyone version gave admins strictly LESS signal than
    // the mailto it replaced (a real email at least carried intent in its
    // subject line).
    cta: { label: "Ask about a retainer", href: "/intake?package=retainer" },
    highlight: false,
    badgeLabel: null,
  },
];

// 2026-09-23: same spec-table pricing as the landing page (PricingSpec),
// so a visitor clicking through sees the identical treatment of the same
// three tiers. See DESIGN.md, "Marketing theme".
export default function PricingPage() {
  return (
    <>
      <header className={s.pageHead}>
        <h1 className={s.pageTitle}>Pricing</h1>
        <p className={s.lede}>
          Starting prices below. We confirm the exact number with you directly before any work starts. No card
          required today.
        </p>
      </header>

      <section>
        <PricingSpec tiers={PACKAGES} />
      </section>

      <section className={s.ctaLine}>
        <div>
          <h2>Not sure which one fits?</h2>
          <p className={s.muted}>Just start the bid form. We&apos;ll figure out the right plan together.</p>
        </div>
        <Link href="/intake" className={`${s.btn} ${s.btnQuiet}`}>
          Get started
        </Link>
      </section>
    </>
  );
}
