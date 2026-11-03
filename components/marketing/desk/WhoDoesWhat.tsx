"use client";

import { useEffect, useRef, useState } from "react";
import s from "./desk.module.css";

// The two-tab "We do" / "You do" switch. Server-rendered with both panels
// showing (and their names as headings), so the page is complete without
// JavaScript; once hydrated it becomes a proper tablist.

const PANELS = [
  {
    id: "us",
    name: "We do",
    rows: [
      ["Read the whole bid", "Every page of it."],
      ["Fill every form", "In the buyer’s format."],
      ["Keep your papers", "Send them once."],
      ["Check it by hand", "Mike reads every page."],
    ],
  },
  {
    id: "you",
    name: "You do",
    rows: [
      ["Pick the bid", "Send the link or the PDF."],
      ["Set your price", "The number is always yours."],
      ["Sign it", "We mark every line that needs you."],
      ["Do the work", "We never go on site."],
    ],
  },
] as const;

export function WhoDoesWhat() {
  const [ready, setReady] = useState(false);
  const [on, setOn] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => setReady(true), []);

  const keyDown = (e: React.KeyboardEvent, i: number) => {
    const last = PANELS.length - 1;
    const to: Record<string, number> = {
      ArrowRight: i === last ? 0 : i + 1,
      ArrowLeft: i === 0 ? last : i - 1,
      Home: 0,
      End: last,
    };
    if (!(e.key in to)) return;
    e.preventDefault();
    const n = to[e.key];
    setOn(n);
    tabs.current[n]?.focus();
  };

  return (
    <div className={`${s.container} ${s.split__grid}`}>
      <div className={s.split__head}>
        <h2 id="split-h">Who does what</h2>
        <div className={s.seg} role="tablist" aria-label="Who does what">
          {PANELS.map((p, i) => (
            <button
              key={p.id}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`tab-${p.id}`}
              aria-selected={on === i}
              aria-controls={`panel-${p.id}`}
              tabIndex={on === i ? 0 : -1}
              onClick={() => setOn(i)}
              onKeyDown={(e) => keyDown(e, i)}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>
      <div>
        {PANELS.map((p, i) => (
          <div
            key={p.id}
            className={s.panel}
            role="tabpanel"
            id={`panel-${p.id}`}
            aria-labelledby={`tab-${p.id}`}
            hidden={ready && on !== i}
            data-pre={ready ? undefined : ""}
          >
            <p className={s.panel__name}>{p.name}</p>
            <ul className={s.rows}>
              {p.rows.map(([h, d]) => (
                <li key={h}>
                  <h3>{h}</h3>
                  <p>{d}</p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
