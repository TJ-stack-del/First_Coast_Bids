"use client";

import { useEffect, useRef, useState } from "react";
import s from "./desk.module.css";
import { drawWood } from "./draw";

// The hero's lamp-lit desk: five bid pages you pick up to see who handles
// each one, then "Hand it to us" slides them into the folder, which closes
// and is stamped Ready to sign. Without JavaScript the pages lie where they
// are with their labels showing, so the scene still says everything.

// Each page has a spot on the wide desk (x, y) and one on the phone's
// portrait desk (px, py), where the pile sits above the folder so nothing
// clips and the pages stay big enough to tap.
const PAGES = [
  { name: "Bid form", who: "We fill it", x: 250, y: 150, px: 40, py: 70, r: -9 },
  { name: "W-9", who: "You send it once", x: 440, y: 110, px: 360, py: 40, r: 7 },
  { name: "Insurance certificate", who: "Your agent sends it", x: 330, y: 300, px: 210, py: 210, r: 15 },
  { name: "Addendum 2", who: "We track and sign-mark it", x: 500, y: 270, px: 390, py: 290, r: -5 },
  { name: "State forms", who: "We fill them, you sign", x: 150, y: 320, px: 30, py: 320, r: 18 },
];

// Where gathered pages land (inside the folder), where a picked-up page
// rises to, and the scene's drawn width (desk plus the open flap, in
// perspective) with how far right of centre it sits at full size. The
// folder's own spot is in desk.module.css and matches these.
const LAYOUTS = {
  wide: { folder: { x: 708, y: 250 }, lift: { x: 420, y: 300, z: 150, scale: 1.1 }, sceneW: 1212, shift: 43 },
  phone: { folder: { x: 98, y: 600 }, lift: { x: 210, y: 635, z: 290, scale: 2.2 }, sceneW: 636, shift: 0 },
};
const PHONE = "(max-width: 40rem)";
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
  const [phone, setPhone] = useState(false);
  const L = phone ? LAYOUTS.phone : LAYOUTS.wide;

  useEffect(() => {
    const wrap = wrapRef.current;
    const wood = woodRef.current;
    if (!wrap || !wood) return;
    const mq = window.matchMedia(PHONE);
    const fit = () => {
      // The open folder flap reaches past the wide desk's right edge, so
      // that scene is wider on the right than the left: fit the whole width
      // and nudge it left to centre it, once it has to shrink.
      const isPhone = mq.matches;
      const { sceneW, shift } = isPhone ? LAYOUTS.phone : LAYOUTS.wide;
      const sc = Math.min(1, (wrap.clientWidth - 16) / sceneW);
      wrap.style.setProperty("--s", sc.toFixed(3));
      wrap.style.setProperty("--shift", sc < 1 ? `${(-shift * sc).toFixed(1)}px` : "0px");
      setPhone(isPhone);
    };
    const redraw = () => {
      fit();
      drawWood(wood);
    };
    redraw();
    let t: ReturnType<typeof setTimeout>;
    const later = () => {
      clearTimeout(t);
      t = setTimeout(redraw, 120);
    };
    const ro = new ResizeObserver(later);
    ro.observe(wrap);
    mq.addEventListener("change", later);
    return () => {
      clearTimeout(t);
      ro.disconnect();
      mq.removeEventListener("change", later);
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
              const at = phone ? { x: p.px, y: p.py } : { x: p.x, y: p.y };
              let transform = base(p, i);
              let delay = "0ms";
              if (gathered) {
                transform = `translate3d(${L.folder.x - at.x}px, ${L.folder.y - at.y}px, ${4 + i}px) rotateZ(${i % 2 ? 1.5 : -1.5}deg)`;
                delay = `${i * 120}ms`;
              } else if (lifted === i) {
                transform = `translate3d(${L.lift.x - at.x}px, ${L.lift.y - at.y}px, ${L.lift.z}px) rotateZ(0deg) rotateX(-50deg) scale(${L.lift.scale})`;
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
                  aria-hidden={gathered || undefined}
                  style={
                    {
                      "--x": `${p.x}px`,
                      "--y": `${p.y}px`,
                      "--px": `${p.px}px`,
                      "--py": `${p.py}px`,
                      transform,
                      transitionDelay: delay,
                    } as React.CSSProperties
                  }
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
