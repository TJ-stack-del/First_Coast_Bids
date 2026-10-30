"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { roadmap } from "@/lib/guide/roadmap";
import type { Answers } from "@/lib/guide/types";
import s from "./quiz.module.css";

// "Where do I start?": four yes-or-no questions, then the road to a first
// bid with each station marked done / next / later (lib/guide/roadmap.ts),
// the next one carrying its one action. Nothing here is stored or sent.
const QUESTIONS: { key: keyof Answers; text: string; hint: string }[] = [
  { key: "bidBefore", text: "Have you bid on a government job before?", hint: "Any city, county, school district, state or federal job." },
  { key: "licensed", text: "Do you have your business license and insurance?", hint: "General liability, and workers' comp if you have employees." },
  { key: "registered", text: "Are you registered as a vendor?", hint: "On SAM.gov, or on a local agency's bid site." },
  { key: "bidInHand", text: "Do you have a bid in hand right now?", hint: "An RFP, ITB or RFQ you'd like to go after." },
];

export function QuizForm() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<Answers>>({});
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const prefersReducedMotion = useReducedMotion();
  const reduceMotion = mounted && prefersReducedMotion;
  // After the last answer the buttons disappear: move focus to the result so
  // keyboard and screen-reader users land on it.
  const resultRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (step >= QUESTIONS.length) resultRef.current?.focus();
  }, [step]);

  function answer(value: boolean) {
    const key = QUESTIONS[step].key;
    setAnswers((a) => ({ ...a, [key]: value }));
    setStep((n) => n + 1);
  }

  if (step >= QUESTIONS.length) {
    const r = roadmap(answers as Answers);
    return (
      <div className={s.result}>
        <h2 ref={resultRef} tabIndex={-1} className={s.resultTitle}>
          {r.headline}
        </h2>
        <ol className={s.road}>
          {r.stations.map((st, i) => (
            <li key={st.id} className={s[st.status]} aria-current={st.status === "next" ? "step" : undefined}>
              <span className={s.dot} aria-hidden="true">
                {st.status === "done" ? "✓" : i + 1}
              </span>
              <div className={s.stop}>
                <span className={s.state}>{st.status === "done" ? "Done" : st.status === "next" ? "Your next step" : "Later"}</span>
                <h3>{st.title}</h3>
                {st.status !== "later" && <p>{st.why}</p>}
                {st.status === "next" && st.action && (
                  <Link href={st.action.href} className={s.go}>
                    {st.action.label}
                  </Link>
                )}
                {st.status === "later" && st.action && (
                  <Link href={st.action.href} className={s.peek}>
                    {st.action.label}
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ol>
        <p className={s.again}>
          <button
            type="button"
            onClick={() => {
              setStep(0);
              setAnswers({});
            }}
          >
            Start over
          </button>
          <Link href="/guide">Browse the whole guide</Link>
        </p>
      </div>
    );
  }

  const q = QUESTIONS[step];
  return (
    <div className={s.card}>
      <div className={s.bar} aria-hidden="true">
        {QUESTIONS.map((_, i) => (
          <span key={i} className={i <= step ? s.barOn : ""} />
        ))}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          initial={reduceMotion ? false : { opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, x: -16, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className={s.count}>
            Question {step + 1} of {QUESTIONS.length}
          </p>
          <h2 className={s.question} aria-live="polite">
            {q.text}
          </h2>
          <p className={s.hint}>{q.hint}</p>
        </motion.div>
      </AnimatePresence>
      <div className={s.answers}>
        <button type="button" onClick={() => answer(true)} className={s.yes}>
          Yes
        </button>
        <button type="button" onClick={() => answer(false)} className={s.no}>
          No
        </button>
      </div>
      {step > 0 && (
        <button type="button" className={s.back} onClick={() => setStep((n) => n - 1)}>
          ← Back
        </button>
      )}
    </div>
  );
}
