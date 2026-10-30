"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ask } from "@/lib/faq/answers";
import s from "./ask.module.css";

// "Ask us anything" on the FAQ (lib/faq/answers.ts): answers as you type from
// the FAQ, the guide's glossary and its articles. No AI and nothing sent; a
// question with no answer becomes a pre-filled message to us.

const SUGGESTIONS = ["How fast?", "How much?", "Who submits it?", "Do you do bonds?", "Federal bids?", "What's an addendum?"];

const KIND_LABEL = { faq: "Answer", term: "From the glossary", article: "In the guide" } as const;

export function AskBox() {
  const [q, setQ] = useState("");
  const results = useMemo(() => ask(q), [q]);
  const asked = q.trim().length > 2;

  return (
    <div className={s.box}>
      <label htmlFor="ask" className={s.label}>
        Ask us anything
      </label>
      <input
        id="ask"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="e.g. Do I have to submit it myself?"
        autoComplete="off"
        className={s.input}
      />
      <div className={s.chips} aria-label="Common questions">
        {SUGGESTIONS.map((sug) => (
          <button key={sug} type="button" onClick={() => setQ(sug)}>
            {sug}
          </button>
        ))}
      </div>

      <div aria-live="polite">
        {asked && results.length > 0 && (
          <ol className={s.results}>
            {results.map((r) => (
              <li key={r.kind + r.title}>
                <span className={s.kind}>{KIND_LABEL[r.kind]}</span>
                <h3>{r.title}</h3>
                <p>{r.text}</p>
                {r.href && (
                  <Link href={r.href.url} className={s.more}>
                    {r.href.label} →
                  </Link>
                )}
              </li>
            ))}
          </ol>
        )}
        {asked && results.length === 0 && (
          <div className={s.none}>
            <p>We don&apos;t have a written answer to that yet.</p>
            <Link href={`/contact?message=${encodeURIComponent(q.trim())}`} className={s.ask}>
              Ask us directly
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
