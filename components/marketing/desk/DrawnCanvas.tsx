"use client";

import { useEffect, useRef } from "react";
import { drawBand, drawLand } from "./draw";

// A canvas that redraws itself when its box resizes or the web fonts land
// (the map's labels are set in the body face). Decorative: aria-hidden, with
// the content it shows given in text next to it.
const DRAW = { land: drawLand, band: drawBand };

export function DrawnCanvas({ kind }: { kind: keyof typeof DRAW }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const draw = () => DRAW[kind](cv);
    draw();
    let alive = true;
    document.fonts?.ready.then(() => alive && draw());
    let t: ReturnType<typeof setTimeout>;
    const ro = new ResizeObserver(() => {
      clearTimeout(t);
      t = setTimeout(draw, 120);
    });
    ro.observe(cv);
    return () => {
      alive = false;
      clearTimeout(t);
      ro.disconnect();
    };
  }, [kind]);

  return <canvas ref={ref} aria-hidden="true" />;
}
