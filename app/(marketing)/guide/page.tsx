import type { Metadata } from "next";
import Link from "next/link";
import s from "@/components/marketing/press.module.css";
import { ARTICLES, STEP_LABELS } from "@/lib/guide/articles";
import type { Step } from "@/lib/guide/types";
import { NextStep } from "@/components/marketing/NextStep";

export const metadata: Metadata = {
  title: "New to bidding?",
  description: "Government work for trade businesses, in plain English: what an RFP is, where bids are posted around Jacksonville, getting registered, and your first bid.",
};

// The "New to bidding?" guide hub (replaced the blog, 2026-09-26): the path
// Learn, Get ready, Start, with the articles under each step.
const STEPS: Step[] = ["learn", "ready", "start"];

export default function GuidePage() {
  return (
    <>
      <header className={s.pageHead}>
        <h1 className={s.pageTitle}>New to bidding?</h1>
        <p className={s.lede}>Government work for trade businesses, in plain English.</p>
      </header>
      <section className={s.narrow}>
        {STEPS.map((step, n) => (
          <div key={step} className="mb-10">
            <h2 className={s.rowTitle}>
              <span className={s.mono}>{n + 1}.</span> {STEP_LABELS[step]}
            </h2>
            <div className={s.ledger}>
              {ARTICLES.filter((a) => a.step === step).map((a) => (
                <article key={a.slug}>
                  <Link href={`/guide/${a.slug}`} className={s.inlineLink}>{a.title}</Link>
                  <p className={s.muted}>{a.summary}</p>
                </article>
              ))}
            </div>
          </div>
        ))}
        <NextStep />
      </section>
    </>
  );
}
