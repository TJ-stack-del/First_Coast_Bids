"use client";

import { useState } from "react";
import { SAMPLE_BIDS } from "@/lib/marketing/sample-bids";
import s from "./story.module.css";

// "Your whole bid, on one screen": what a client sees for one bid, drawn from
// a made-up sample per trade (lib/marketing/sample-bids.ts) that the visitor
// can switch between. Labelled as a sample on the screen and below it.

const STATE_LABEL = { ready: "Ready", review: "With you", drafting: "Drafting" } as const;

export function ProductScreen() {
  const [i, setI] = useState(0);
  const bid = SAMPLE_BIDS[i];

  return (
    <>
      <div className={s.switch} role="group" aria-label="Show a sample bid for your trade">
        <span>Show it for your trade:</span>
        {SAMPLE_BIDS.map((b, n) => (
          <button key={b.trade} type="button" aria-pressed={n === i} onClick={() => setI(n)}>
            {b.trade}
          </button>
        ))}
      </div>

      <div className={s.screen} aria-live="polite">
        <div className={s.screenBar} aria-hidden="true">
          <i />
          <i />
          <i />
          <span>Your bids</span>
          <b>Sample, made-up bid</b>
        </div>
        <div className={s.screenBody}>
          <div className={s.bidHead}>
            <div>
              <small>
                {bid.agency} · {bid.number}
              </small>
              <h3>{bid.title}</h3>
            </div>
            <div className={s.due}>
              <strong>{bid.daysLeft} days</strong>
              <span>Due {bid.due}</span>
            </div>
          </div>

          <div className={s.stack}>
            <div className={s.card}>
              <h4>
                <span className={`${s.tag} ${s.tagYou}`}>YOU</span> Only you can do these
              </h4>
              <ul className={s.tasks}>
                {bid.you.map((t) => (
                  <li key={t.text}>
                    {t.text}
                    <em>p. {t.page}</em>
                  </li>
                ))}
              </ul>
            </div>
            <div className={s.card}>
              <h4>
                <span className={`${s.tag} ${s.tagWe}`}>WE</span> We&apos;re handling
              </h4>
              <ul className={s.tasks}>
                {bid.we.map((t) => (
                  <li key={t.text}>
                    {t.text}
                    <em>p. {t.page}</em>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className={s.card}>
            <h4>Your package</h4>
            <ul className={s.docs}>
              {bid.docs.map((d) => (
                <li key={d.name}>
                  <span>{d.name}</span>
                  <span className={`${s.state} ${s[d.state]}`}>{STATE_LABEL[d.state]}</span>
                  <small>{d.detail}</small>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
