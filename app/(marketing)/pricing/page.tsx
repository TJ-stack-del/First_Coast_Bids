import type { Metadata } from "next";
import Link from "next/link";
import { Reveal } from "@/components/ui/Reveal";

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
// with no actual demand data behind it. Flip PILOT_FREE_COHORT_OPEN to
// false by hand (ask Claude, or edit directly) once PILOT_COHORT_SIZE
// free Pilots have gone out, and redeploy. What Pilot costs after that
// point is deliberately undecided -- real cost-per-bid and conversion
// data from this first cohort is what should set that number, not a
// guess made before a single real bid has been completed (see
// project_bidpulse_package_pricing.md) -- so post-cap Pilot falls back
// to the same "confirmed with you directly" pattern already used
// elsewhere on this page, not a fabricated number.
const PILOT_FREE_COHORT_OPEN = true;
const PILOT_COHORT_SIZE = 10;
const PILOT_PRICE_LINE = PILOT_FREE_COHORT_OPEN
  ? `Free for the first ${PILOT_COHORT_SIZE} clients`
  : "Pricing confirmed with you directly";

const PACKAGES = [
  {
    type: "pilot",
    name: "Pilot",
    tagline: "A low-commitment first bid, on us to prove the process.",
    priceLine: PILOT_PRICE_LINE,
    features: ["One full bid, done for you", "See how the process works", "No commitment after"],
    cta: { label: "Get started", href: "/intake?package=pilot" },
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
    cta: { label: "Get started", href: "/intake?package=one_off" },
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
    cta: { label: "Get started", href: "/intake?package=retainer" },
    highlight: false,
    badgeLabel: null,
  },
];

export default function PricingPage() {
  return (
    <>
      <section className="text-center flex flex-col gap-2">
        <Reveal mode="mount">
          <h1 className="text-headline-lg text-primary">Pricing</h1>
        </Reveal>
        <Reveal mode="mount" delay={0.08}>
          <p className="text-body-md text-on-surface-variant">
            Starting prices below. We confirm the exact number with you directly before any
            work starts. No card required today.
          </p>
        </Reveal>
      </section>

      {/* One bordered ledger, not three floating cards -- matches the
          homepage's pricing preview so a visitor doesn't land on a
          differently-styled treatment of the identical three tiers after
          clicking through from there. */}
      <section>
        <Reveal className="rounded-xl border border-outline-variant overflow-hidden grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-outline-variant">
          {PACKAGES.map((pkg) => (
          <div
            key={pkg.type}
            className={`p-space-base flex flex-col gap-space-md ${pkg.highlight ? "bg-primary-container/10" : ""}`}
          >
            <header className="flex flex-col gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-headline-md text-primary">{pkg.name}</h2>
                {pkg.badgeLabel && (
                  <span className="px-2 py-0.5 rounded bg-primary-container text-on-primary-container text-label-sm font-bold uppercase tracking-wider">
                    {pkg.badgeLabel}
                  </span>
                )}
              </div>
              <p className="text-body-sm text-on-surface-variant">{pkg.tagline}</p>
              <p className="text-body-lg font-bold text-primary">{pkg.priceLine}</p>
            </header>
            <ul className="flex flex-col gap-3 flex-grow">
              {pkg.features.map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-primary text-[20px]">check_circle</span>
                  <span className="text-body-md text-on-surface">{f}</span>
                </li>
              ))}
            </ul>
            <Link
              href={pkg.cta.href}
              className={`py-3 px-4 rounded text-label-md text-center transition active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                pkg.highlight
                  ? "bg-primary-container text-on-primary-container hover:opacity-90 hover:-translate-y-0.5"
                  : "bg-surface-container-low text-on-surface border border-outline hover:bg-surface-container-high hover:-translate-y-0.5"
              }`}
            >
              {pkg.cta.label}
            </Link>
          </div>
        ))}
      </Reveal>
      </section>

      <Reveal
        as="div"
        className="p-gutter bg-surface-container-low rounded-lg border border-outline-variant flex flex-col md:flex-row items-center justify-between gap-6"
      >
        <div className="flex-1 flex flex-col gap-2 text-center md:text-left">
          <h3 className="text-body-lg font-semibold text-on-surface">Not sure which one fits?</h3>
          <p className="text-body-sm text-on-surface-variant">
            Just start the bid form. We'll figure out the right plan together.
          </p>
        </div>
        <Link
          href="/intake"
          className="shrink-0 py-2 px-6 border border-primary text-primary rounded text-label-md hover:bg-surface-container-high transition active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Get started
        </Link>
      </Reveal>
    </>
  );
}
