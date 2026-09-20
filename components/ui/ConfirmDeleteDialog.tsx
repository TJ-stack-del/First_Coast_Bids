"use client";

import { useEffect, useState } from "react";
import { Spinner } from "./Spinner";

// Shared by the submission detail page's "Delete submission" action and
// the matched-opportunities review screen's per-row delete — both are
// real, permanent deletes with no undo, so both get the same real
// confirmation friction: typing the exact record name, not just a single
// "Are you sure?" click. Deliberately NOT a bulk-delete tool — one record
// at a time, admin-typed confirmation every time.
export function ConfirmDeleteDialog({
  open,
  onClose,
  onConfirm,
  confirmText,
  title,
  description,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  confirmText: string;
  title: string;
  description: string;
  busy: boolean;
}) {
  const [typed, setTyped] = useState("");

  const matches = typed === confirmText;

  function handleClose() {
    setTyped("");
    onClose();
  }

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="bg-surface-container-lowest rounded-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-title-lg text-error font-bold mb-2 flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px]">warning</span>
          {title}
        </h2>
        <p className="text-body-md text-on-surface-variant mb-4">{description}</p>
        <p className="text-body-md text-on-surface mb-2">
          Type <span className="font-bold break-words">{confirmText}</span> below to confirm. This is
          permanent.
        </p>
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          disabled={busy}
          className="w-full px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-error mb-4"
          autoFocus
        />
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={handleClose}
            disabled={busy}
            className="px-4 py-2 rounded border border-outline-variant text-on-surface text-label-md hover:bg-surface-container-high transition active:scale-[0.97] disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!matches || busy}
            className="px-4 py-2 rounded bg-error text-on-error text-label-md font-bold hover:opacity-90 transition active:scale-[0.97] disabled:opacity-40 flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error"
          >
            {busy && <Spinner />}
            {busy ? "Deleting…" : "Delete permanently"}
          </button>
        </div>
      </div>
    </div>
  );
}
