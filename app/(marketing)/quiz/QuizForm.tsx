"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-8 flex flex-col gap-4 text-center">
        <h2 className="text-headline-md text-primary">
          {yesCount >= 2 ? "You're a strong fit." : "We can still help."}
        </h2>
        <p className="text-body-md text-on-surface-variant">
          {yesCount >= 2
            ? "Based on your answers, you're well-positioned to bid. Let's get your submission prepared."
            : "Every bidder starts somewhere. Send us your RFP and we'll take it from there."}
        </p>
        <Link
          href="/intake"
          className="self-center px-6 py-3 bg-primary-container text-on-primary-container rounded text-label-md font-semibold hover:opacity-90 hover:-translate-y-0.5 transition active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Get started
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-8 flex flex-col gap-8">
      <div className="w-full bg-surface-container-high rounded-full h-2 overflow-hidden">
        <div
          className="bg-primary-container h-2 rounded-full transition-[width] duration-300 ease-in-out"
          style={{ width: `${((step + 1) / QUESTIONS.length) * 100}%` }}
        />
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
          <span className="text-label-md text-on-surface-variant block mb-3 tracking-widest uppercase">
            Question {step + 1} of {QUESTIONS.length}
          </span>
          <h2 className="text-headline-md text-primary leading-tight">{QUESTIONS[step]}</h2>
        </motion.div>
      </AnimatePresence>

      <div className="flex gap-3">
        <button
          onClick={() => answer(true)}
          className="flex-1 py-3 px-4 bg-primary-container text-on-primary-container rounded text-label-md font-semibold hover:opacity-90 hover:-translate-y-0.5 transition active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Yes
        </button>
        <button
          onClick={() => answer(false)}
          className="flex-1 py-3 px-4 bg-surface border border-outline-variant rounded text-label-md hover:bg-surface-container-high hover:-translate-y-0.5 transition active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          No
        </button>
      </div>
    </div>
  );
}
