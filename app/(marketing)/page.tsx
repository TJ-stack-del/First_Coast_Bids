import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { KNOWN_TRADES, assertNoMissingTradeCards } from "@/lib/compliance/known-trades";
import { TransformationPipeline } from "@/components/ui/TransformationPipeline";
import { Reveal } from "@/components/ui/Reveal";

export const metadata: Metadata = {
  description: "We help you win local government contracts. Send us the bid papers. Our team handles the paperwork so you can send in a strong bid.",
};

// Also the one place that decides where a signed-in user actually lands —
// see MIGRATION-TO-BIDPULSE.md: admin (team_members) and client (clients)
// are two completely separate account types now, so routing has to branch
// on which row exists rather than sending everyone to the same dashboard.
// An anonymous visitor gets the public marketing homepage instead (Step 3).
export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return <Home />;

  const { data: member } = await supabase
    .from("team_members")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (member) redirect("/admin/inbox");

  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (client) redirect("/dashboard");

  return (
    <main className="min-h-screen flex items-center justify-center bg-surface px-margin-mobile py-12 text-center">
      <p className="text-body-md text-error">No account found for this login. Contact support.</p>
    </main>
  );
}

const HOW_IT_WORKS = [
  {
    icon: "search",
    badge: "bg-primary-fixed text-on-primary-fixed",
    title: "1. Tell us about the bid",
    body: "A three-step form: your company info, the agency and job details, and the bid file itself.",
  },
  {
    icon: "fact_check",
    badge: "bg-secondary-container text-on-secondary-container",
    title: "2. We do the work",
    body: "Our team writes the paperwork about your company, checks it against the agency's rules, and writes up the technical part.",
  },
  {
    icon: "task",
    badge: "bg-tertiary-fixed text-on-tertiary-fixed",
    title: "3. You review and send it",
    body: "You check everything over. We confirm once it's actually sent in to the agency.",
  },
];

// "HVAC", "IT / Computer Support" -> "HVAC" / "IT / computer support": lowercases
// each word except ones already fully uppercase (acronyms), so labels read
// naturally mid-sentence instead of as a title-cased list.
function toSentenceCase(label: string): string {
  return label
    .split(" ")
    .map((word) => (word === word.toUpperCase() ? word : word.toLowerCase()))
    .join(" ");
}

// Sourced from known-trades.ts (the trade-coverage safety net's source of
// truth) so this copy can't go stale again the next time a vertical is added.
const SUPPORTED_TRADES_LIST = new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format(
  KNOWN_TRADES.map((trade) => toSentenceCase(trade.label))
);

const TRADES = [
  {
    id: "hvac",
    icon: "hvac",
    title: "HVAC",
    body: "Installation, maintenance, and repair contracts for public buildings.",
  },
  {
    id: "janitorial",
    icon: "cleaning_services",
    title: "Janitorial",
    body: "Cleaning and facility-upkeep contracts for schools, offices, and public spaces.",
  },
  {
    id: "landscaping",
    icon: "yard",
    title: "Landscaping",
    body: "Grounds maintenance and lawn care contracts for cities, parks, and school districts.",
  },
  {
    id: "it-computer-support",
    icon: "computer",
    title: "IT / Computer Support",
    body: "Help desk, network support, and technical-service contracts for schools, agencies, and public offices.",
  },
  {
    id: "electrical",
    icon: "electrical_services",
    title: "Electrical",
    body: "Panel upgrades, lighting retrofits, and wiring contracts for municipal and school facilities.",
  },
];

// Each id here must match a KNOWN_TRADES id — this section needs a real
// authored icon + description per trade, so it can't be generated from
// known-trades.ts the way the tagline above is. Instead this fails the
// build/render loudly the moment a new trade ships there without a
// matching card, rather than silently drifting until a screenshot catches
// it (which is exactly how Gallery's separate card list drifted before
// this check existed for it too — see app/gallery/page.tsx).
assertNoMissingTradeCards(
  TRADES.map((t) => t.id),
  '"Trades we work with" section (app/page.tsx)'
);

