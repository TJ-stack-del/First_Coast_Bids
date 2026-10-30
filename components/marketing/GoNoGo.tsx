"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { daysLeft, questionsFor, verdict, type Answer } from "@/lib/bid-read/go-no-go";
import type { ReadItem } from "@/lib/bid-read/read";
import s from "./press.module.css";

// "Should you bid this?" under a bid read (lib/bid-read/go-no-go.ts): the
// things only the contractor can bring, as yes / not sure / no, and a verdict
// that updates as they answer. Nothing here is sent anywhere.

const CHOICES: { value: Answer; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "unsure", label: "Not sure" },
  { value: "no", label: "No" },
];

export function GoNoGo({ items }: { items: ReadItem[] }) {
  const questions = useMemo(() => questionsFor(items), [items]);
  const left = useMemo(() => daysLeft(items, new Date()), [items]);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const v = verdict(questions, answers, left);

  return (
    <section className={s.gng} aria-labelledby="gng-title">
      <div className={s.gngHead}>
        <h3 id="gng-title" className={s.serif}>
          Should you bid this one?
        </h3>
        <p>
          {left === null
            ? "We couldn't find the due date. "
            : left < 0
              ? "The due date has passed. "
              : `${left} day${left === 1 ? "" : "s"} until it's due. `}
          {questions.length > 0
            ? `${questions.length === 1 ? "One question" : `${questions.length} quick questions`} about what only you can bring.`
            : "Nothing on our list needs you before we start."}
        </p>
      </div>

      {questions.length > 0 && (
        <ol className={s.gngQs}>
          {questions.map((q) => (
            <li key={q.key}>
              <span className={s.gngAsk}>
                {q.ask} <span className={s.gngPage}>p. {q.page}</span>
              </span>
              <span className={s.gngChoices} role="radiogroup" aria-label={q.ask}>
                {CHOICES.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    role="radio"
                    aria-checked={answers[q.key] === c.value}
                    data-v={c.value}
                    onClick={() => setAnswers((a) => ({ ...a, [q.key]: c.value }))}
                  >
                    {c.label}
                  </button>
                ))}
              </span>
            </li>
          ))}
        </ol>
      )}

      <div className={s.gngVerdict} data-kind={v.kind} aria-live="polite">
        <strong>{v.title}</strong>
        <p>{v.detail}</p>
        {v.kind === "hold" && v.reasons.length > 0 && (
          <ul>
            {v.reasons.map((r) => (
              <li key={r.key}>{r.fix}</li>
            ))}
          </ul>
        )}
        {v.kind === "lineup" && (
          <ul>
            {v.todo.map((t) => (
              <li key={t.key}>{t.fix}</li>
            ))}
          </ul>
        )}
        {(v.kind === "hold" || v.kind === "closed") && (
          <p className={s.gngNext}>
            Not this one? Send us the next bid you find, or{" "}
            <Link href="/guide/where-bids-are-posted" className={s.inlineLink}>
              see where bids are posted
            </Link>
            .
          </p>
        )}
      </div>
    </section>
  );
}
