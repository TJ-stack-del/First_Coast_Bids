"use client";

import { useEffect, useRef } from "react";

// A thin bar along the top of a guide article showing how far you've read.
// Transform only; hidden from assistive tech, which has the page itself.
export function ReadingProgress() {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const p = max > 0 ? Math.min(1, window.scrollY / max) : 0;
        if (bar.current) bar.current.style.transform = `scaleX(${p})`;
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <div aria-hidden="true" className="fixed left-0 right-0 top-0 z-[60] h-[3px] bg-transparent pointer-events-none">
      <div ref={bar} className="h-full origin-left bg-[#C19349]" style={{ transform: "scaleX(0)" }} />
    </div>
  );
}
