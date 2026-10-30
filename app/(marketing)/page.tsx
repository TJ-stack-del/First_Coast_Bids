import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { assertNoMissingTradeCards } from "@/lib/compliance/known-trades";
import Image from "next/image";
import { BidRead } from "@/components/marketing/BidRead";
import f from "@/components/marketing/field.module.css";
import { interTight } from "@/components/marketing/field-font";
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

// Four things every bid gets (after the Voltix shot's "Four things every
// job gets, no exceptions"): each one a real, checkable rule of the service.
const FOUR = [
  {
    title: "A page and a quote for every rule",
    body: "Every requirement in your compliance matrix shows the page it's on and the bid's own words. Check any line in seconds.",
  },
  {
    title: "Blanks stay blank",
    body: "If you haven't told us a fact, it stays a bracketed blank. Nothing gets guessed, and the package can't be downloaded until every blank is filled.",
  },
  {
    title: "The price agreed before the work",
    body: "We confirm the exact price with you before we start. No card to get going, and every document is free to preview first.",
  },
  {
    title: "You hit submit",
    body: "You send it in through your own agency portal account. We never ask for your login and never submit on your behalf.",
  },
];

const WE_DO = [
  "Read every page of the bid, addenda included",
  "Write your capability statement, compliance matrix and technical narrative",
  "Fill in the agency's forms for you to sign",
  "Track the deadline and check wage rules and set-asides",
];

const YOU_DO = [
  "Send us the bid file",
  "Send proof only you have: insurance certificates, licenses",
  "Show up to any mandatory site visit",
  "Review, sign and send it in yourself",
];

const DOCS = [
  {
    title: "Capability statement",
    body: "One page on your company, your crew and your past work, written for this agency.",
    src: "/sample-packet/capability-statement.webp",
  },
  {
    title: "Compliance matrix",
    body: "Every requirement in the bid, the page it's on, and how you meet it, line by line.",
    src: "/sample-packet/compliance-matrix.webp",
  },
  {
    title: "Technical narrative",
    body: "How you'll do the work: staffing, schedule, quality checks, in plain words the evaluators score.",
    src: "/sample-packet/technical-narrative.webp",
  },
];

