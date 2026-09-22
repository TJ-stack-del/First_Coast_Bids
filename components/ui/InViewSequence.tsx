"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Arms a one-shot CSS sequence (see `.motion-sequence` in globals.css) the
// first time this block scrolls into view. The server render carries no
// data-played attribute at all, so with JS off -- or before hydration --
// every mark and stamp inside is simply shown in its finished state. After
// mount it flips to "false" (hidden, ready to play) only if the block isn't
// already on screen, then to "true" once it is. Same observer-plus-timeout
// safety net as Reveal.tsx, for the same reason: a decorative sequence must
// never be able to leave real content hidden.
export function InViewSequence({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [played, setPlayed] = useState<"false" | "true" | undefined>(undefined);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    setPlayed("false");

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPlayed("true");
          observer.disconnect();
        }
      },
      { threshold: 0.35 }
    );
    observer.observe(node);

    const fallback = window.setTimeout(() => {
      const rect = node.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) setPlayed("true");
    }, 2000);

    return () => {
      observer.disconnect();
      window.clearTimeout(fallback);
    };
  }, []);

  return (
    <div ref={ref} className={`motion-sequence ${className ?? ""}`} data-played={played}>
      {children}
    </div>
  );
}
