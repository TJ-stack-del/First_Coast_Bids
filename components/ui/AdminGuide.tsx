"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AdminHowToContent } from "./AdminHowToContent";

// Admin-only in-app how-to, requested directly by Mike as something he can
// pull up without hunting for a separate document -- a slide-over drawer
// beats a PDF here because it lives in the same header on every admin page
// and can be read beside the bid being worked. The content itself lives in
// AdminHowToContent.tsx, shared with the full /admin/how-to page: edit it
// there, never here, so the two can't disagree.
//
// Plain <details>/<summary> per section rather than a hand-rolled accordion:
// fully keyboard- and screen-reader-operable with zero extra JS, and this
// is a reference panel, not a marketing surface -- native disclosure is the
// right tool, not a place to spend a custom interaction budget.
//
// Portalled into document.body (same pattern as Combobox.tsx's dropdown):
// this button renders inside AppShell's <header>, which has backdrop-blur.
// backdrop-filter establishes a containing block for position:fixed
// descendants, same as transform/filter/perspective would -- so without
// the portal, the drawer's "fixed inset-0" resolved against the ~65px
// header instead of the viewport, trapping the whole overlay and panel
// inside that sliver instead of covering the screen. A real reported bug,
// confirmed via a real screenshot showing exactly that.
export function AdminGuide() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="How to"
        aria-label="Open the how-to guide"
        className="w-11 h-11 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
      >
        <span className="material-symbols-outlined text-[22px]">help</span>
      </button>

      {open &&
        mounted &&
        createPortal(
          <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="How to">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-full sm:w-[480px] bg-surface shadow-2xl overflow-y-auto motion-reduce:transition-none">
            <div className="sticky top-0 bg-surface border-b border-outline-variant px-6 py-4 flex items-center justify-between gap-3">
              <h2 className="text-title-lg text-primary font-bold">How to</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="w-9 h-9 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="px-6 py-4">
              <a href="/admin/how-to" onClick={() => setOpen(false)} className="inline-block mb-3 text-body-sm text-primary font-bold underline">
                Open as a full page
              </a>
              <AdminHowToContent />
            </div>
          </div>
        </div>,
          document.body
        )}
    </>
  );
}