// 2026-10-30 (round 6): the combined look. Light, photo-framed opening and
// "four things, no exceptions" after the Voltix electrical-contractor shot;
// one person, not a call centre, after the local roofer; the typed fact
// strip after the industrial-construction shot; the we / you split from
// services sold to tradespeople, so the site reads as a paperwork service
// for contractors rather than a contractor. Kept from round 5: the bid
// read as the working tool, trade photos, the dark price card, questions.
// Every figure on the page is true today; no reviews, ratings or counts
// (PRODUCT.md).
function Home() {
  return (
    <div className={`${f.page} ${interTight.variable}`}>
      {/* ---------- Opening ---------- */}
      <section className={`${f.open} ${f.bleed}`}>
        <div className={`${f.inner} ${f.openGrid}`}>
          <div className={f.openText}>
            <p className={f.kicker} style={{ margin: 0 }}>
              For small trade businesses · Northeast Florida
            </p>
            <h1 className={f.display}>
              Bid paperwork, done right. <span className={f.navyText}>You stay in charge.</span>
            </h1>
            <p className={f.lede}>
              Send us a government bid. We write the capability statement, compliance matrix and technical narrative.
              You check it, sign it and send it in yourself.
            </p>
            <div className={f.heroCtas}>
              <a href="#read" className={`${f.btn} ${f.btnNavy} ${f.arrow}`}>
                Read my bid free
              </a>
              <Link href="/intake?package=pilot" className={`${f.btn} ${f.btnLine}`}>
                Start a pilot bid
              </Link>
            </div>
            <p className={f.human}>One person reads your bid and writes your package. No call center, no hand-offs.</p>
          </div>
          <div className={f.frame}>
            <Image
              src="/gallery/hvac.jpg"
              alt="A technician with gauges connected to a rooftop air-conditioning unit"
              fill
              priority
              sizes="(min-width: 1024px) 560px, 100vw"
            />
            <div className={`${f.chip} ${f.chipNavy}`}>
              <strong>No card to start</strong>
              Price agreed with you before any work begins.
            </div>
            <div className={`${f.chip} ${f.chipQuote}`}>
              <strong>Every rule cites its page</strong>
              <span className={f.mono}>p. 14</span> · <q>Contractor shall maintain general liability of not less than $2,000,000.</q>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Typed facts: true today, nothing counted that isn't real ---------- */}
      <section className={`${f.strip} ${f.bleed}`} aria-label="The service in four numbers">
        <div className={`${f.inner} ${f.stripGrid}`}>
          <div>
            <b className={f.mono}>48 hrs</b>
            <span>Our aim, bid file to draft</span>
          </div>
          <div>
            <b className={f.mono}>3 docs</b>
            <span>One package, your signature</span>
          </div>
          <div>
            <b className={f.mono}>0</b>
            <span>Made-up facts. Blanks stay blank</span>
          </div>
          <div>
            <b className={f.mono}>1 person</b>
            <span>On your file, start to finish</span>
          </div>
        </div>
      </section>

      {/* ---------- We / you ---------- */}
      <section className={`${f.section} ${f.sectionWhite} ${f.bleed}`}>
        <div className={f.inner}>
          <div className={`${f.head} ${f.headRow}`}>
            <h2 className={f.h2}>We do the paperwork. You do the work.</h2>
            <p className={f.lede}>
              We&apos;re not contractors and we don&apos;t bid against you. We prepare the paperwork that wins or loses
              a bid before anyone looks at your price.
            </p>
          </div>
          <div className={f.duo}>
            <div className={`${f.side} ${f.sideWe}`}>
              <span className={f.whoLabel}>What we do</span>
              <h3>The reading and the writing.</h3>
              <ul>
                {WE_DO.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className={`${f.side} ${f.sideYou}`}>
              <span className={f.whoLabel}>What only you can do</span>
              <h3>The proof and the signature.</h3>
              <ul>
                {YOU_DO.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
          <p className={f.duoNote}>We never submit for you and never ask for your portal login.</p>
        </div>
      </section>

      {/* ---------- The bid read: the page's working tool ---------- */}
      <section id="read" className={`${f.section} ${f.bleed}`} style={{ scrollMarginTop: 72 }}>
        <div className={`${f.inner} ${f.split}`}>
          <div className={f.stick}>
            <p className={f.kicker}>Try it on your bid</p>
            <h2 className={f.h2}>See what the bid is asking for.</h2>
            <ol className={f.steps}>
              <li>
                <b>1</b>
                <div>
                  Drop in the bid file
                  <span>PDF, Word or text. It&apos;s read on your computer and never uploaded.</span>
                </div>
              </li>
              <li>
                <b>2</b>
                <div>
                  Get the list in seconds
                  <span>Deadline, site visits, bonds, forms, insurance, each with its page.</span>
                </div>
              </li>
              <li>
                <b>3</b>
                <div>
                  Hand it to us, or keep the list
                  <span>Start a bid with it, or download it as a draft compliance matrix.</span>
                </div>
              </li>
            </ol>
          </div>
          <div className={`${f.tool} ${f.tool}`}>
            <BidRead look={{ drop: f.toolDrop, title: f.toolTitle, cap: f.toolCap, primary: f.toolPrimary, quiet: f.toolQuiet }} />
          </div>
        </div>
      </section>

      {/* ---------- Four things, no exceptions ---------- */}
      <section className={`${f.section} ${f.sectionWhite} ${f.bleed}`}>
        <div className={f.inner}>
          <div className={`${f.head} ${f.headRow}`}>
            <h2 className={f.h2}>Four things every bid gets. No exceptions.</h2>
            <p className={f.lede}>Whatever the trade, whatever the agency, this is what you can hold us to.</p>
          </div>
          <div className={f.four}>
            <div className={f.fourPhoto}>
              <Image src="/gallery/landscaping.jpg" alt="A mower cutting a lawn in low evening sun" fill sizes="(min-width: 1024px) 520px, 100vw" />
            </div>
            <div className={f.fourGrid}>
              {FOUR.map((thing, i) => (
                <article key={thing.title} className={f.thing}>
                  <span className={f.mono}>{String(i + 1).padStart(2, "0")}</span>
                  <h3>{thing.title}</h3>
                  <p>{thing.body}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Trades ---------- */}
      <section id="trades" className={`${f.section} ${f.bleed}`}>
        <div className={f.inner}>
          <div className={`${f.head} ${f.headRow}`}>
            <h2 className={f.h2}>The trades we know inside out.</h2>
            <p className={f.lede}>
              Five trades, and the public contracts small crews in them actually bid on: schools, city buildings,
              parks and offices.
            </p>
          </div>
          <ul className={f.trades} role="list">
            {TRADES.map((trade) => (
              <li key={trade.id} className={f.trade}>
                <Image src={trade.photo} alt={trade.alt} fill sizes="(min-width: 1280px) 250px, (min-width: 768px) 33vw, 100vw" />
                <div className={f.tradeBody}>
                  <h3>{trade.title}</h3>
                  <p>{trade.body}</p>
                </div>
              </li>
            ))}
          </ul>
          {/* A trade outside these five is a heads-up, not a rejection --
              see lib/compliance/known-trades.ts. */}
          <p className={f.tradeNote}>
            In a related trade? <Link href="/intake" className={f.link}>Start a bid anyway</Link>. If it&apos;s outside
            what we know well, you&apos;ll hear that up front, before you&apos;ve paid anything.
          </p>
        </div>
      </section>

      {/* ---------- What you get back ---------- */}
      <section className={`${f.section} ${f.sectionWhite} ${f.bleed}`}>
        <div className={f.inner}>
          <div className={`${f.head} ${f.headRow}`}>
            <h2 className={f.h2}>Three documents, one package, your signature.</h2>
            <p className={f.lede}>
              Bound as one PDF and checked against the agency&apos;s rules. Preview real pages from your own bid before
              anything is due.
            </p>
          </div>
          <div className={f.docs}>
            {DOCS.map((doc, i) => (
              <article key={doc.title} className={f.doc}>
                <div className={f.docShot}>
                  <Image src={doc.src} alt={`A sample ${doc.title.toLowerCase()} page`} fill sizes="(min-width: 1024px) 400px, 100vw" />
                </div>
                <div className={f.docBody}>
                  <span className={`${f.mono} ${f.docLabel}`}>Doc {String(i + 1).padStart(2, "0")}</span>
                  <h3>{doc.title}</h3>
                  <p>{doc.body}</p>
                </div>
              </article>
            ))}
          </div>
          <p className={f.docFoot}>
            Pages shown are from a synthetic sample, not a real client.{" "}
            <Link href="/gallery" className={f.link}>
              See sample write-ups by trade
            </Link>
          </p>
        </div>
      </section>

      {/* ---------- Prices ---------- */}
      <section id="pricing" className={`${f.section} ${f.bleed}`}>
        <div className={f.inner}>
          <div className={`${f.head} ${f.headRow}`}>
            <h2 className={f.h2}>Know the cost before you send a thing.</h2>
            <p className={f.lede}>Starting prices, confirmed with you before any work begins.</p>
          </div>
          <div className={f.prices}>
            {PRICING_PREVIEW.map((tier) => (
              <div key={tier.name} className={f.price}>
                <div className={f.priceName}>
                  {tier.name}
                  {tier.badgeLabel && <span className={f.tag}>{tier.badgeLabel}</span>}
                </div>
                <div className={f.priceWhat}>
                  {tier.tagline} {tier.features.join(". ")}.
                </div>
                <div className={f.priceAmt}>
                  {tier.priceLine.replace(/^Starting at /, "")}
                  <small>{tier.priceLine.startsWith("Starting at") ? `Starting price · ${tier.terms}` : tier.terms}</small>
                </div>
                <Link href={tier.cta.href} className={`${f.btn} ${tier.highlight ? f.btnGold : f.btnLine}`}>
                  {tier.cta.label}
                </Link>
              </div>
            ))}
          </div>
          <p className={f.priceNote}>
            No card required to get started.{" "}
            <Link href="/pricing" className={f.link}>
              See full pricing
            </Link>
          </p>
        </div>
      </section>

      {/* ---------- Questions ---------- */}
      <section id="faq" className={`${f.section} ${f.sectionWhite} ${f.bleed}`}>
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
        <div className={`${f.inner} ${f.split}`}>
          <div className={f.stick}>
            <h2 className={f.h2}>Good to know first.</h2>
            <p className={f.lede} style={{ marginTop: 18 }}>
              The questions contractors ask before they send us a bid.
            </p>
          </div>
          <div>
            <div className={f.faq}>
              {FAQ_PREVIEW.map((item) => (
                <details key={item.q}>
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
            <p className={f.faqMore}>
              <Link href="/faq" className={f.link}>
                Read the full FAQ
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* ---------- Closing: one person, not a call center ---------- */}
      <section className={`${f.closing} ${f.bleed}`} aria-labelledby="final-cta">
        <div className={f.heroPhoto} aria-hidden="true">
          <Image src="/gallery/electrical.jpg" alt="" fill sizes="100vw" />
        </div>
        <div className={`${f.inner}`}>
          <div className={f.person}>
            <p className={f.kicker} style={{ color: "rgb(255 255 255 / 0.7)", margin: 0 }}>
              Northeast Florida
            </p>
            <h2 id="final-cta" className={f.h2}>
              No call center. <span className={f.gold}>No hand-offs.</span>
            </h2>
            <p className={f.lede}>
              The person who reads your bid is the person who writes your package and answers your messages. Send it
              over and you&apos;ll know the price before any work starts.
            </p>
            <div className={f.heroCtas}>
              <Link href="/intake?package=pilot" className={`${f.btn} ${f.btnGold} ${f.arrow}`}>
                Start a pilot bid
              </Link>
              <a href="#read" className={`${f.btn} ${f.btnGhost}`}>
                Read my bid first
              </a>
            </div>
            <p className={f.closingFine}>
              No card required. New to government bids? <Link href="/guide">Start here</Link>.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
