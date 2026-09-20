"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type ComboboxOption = { id: string; label: string };

// Searchable replacement for a plain <select> — built from real divs/
// buttons rather than the browser's own <option> list specifically so the
// dropdown can be themed (background, border, hover state) at all. A
// native <select>'s open dropdown is rendered by the OS, not the page, so
// no amount of CSS reaches it — it always shows the platform's own
// default list chrome (including the "OS blue" hover this was built to
// get rid of) regardless of the trigger element's own styling.
//
// The dropdown itself portals into document.body rather than rendering
// inline: both real call sites (MatchesPanel's table and card list) wrap
// their rows in an `overflow-hidden` container (needed for its own
// rounded corners), which would otherwise silently clip an absolutely-
// positioned dropdown for any row near the bottom of that container.
export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Select…",
  emptyMessage = "No matches",
  className = "",
}: {
  options: ComboboxOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = options.find((o) => o.id === value);

  // Portal target isn't available during SSR/first render; matches this
  // codebase's usual mounted-gate pattern for anything client-only.
  useEffect(() => setMounted(true), []);

  function openDropdown() {
    const el = inputRef.current;
    if (el) {
      const r = el.getBoundingClientRect();
      // The trigger input is deliberately narrow to fit a table column/
      // card row (see callers' own comments), but the dropdown itself
      // needs real room for long client names -- reusing the input's own
      // width here made every option wrap across 4-5 lines. Widened to a
      // sensible minimum and nudged left if that would run past the
      // viewport's right edge.
      const width = Math.max(r.width, 240);
      const left = Math.min(r.left, window.innerWidth - width - 8);
      setRect({ top: r.bottom + 4, left: Math.max(8, left), width });
    }
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    // Closing on scroll (rather than continuously repositioning) is the
    // same simplification most lightweight comboboxes make — the
    // `position: fixed` rect above would otherwise go stale the instant
    // any ancestor scrolls.
    function handleScroll() {
      setOpen(false);
      setQuery("");
    }
    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleScroll);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleScroll);
    };
  }, [open]);

  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  function select(option: ComboboxOption) {
    onChange(option.id);
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
  }

  return (
    <div ref={containerRef} className={`relative min-w-0 ${className}`}>
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        value={open ? query : selected?.label ?? ""}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!open) openDropdown();
        }}
        onFocus={openDropdown}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            setQuery("");
            inputRef.current?.blur();
          } else if (e.key === "Enter" && filtered.length > 0) {
            e.preventDefault();
            select(filtered[0]);
          }
        }}
        placeholder={placeholder}
        className="w-full px-2 py-1.5 rounded border border-outline-variant bg-surface text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-primary min-w-0"
      />
      {open &&
        mounted &&
        rect &&
        createPortal(
          <ul
            role="listbox"
            style={{ position: "fixed", top: rect.top, left: rect.left, width: rect.width }}
            className="z-50 max-h-56 overflow-auto rounded-lg border border-outline-variant bg-surface-container-lowest shadow-lg py-1"
          >
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-body-sm text-on-surface-variant">{emptyMessage}</li>
            )}
            {filtered.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={o.id === value}
                  // onMouseDown (not onClick) fires before the input's own
                  // blur -- a plain onClick here would never run, since
                  // the click-outside handling above would already have
                  // closed and unmounted this list first.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    select(o);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-body-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ${
                    o.id === value
                      ? "bg-primary-container/50 text-on-surface font-semibold"
                      : "text-on-surface hover:bg-surface-container-high"
                  }`}
                >
                  {o.label}
                </button>
              </li>
            ))}
          </ul>,
          document.body
        )}
    </div>
  );
}
