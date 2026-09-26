"use client";

import Link from "next/link";
import { useState } from "react";
import type { ClientTask } from "@/lib/dashboard/client-tasks";
import s from "@/components/marketing/press.module.css";

// The client dashboard's two lists (docs/superpowers/specs/
// 2026-09-26-client-area-redesign-design.md): "Needs you" first, one row
// per waiting bid with the one thing to do, then every bid as a one-line
// row that opens to its full details. One row open at a time, so a client
// with a dozen bids scans a short list instead of a dozen full cards.

export type BidRow = {
  id: string;
  title: string;
  solicitation: string | null;
  due: string | null;
  standing: string;
  needsAction: boolean;
  completed: boolean;
  isTest: boolean;
  // Warnings that must stay visible while the row is closed (below the
  // wage-law floor, a mandatory site visit).
  flags: string[];
  detail: React.ReactNode;
};

type Filter = "all" | "needs_action" | "completed";

function Meta({ solicitation, due }: { solicitation: string | null; due: string | null }) {
  return (
    <>
      {solicitation && <span className="font-code">{solicitation}</span>}
      {due && (
        <span>
          Due <span className="font-code">{due}</span>
        </span>
      )}
    </>
  );
}

export function BidLedger({ rows, tasks }: { rows: BidRow[]; tasks: ClientTask[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const rowsById = new Map(rows.map((r) => [r.id, r]));

  // Opens the bid's row (showing every bid again if a filter hid it), moves
  // focus to the row, and scrolls to the part the task is about: the
  // checklist for open items, the deliverables for a package review.
  function openBid(task: ClientTask) {
    const id = task.bidId;
    setFilter("all");
    setOpenId(id);
    requestAnimationFrame(() => {
      const row = document.getElementById(`bid-${id}`);
      const part =
        task.kind === "items"
          ? document.getElementById(`bid-${id}-checklist`)
          : task.kind === "review"
            ? document.getElementById(`bid-${id}-deliverables`)
            : null;
      (part ?? row)?.scrollIntoView({ behavior: "smooth", block: "start" });
      (row?.querySelector("[data-bid-toggle]") as HTMLElement | null)?.focus({ preventScroll: true });
    });
  }

  const counts = {
    all: rows.length,
    needs_action: rows.filter((r) => r.needsAction).length,
    completed: rows.filter((r) => r.completed).length,
  };
  const visible = rows.filter((r) =>
    filter === "all" ? true : filter === "needs_action" ? r.needsAction : r.completed
  );
  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "needs_action", label: "Needs you" },
    { key: "completed", label: "Done" },
  ];

  return (
    <>
      <section aria-labelledby="needs-you" className="flex flex-col gap-4">
        <h2 id="needs-you" className="text-headline-md">
          Needs you
        </h2>
        {tasks.length === 0 ? (
          <p className="text-body-md text-on-surface-variant">
            Nothing needs you right now. We&apos;ll email you when something does.
          </p>
        ) : (
          <div className={s.ledger}>
            {tasks.map((task) => {
              const row = rowsById.get(task.bidId);
              return (
                <article key={task.bidId} className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-title-lg text-on-surface">{row?.title}</h3>
                    <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-body-sm text-on-surface-variant">
                      <Meta solicitation={row?.solicitation ?? null} due={row?.due ?? null} />
                    </p>
                  </div>
                  {task.kind === "profile" ? (
                    <Link href="/dashboard/profile" className={`${s.btn} ${s.btnPrimary} shrink-0`}>
                      {task.label}
                    </Link>
                  ) : (
                    <button type="button" onClick={() => openBid(task)} className={`${s.btn} ${s.btnPrimary} shrink-0`}>
                      {task.label}
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section aria-labelledby="all-bids" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h2 id="all-bids" className="text-headline-md">
            All your bids
          </h2>
          <div className="flex gap-1" role="group" aria-label="Show">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                aria-pressed={filter === f.key}
                onClick={() => setFilter(f.key)}
                className={`min-h-[44px] px-3 text-label-md rounded underline-offset-8 decoration-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                  filter === f.key ? "text-primary font-bold underline" : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {f.label} <span className="font-code">({counts[f.key]})</span>
              </button>
            ))}
          </div>
        </div>

        {visible.length === 0 ? (
          <p className="text-body-md text-on-surface-variant">Nothing in this view yet.</p>
        ) : (
          <div className={s.ledger}>
            {visible.map((row) => {
              const open = openId === row.id;
              return (
                <article key={row.id} id={`bid-${row.id}`} className="!py-0 scroll-mt-24">
                  <h3>
                    <button
                      type="button"
                      data-bid-toggle
                      aria-expanded={open}
                      aria-controls={`bid-${row.id}-detail`}
                      onClick={() => setOpenId(open ? null : row.id)}
                      className="w-full min-h-[56px] py-4 flex items-start gap-4 text-left rounded focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary group"
                    >
                      <span className="flex-1 min-w-0 flex flex-col gap-1">
                        <span className="text-title-lg text-on-surface group-hover:text-primary">
                          {row.title}
                          {row.isTest && (
                            <span className="ml-2 align-middle px-1.5 py-0.5 border border-outline-variant text-label-sm text-on-surface-variant">
                              Test
                            </span>
                          )}
                        </span>
                        <span className="flex flex-wrap gap-x-4 gap-y-1 text-body-sm text-on-surface-variant">
                          <span>{row.standing}</span>
                          <Meta solicitation={row.solicitation} due={row.due} />
                        </span>
                        {row.flags.length > 0 && (
                          <span className="flex flex-wrap gap-2 mt-1">
                            {row.flags.map((f) => (
                              <span key={f} className="inline-flex items-center gap-1 text-body-sm font-bold text-error">
                                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                                  warning
                                </span>
                                {f}
                              </span>
                            ))}
                          </span>
                        )}
                      </span>
                      <span
                        className={`material-symbols-outlined shrink-0 mt-1 text-on-surface-variant transition-transform duration-200 ease-out motion-reduce:transition-none ${
                          open ? "rotate-180" : ""
                        }`}
                        aria-hidden="true"
                      >
                        expand_more
                      </span>
                    </button>
                  </h3>
                  {open && (
                    <div
                      id={`bid-${row.id}-detail`}
                      role="region"
                      aria-label={`Details: ${row.title}`}
                      className="animate-disclose pb-6"
                    >
                      {row.detail}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
