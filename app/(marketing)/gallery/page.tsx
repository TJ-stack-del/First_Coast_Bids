import type { Metadata } from "next";
import Image from "next/image";
import { assertNoMissingTradeCards } from "@/lib/compliance/known-trades";
import s from "@/components/marketing/press.module.css";

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

// 2026-09-23: one ledger of specimen rows (photo, trade, a SAMPLE stamp,
// serif title, excerpt) instead of floating cards, matching the rest of
// the marketing site. Every row stays visibly marked as a synthetic sample
// (PRODUCT.md: never present sample content as a real client's work).
export default function GalleryPage() {
  return (
    <>
      <header className={s.pageHead}>
        <h1 className={s.pageTitle}>Example deliverables</h1>
        <p className={s.lede}>
          Illustrative samples only. Synthetic company names and figures, not a real client&apos;s work.
        </p>
      </header>

      <section>
        <div className={s.ledger}>
          {EXAMPLES.map((ex) => (
            <article key={ex.id} className={s.exampleRow}>
              <div className={s.photo}>
                <Image src={ex.image} alt={ex.imageAlt} fill sizes="(min-width: 720px) 280px, 100vw" className="object-cover" />
              </div>
              <div>
                <div className={s.meta}>
                  <span>{ex.trade}</span>
                  <span className={s.stamp}>Sample</span>
                </div>
                <h2 className={s.rowTitle}>{ex.title}</h2>
                <p className={s.muted}>{ex.excerpt}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
