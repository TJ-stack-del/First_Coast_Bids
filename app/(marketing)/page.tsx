import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { assertNoMissingTradeCards } from "@/lib/compliance/known-trades";
import Image from "next/image";
import { BidRead } from "@/components/marketing/BidRead";
import st from "@/components/marketing/story.module.css";
import { sourceSerif, publicSans } from "@/components/marketing/story-fonts";
import { ProductScreen } from "@/components/marketing/ProductScreen";
import { BidJourney } from "@/components/marketing/BidJourney";
import { pilotFaqPhrase, pilotPriceLine } from "@/lib/pilot-offer";

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

const TRADES = [
  {
    id: "hvac",
    photo: "/gallery/hvac.jpg",
    alt: "A technician with gauges connected to a rooftop air-conditioning unit",
    icon: "hvac",
    title: "HVAC",
    body: "Installation, maintenance, and repair contracts for public buildings.",
  },
  {
    id: "janitorial",
    photo: "/gallery/janitorial.jpg",
    alt: "A cleaner spraying and wiping a large shop window",
    icon: "cleaning_services",
    title: "Janitorial",
    body: "Cleaning and facility-upkeep contracts for schools, offices, and public spaces.",
  },
  {
    id: "landscaping",
    photo: "/gallery/landscaping.jpg",
    alt: "A mower cutting a lawn in low evening sun",
    icon: "yard",
    title: "Landscaping",
    body: "Grounds maintenance and lawn care contracts for cities, parks, and school districts.",
  },
  {
    id: "it-computer-support",
    photo: "/gallery/it-computer-support.jpg",
    alt: "A technician running network cable in a server rack",
    icon: "computer",
    title: "IT / Computer Support",
    body: "Help desk, network support, and technical-service contracts for schools, agencies, and public offices.",
  },
  {
    id: "electrical",
    photo: "/gallery/electrical.jpg",
    alt: "A screwdriver at the breakers of an open electrical panel",
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
// Now read from lib/pilot-offer.ts, shared with the pricing page and the
// guide (2026-09-26).
const PILOT_PRICE_LINE = pilotPriceLine();

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
    features: ["We send you bids that fit your trade", "One person who knows your file"],
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
    a: "No one can guarantee an award. What we promise is a careful, complete package, checked line by line against the RFP's own requirements, with anything we couldn't confirm marked for you to fill in.",
  },
  {
    q: "Why do I submit the bid myself instead of First Coast Bids submitting it?",
    a: "You hold the reins. Government procurement portals tie submissions to your own company's registered vendor credentials, so you're the one who uploads and hits submit. We prepare the package, you stay in control of your own account.",
  },
  {
    q: "How does pricing work?",
    a: `One-off starts at $399, Retainer starts at $649/mo, and ${pilotFaqPhrase()}. See the Pricing page for the full breakdown. We confirm the exact number with you directly before any work starts. No card is required to get started, and every deliverable is free to preview before anything's due.`,
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

// A bid's loose ends, handled in the order a bid brings them. Each `was` is a
// worry the opening's moving picture (BidJourney) shows on the RFP.
const HANDLED = [
  {
    when: "The day it arrives",
    was: "Page 47 of 112…",
    title: "Every page, read for you",
    body: "Send the bid file, addenda and all. We read every page, so you don't lose an evening to page 47.",
  },
  {
    when: "The same day",
    was: "Site visit, Nov 4, 9:00 a.m.",
    title: "The dates you can't miss, pulled out",
    body: "Site visits, the questions deadline and the due date, each with the page it came from. No surprises the week of.",
  },
  {
    when: "Day 1",
    was: "Sworn statement unsigned",
    title: "Forms filled in, ready to sign",
    body: "The agency's forms and sworn statements, filled in from your company file. You read them and sign.",
  },
  {
    when: "Day 1",
    was: "Addendum 2 not acknowledged",
    title: "Every addendum acknowledged",
    body: "Each addendum checked for what it changes, and acknowledged the way the bid asks.",
  },
  {
    when: "Day 1",
    was: "Bid bond 5%: need a surety",
    title: "What only you can do, on day one",
    body: "Bonds, insurance certificates, licenses, a site visit: listed for you up front, not the night before it's due.",
  },
  {
    when: "Day 2",
    was: "Capability statement?",
    title: "Your package, ready to preview",
    body: "Capability statement, compliance matrix and technical narrative, checked against the agency's rules. Preview real pages before anything's due.",
  },
  {
    when: "Before the deadline",
    was: "Due Nov 18, 2:00 p.m.",
    title: "You hit submit",
    body: "You send it in through your own agency portal account. We never ask for your login and never submit for you.",
  },
];

// 2026-10-30 (round 7): the homepage as one story, after counterlineops.com's
// flow -- the story in one moving picture (RFP in, "in the running" out), the product
// (your whole bid on one screen), the payoff (the same loose ends handled in
// order), then every price, the questions and one next step. Replaces the
// round 5/6 section-by-section layout. No reviews, ratings or counts
// (PRODUCT.md); every sample is labelled as one.
function Home() {
  return (
    <div className={`${st.page} ${sourceSerif.variable} ${publicSans.variable}`}>
      {/* ---------- 1. The story in one picture: RFP in, in the running out ---------- */}
      <section className={`${st.hero} ${st.bleed}`}>
        <div className={`${st.inner} ${st.heroGrid}`}>
          <div className={st.heroText}>
            <p className={st.heroKicker}>For small trade businesses · Northeast Florida</p>
            <h1 className={`${st.serif} ${st.heroTitle}`}>Government bids, without the paperwork pile.</h1>
            <p className={st.heroLede}>
              Send us the RFP. We read every page, write the package, and tell you the few things only you can do.
              You sign it, send it in, and your bid gets scored on your price and your work.
            </p>
            <div className={st.ctas}>
              <a href="#read" className={`${st.btn} ${st.btnLight}`}>
                Read my bid free
              </a>
              <Link href="/intake?package=pilot" className={`${st.btn} ${st.btnGhost}`}>
                Start a pilot bid
              </Link>
            </div>
          </div>
          <BidJourney />
        </div>
      </section>

      {/* ---------- 2. The product ---------- */}
      <section className={`${st.screenSec} ${st.bleed}`}>
        <div className={st.inner}>
          <div className={st.screenHead}>
            <div>
              <p className={st.eyebrow}>One bid, one screen</p>
              <h2 className={`${st.serif} ${st.h2}`}>Your whole bid, on one screen.</h2>
            </div>
            <p className={st.lede}>
              When it&apos;s due, what we&apos;re handling, the few things only you can do, and how far along your
              package is. Every line points to its page in the bid.
            </p>
          </div>
          <ProductScreen />
          <p className={st.screenNote}>A sample with made-up details. Yours shows your real bid.</p>
        </div>
      </section>

      {/* ---------- 3. The payoff: the same loose ends, handled ---------- */}
      <section id="how" className={`${st.handled} ${st.bleed}`}>
        <div className={`${st.inner} ${st.handledGrid}`}>
          <div className={st.sticky}>
            <p className={st.eyebrow}>How it works</p>
            <h2 className={`${st.serif} ${st.h2}`}>Every loose end, handled.</h2>
            <p className={st.lede} style={{ marginTop: 20 }}>
              The worries a bid brings, in the order it brings them. We aim to have your package
              ready within 48 hours of getting the file.
            </p>
            <div className={st.ctas} style={{ marginTop: 28 }}>
              <Link href="/intake?package=pilot" className={`${st.btn} ${st.btnNavy}`}>
                Start a pilot bid
              </Link>
            </div>
          </div>
          <div>
            <ol className={st.timeline}>
              {HANDLED.map((step) => (
                <li key={step.title}>
                  <span className={st.when}>{step.when}</span>
                  <div>
                    <span className={st.was}>{step.was}</span>
                  </div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </li>
              ))}
            </ol>
            <div id="read" className={st.tryIt} style={{ scrollMarginTop: 88 }}>
              <p className={st.eyebrow}>Try it on your own bid</p>
              <div className={`${st.tool} ${st.tool}`}>
                <BidRead
                  look={{ drop: st.toolDrop, title: st.toolTitle, cap: st.toolCap, primary: st.toolPrimary, quiet: st.toolQuiet }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- 4. Every price ---------- */}
      <section id="pricing" className={`${st.prices} ${st.bleed}`}>
        <div className={st.inner}>
          <p className={st.eyebrow}>Prices</p>
          <h2 className={`${st.serif} ${st.h2}`}>Start with one bid, on us.</h2>
          <p className={st.lede} style={{ marginTop: 18 }}>
            Every starting price is on this page. We confirm yours before any work begins, and nothing gets added
            without your say-so.
          </p>
          <div className={st.priceGrid}>
            {PRICING_PREVIEW.map((tier) => (
              <article key={tier.name} className={`${st.plan} ${tier.highlight ? st.planHot : ""}`}>
                {tier.badgeLabel && <span className={st.planTag}>{tier.badgeLabel}</span>}
                <h3>{tier.name}</h3>
                <div className={st.planPrice}>
                  {tier.priceLine.replace(/^Starting at /, "")}
                  <small>{tier.priceLine.startsWith("Starting at") ? `Starting price · ${tier.terms}` : tier.terms}</small>
                </div>
                <ul>
                  {tier.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                <Link href={tier.cta.href} className={`${st.btn} ${tier.highlight ? st.btnLight : st.btnLine}`}>
                  {tier.cta.label}
                </Link>
              </article>
            ))}
          </div>
          <p className={st.guarantee}>
            No card to start. We never promise a win; we promise a complete package, checked line by line against
            what the agency asked for. <Link href="/pricing" className={st.link}>Full pricing</Link>
          </p>
        </div>
      </section>

      {/* ---------- 5. Questions ---------- */}
      <section id="faq" className={`${st.qs} ${st.bleed}`}>
        {/* FAQPage structured data for search and answer engines: the exact
            questions and answers rendered below, nothing added. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: FAQ_PREVIEW.map((item) => ({
                "@type": "Question",
                name: item.q,
                acceptedAnswer: { "@type": "Answer", text: item.a },
              })),
            }).replace(/</g, "\\u003c"),
          }}
        />
        <div className={`${st.inner} ${st.qsGrid}`}>
          <div>
            <h2 className={`${st.serif} ${st.h2}`}>Before you send a bid.</h2>
            <p className={st.lede} style={{ marginTop: 18 }}>
              Anything else? <Link href="/faq" className={st.link}>Read the full FAQ</Link> or{" "}
              <Link href="/contact" className={st.link}>ask us</Link>.
            </p>
          </div>
          <div className={st.faq}>
            {FAQ_PREVIEW.map((item) => (
              <details key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- 6. One next step ---------- */}
      <section className={`${st.close} ${st.bleed}`} aria-labelledby="final-cta">
        <div className={`${st.inner} ${st.closeGrid}`}>
          <div>
            <h2 id="final-cta" className={`${st.serif} ${st.h2}`}>
              Got a bid on your desk?
            </h2>
            <p className={st.lede}>
              Send it over. You&apos;ll know the price before any work starts, and what only you need to do by the end
              of the day.
            </p>
            <div className={st.ctas}>
              <Link href="/intake?package=pilot" className={`${st.btn} ${st.btnLight}`}>
                Start a pilot bid
              </Link>
              <a href="#read" className={`${st.btn} ${st.btnGhost}`}>
                Read my bid first
              </a>
            </div>
            <p className={st.closeFine}>
              No card required. New to government bids? <Link href="/guide">Start here</Link>.
            </p>
          </div>
          <div className={st.closePhoto}>
            <Image
              src="/gallery/it-computer-support.jpg"
              alt="A technician running network cable in a server rack"
              fill
              sizes="(min-width: 1024px) 480px, 100vw"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
