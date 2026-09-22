import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { KNOWN_TRADES, assertNoMissingTradeCards } from "@/lib/compliance/known-trades";
import { SampleSpecimen } from "@/components/landing/SampleSpecimen";
import s from "@/components/landing/landing.module.css";

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
    who: "You",
    body: "A three-step form: your company info, the agency and job details, and the bid file itself.",
  },
  {
    icon: "fact_check",
    badge: "bg-secondary-container text-on-secondary-container",
    title: "2. We do the work",
    who: "Our team",
    body: "Our team writes the paperwork about your company, checks it against the agency's rules, and writes up the technical part.",
  },
  {
    icon: "task",
    badge: "bg-tertiary-fixed text-on-tertiary-fixed",
    title: "3. You review and send it",
    who: "You",
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
    cta: { label: "Start a pilot bid", href: "/intake?package=pilot" },
    highlight: true,
    badgeLabel: "Start here",
  },
  {
    name: "One-off",
    tagline: "A single bid, fully prepared.",
    priceLine: "Starting at $399",
    terms: "Confirmed with you before work starts",
    features: ["The write-up about your company", "A checklist matching the agency's rules", "The technical write-up"],
    cta: { label: "Start a one-off bid", href: "/intake?package=one_off" },
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
    cta: { label: "Ask about a retainer", href: "/intake?package=retainer" },
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
  {
    q: "What do I need to get started?",
    a: "Just the RFP itself (or a link to it) and basic company info: NAICS codes, small-business status, and set-asides if you have them.",
  },
  {
    q: "Is my data secure?",
    a: "Your submission and files are tied to your account only, and every status change on your bid is recorded in an audit trail.",
  },
];

