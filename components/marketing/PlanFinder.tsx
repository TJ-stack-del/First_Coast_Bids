"use client";

import { useState } from "react";
import Link from "next/link";
import { findPlan, yourTime, ONE_OFF, RETAINER } from "@/lib/marketing/plan-finder";
import { PILOT_FREE_COHORT_OPEN } from "@/lib/pilot-offer";
import s from "./pricing.module.css";

// "Which plan fits you?" (lib/marketing/plan-finder.ts): a few answers, a
// recommendation, and the starting-price math behind it.

const PACES = [
  { value: 0.25, label: "One every few months" },
  { value: 0.5, label: "One every other month" },
  { value: 1, label: "About one a month" },
  { value: 2, label: "Two a month" },
  { value: 3, label: "Three a month" },
  { value: 4, label: "Four or more" },
];

const HREF = {
  pilot: "/intake?package=pilot",
  one_off: "/intake?package=one_off",
  retainer: "/intake?package=retainer",
  talk: "/contact",
} as const;

const CTA = {
  pilot: "Start a pilot bid",
  one_off: "Start a one-off bid",
  retainer: "Ask about a retainer",
  talk: "Talk to us",
} as const;

const money = (n: number) => `$${n.toLocaleString("en-US")}`;

export function PlanFinder() {
  const [pace, setPace] = useState(2);
  const [firstBid, setFirstBid] = useState(true);
  const [wantsBidsFound, setWantsBidsFound] = useState(false);
  const [hours, setHours] = useState("");
  const [rate, setRate] = useState("");
  const bidsPerMonth = PACES[pace].value;
  const fit = findPlan({ bidsPerMonth, wantsBidsFound, firstBid, pilotOpen: PILOT_FREE_COHORT_OPEN });
  const diy = yourTime(bidsPerMonth, Number(hours) || null, Number(rate) || null);

  return (
    <div className={s.finder}>
      <div className={s.inputs}>
        <fieldset className={s.field}>
          <legend>Have you sent us a bid before?</legend>
          <div className={s.toggle}>
            <button type="button" aria-pressed={firstBid} onClick={() => setFirstBid(true)}>
              Not yet
            </button>
            <button type="button" aria-pressed={!firstBid} onClick={() => setFirstBid(false)}>
              Yes
            </button>
          </div>
        </fieldset>

        <div className={s.field}>
          <label htmlFor="pace">How often do you expect to bid?</label>
          <input
            id="pace"
            type="range"
            min={0}
            max={PACES.length - 1}
            step={1}
            value={pace}
            onChange={(e) => setPace(Number(e.target.value))}
            aria-valuetext={PACES[pace].label}
          />
          <strong className={s.paceLabel}>{PACES[pace].label}</strong>
        </div>

        <fieldset className={s.field}>
          <legend>Do you want us to find bids that fit your trade?</legend>
          <div className={s.toggle}>
            <button type="button" aria-pressed={!wantsBidsFound} onClick={() => setWantsBidsFound(false)}>
              I&apos;ll find them
            </button>
            <button type="button" aria-pressed={wantsBidsFound} onClick={() => setWantsBidsFound(true)}>
              Yes, send me bids
            </button>
          </div>
        </fieldset>

        <details className={s.time}>
          <summary>Optional: what does a bid cost you in your own time?</summary>
          <div className={s.timeRow}>
            <label>
              Hours a bid takes you
              <input inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value.replace(/[^\d.]/g, ""))} placeholder="e.g. 10" />
            </label>
            <label>
              What your hour is worth ($)
              <input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, ""))} placeholder="e.g. 75" />
            </label>
          </div>
        </details>
      </div>

      <div className={s.result} aria-live="polite">
        <p className={s.resultKicker}>Your best fit</p>
        <h3>{fit.title}</h3>
        <p className={s.resultWhy}>{fit.why}</p>
        <dl className={s.math}>
          <div>
            <dt>One-off, per month</dt>
            <dd>
              {money(fit.oneOffMonthly)}
              <small>
                {bidsPerMonth} × {money(ONE_OFF)}
              </small>
            </dd>
          </div>
          <div>
            <dt>Retainer, per month</dt>
            <dd>
              {fit.retainerMonthly === null ? "Ask us" : money(RETAINER)}
              <small>{fit.retainerMonthly === null ? "covers up to 2 bids" : "up to 2 bids + bids found"}</small>
            </dd>
          </div>
          {diy !== null && (
            <div>
              <dt>Doing it yourself</dt>
              <dd>
                {money(diy)}
                <small>of your time, from your numbers</small>
              </dd>
            </div>
          )}
        </dl>
        <Link href={HREF[fit.plan]} className={s.resultBtn}>
          {CTA[fit.plan]}
        </Link>
        <p className={s.fine}>Starting prices. We confirm your exact price with you before any work starts.</p>
      </div>
    </div>
  );
}
