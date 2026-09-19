"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

// Shared entrance-motion primitive for the marketing page -- one easing
// curve and one duration everywhere (Emil Kowalski's "200-300ms sweet
// spot", an ease-out-quint-ish curve), varied only by *when* it fires
// (mode) and *how* it moves (variant), so every section reads as the
// same authored system rather than a grab-bag of scroll-fade effects.
// Duration is 300ms (the top of that stated range) -- was 500ms, a real
// mismatch against this comment's own claim, caught by an emil-motion
// skill pass (2026-09-19) rather than by anyone actually re-reading the
// number against the comment above it.
// Same mount-gated useReducedMotion pattern as TransformationPipeline
// (see its own comment): the server always renders as if reduced motion
// were off, so gating on `mounted` keeps the first client render
// identical to the server's, then swaps to the plain, unanimated
// element a tick after hydration if the OS actually asks for it --
// never a fade the user asked to not see.
const EASE = [0.22, 1, 0.36, 1] as const;

type RevealProps = {
  children: ReactNode;
  as?: "div" | "li" | "article";
  className?: string;
  /** "view" (default) fires once the element scrolls into view; "mount" fires immediately, for above-the-fold content. */
  mode?: "view" | "mount";
  /** "rise" is a small fade + upward drift; "scale" is a fade + slight scale-in, for the numbered step badges. */
  variant?: "rise" | "scale";
  delay?: number;
};

export function Reveal({ children, as = "div", className, mode = "view", variant = "rise", delay = 0 }: RevealProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const prefersReducedMotion = useReducedMotion();
  const reduceMotion = mounted && prefersReducedMotion;

  // Own IntersectionObserver rather than framer-motion's built-in
  // whileInView -- a real, reproduced bug (confirmed via getComputedStyle
  // inspection, not just a screenshot glitch) found elements could get
  // permanently stuck at their hidden initial state under certain
  // scroll-and-pause timing patterns, since whileInView's own internal
  // viewport tracking has no fallback if its observer callback ever
  // misses. A directly-owned observer plus a hard timeout safety net (in
  // case the observer itself never fires at all) guarantees content is
  // never left permanently invisible, which a purely decorative entrance
  // animation must never risk.
  const ref = useRef<HTMLElement | null>(null);
  const [inView, setInView] = useState(mode === "mount");

  useEffect(() => {
    if (mode !== "view" || inView || reduceMotion) return;
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(node);

    // Safety net: if the observer never fires (a real, if rare, browser/
    // timing edge case) but the element is already on-screen, don't leave
    // it invisible forever.
    const fallback = window.setTimeout(() => {
      const rect = node.getBoundingClientRect();
      const visible = rect.top < window.innerHeight && rect.bottom > 0;
      if (visible) setInView(true);
    }, 2000);

    return () => {
      observer.disconnect();
      window.clearTimeout(fallback);
    };
  }, [mode, inView, reduceMotion]);

  if (reduceMotion) {
    if (as === "li") return <li className={className}>{children}</li>;
    if (as === "article") return <article className={className}>{children}</article>;
    return <div className={className}>{children}</div>;
  }

  const hidden = variant === "scale" ? { opacity: 0, scale: 0.92 } : { opacity: 0, y: 16 };
  const shown = { opacity: 1, y: 0, scale: 1 };
  const Component = as === "li" ? motion.li : as === "article" ? motion.article : motion.div;

  return (
    <Component
      ref={ref as React.RefObject<never>}
      className={className}
      initial={hidden}
      animate={inView ? shown : hidden}
      transition={{ duration: 0.3, delay, ease: EASE }}
    >
      {children}
    </Component>
  );
}