// 2026-09-22 redesign (Braun structure + Stripe Press warmth), built from the
// approved draft in design-drafts/2026-09-22-landing-directions/ (v0.6). The
// hero stays centred (an explicit earlier call); everything below sits on a
// left-aligned grid of hairline-ruled spec tables. No scroll reveals: the
// only motion is hover color changes and the packet's page edges.
function Home() {
  return (
    <>
      {/* ---------- Hero ---------- */}
      <section className={s.hero}>
        <h1 className={s.h1}>
          You run the crew. <em>We handle the paperwork.</em>
        </h1>
        <p className={s.heroLede}>
          Upload the RFP. We turn complex solicitations into a ready-to-submit capability statement, compliance
          matrix, and technical narrative, so you can review, sign, and send.
        </p>
        <div className={s.ctas}>
          <Link href="/intake" className={`${s.btn} ${s.btnPrimary}`}>
            Get started
          </Link>
          <a href="#how" className={`${s.btn} ${s.btnQuiet}`}>
            See how it works
          </a>
        </div>
        {/* The one proof signal above the fold (landing-page skill): a claim
            the sample sheet below backs up, not an invented stat. */}
        <a href="#sample" className={s.proofline}>
          Every requirement cites its page in the RFP. Anything we don&apos;t know stays a visible blank.{" "}
          <span>See a sample sheet</span>
        </a>
        <ul className={s.trades} aria-label="Trades we work with">
          {TRADES.map((trade) => (
            <li key={trade.id}>{trade.title}</li>
          ))}
        </ul>
      </section>

      {/* ---------- Proof: the sample sheet ---------- */}
      <section id="sample" className={s.block}>
        <div className={s.head}>
          <h2 className={s.h2}>
            Every line traced to the RFP. <em>Nothing made up.</em>
          </h2>
          <p className={s.lede}>
            Here&apos;s part of a compliance matrix, labelled the way you&apos;d label a part. Each numbered point is
            something our team does on every bid.
          </p>
        </div>
        <SampleSpecimen />
      </section>

      {/* ---------- Founding clients ---------- */}
      <section className={s.block}>
        <div className={s.head}>
          <h2 className={s.h2}>
            Now accepting <em>founding clients.</em>
          </h2>
        </div>
        <div className={s.benefits}>
          <article>
            <h3 className={s.serif}>Plain-language process</h3>
            <p className={s.muted}>No confusing paperwork jargon. We explain everything in plain English.</p>
          </article>
          <article>
            <h3 className={s.serif}>You focus on the job</h3>
            <p className={s.muted}>We handle the writing so you can keep running your business.</p>
          </article>
          <article>
            <h3 className={s.serif}>Built for small trades</h3>
            <p className={s.muted}>Not a big consulting firm, made for {SUPPORTED_TRADES_LIST} contractors.</p>
          </article>
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section id="how" className={`${s.block} ${s.how}`}>
        <div className={s.head}>
          <h2 className={s.h2}>
            Three steps. <em>You&apos;re in charge of the last one.</em>
          </h2>
        </div>
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th scope="col">Step</th>
                <th scope="col">Who</th>
                <th scope="col">What happens</th>
              </tr>
            </thead>
            <tbody>
              {HOW_IT_WORKS.map((step) => (
                <tr key={step.title}>
                  <th scope="row" className={`${s.serif} ${s.stepName}`}>
                    {step.title.replace(/^\d+\.\s*/, "")}
                  </th>
                  <td className={s.who}>{step.who}</td>
                  <td>
                    {step.body}
                    {step.who === "Our team" && <span className={`${s.sub} ${s.promise}`}>Most bids ready in 48 hours</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={s.control}>We never submit on your behalf. You stay in control of your own agency portal account.</p>
      </section>

      {/* ---------- Trades ---------- */}
      <section id="trades" className={s.block}>
        <div className={s.head}>
          <h2 className={s.h2}>
            Trades we <em>work with.</em>
          </h2>
          <p className={s.lede}>We&apos;re set up for the kind of bids small trade businesses actually deal with.</p>
        </div>
        <ul className={s.tradelist}>
          {TRADES.map((trade) => (
            <li key={trade.id}>
              <h3 className={s.serif}>{trade.title}</h3>
              <p className={s.muted}>{trade.body}</p>
            </li>
          ))}
        </ul>
        {/* A trade outside these five is a heads-up, not a rejection -- see
            lib/compliance/known-trades.ts. */}
        <p className={s.note}>
          We&apos;re deepest in these five, but if you&apos;re in a related trade, go ahead and{" "}
          <Link href="/intake" className={s.inlineLink}>
            start your bid
          </Link>
          . You&apos;ll get an honest heads-up right away if something&apos;s outside our sweet spot (a trade outside
          these five gets less tailored compliance guidance, but we&apos;ll tell you that up front, not after
          you&apos;ve paid). Prefer to ask first?{" "}
          <Link href="/contact" className={s.inlineLink}>
            Contact us
          </Link>
          .
        </p>
      </section>

      {/* ---------- Pricing: one spec table, Pilot marked by a navy rule ---------- */}
      <section id="pricing" className={s.block}>
        <div className={s.head}>
          <h2 className={s.h2}>
            Plain prices, <em>confirmed with you before work starts.</em>
          </h2>
          <p className={s.lede}>
            Every deliverable is free to preview before anything&apos;s due: real excerpts from your actual bid, not a
            mockup. Starting prices are below.
          </p>
        </div>
        <div className={`${s.tableWrap} ${s.pricingWrap}`}>
          <table className={`${s.table} ${s.pricing}`}>
            <thead>
              <tr>
                <th scope="col">Plan</th>
                {PRICING_PREVIEW.map((tier) => (
                  <th key={tier.name} scope="col" className={tier.highlight ? s.live : ""}>
                    <span className={`${s.serif} ${s.planName}`}>{tier.name}</span>
                    {tier.badgeLabel && <span className={s.planNote}>{tier.badgeLabel}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Price</th>
                {PRICING_PREVIEW.map((tier) => (
                  <td key={tier.name} className={tier.highlight ? s.live : ""}>
                    <PriceLine line={tier.priceLine} />
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">For</th>
                {PRICING_PREVIEW.map((tier) => (
                  <td key={tier.name} className={tier.highlight ? s.live : ""}>
                    {tier.tagline}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">Terms</th>
                {PRICING_PREVIEW.map((tier) => (
                  <td key={tier.name} className={tier.highlight ? s.live : ""}>
                    {tier.terms}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">Included</th>
                {PRICING_PREVIEW.map((tier) => (
                  <td key={tier.name} className={tier.highlight ? s.live : ""}>
                    {tier.features[0]}
                    {tier.features.length > 1 && <span className={s.sub}>{tier.features.slice(1).join(" · ")}</span>}
                  </td>
                ))}
              </tr>
              <tr className={s.ctaRow}>
                <th scope="row">
                  <span className="sr-only">Choose a plan</span>
                </th>
                {PRICING_PREVIEW.map((tier) => (
                  <td key={tier.name} className={tier.highlight ? s.live : ""}>
                    <Link href={tier.cta.href} className={`${s.btn} ${tier.highlight ? s.btnPrimary : s.btnQuiet}`}>
                      {tier.cta.label}
                    </Link>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        {/* Phones: one spec block per plan instead of a sideways-scrolling table. */}
        <div className={s.plansMobile}>
          {PRICING_PREVIEW.map((tier) => (
            <article key={tier.name} className={tier.highlight ? s.liveCard : ""}>
              <span className={`${s.serif} ${s.planName}`}>
                {tier.name}
                {tier.badgeLabel && <span className={s.planNote}>{tier.badgeLabel}</span>}
              </span>
              <dl>
                <dt>Price</dt>
                <dd>
                  <PriceLine line={tier.priceLine} />
                </dd>
                <dt>For</dt>
                <dd>{tier.tagline}</dd>
                <dt>Terms</dt>
                <dd>{tier.terms}</dd>
                <dt>Included</dt>
                <dd>
                  {tier.features[0]}
                  {tier.features.length > 1 && <span className={s.sub}>{tier.features.slice(1).join(" · ")}</span>}
                </dd>
              </dl>
              <Link href={tier.cta.href} className={`${s.btn} ${tier.highlight ? s.btnPrimary : s.btnQuiet}`}>
                {tier.cta.label}
              </Link>
            </article>
          ))}
        </div>
        <p className={s.fineprint}>
          No card required to get started. We never promise a win: our readiness check tells you whether the
          submission is complete and correct, not whether you&apos;ll be awarded the contract.{" "}
          <Link href="/pricing" className={s.inlineLink}>
            See full pricing
          </Link>
        </p>
      </section>

      {/* ---------- FAQ ---------- */}
      <section id="faq" className={s.block}>
        <div className={s.head}>
          <h2 className={s.h2}>
            Questions contractors <em>actually ask.</em>
          </h2>
        </div>
        <dl className={s.faq}>
          {FAQ_PREVIEW.map((item) => (
            <div key={item.q}>
              <dt className={s.serif}>{item.q}</dt>
              <dd>{item.a}</dd>
            </div>
          ))}
        </dl>
        <p className={s.note}>
          <Link href="/faq" className={s.inlineLink}>
            Read the full FAQ
          </Link>
        </p>
      </section>

      {/* ---------- Final call to action ---------- */}
      <section className={`${s.final} -mx-margin-mobile md:-mx-margin-desktop`} aria-labelledby="final-cta">
        <h2 id="final-cta" className={s.h2}>
          Ready to send in a <em>strong bid?</em>
        </h2>
        <p>Tell us about your bid. It only takes a few minutes.</p>
        <Link href="/intake" className={`${s.btn} ${s.finalBtn}`}>
          Get started
        </Link>
        <span className={s.risk}>No card required to get started.</span>
      </section>
    </>
  );
}

// "Starting at $399" / "Starting at $649/mo" / "Free for the first 10 clients"
// rendered as a spec-table price: the figure in navy monospace with its
// qualifier underneath. Pilot's line has no figure, so it reads "On us"
// (the product's own wording -- never a bare "free", PRODUCT.md) above the
// real terms.
function PriceLine({ line }: { line: string }) {
  const m = line.match(/^Starting at (\$[\d,]+)(\/mo)?$/);
  if (m) {
    return (
      <>
        <span className={`${s.price} ${s.mono}`}>
          {m[1]}
          {m[2] && <span className={s.muted} style={{ fontSize: 14 }}>{m[2]}</span>}
        </span>
        <span className={s.sub}>Starting at</span>
      </>
    );
  }
  return (
    <>
      <span className={`${s.price} ${s.priceWord}`}>On us</span>
      <span className={s.sub}>{line}</span>
    </>
  );
}
