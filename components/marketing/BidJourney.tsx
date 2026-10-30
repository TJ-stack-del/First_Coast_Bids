"use client";

import { useEffect, useRef, useState } from "react";
import s from "./journey.module.css";

// The opening's moving picture: one made-up bid going from RFP to "in the
// running". It ends at what we can truthfully promise -- the bid passes the
// agency's first check (complete, on time, every form signed) and gets
// scored on price and work -- never at "you won" (PRODUCT.md: no win
// guarantees). Advances every few seconds, pauses on hover or focus, and
// holds still under reduced motion; the step bar below it is clickable.

const STEPS = ["Your RFP", "We read it", "Your package", "You submit", "In the running"] as const;
const STEP_MS = 3400;

const LOOSE = ["Addendum 2", "Site visit, Nov 4", "Bid bond 5%", "Sworn statement", "Due Nov 18"];

export function BidJourney() {
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const [still, setStill] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setStill(mq.matches);
    const on = () => setStill(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    if (paused || still) return;
    timer.current = setInterval(() => setStep((n) => (n + 1) % STEPS.length), STEP_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [paused, still]);

  const at = (n: number) => (step === n ? s.on : "");

  return (
    <div
      className={s.journey}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className={s.stage} aria-hidden="true">
        {/* 1. The RFP, its loose ends showing */}
        <div className={`${s.scene} ${at(0)}`}>
          <div className={s.doc}>
            <div className={s.docHead}>
              <b>Invitation to Bid</b>
              <span>ITB SAMPLE-0412 · page 1 of 112</span>
            </div>
            {Array.from({ length: 9 }).map((_, i) => (
              <i key={i} className={`${s.line} ${[2, 5, 7].includes(i) ? s.mark : ""}`} style={{ width: `${62 + ((i * 17) % 34)}%` }} />
            ))}
          </div>
          <ul className={s.pops}>
            {LOOSE.map((l, i) => (
              <li key={l} style={{ transitionDelay: `${250 + i * 220}ms` }}>
                {l}
              </li>
            ))}
          </ul>
        </div>

        {/* 2. Read and sorted: we handle / you handle */}
        <div className={`${s.scene} ${at(1)}`}>
          <div className={s.sort}>
            <div className={s.col}>
              <span className={s.weTag}>WE HANDLE</span>
              <p>Sworn statements, filled in<em>p. 31</em></p>
              <p>Addenda 1 and 2, acknowledged<em>p. 2</em></p>
              <p>Wage rates, checked<em>p. 12</em></p>
            </div>
            <div className={s.col}>
              <span className={s.youTag}>YOU HANDLE</span>
              <p>Site visit, Nov 4<em>p. 3</em></p>
              <p>Bid bond from your surety<em>p. 4</em></p>
            </div>
          </div>
        </div>

        {/* 3. The package: three documents */}
        <div className={`${s.scene} ${at(2)}`}>
          <div className={s.pack}>
            {["Capability statement", "Compliance matrix", "Technical narrative"].map((d, i) => (
              <div key={d} className={s.sheet} style={{ transitionDelay: `${150 + i * 220}ms` }}>
                <i className={s.line} style={{ width: "70%" }} />
                <i className={s.line} style={{ width: "88%" }} />
                <i className={s.line} style={{ width: "54%" }} />
                <b>{d}</b>
                <span className={s.tick}>✓</span>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Submitted by the client, through their own portal */}
        <div className={`${s.scene} ${at(3)}`}>
          <div className={s.portal}>
            <div className={s.portalBar}>Agency bid portal · your account</div>
            <div className={s.portalBody}>
              <span className={s.sent}>✓</span>
              <b>Bid submitted</b>
              <span>Tue, Nov 18 · 1:42 p.m.</span>
              <em>18 minutes before the deadline</em>
            </div>
          </div>
        </div>

        {/* 5. The honest finish: through the first check, scored on merit */}
        <div className={`${s.scene} ${at(4)}`}>
          <div className={s.result}>
            <b>Bid opening · first check</b>
            <ul>
              <li>Complete</li>
              <li>On time</li>
              <li>Every form signed</li>
              <li>Every addendum acknowledged</li>
            </ul>
            <div className={s.stamp}>In the running</div>
            <p>Now it&apos;s scored on your price and your work, not a missing form.</p>
          </div>
        </div>
      </div>

      <ol className={s.steps} aria-label="From RFP to in the running">
        {STEPS.map((label, n) => (
          <li key={label}>
            <button type="button" aria-current={step === n ? "step" : undefined} onClick={() => setStep(n)}>
              <span className={s.bar}>
                <span className={step === n && !paused && !still ? s.fill : step > n ? s.full : ""} />
              </span>
              {label}
            </button>
          </li>
        ))}
      </ol>
      <p className={s.note}>A made-up bid. We never promise a win; we make sure yours gets scored.</p>
    </div>
  );
}
