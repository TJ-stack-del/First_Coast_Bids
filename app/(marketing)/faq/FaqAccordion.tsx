"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

const EASE = [0.22, 1, 0.36, 1] as const;

export function FaqAccordion({ faqs }: { faqs: { q: string; a: string }[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const prefersReducedMotion = useReducedMotion();
  const reduceMotion = mounted && prefersReducedMotion;

  return (
    <div className="flex flex-col gap-2">
      {faqs.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <div key={item.q} className="border border-outline-variant rounded-lg bg-surface-container-lowest overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="w-full flex items-center justify-between gap-4 px-gutter py-4 text-left hover:bg-surface-container-low transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
            >
              <span className="text-title-lg text-primary">{item.q}</span>
              {/* A single "add" glyph rotated 45deg reads as a plus becoming
                  an x -- no icon swap, so the only thing that ever moves is
                  a transform (GPU-accelerated, per the animation skill's own
                  "only animate transform and opacity" rule). */}
              <motion.span
                className="material-symbols-outlined text-on-surface-variant shrink-0"
                animate={{ rotate: isOpen ? 45 : 0 }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: EASE }}
              >
                add
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen &&
                (reduceMotion ? (
                  <p className="text-body-md text-on-surface-variant px-gutter pb-4">{item.a}</p>
                ) : (
                  <motion.div
                    key="content"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: EASE }}
                    style={{ overflow: "hidden" }}
                  >
                    <p className="text-body-md text-on-surface-variant px-gutter pb-4">{item.a}</p>
                  </motion.div>
                ))}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
