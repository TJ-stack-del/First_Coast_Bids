"use client";

import { useEffect } from "react";

// A lighter sibling to ConfirmDeleteDialog.tsx -- that one requires typing
// the exact record name, appropriate for a real permanent delete with no
// undo. This is for a lower-stakes, reversible "are you sure" (e.g.
// overwriting draft text that hasn't even been saved yet) -- a review
// found DeliverablesPanel.tsx using the un-stylable, inconsistent browser-
// native window.confirm() for exactly this case instead of either of the
// app's own dialog patterns.
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Continue",
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
}) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="bg-surface-container-lowest rounded-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-title-lg text-on-surface font-bold mb-2">{title}</h2>
        <p className="text-body-md text-on-surface-variant mb-5">{description}</p>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded border border-outline-variant text-on-surface text-label-md hover:bg-surface-container-high transition active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded bg-primary-container text-on-primary-container text-label-md font-bold hover:opacity-90 transition active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
