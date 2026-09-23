"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import s from "@/components/marketing/press.module.css";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

// 4-question RFP fit-score quiz per BUILD-ORDER-BIDPULSE.md Step 3 — pure
// lead-gen, no schema table for it, so nothing here is persisted.

const QUESTIONS = [
  "Do you have an upcoming RFP deadline in the next 30 days?",
  "Have you submitted a government or agency bid before?",
  "Do you already have a compliance matrix or capability statement ready?",
  "Are you a certified small business (WOSB, SDVOSB, 8(a), HUBZone, etc.)?",
];

export function QuizForm() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const prefersReducedMotion = useReducedMotion();
  const reduceMotion = mounted && prefersReducedMotion;

  function answer(value: boolean) {
    setAnswers((a) => [...a, value]);
    setStep((s) => s + 1);
  }

  if (step >= QUESTIONS.length) {
    const yesCount = answers.filter(Boolean).length;
    return (
      <div className={`${s.formSheet} grid gap-4`}>
        <h2 className={s.rowTitle}>
          {yesCount >= 2 ? "You're a strong fit." : "We can still help."}
        </h2>
        <p className={s.muted}>
          {yesCount >= 2
            ? "Based on your answers, you're well-positioned to bid. Let's get your submission prepared."
            : "Every bidder starts somewhere. Send us your RFP and we'll take it from there."}
        </p>
        {/* The site's one main action (2026-09-23). */}
        <Link href="/intake?package=pilot" className={`${s.btn} ${s.btnPrimary} justify-self-start`}>
          Start a pilot bid
        </Link>
      </div>
    );
  }

  return (
    <div className={`${s.formSheet} grid gap-8`}>
      <div className={s.progress} role="progressbar" aria-valuemin={1} aria-valuemax={QUESTIONS.length} aria-valuenow={step + 1}>
        <div className={s.progressFill} style={{ width: `${((step + 1) / QUESTIONS.length) * 100}%` }} />
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
          exit={reduceMotion ? undefined : { opacity: 0, x: -16 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className={`${s.meta} mb-2`}>
            Question <span className={s.mono}>{step + 1}</span> of <span className={s.mono}>{QUESTIONS.length}</span>
          </span>
          <h2 className={s.rowTitle}>{QUESTIONS[step]}</h2>
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
