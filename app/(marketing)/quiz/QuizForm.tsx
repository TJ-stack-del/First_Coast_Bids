"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import s from "@/components/marketing/press.module.css";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { nextSteps } from "@/lib/guide/next-steps";
import { getArticle } from "@/lib/guide/articles";
import type { Answers } from "@/lib/guide/types";
import { PILOT_CTA, pilotPriceLine } from "@/lib/pilot-offer";

// "Where do I start?" (docs/superpowers/specs/2026-09-26-newcomer-guide-design.md):
// four yes/no questions, then one to three next steps from nextSteps() --
// guide articles, or the Pilot when a bid is in hand. For newcomers and
// people already bidding alike. Nothing here is stored or sent.
const QUESTIONS: { key: keyof Answers; text: string }[] = [
  { key: "bidBefore", text: "Have you bid on a government job before?" },
  { key: "registered", text: "Are you registered in SAM.gov or on a local bid site?" },
  { key: "licensed", text: "Do you have your business license and insurance?" },
  { key: "bidInHand", text: "Do you have a bid (an RFP or ITB) in hand right now?" },
];

export function QuizForm() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<Answers>>({});
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const prefersReducedMotion = useReducedMotion();
  // After the last answer the Yes/No buttons disappear: move focus to the
  // result so keyboard and screen-reader users land on it (final review 13).
  const resultRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (step >= QUESTIONS.length) resultRef.current?.focus();
  }, [step]);
  const reduceMotion = mounted && prefersReducedMotion;

  function answer(value: boolean) {
    const key = QUESTIONS[step].key;
    setAnswers((a) => ({ ...a, [key]: value }));
    setStep((s) => s + 1);
  }

  if (step >= QUESTIONS.length) {
    const steps = nextSteps(answers as Answers);
    return (
      <div className={`${s.formSheet} grid gap-6`}>
        <h2 ref={resultRef} tabIndex={-1} className={`${s.rowTitle} outline-none`}>Here&apos;s where to start.</h2>
        <ol className="grid gap-5 list-decimal pl-6">
          {steps.map((st) => {
            if (st.target === "pilot")
              return (
                <li key="pilot">
                  <p>{st.why}</p>
                  <Link href={PILOT_CTA.href} className={`${s.btn} ${s.btnPrimary} mt-2 inline-flex`}>
                    {PILOT_CTA.label}
                  </Link>
                  <p className={`${s.muted} mt-1`}>Pilot: {pilotPriceLine()}.</p>
                </li>
              );
            const article = getArticle(st.target);
            return (
              <li key={st.target}>
                <Link href={`/guide/${st.target}`} className={s.inlineLink}>{article?.title ?? st.target}</Link>
                <p className={s.muted}>{st.why}</p>
              </li>
            );
          })}
        </ol>
        <p className="flex flex-wrap gap-4 items-center">
          <button type="button" onClick={() => { setStep(0); setAnswers({}); }} className={`${s.btn} ${s.btnQuiet}`}>
            Start over
          </button>
          <Link href="/guide" className={s.inlineLink}>Browse the whole guide</Link>
        </p>
      </div>
    );
  }

  return (
    <div className={`${s.formSheet} grid gap-8`}>
      <div className={s.progress} role="progressbar" aria-label="Progress" aria-valuetext={`Question ${step + 1} of ${QUESTIONS.length}`} aria-valuemin={1} aria-valuemax={QUESTIONS.length} aria-valuenow={step + 1}>
        <div className={s.progressFill} style={{ transform: `scaleX(${(step + 1) / QUESTIONS.length})` }} />
      </div>

      {/* A state transition, not decoration: each question is a distinct
          step, so it gets its own directional slide (next question enters
          from the right, matching the progress bar's forward motion)
          instead of abruptly swapping text. Keyed by step so
          AnimatePresence treats each question as a new element to
          cross-fade between. */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          initial={reduceMotion ? false : { opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, x: -16, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className={`${s.meta} mb-2`}>
            Question <span className={s.mono}>{step + 1}</span> of <span className={s.mono}>{QUESTIONS.length}</span>
          </span>
          <h2 className={s.rowTitle} aria-live="polite">{QUESTIONS[step].text}</h2>
        </motion.div>
      </AnimatePresence>

      <div className="flex gap-3">
        <button type="button" onClick={() => answer(true)} className={`${s.btn} ${s.btnPrimary} flex-1`}>
          Yes
        </button>
        <button type="button" onClick={() => answer(false)} className={`${s.btn} ${s.btnQuiet} flex-1`}>
          No
        </button>
      </div>
    </div>
  );
}
