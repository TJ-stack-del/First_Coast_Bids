import type { Metadata } from "next";
import Link from "next/link";
import s from "@/components/marketing/press.module.css";
import { pilotFaqPhrase } from "@/lib/pilot-offer";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Answers to common questions about First Coast Bids' done-for-you bid prep service.",
};

const CATEGORIES = [
  {
    name: "About First Coast Bids",
    faqs: [
      {
        q: "What is First Coast Bids?",
        a: "A done-for-you bid prep service. You send us your RFP; our team prepares the capability statement, compliance matrix, and technical narrative for you.",
      },
      {
        q: "Do you guarantee I'll win the bid?",
        a: "No one can guarantee an award. What we guarantee is a complete, compliant submission prepared by people who've done this before.",
      },
      {
        q: "Is my data secure?",
        a: "Your submission and files are tied to your account only, and every status change on your bid is recorded in an audit trail.",
      },
    ],
  },
  {
    name: "Pricing",
    faqs: [
      {
        q: "How does pricing work?",
        a: `One-off starts at $399, Retainer starts at $649/mo, and ${pilotFaqPhrase()}. See the Pricing page for the full breakdown. We confirm the exact number with you directly before any work starts. No card is required to get started.`,
      },
    ],
  },
  {
    name: "Getting started",
    faqs: [
      {
        q: "What do I need to get started?",
        a: "Just the RFP itself (or a link to it) and basic company info: NAICS codes, small-business status, and set-asides if you have them.",
      },
    ],
  },
];

// 2026-09-23: answers shown in full under each category (the landing
// page's hairline Q/A layout) instead of an accordion -- there are only a
// handful of questions, so hiding them behind clicks cost more than it
// saved. FAQPage structured data mirrors the visible text exactly.
export default function FaqPage() {
  const allFaqs = CATEGORIES.flatMap((cat) => cat.faqs);
  return (
    <>
      <header className={s.pageHead}>
        <h1 className={s.pageTitle}>Frequently asked questions</h1>
        <p className={s.lede}>Straight answers about how First Coast Bids works.</p>
      </header>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: allFaqs.map((item) => ({
              "@type": "Question",
              name: item.q,
              acceptedAnswer: { "@type": "Answer", text: item.a },
            })),
          }).replace(/</g, "\\u003c"),
        }}
      />

      {CATEGORIES.map((cat) => (
        <section key={cat.name}>
          <h2 className={s.h3}>{cat.name}</h2>
          <dl className={s.faq}>
            {cat.faqs.map((item) => (
              <div key={item.q}>
                <dt className={s.serif}>{item.q}</dt>
                <dd>{item.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      <section className={s.ctaLine}>
        <h2>Can&apos;t find the answer you&apos;re looking for?</h2>
        <Link href="/contact" className={`${s.btn} ${s.btnPrimary}`}>
          Contact support
        </Link>
      </section>
    </>
  );
}