// Mirrors app/pricing/page.tsx's PACKAGES (name/tagline/first two features per
// tier) — keep these two in sync by hand if pricing copy changes. Duplicated
// rather than imported because pricing/page.tsx doesn't export PACKAGES, and
// this preview intentionally shows fewer features per tier than the full page.
//
// Price lines and the Pilot free-cohort flip are kept in sync with
// pricing/page.tsx's own constants -- see that file's comments for the
// full reasoning (2026-09-16 pricing-transparency + Pilot-cap decisions).
const PILOT_FREE_COHORT_OPEN = true;
const PILOT_COHORT_SIZE = 10;
const PILOT_PRICE_LINE = PILOT_FREE_COHORT_OPEN
  ? `Free for the first ${PILOT_COHORT_SIZE} clients`
  : "Pricing confirmed with you directly";

const PRICING_PREVIEW = [
  {
    name: "Pilot",
    tagline: "A low-commitment first bid, on us to prove the process.",
    priceLine: PILOT_PRICE_LINE,
    terms: "No commitment after",
    features: ["One full bid, done for you", "See how the process works"],
    cta: { label: "Get started", href: "/intake?package=pilot" },
    highlight: true,
    badgeLabel: "Start here",
  },
  {
    name: "One-off",
    tagline: "A single bid, fully prepared.",
    priceLine: "Starting at $399",
    terms: "Confirmed with you before work starts",
    features: ["The write-up about your company", "A checklist matching the agency's rules", "The technical write-up"],
    cta: { label: "Get started", href: "/intake?package=one_off" },
    highlight: false,
    badgeLabel: null,
  },
  {
    name: "Retainer",
    tagline: "Ongoing coverage for teams bidding regularly.",
    priceLine: "Starting at $649/mo",
    terms: "Up to 2 full bids a month",
    features: ["We watch for new bids every month", "One person who knows your file"],
    // Kept in sync with pricing/page.tsx's own retainer CTA -- see that
    // file's comment for why this is /intake now, not a mailto: dead end,
    // and for why the ?package= param matters.
    cta: { label: "Get started", href: "/intake?package=retainer" },
    highlight: false,
    badgeLabel: null,
  },
];

// Mirrors the "About First Coast Bids" category in app/faq/page.tsx's CATEGORIES —
// same note on keeping these in sync applies.
const FAQ_PREVIEW = [
  {
    q: "What is First Coast Bids?",
    a: "A done-for-you bid prep service. You send us your RFP; our team prepares the capability statement, compliance matrix, and technical narrative for you.",
  },
  {
    q: "Do you guarantee I'll win the bid?",
    a: "No one can guarantee an award. What we guarantee is a complete, compliant submission prepared by people who've done this before.",
  },
  {
    q: "Why do I submit the bid myself instead of First Coast Bids submitting it?",
    a: "You hold the reins. Government procurement portals tie submissions to your own company's registered vendor credentials, so you're the one who uploads and hits submit. We prepare the package, you stay in control of your own account.",
  },
  {
    q: "How does pricing work?",
    a: "One-off starts at $399, Retainer starts at $649/mo, and Pilot is free for our first 10 clients. See the Pricing page for the full breakdown. We confirm the exact number with you directly before any work starts. No card is required to get started, and every deliverable is free to preview before anything's due.",
  },
];

