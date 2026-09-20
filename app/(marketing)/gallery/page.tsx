import type { Metadata } from "next";
import Image from "next/image";
import { assertNoMissingTradeCards } from "@/lib/compliance/known-trades";
import { Reveal } from "@/components/ui/Reveal";

export const metadata: Metadata = {
  title: "Gallery",
  description: "Example deliverables: synthetic samples showing the kind of write-ups we prepare for HVAC, janitorial, landscaping, and IT/computer support bids.",
};

// Clearly-labeled synthetic examples only — never a real client's data.
// Real photos now (public/gallery/*.jpg), not the earlier icon-block
// placeholder -- sourced 2026-09-16 via the real Pexels API (a key was
// already provisioned in .env.local for exactly this) and downloaded
// once as static assets rather than hotlinked live. That's the actual
// fix for this file's older "hotlinked stock-photo placeholders don't
// belong in a real app" concern -- the problem was never photos
// themselves, it was a live runtime dependency on someone else's CDN
// uptime/rate limits. A self-hosted file has none of that. Every photo
// is a genuine hands-on work shot (real tools, real close-up action),
// deliberately not posed corporate stock (handshakes, forced smiles,
// looking-at-camera) -- see each image's alt text for the actual scene.
const EXAMPLES = [
  {
    id: "hvac",
    trade: "HVAC",
    image: "/gallery/hvac.jpg",
    imageAlt: "An HVAC technician using a manifold gauge to service a rooftop air conditioning unit",
    title: "Systems & Installation",
    excerpt:
      "Sample Co. HVAC has completed 40+ commercial installation and retrofit jobs across three states, with a 98% on-time completion rate and NATE-certified technicians on every crew.",
  },
  {
    id: "janitorial",
    trade: "Janitorial",
    image: "/gallery/janitorial.jpg",
    imageAlt: "A cleaner wiping down a glass surface with a spray bottle and cloth",
    title: "Commercial Cleaning",
    excerpt:
      "Sample Clean Services holds current bonding and insurance for facilities up to 500,000 sq ft, and has maintained continuous janitorial contracts with two school districts since 2019.",
  },
  {
    id: "landscaping",
    trade: "Landscaping",
    image: "/gallery/landscaping.jpg",
    imageAlt: "A landscaper mowing a lawn with a push mower in late-afternoon sun",
    title: "Grounds Maintenance",
    excerpt:
      "Sample Grounds Co. maintains 30+ acres of public parkland year-round, with a dedicated irrigation-repair crew and same-week response for storm cleanup.",
  },
  {
    id: "it-computer-support",
    trade: "IT / Computer Support",
    image: "/gallery/it-computer-support.jpg",
    imageAlt: "An IT technician securing network cables in a server rack",
    title: "Help Desk & Network Support",
    excerpt:
      "Sample IT Solutions has staffed help desk and network operations for two municipal agencies since 2021, holding a 24-hour response guarantee and CompTIA-certified technicians on every ticket.",
  },
  {
    id: "electrical",
    trade: "Electrical",
    image: "/gallery/electrical.jpg",
    imageAlt: "An electrician working inside an open circuit breaker panel",
    title: "Panel & Lighting Upgrades",
    excerpt:
      "Sample Electric Co. has completed 25+ municipal panel and lighting retrofit projects, with licensed electricians and current NFPA 70E arc-flash training on every crew.",
  },
];

// Each id above must match a KNOWN_TRADES id — this section needs a real
// authored photo + description per trade, so it can't be generated from
// known-trades.ts directly. Instead this fails loudly the moment a new
// trade ships there without a matching card, same check the homepage's
// "Trades we work with" grid uses (see app/page.tsx) — this is exactly
// how this page fell out of sync the first time: that check only ever
// covered the homepage's own card list, not this separate one.
assertNoMissingTradeCards(
  EXAMPLES.map((e) => e.id),
  '"Example deliverables" gallery (app/gallery/page.tsx)'
);

function DeliverableCard({ ex, delay, className = "" }: { ex: (typeof EXAMPLES)[number]; delay: number; className?: string }) {
  return (
    // No hover-lift/shadow/border-highlight here on purpose -- this card
    // has no click destination (no full-sample content exists per trade,
    // just this excerpt), so styling it like an interactive element would
    // promise a click that goes nowhere. Found as a real reported bug
    // (2026-09-19): the card's hover affordance was the exact same pattern
    // used for genuinely clickable elements elsewhere on the site, so it
    // read as "click me" despite having no href or onClick anywhere.
    <Reveal
      delay={delay}
      className={`bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden flex flex-col ${className}`}
    >
      <div className="relative h-40 w-full">
        <Image src={ex.image} alt={ex.imageAlt} fill sizes="(min-width: 1024px) 300px, 100vw" className="object-cover" />
      </div>
      <div className="p-gutter flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-label-md text-on-surface-variant uppercase tracking-wider">{ex.trade}</h2>
          <span className="text-[10px] px-2 py-0.5 rounded border border-outline-variant bg-surface-container-low text-on-surface-variant font-bold uppercase">
            Sample
          </span>
        </div>
        <h3 className="text-headline-md text-primary">{ex.title}</h3>
        <p className="text-body-sm text-on-surface-variant">{ex.excerpt}</p>
      </div>
    </Reveal>
  );
}

export default function GalleryPage() {
  const topRow = EXAMPLES.slice(0, 3);
  const bottomRow = EXAMPLES.slice(3);

  return (
    <>
      <section className="text-center flex flex-col gap-2">
        <Reveal mode="mount">
          <h1 className="text-headline-lg text-primary">Example deliverables</h1>
        </Reveal>
        <Reveal mode="mount" delay={0.08}>
          <p className="text-body-md text-on-surface-variant max-w-lg mx-auto">
            Illustrative samples only. Synthetic company names and figures, not a real
            client's work.
          </p>
        </Reveal>
      </section>

      {/* Below lg there isn't room for 3 fixed-width cards per row without
          an awkward wrap, so this falls back to the plain responsive grid
          every other listing on the site already uses. */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-gutter lg:hidden">
        {EXAMPLES.map((ex, i) => (
          <DeliverableCard key={ex.trade} ex={ex} delay={i * 0.08} />
        ))}
      </section>

      {/* lg+: staged like bowling pins -- 3 on top, 2 on bottom. Both rows
          use the same fixed card width and are independently centered, so
          the bottom row naturally nests under the top row's gaps with no
          manual offset math. */}
      <section className="hidden lg:flex lg:flex-col lg:gap-gutter">
        <div className="flex justify-center gap-gutter">
          {topRow.map((ex, i) => (
            <DeliverableCard key={ex.trade} ex={ex} delay={i * 0.08} className="w-[300px]" />
          ))}
        </div>
        <div className="flex justify-center gap-gutter">
          {bottomRow.map((ex, i) => (
            <DeliverableCard key={ex.trade} ex={ex} delay={(i + 3) * 0.08} className="w-[300px]" />
          ))}
        </div>
      </section>
    </>
  );
}
