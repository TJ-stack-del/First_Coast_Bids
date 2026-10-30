import type { Metadata } from "next";
import Link from "next/link";
import s from "@/components/marketing/press.module.css";
import { FAQS } from "@/lib/faq/answers";
import { AskBox } from "@/components/marketing/AskBox";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Answers to common questions about First Coast Bids' done-for-you bid prep service.",
};

// Questions and answers live in lib/faq/answers.ts, shared with "Ask us
// anything" so the list and the search can never disagree.
const CATEGORIES = [...new Set(FAQS.map((f) => f.category))].map((name) => ({
  name,
  faqs: FAQS.filter((f) => f.category === name),
}));

// 2026-10-30 (round 16): "Ask us anything" at the top, then every question
// in full by category. Answers stay visible rather than behind an accordion:
// there are around twenty, and hiding them cost more than it saved.
export default function FaqPage() {
  const allFaqs = CATEGORIES.flatMap((cat) => cat.faqs);
  return (
    <>
      <header className={s.pageHead}>
        <h1 className={s.pageTitle}>Questions, answered.</h1>
        <p className={s.lede}>
          Type your question, or read every answer below. If we haven&apos;t written one yet, you can ask us directly.
        </p>
      </header>

      <AskBox />

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
                <dd>
                  {item.a}
                  {item.href && (
                    <>
                      {" "}
                      <Link href={item.href.url} className={s.inlineLink}>
                        {item.href.label}
                      </Link>
                    </>
                  )}
                </dd>
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
