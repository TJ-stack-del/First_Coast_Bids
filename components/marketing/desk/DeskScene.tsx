"use client";

import { useEffect, useRef, useState } from "react";
import s from "./desk.module.css";
import { drawWood } from "./draw";

// The hero's lamp-lit desk: five bid pages you pick up to see who handles
// each one, then "Hand it to us" slides them into the folder, which closes
// and is stamped Ready to sign. Without JavaScript the pages lie where they
// are with their labels showing, so the scene still says everything.

const PAGES = [
  { name: "Bid form", who: "We fill it", x: 250, y: 150, r: -9 },
  { name: "W-9", who: "You send it once", x: 440, y: 110, r: 7 },
  { name: "Insurance certificate", who: "Your agent sends it", x: 330, y: 300, r: 15 },
  { name: "Addendum 2", who: "We track and sign-mark it", x: 500, y: 270, r: -5 },
  { name: "State forms", who: "We fill them, you sign", x: 150, y: 320, r: 23 },
];

const FOLDER = { x: 708, y: 250 };
const LIFT = { x: 420, y: 300 };
// The scene's drawn width (desk plus the open flap, in perspective) and how
// far right of centre it sits, measured at full size.
const SCENE_W = 1212;
const SCENE_SHIFT = 43;
const START_HINT = "Pick up a page to see who handles it.";

type Page = (typeof PAGES)[number];

const base = (p: Page, i: number) => `translate3d(0, 0, ${3 + i * 2}px) rotateZ(${p.r}deg)`;

export function DeskScene() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const woodRef = useRef<HTMLCanvasElement>(null);
  const [lifted, setLifted] = useState<number | null>(null);
  const [gathered, setGathered] = useState(false);
  // Whether the last change was a hand-over or a spread-out, for the
  // staggered delays; a single pick-up moves at once.
  const [move, setMove] = useState<"pick" | "gather" | "spread">("pick");

  useEffect(() => {
    const wrap = wrapRef.current;
    const wood = woodRef.current;
    if (!wrap || !wood) return;
    const fit = () => {
      // The open folder flap reaches past the desk's right edge, so the
      // scene is wider on the right than the left: fit that whole width
      // and nudge it left to centre it, once it has to shrink.
      const sc = Math.min(1, (wrap.clientWidth - 16) / SCENE_W);
      wrap.style.setProperty("--s", sc.toFixed(3));
      wrap.style.setProperty("--shift", sc < 1 ? `${(-SCENE_SHIFT * sc).toFixed(1)}px` : "0px");
    };
    fit();
    drawWood(wood);
    let t: ReturnType<typeof setTimeout>;
    const ro = new ResizeObserver(() => {
      clearTimeout(t);
      t = setTimeout(() => {
        fit();
        drawWood(wood);
      }, 120);
    });
    ro.observe(wrap);
    return () => {
      clearTimeout(t);
      ro.disconnect();
    };
  }, []);

  const pick = (i: number) => {
    if (gathered) return;
    setMove("pick");
    setLifted(lifted === i ? null : i);
  };

  const hand = () => {
    setLifted(null);
    setMove(gathered ? "spread" : "gather");
    setGathered(!gathered);
  };

  const hint = gathered
    ? "Every page filled or attached. You set the price and sign."
    : lifted !== null
      ? `${PAGES[lifted].name}: ${PAGES[lifted].who.toLowerCase()}.`
      : START_HINT;

  return (
    <>
      <div className={s["stage-wrap"]} ref={wrapRef}>
        <div className={s.stage}>
          <div className={`${s.desk} ${gathered ? s.closed : ""}`}>
            <canvas ref={woodRef} aria-hidden="true" />
            <div className={s.folder} aria-hidden="true">
              <div className={s.folder__back} />
              <div className={s.flap}>
                <span>Ready to sign</span>
              </div>
            </div>
            {PAGES.map((p, i) => {
              let transform = base(p, i);
              let delay = "0ms";
              if (gathered) {
                transform = `translate3d(${FOLDER.x - p.x}px, ${FOLDER.y - p.y}px, ${4 + i}px) rotateZ(${i % 2 ? 1.5 : -1.5}deg)`;
                delay = `${i * 120}ms`;
              } else if (lifted === i) {
                transform = `translate3d(${LIFT.x - p.x}px, ${LIFT.y - p.y}px, 150px) rotateZ(0deg) rotateX(-50deg) scale(1.1)`;
              } else if (move === "spread") {
                delay = `${400 + i * 80}ms`;
              }
              return (
                <button
                  key={p.name}
                  className={s.page}
                  type="button"
                  aria-pressed={lifted === i}
                  tabIndex={gathered ? -1 : 0}
                  style={{ left: p.x, top: p.y, transform, transitionDelay: delay }}
                  onClick={() => pick(i)}
                >
                  {p.name}
                  <small>{p.who}</small>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className={`${s.container} ${s["desk-bar"]}`}>
        <p aria-live="polite">{hint}</p>
        <button className={`${s.btn} ${s["btn--night"]}`} type="button" onClick={hand}>
          {gathered ? "Spread them out again" : "Hand it to us"}
        </button>
      </div>
    </>
  );
}
