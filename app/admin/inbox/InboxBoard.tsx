"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Submission = {
  id: string;
  agency: string;
  solicitation_number: string | null;
  stage: string;
  due_date: string | null;
  is_test: boolean;
  draft: boolean;
  submitted_at: string | null;
  estimated_value: number | null;
  clients: { company_name: string } | null;
  pastPromise: boolean;
  isStale: boolean;
  deliverablesDrafted: number;
};

const STAGE_ORDER = [
  "submitted",
  "in_review",
  "deliverables_ready",
  "client_review",
  "closed",
] as const;

// Closed work is done — showing that column by default would clutter the
// board with finished work instead of what actually needs attention today.
// Reachable via the "Show closed" toggle instead of an always-on 5-column
// board.
const ACTIVE_STAGES = new Set<string>(["submitted", "in_review", "deliverables_ready", "client_review"]);

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// Same $-thousands shorthand the deliverables/pricing side of the app
// already uses for estimated_value — never invents a figure, just formats
// the real admin-entered one (or renders nothing if it's null).
function formatValue(value: number | null): string | null {
  if (value == null) return null;
  if (value >= 1000) return `$${Math.round(value / 1000)}k`;
  return `$${value.toLocaleString()}`;
}

export function InboxBoard({
  submissions,
  stageLabels,
  stagePillStyle,
  stageDescriptions,
  stageDotColor,
}: {
  submissions: Submission[];
  stageLabels: Record<string, string>;
  stagePillStyle: Record<string, string>;
  stageDescriptions: Record<string, string>;
  stageDotColor: Record<string, string>;
}) {
  const [view, setView] = useState<"board" | "list">("board");
  const [needsAttentionOnly, setNeedsAttentionOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"fifo" | "due">("fifo");
  const [includeTest, setIncludeTest] = useState(true);
  const [showClosed, setShowClosed] = useState(false);

  // Same pastPromise/isStale flags the daily-digest cron already emails out
  // (app/api/daily-digest/route.ts), computed here (not passed down as
  // separate count props from page.tsx) so the alert pill below can live
  // next to the "Needs attention only" checkbox it drives. Test rows never
  // contribute, same as the footer strip's own openSubmissions figures.
  const openSubmissions = submissions.filter((s) => s.stage !== "closed" && !s.is_test);
  const pastPromiseCount = openSubmissions.filter((s) => s.pastPromise).length;
  const staleCount = openSubmissions.filter((s) => s.isStale && !s.pastPromise).length;

  const filtered = useMemo(() => {
    let rows = submissions;
    if (!includeTest) rows = rows.filter((s) => !s.is_test);
    if (needsAttentionOnly) rows = rows.filter((s) => s.pastPromise || s.isStale);

    // is_test stays the primary sort key regardless of mode — a test row
    // never gets to jump ahead of real ones just because its due date or
    // submission time is earlier, same invariant the original FIFO query
    // enforced at the DB level.
    const sorted = [...rows].sort((a, b) => {
      if (a.is_test !== b.is_test) return a.is_test ? 1 : -1;
      if (sortBy === "due") {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }
      const aTime = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
      const bTime = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
      return aTime - bTime;
    });
    return sorted;
  }, [submissions, includeTest, needsAttentionOnly, sortBy]);

  const visibleStages = STAGE_ORDER.filter((s) => showClosed || ACTIVE_STAGES.has(s));

  // Clicking the pill toggles the "Needs attention only" checkbox below it
  // (part of `controls`) rather than just being an inert count -- an admin
  // who sees "3 submissions past turnaround" can jump straight to that
  // filtered view in one click instead of hunting for the checkbox.
  const attentionBanner = (pastPromiseCount > 0 || staleCount > 0) && (
    <button
      type="button"
      onClick={() => setNeedsAttentionOnly((v) => !v)}
      aria-pressed={needsAttentionOnly}
      title="Click to toggle the “Needs attention only” filter"
      className={`w-full text-left bg-surface-container-low px-gutter py-3 rounded-xl shadow-md flex flex-wrap items-center gap-3 transition hover:bg-surface-container-high active:scale-[0.99] mt-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
        needsAttentionOnly ? "ring-2 ring-primary" : ""
      }`}
    >
      <span className="material-symbols-outlined text-primary-container text-lg">timer</span>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm">
        {pastPromiseCount > 0 && (
          <span className="text-on-surface">
            <strong className="font-bold">{pastPromiseCount}</strong>{" "}
            {pastPromiseCount === 1 ? "submission" : "submissions"} past the 48-hour turnaround
          </span>
        )}
        {pastPromiseCount > 0 && staleCount > 0 && <span className="text-outline-variant">•</span>}
        {staleCount > 0 && (
          <span className="text-error font-medium">
            <strong className="font-bold">{staleCount}</strong> {staleCount === 1 ? "submission" : "submissions"}{" "}
            untouched for 3+ days
          </span>
        )}
      </div>
    </button>
  );

  const controls = (
    <div className="flex flex-wrap items-center gap-3 mt-4 mb-2">
      <div className="inline-flex rounded-lg border border-outline-variant overflow-hidden">
        <button
          type="button"
          onClick={() => setView("board")}
          className={`px-3 py-1.5 text-label-md font-semibold transition active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ${
            view === "board" ? "bg-primary-container text-on-primary-container" : "bg-surface-container-lowest text-on-surface hover:bg-surface-container-low"
          }`}
        >
          Board
        </button>
        <button
          type="button"
          onClick={() => setView("list")}
          className={`px-3 py-1.5 text-label-md font-semibold transition active:scale-[0.97] border-l border-outline-variant focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ${
            view === "list" ? "bg-primary-container text-on-primary-container" : "bg-surface-container-lowest text-on-surface hover:bg-surface-container-low"
          }`}
        >
          List
        </button>
      </div>

      <label className="inline-flex items-center gap-2 text-label-md text-on-surface-variant cursor-pointer">
        <input
          type="checkbox"
          checked={needsAttentionOnly}
          onChange={(e) => setNeedsAttentionOnly(e.target.checked)}
          className="rounded"
        />
        Needs attention only
      </label>

      <label className="inline-flex items-center gap-2 text-label-md text-on-surface-variant cursor-pointer">
        <input type="checkbox" checked={includeTest} onChange={(e) => setIncludeTest(e.target.checked)} className="rounded" />
        Include test submissions
      </label>

      {view === "board" && (
        <label className="inline-flex items-center gap-2 text-label-md text-on-surface-variant cursor-pointer">
          <input
            type="checkbox"
            checked={showClosed}
            onChange={(e) => setShowClosed(e.target.checked)}
            className="rounded"
          />
          Show closed
        </label>
      )}

      <label className="inline-flex items-center gap-2 text-label-md text-on-surface-variant ml-auto">
        Sort
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as "fifo" | "due")}
          className="bg-surface-container-lowest border border-outline-variant rounded px-2 py-1 text-label-md text-on-surface outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
        >
          <option value="fifo">Submission order</option>
          <option value="due">Due date</option>
        </select>
      </label>
    </div>
  );

  function AttentionBadge({ sub }: { sub: Submission }) {
    if (sub.pastPromise) {
      return (
        <span className="inline-flex px-2.5 py-1 rounded-full text-label-sm font-bold bg-error text-on-error uppercase">
          Past due
        </span>
      );
    }
    if (sub.isStale) {
      return (
        <span className="inline-flex px-2.5 py-1 rounded-full text-label-sm font-medium bg-surface-container-highest text-on-surface-variant">
          Needs attention
        </span>
      );
    }
    return null;
  }

  if (view === "board") {
    return (
      <div>
        {attentionBanner}
        {controls}
        {/* Stacked full-width columns below sm (horizontal scroll reads worse
            than a normal scrolling page on a ~380px phone); side-by-side with
            horizontal scroll from sm up, where reaching a column is a single
            swipe/scroll instead of the whole page's only scroll direction. */}
        <div className="animate-view-swap flex flex-col sm:flex-row gap-4 sm:overflow-x-auto pb-2">
          {visibleStages.map((stage) => {
            const cards = filtered.filter((s) => s.stage === stage);
            return (
              <div key={stage} className="w-full sm:flex-none sm:w-80 bg-surface-container-low p-2 rounded-xl flex flex-col gap-2">
                <div className="px-1 pt-1 flex flex-col gap-0.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded ${stageDotColor[stage] ?? "bg-outline"}`} />
                      <h2 className="text-[15px] font-headline uppercase tracking-wide font-bold text-on-surface">
                        {stageLabels[stage] ?? stage}
                      </h2>
                    </div>
                    <span className="px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface font-code text-body-sm font-bold">
                      {cards.length}
                    </span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant leading-tight">
                    {stageDescriptions[stage] ?? ""}
                  </p>
                </div>
                <div className="flex flex-col gap-2 min-h-[80px]">
                  {cards.map((sub) => {
                    const formattedValue = formatValue(sub.estimated_value);
                    return (
                      <Link
                        key={sub.id}
                        href={`/admin/inbox/${sub.id}`}
                        className={`bg-surface-container p-3 rounded-lg shadow-sm hover:bg-surface-container-high transition-colors flex flex-col gap-2 group focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                          sub.is_test ? "opacity-80" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-col min-w-0">
                            <span className="text-[11px] font-code text-primary font-bold">
                              {sub.solicitation_number || "No solicitation #"}
                            </span>
                            <span className="text-body-md font-headline font-bold text-on-surface line-clamp-1 group-hover:text-primary transition-colors">
                              {sub.clients?.company_name ?? "—"}
                            </span>
                          </div>
                          {sub.is_test ? (
                            <span className="px-2 py-0.5 rounded bg-surface-bright text-on-surface-variant text-[10px] font-bold uppercase whitespace-nowrap">
                              Test
                            </span>
                          ) : (
                            <AttentionBadge sub={sub} />
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-body-sm text-on-surface-variant min-w-0">
                          <span className="material-symbols-outlined text-xs text-outline shrink-0">account_balance</span>
                          <span className="truncate">{sub.agency}</span>
                        </div>
                        {(() => {
                          const showDrafted = stage !== "submitted" && stage !== "closed";
                          if (!formattedValue && !sub.due_date && !showDrafted) return null;
                          return (
                            <div
                              className={`bg-surface-container-lowest p-1.5 rounded grid gap-1 text-center ${
                                showDrafted ? "grid-cols-3" : "grid-cols-2"
                              }`}
                            >
                              <div className="flex flex-col">
                                <span className="text-[9px] text-on-surface-variant uppercase font-code">Est. value</span>
                                <span className="text-body-sm text-on-surface font-bold font-code">
                                  {formattedValue ?? "—"}
                                </span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[9px] text-on-surface-variant uppercase font-code">Due</span>
                                <span className="text-body-sm text-on-surface font-bold font-code">
                                  {sub.due_date ? new Date(sub.due_date).toLocaleDateString() : "—"}
                                </span>
                              </div>
                              {showDrafted && (
                                <div className="flex flex-col">
                                  <span className="text-[9px] text-on-surface-variant uppercase font-code">Drafted</span>
                                  <span
                                    className={`text-body-sm font-bold font-code ${
                                      sub.deliverablesDrafted >= 3 ? "text-secondary" : "text-on-surface"
                                    }`}
                                  >
                                    {sub.deliverablesDrafted} of 3
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </Link>
                    );
                  })}
                  {cards.length === 0 && <p className="text-label-sm text-on-surface-variant px-1 py-3 text-center">Empty</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div>
      {attentionBanner}
      {controls}
      {/* Table — only once there's comfortably enough width for six columns
          of real content (long agency names, badges) without cutting
          anything off. Below that, a stacked card per submission instead —
          see the xl:hidden block below. */}
      <div className="animate-view-swap hidden xl:block bg-surface-container-lowest border border-outline-variant rounded-xl">
        <table className="w-full text-body-md table-fixed">
          <thead className="bg-surface-container-low">
            <tr>
              <th className="text-left px-4 py-3 text-label-md text-on-surface-variant uppercase tracking-wider w-[26%]">Client</th>
              <th className="text-left px-4 py-3 text-label-md text-on-surface-variant uppercase tracking-wider w-[24%]">Agency</th>
              <th className="text-left px-4 py-3 text-label-md text-on-surface-variant uppercase tracking-wider w-[14%]">Stage</th>
              <th className="text-left px-4 py-3 text-label-md text-on-surface-variant uppercase tracking-wider w-[14%]">Attention</th>
              <th className="text-left px-4 py-3 text-label-md text-on-surface-variant uppercase tracking-wider w-[12%]">Due</th>
              <th className="text-left px-4 py-3 text-label-md text-on-surface-variant uppercase tracking-wider w-[10%]"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((sub) => (
              <tr key={sub.id} className="border-t border-outline-variant hover:bg-surface-container-low transition">
                <td className="px-4 py-3 text-on-surface">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-primary-fixed text-on-primary-fixed flex items-center justify-center text-label-sm font-bold shrink-0">
                      {initials(sub.clients?.company_name ?? "—")}
                    </div>
                    <div className="min-w-0">
                      <span className="font-semibold break-words">{sub.clients?.company_name ?? "—"}</span>
                      {sub.is_test && (
                        <span className="ml-2 text-[10px] px-2 py-0.5 rounded bg-surface-container-highest text-on-surface-variant font-bold uppercase">
                          Test
                        </span>
                      )}
                      {sub.draft && (
                        <span className="ml-2 text-[10px] px-2 py-0.5 rounded bg-surface-container-highest text-on-surface-variant font-bold uppercase">
                          Draft
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-on-surface-variant break-words">{sub.agency}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex px-2.5 py-1 rounded-full text-label-sm font-medium ${
                      stagePillStyle[sub.stage] ?? "bg-surface-container-high text-on-surface-variant"
                    }`}
                  >
                    {stageLabels[sub.stage] ?? sub.stage}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <AttentionBadge sub={sub} />
                  {!sub.pastPromise && !sub.isStale && <span className="text-on-surface-variant">—</span>}
                </td>
                <td className="px-4 py-3 text-on-surface-variant">
                  {sub.due_date ? new Date(sub.due_date).toLocaleDateString() : "—"}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/inbox/${sub.id}`}
                    className="inline-flex px-3 py-1.5 rounded bg-primary-container text-on-primary-container text-label-md font-semibold hover:opacity-90 hover:-translate-y-0.5 transition active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-on-surface-variant">
                  No submissions match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Card list — narrower than xl (laptop widths with less room, and
          mobile). Same data, stacked instead of columned, so nothing is
          ever cut off or forces sideways scrolling. */}
      <div className="animate-view-swap xl:hidden bg-surface-container-lowest border border-outline-variant rounded-xl divide-y divide-outline-variant">
        {filtered.map((sub) => (
          <Link
            key={sub.id}
            href={`/admin/inbox/${sub.id}`}
            className="flex flex-col gap-3 px-4 py-4 hover:bg-surface-container-low transition focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-primary-fixed text-on-primary-fixed flex items-center justify-center text-label-sm font-bold shrink-0">
                  {initials(sub.clients?.company_name ?? "—")}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-on-surface break-words">{sub.clients?.company_name ?? "—"}</p>
                  <p className="text-label-md text-on-surface-variant break-words">{sub.agency}</p>
                </div>
              </div>
              <span className="shrink-0 inline-flex px-3 py-1.5 rounded bg-primary-container text-on-primary-container text-label-md font-semibold">
                Open
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex px-2.5 py-1 rounded-full text-label-sm font-medium ${
                  stagePillStyle[sub.stage] ?? "bg-surface-container-high text-on-surface-variant"
                }`}
              >
                {stageLabels[sub.stage] ?? sub.stage}
              </span>
              <AttentionBadge sub={sub} />
              {sub.is_test && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-surface-container-highest text-on-surface-variant font-bold uppercase">
                  Test
                </span>
              )}
              {sub.draft && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-surface-container-highest text-on-surface-variant font-bold uppercase">
                  Draft
                </span>
              )}
              <span className="text-label-md text-on-surface-variant ml-auto">
                {sub.due_date ? `Due ${new Date(sub.due_date).toLocaleDateString()}` : "No due date"}
              </span>
            </div>
          </Link>
        ))}
        {filtered.length === 0 && (
          <p className="px-4 py-6 text-center text-on-surface-variant">No submissions match the current filters.</p>
        )}
      </div>
    </div>
  );
}