function Home() {
  return (
    <>
      {/* ---------- Hero ---------- */}
      {/* The page's one on-load moment: headline, subhead, CTAs, and trade
          badges arrive as a single authored beat (mode="mount", staggered
          by a fixed delay) rather than each having its own scroll trigger
          -- everything below the fold uses whileInView instead, so the
          "page just loaded" feeling only happens once, where it matters. */}
      {/* A design review suggested left-aligning this (flagged as "safe but
          generic" centered) -- tried it, but per explicit user direction it
          killed the hero's actual vibe, so this stays centered/symmetric.
          Not every audit finding is worth taking; this one wasn't. */}
      <section className="flex flex-col items-center text-center gap-6 py-8">
        <Reveal mode="mount">
          <h1 className="text-display-lg text-primary font-bold max-w-3xl">
            You run the crew. We handle the paperwork.
          </h1>
        </Reveal>
        <Reveal mode="mount" delay={0.08}>
          <p className="text-body-lg text-on-surface-variant max-w-xl">
            Upload the RFP. We turn complex solicitations into a ready-to-submit capability
            statement, compliance matrix, and technical narrative, so you can review, sign,
            and send.
          </p>
        </Reveal>
        <Reveal mode="mount" delay={0.16} className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto justify-center mt-2">
          <Link
            href="/intake"
            className="w-full sm:w-auto px-8 py-4 bg-primary-container text-on-primary-container rounded text-label-md hover:opacity-90 hover:-translate-y-0.5 transition active:scale-[0.97] flex items-center justify-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Get started
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </Link>
          <a
            href="#how"
            className="w-full sm:w-auto px-8 py-4 border border-outline-variant text-on-surface rounded text-label-md hover:bg-surface-container-low hover:-translate-y-0.5 transition active:scale-[0.97] text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            See how it works
          </a>
        </Reveal>

        <Reveal mode="mount" delay={0.24} className="flex flex-wrap items-center justify-center gap-2 pt-2">
          {TRADES.map((trade) => (
            <span
              key={trade.id}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-low text-label-sm text-on-surface-variant uppercase tracking-wider"
            >
              <span className="material-symbols-outlined text-primary text-[14px]">{trade.icon}</span>
              {trade.title}
            </span>
          ))}
        </Reveal>

        <TransformationPipeline />
      </section>

      <section className="flex flex-col items-center gap-6">
        <span className="text-label-md text-primary font-bold uppercase tracking-wide border border-primary rounded-full px-4 py-1">
          Now accepting founding clients
        </span>
        {/* A divided row, not three identical cards -- matches the same
            hairline-ledger language the Trades and Pricing sections below
            already use, rather than introducing a fourth distinct "3 equal
            boxes" treatment on the same page. */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-outline-variant border-y border-outline-variant">
          {[
            {
              icon: "chat",
              title: "Plain-language process",
              body: "No confusing paperwork jargon. We explain everything in plain English.",
            },
            {
              icon: "construction",
              title: "You focus on the job",
              body: "We handle the writing so you can keep running your business.",
            },
            {
              icon: "storefront",
              title: "Built for small trades",
              body: `Not a big consulting firm, made for ${SUPPORTED_TRADES_LIST} contractors.`,
            },
          ].map((item, i) => (
            <Reveal key={item.title} delay={i * 0.1} className="flex flex-col items-center text-center gap-2 py-gutter px-4">
              <span className="material-symbols-outlined text-primary text-[28px]">{item.icon}</span>
              <h3 className="text-title-lg text-primary">{item.title}</h3>
              <p className="text-body-sm text-on-surface-variant">{item.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section
        id="how"
        className="bg-primary text-on-primary -mx-margin-mobile md:-mx-margin-desktop px-margin-mobile md:px-margin-desktop py-section-gap flex flex-col gap-gutter"
      >
        <div className="flex flex-col gap-2 max-w-2xl">
          <h2 className="text-headline-lg text-on-primary">
            Three steps. You&apos;re never the one filling out the form.
          </h2>
        </div>
        {/* A vertical stepped list, not another 3-column grid -- a design
            review flagged this section landing immediately after the
            "Plain-language process / You focus on the job / Built for small
            trades" trio above with the identical 3-equal-column rhythm,
            reading as the same layout twice in a row. Each badge now also
            uses its own step.badge token (primary-fixed / secondary-container
            / tertiary-fixed) instead of every badge hardcoding bg-tertiary --
            that per-step color distinction was already defined in
            HOW_IT_WORKS but never actually wired into the render before. */}
        <div className="flex flex-col gap-8 max-w-2xl">
          {HOW_IT_WORKS.map((step, i) => (
            <Reveal key={step.title} variant="scale" delay={i * 0.12} className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center font-code text-body-md shrink-0 ${step.badge}`}>
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="flex flex-col gap-1 pt-2">
                <h3 className="text-headline-md text-on-primary">{step.title.replace(/^\d+\.\s*/, "")}</h3>
                <p className="text-body-sm text-on-primary/70">{step.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <p className="text-body-sm text-on-primary/70 flex items-center gap-2">
          <span className="material-symbols-outlined text-on-primary text-[18px] shrink-0">verified_user</span>
          We never submit on your behalf. You stay in control of your own agency portal account.
        </p>
      </section>

      {/* ---------- Trades ---------- */}
      <section className="bg-surface-container-low border-y border-outline-variant -mx-margin-mobile md:-mx-margin-desktop px-margin-mobile md:px-margin-desktop py-section-gap flex flex-col gap-gutter">
        <div className="flex flex-col gap-2 max-w-2xl">
          <h2 className="text-headline-lg text-primary">Trades we work with</h2>
          <p className="text-body-md text-on-surface-variant">
            We're set up for the kind of bids small trade businesses actually deal with.
          </p>
        </div>
        {/* Manifest-style rows, not a card grid -- a fixed label column
            (icon + trade name) alongside a description column, divided by
            hairlines only. No per-item border/background/radius: reads as
            one continuous index rather than a shelf of same-size boxes. */}
        {/* The section's signature moment: rows reveal top to bottom in
            reading order (a fixed per-row delay, not a synchronized group
            fade) -- reads like a manifest being read down the list, distinct
            from the grouped reveals used elsewhere on the page. */}
        <ul className="flex flex-col divide-y divide-outline-variant">
          {TRADES.map((trade, i) => (
            <Reveal
              key={trade.title}
              as="li"
              delay={i * 0.08}
              className="flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-8 py-6 first:pt-0 last:pb-0"
            >
              <div className="flex items-center gap-3 sm:w-64 shrink-0">
                <span className="material-symbols-outlined text-primary text-[22px]">{trade.icon}</span>
                <h4 className="text-title-lg text-primary uppercase tracking-wide">{trade.title}</h4>
              </div>
              <p className="text-body-sm text-on-surface-variant sm:flex-1">{trade.body}</p>
            </Reveal>
          ))}
        </ul>
        {/* The intake flow already accepts any trade and gives an honest
            heads-up (not a rejection) when it's outside the trades above with
            deep compliance-matrix coverage — see lib/compliance/known-trades.ts.
            This copy makes that explicit instead of implying a harder gate
            than the product actually has. Points at the intake CTA, not a
            contact form, since a reply-and-wait step is the wrong thing to
            introduce at the exact moment someone's deciding whether to try
            First Coast Bids — the product already answers the question for free. */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 max-w-2xl">
          <p className="text-body-sm text-on-surface-variant">
            We&apos;re deepest in these five, but if you&apos;re in a related trade, go
            ahead and{" "}
            <Link href="/intake" className="text-primary font-bold hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-sm">
              start your bid
            </Link>
            . You&apos;ll get an honest heads-up right away if something&apos;s outside our
            sweet spot (a trade outside these five gets less tailored compliance
            guidance, but we&apos;ll tell you that up front, not after you&apos;ve paid).
            Prefer to ask first?{" "}
            <Link href="/contact" className="text-primary font-bold hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-sm">
              Contact us
            </Link>
            .
          </p>
        </div>
      </section>

      {/* ---------- Pricing (rate sheet, not a card grid) ---------- */}
      <section id="pricing" className="flex flex-col gap-gutter">
        <div className="flex flex-col gap-2 max-w-2xl">
          <h2 className="text-headline-lg text-primary">No subscriptions. We invoice after the work&apos;s done.</h2>
          <p className="text-body-md text-on-surface-variant">
            Every deliverable is free to preview before anything&apos;s due: real
            excerpts from your actual bid, not a mockup. Starting prices below;
            we confirm the exact number with you directly before any work starts.
          </p>
        </div>
        {/* One bordered ledger, not three floating cards: tiers are columns
            of a single rate sheet separated by hairlines, the popular tier
            marked by a tint fill rather than its own shadow/ring. Revealed
            as one synchronized unit (unlike the Trades list's row-by-row
            reveal) so the three tiers stay comparable at a glance instead
            of arriving staggered. */}
        <Reveal className="rounded-xl border border-outline-variant overflow-hidden grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-outline-variant">
          {PRICING_PREVIEW.map((tier) => (
            <div
              key={tier.name}
              className={`p-space-base flex flex-col gap-space-md ${tier.highlight ? "bg-primary-container/10" : ""}`}
            >
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-headline-md text-primary">{tier.name}</h3>
                  {tier.badgeLabel && (
                    <span className="px-2 py-0.5 rounded bg-primary-container text-on-primary-container text-label-sm font-bold uppercase tracking-wider">
                      {tier.badgeLabel}
                    </span>
                  )}
                </div>
                <p className="text-body-md text-on-surface-variant mt-1">{tier.tagline}</p>
                <p className="text-body-md font-bold text-primary mt-1">{tier.priceLine}</p>
              </div>
              <ul className="flex flex-col gap-2 flex-grow">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-body-sm text-on-surface">
                    <span className="material-symbols-outlined text-secondary text-[18px] shrink-0">check_circle</span>
                    {f}
                  </li>
                ))}
              </ul>
              <p className="text-label-sm font-code text-on-surface-variant uppercase tracking-wide">{tier.terms}</p>
              <Link
                href={tier.cta.href}
                className="mt-auto px-4 py-2.5 bg-primary-container hover:bg-primary hover:-translate-y-0.5 text-on-primary-container rounded-lg text-label-md font-bold text-center transition active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {tier.cta.label}
              </Link>
            </div>
          ))}
        </Reveal>
        <Link href="/pricing" className="text-primary font-bold hover:underline self-start focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-sm">
          See full pricing →
        </Link>
      </section>

      {/* ---------- FAQ preview ---------- */}
      {/* Four questions shown in full, not an accordion -- a design review
          flagged the click-to-expand pattern as the generic template
          treatment when there's this little to hide. The real /faq page
          (dozens of questions across categories) keeps FaqAccordion, where
          progressive disclosure actually earns its place. */}
      <section id="faq" className="flex flex-col gap-gutter max-w-2xl mx-auto w-full">
        <div className="flex flex-col gap-2 text-center">
          <h2 className="text-headline-lg text-primary">Questions contractors actually ask</h2>
        </div>
        <div className="flex flex-col divide-y divide-outline-variant border-y border-outline-variant">
          {FAQ_PREVIEW.map((item, i) => (
            <Reveal key={item.q} delay={i * 0.08} className="flex flex-col gap-1.5 py-5">
              <h3 className="text-title-lg text-primary">{item.q}</h3>
              <p className="text-body-md text-on-surface-variant">{item.a}</p>
            </Reveal>
          ))}
        </div>
        <Link href="/faq" className="text-primary font-bold hover:underline text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-sm">
          Read the full FAQ →
        </Link>
      </section>

      <section className="bg-primary-container text-on-primary-container rounded-xl px-margin-mobile md:px-margin-desktop py-section-gap flex flex-col items-center text-center gap-6">
        <h2 className="text-headline-lg text-on-primary-container max-w-2xl">
          Ready to send in a strong bid?
        </h2>
        <p className="text-body-md text-on-primary-container/80 max-w-xl">
          Tell us about your bid. It only takes a few minutes.
        </p>
        <Link
          href="/intake"
          className="px-8 py-4 bg-surface text-primary rounded text-label-md hover:opacity-90 hover:-translate-y-0.5 transition active:scale-[0.97] flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-surface"
        >
          <span className="material-symbols-outlined text-[18px]">assignment</span>
          Get started
        </Link>
      </section>
    </>
  );
}
