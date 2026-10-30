import type { Metadata } from "next";
import Link from "next/link";
import g from "@/components/marketing/guide.module.css";
import { readingMinutes } from "@/lib/guide/reading";
import { ARTICLES, STEP_LABELS } from "@/lib/guide/articles";
import type { Step } from "@/lib/guide/types";

export const metadata: Metadata = {
  title: "New to bidding?",
  description: "Government work for trade businesses, in plain English: what an RFP is, where bids are posted around Jacksonville, getting registered, and your first bid.",
};

// The "New to bidding?" guide hub (replaced the blog, 2026-09-26): the path
// Learn, Get ready, Start, with the articles under each step.
const STEPS: Step[] = ["learn", "ready", "start"];

// 2026-10-30 (round 17): the guide as a short course -- three numbered
// tracks of article cards with reading times, a clear place to start, and
// the four-question check for anyone unsure where they are.
export default function GuidePage() {
  const first = ARTICLES[0];
  return (
    <div className={g.wrap}>
      <header className={g.head}>
        <p className={g.kicker}>New to bidding?</p>
        <h1 className={g.title}>Government work, in plain English.</h1>
        <p className={g.lede}>
          Seven short reads for trade businesses, in order: what a bid is, getting ready, and your first one. About
          twenty minutes in all.
        </p>
        <div className={g.ctas}>
          <Link href={`/guide/${first.slug}`} className={`${g.btn} ${g.btnDark}`}>
            Start here: {first.title}
          </Link>
          <Link href="/quiz" className={g.btn}>
            Where do I start?
          </Link>
        </div>
      </header>

      <div className={g.tracks}>
        {STEPS.map((step, n) => (
          <section key={step} className={g.track} aria-labelledby={`track-${step}`}>
            <h2 id={`track-${step}`}>
              <span className={g.num}>{n + 1}</span>
              {STEP_LABELS[step]}
            </h2>
            <ol className={g.cards}>
              {ARTICLES.filter((a) => a.step === step).map((a) => (
                <li key={a.slug}>
                  <Link href={`/guide/${a.slug}`} className={`${g.card} ${a.slug === first.slug ? g.start : ""}`}>
                    <b>{a.title}</b>
                    <span>{a.summary}</span>
                    <small>{readingMinutes(a)} min read</small>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>

      <div className={g.check}>
        <div>
          <b>Not sure where you are?</b>
          <p>Four yes-or-no questions show your road to a first bid, and the one thing to do next.</p>
        </div>
        <Link href="/quiz" className={g.btn}>
          Take the 1-minute check
        </Link>
      </div>
    </div>
  );
}
