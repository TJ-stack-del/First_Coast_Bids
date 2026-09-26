"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { MatchFilters, MatchStatus } from "@/lib/matches/rules";
import { notifyClientOfMatch } from "@/lib/matches/notify-client";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/Spinner";
import { Combobox } from "@/components/ui/Combobox";
import { ConfirmDeleteDialog } from "@/components/ui/ConfirmDeleteDialog";
import { RfpDocumentUpload, type ExtractedBidFields } from "@/components/ui/RfpDocumentUpload";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { opportunityTradeTag } from "@/lib/opportunity-trade-tag";
import { clientTradeLabel, clientTradeIds } from "@/lib/trades/naics-options";
import type { Trade } from "@/lib/trades/types";
import { tradeFieldsForInsert } from "@/lib/trades/classify";
import { useToast } from "@/components/Toast";

type Match = {
  id: string;
  source_title: string;
  source_agency: string;
  source_url: string | null;
  scope: string | null;
  solicitation_number: string | null;
  due_date: string | null;
  match_score: number | null;
  status: string;
  assigned_client_id: string | null;
  naics_code: string | null;
  trade_id: string | null;
  suggested_client_id: string | null;
  created_at: string;
};

type Client = { id: string; company_name: string; naics_codes: string[] };

// "Acme Electric" tells an admin nothing about what Acme Electric does --
// this is the real gap a user reported: the assign picker had no way to
// tell an electrician apart from a janitorial company. Falls back to
// flagging the gap explicitly (rather than silently showing the name
// alone) when a client's own Company Profile never set a NAICS code, so
// an incomplete profile is visible instead of looking the same as "no
// trade info available at all."
function clientOptionLabel(client: Client, trades: Trade[]): string {
  const trade = clientTradeLabel(client.naics_codes, trades);
  return trade ? `${client.company_name} — ${trade}` : `${client.company_name} (no trade set)`;
}

// Real urgency signal computed from the real due_date -- no invented SLA
// countdown, just how many days out the actual deadline is.
// A real gap this fixes: a scraped opportunity nobody assigned or
// dismissed before its own due date passed used to render in the exact
// same neutral gray as a comfortably-far-off date -- an admin scanning
// the list had no visual way to tell a dead lead from a fine one. Only
// flagged for `status === "new"`: an expired row that's already been
// assigned or dismissed has been handled, so calling it out again would
// be noise, not signal. Since 2026-09-22 the daily scrape also moves these
// to "expired" 24h after their deadline (app/api/scrape, lib/matches/rules),
// so "Past due" is only ever shown for that last day.
function dueDateInfo(dueDate: string | null, status: string): { label: string; className: string } {
  if (!dueDate) return { label: "—", className: "text-on-surface-variant" };
  const days = Math.ceil((new Date(dueDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  const date = new Date(dueDate).toLocaleDateString();
  if (days < 0) {
    if (status === "new") return { label: `${date} · Past due`, className: "text-error font-bold" };
    return { label: date, className: "text-on-surface-variant" };
  }
  if (days <= 3) return { label: `${date} · ${days}d left`, className: "text-error font-bold" };
  if (days <= 10) return { label: `${date} · ${days}d left`, className: "text-primary font-bold" };
  return { label: date, className: "text-on-surface-variant" };
}

type TabKey = MatchStatus | "all";

const TABS: { key: TabKey; label: string }[] = [
  { key: "new", label: "New" },
  { key: "assigned", label: "Assigned" },
  { key: "dismissed", label: "Dismissed" },
  { key: "expired", label: "Expired" },
  { key: "all", label: "All" },
];

const DEFAULT_FILTERS: MatchFilters = {
  view: "trades",
  status: "new",
  deadline: "any",
  source: "all",
  suggested: false,
  q: "",
  sort: "deadline",
  page: 1,
};

// Serializes only non-default values, so the plain /admin/matches URL is
// the default view and shared links stay short.
function filtersHref(pathname: string, f: MatchFilters): string {
  const params = new URLSearchParams();
  if (f.view !== DEFAULT_FILTERS.view) params.set("view", f.view);
  if (f.status !== DEFAULT_FILTERS.status) params.set("status", f.status);
  if (f.deadline !== DEFAULT_FILTERS.deadline) params.set("deadline", f.deadline);
  if (f.source !== DEFAULT_FILTERS.source) params.set("source", f.source);
  if (f.suggested) params.set("suggested", "1");
  if (f.q) params.set("q", f.q);
  if (f.sort !== DEFAULT_FILTERS.sort) params.set("sort", f.sort);
  if (f.page > 1) params.set("page", String(f.page));
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

// Only live rows can be bulk-dismissed; assigned ones are real client work
// and dismissed ones are already out of the queue.
function isSelectable(m: Match): boolean {
  return m.status === "new" || m.status === "expired";
}

export function MatchesPanel({
  orgId,
  actorId,
  initialMatches,
  clients,
  trades,
  viewCounts,
  filters,
  counts,
  totalForView,
  pageSize,
  loadError,
}: {
  orgId: string;
  actorId: string;
  initialMatches: Match[];
  clients: Client[];
  trades: Trade[];
  viewCounts: { trades: number; other: number };
  filters: MatchFilters;
  counts: Record<TabKey, number>;
  totalForView: number;
  pageSize: number;
  loadError: string | null;
}) {
  const [matches, setMatches] = useState(initialMatches);
  // router.refresh() (after bulk actions, logging, restoring) re-renders
  // the server page with the same filters, so this component isn't
  // remounted -- sync the fresh rows in explicitly.
  useEffect(() => setMatches(initialMatches), [initialMatches]);
  const router = useRouter();
  const pathname = usePathname();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [assignSelections, setAssignSelections] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Match | null>(null);
  const [deleting, setDeleting] = useState(false);
  // A real ops test (Carlos Mendez persona, 2026-09-16) assigned a
  // Construction/Renovation opportunity to a janitorial-only client with
  // zero warning -- the trade tags were already computed and shown on
  // screen (TradeTagBadge, clientOptionLabel) but never actually checked
  // against each other before the write went through. Non-blocking: only
  // interrupts when both trades are known AND they disagree.
  const [mismatchTarget, setMismatchTarget] = useState<{ matchId: string; opportunityTrade: string; clientTrade: string } | null>(null);

  const [logging, setLogging] = useState(false);
  const [title, setTitle] = useState("");
  const [agency, setAgency] = useState("");
  const [scope, setScope] = useState("");
  const [solicitationNumber, setSolicitationNumber] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [searchDraft, setSearchDraft] = useState(filters.q);

  const supabase = createClient();
  const { showToast } = useToast();

  function clientName(clientId: string | null) {
    return clients.find((c) => c.id === clientId)?.company_name ?? "—";
  }

  // Filtering now happens server-side (see page.tsx); this list is exactly
  // the current page of the current view.
  const filteredMatches = matches;
  const selectableIds = matches.filter(isSelectable).map((m) => m.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  // Any filter change goes back to page 1 -- page 4 of the old view means
  // nothing in the new one.
  function applyFilters(patch: Partial<MatchFilters>) {
    router.push(filtersHref(pathname, { ...filters, page: 1, ...patch }));
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(selectableIds));
  }

  // Scoped to the exact ids an admin checked on screen AND still in a
  // dismissible state, then verified by count -- the confirm dialog showed
  // that same count before anything ran (see CLAUDE.md's bulk-modify rule).
  async function handleBulkDismiss() {
    const ids = [...selected];
    if (ids.length === 0) return;
    setBulkBusy(true);

    const { data, error } = await supabase
      .from("matched_opportunities")
      .update({ status: "dismissed" })
      .eq("org_id", orgId)
      .in("id", ids)
      .in("status", ["new", "expired"])
      .select("id");

    setBulkBusy(false);
    setBulkConfirmOpen(false);

    if (error) {
      showToast(error.message, "error");
      return;
    }

    const changed = data ?? [];
    await supabase.from("audit_log").insert({
      org_id: orgId,
      actor_id: actorId,
      event_type: "matched_opportunities_bulk_dismissed",
      event_detail: { count: changed.length, matched_opportunity_ids: changed.map((m) => m.id) },
    });

    setSelected(new Set());
    showToast(
      changed.length === ids.length
        ? `Dismissed ${changed.length} ${changed.length === 1 ? "match" : "matches"}.`
        : `Dismissed ${changed.length} of ${ids.length}; the rest had already changed.`,
      "success"
    );
    router.refresh();
  }

  // An expired match someone still wants goes back to the New queue. If its
  // deadline really has passed, the next daily run will expire it again --
  // this is for a lead that's still live (e.g. an extended deadline).
  async function handleRestore(matchId: string) {
    setBusyId(matchId);
    const { error } = await supabase
      .from("matched_opportunities")
      .update({ status: "new" })
      .eq("id", matchId)
      .eq("status", "expired");
    setBusyId(null);
    if (error) {
      showToast(error.message, "error");
      return;
    }
    showToast("Restored to New.", "success");
    router.refresh();
  }

  // Reuses the same extract-from-document route/component already built and
  // verified for the intake wizard's "About the bid" step -- an admin
  // logging a bid they found themselves is doing the same thing a client
  // does at intake (typing agency/solicitation number/due date/scope out of
  // a real RFP document by hand), so the same fix applies. Only fills a
  // field the document actually stated -- never overwrites something
  // already typed with a blank, and never invents a value that came back
  // null. Title isn't part of ExtractedBidFields (a document rarely has a
  // clean, distinct "title" the way it has an agency name or solicitation
  // number) -- left as a manual field on purpose rather than guessing one.
  function handleOpportunityExtracted(data: ExtractedBidFields) {
    if (data.agency) setAgency(data.agency);
    if (data.solicitationNumber) setSolicitationNumber(data.solicitationNumber);
    if (data.dueDate) setDueDate(data.dueDate);
    if (data.scope) setScope(data.scope);
  }

  async function handleLogOpportunity(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !agency.trim()) return;
    setLogging(true);

    const { data, error: insertError } = await supabase
      .from("matched_opportunities")
      .insert({
        org_id: orgId,
        source_title: title,
        source_agency: agency,
        scope: scope.trim() || null,
        solicitation_number: solicitationNumber.trim() || null,
        due_date: dueDate || null,
        status: "new",
        // Sorted like a scraped bid, so it stays in "Your trades" when its
        // title names an offered trade.
        ...tradeFieldsForInsert({ title }, trades),
      })
      .select()
      .single();

    setLogging(false);

    if (insertError || !data) {
      showToast(insertError?.message ?? "Couldn't log that opportunity.", "error");
      return;
    }

    setMatches((m) => [data, ...m]);
    router.refresh();
    setTitle("");
    setAgency("");
    setScope("");
    setSolicitationNumber("");
    setDueDate("");
  }

  function handleAssignClick(matchId: string) {
    const match = matches.find((m) => m.id === matchId);
    // Falls back to the computed suggestion, same as the dropdown's own
    // displayed value (AssignControls' `selected` prop) -- without this,
    // an admin who trusts the pre-selected client shown on screen and
    // clicks Assign directly (without first re-touching the dropdown,
    // which is the only thing that ever populates assignSelections) hit a
    // false "pick a client first" error on the exact one-click path this
    // suggestion feature exists to enable.
    const clientId = assignSelections[matchId] ?? match?.suggested_client_id ?? "";
    if (!clientId) {
      showToast("Pick a client to assign this to first.", "error");
      return;
    }

    const client = clients.find((c) => c.id === clientId);
    if (!match || !client) return;

    // Warn when the match's trade isn't one of the client's trades. Other
    // trades rows have no trade to compare, so no warning.
    if (match.trade_id) {
      const clientTrades = clientTradeIds(client.naics_codes, trades);
      if (clientTrades.length > 0 && !clientTrades.includes(match.trade_id)) {
        setMismatchTarget({
          matchId,
          opportunityTrade: trades.find((t) => t.id === match.trade_id)?.label ?? "Unknown trade",
          clientTrade: clientTradeLabel(client.naics_codes, trades) ?? "",
        });
        return;
      }
    }

    performAssign(matchId);
  }

  async function performAssign(matchId: string) {
    const match = matches.find((m) => m.id === matchId);
    // Same fallback as handleAssignClick -- see its comment.
    const clientId = assignSelections[matchId] ?? match?.suggested_client_id ?? "";
    if (!clientId) return;
    if (!match) return;

    setBusyId(matchId);

    // Left as a draft (schema default) rather than immediately finalized —
    // the agency/scope/due date are already known, but the client still
    // needs to attach the actual bid file and send it. See IntakeWizard/
    // dashboard's CompleteBidFile: a client with a draft submission like
    // this one skips straight to "Your bid file" instead of being asked
    // "About the bid" again for something we already know.
    const { data: submission, error: submissionError } = await supabase
      .from("submissions")
      .insert({
        client_id: clientId,
        agency: match.source_agency,
        scope: match.scope ?? `From matched opportunity: ${match.source_title}`,
        solicitation_number: match.solicitation_number,
        due_date: match.due_date,
      })
      .select()
      .single();

    if (submissionError || !submission) {
      showToast(submissionError?.message ?? "Couldn't create a submission for this client.", "error");
      setBusyId(null);
      return;
    }

    const { error: updateError } = await supabase
      .from("matched_opportunities")
      .update({ assigned_client_id: clientId, status: "assigned" })
      .eq("id", matchId);

    if (updateError) {
      showToast(updateError.message, "error");
      setBusyId(null);
      return;
    }

    await supabase.from("audit_log").insert({
      submission_id: submission.id,
      org_id: orgId,
      actor_id: actorId,
      event_type: "submission_created_from_match",
      event_detail: { opportunity_id: matchId },
    });

    // The intake wizard triggers this right after a client's own submit
    // (lib/submissions.ts finalizeSubmission); a submission created here by
    // an admin assigning a match skips that path entirely, so it has to be
    // kicked off explicitly or the admin inbox's Fit check panel is stuck on
    // "Not run yet" forever for every match-assigned submission. Scope/
    // agency/due date are already real at this point (taken from the
    // matched opportunity), so there's no need to wait for the client to
    // finalize the bid file first — non-fatal if it fails, since a missing
    // fit check shouldn't block the assignment that already succeeded.
    fetch("/api/generate-fit-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId: submission.id }),
    }).catch(() => {});

    // No email went out for this at all before -- a client (lapsed or
    // active) had no way to know a draft was waiting unless they happened
    // to log in. Doubles as the win-back touch for a client who hasn't had
    // a submission in a while: a real, specific reason to reach out, not a
    // generic "we miss you."
    //
    // Awaited, and its result shown: this was fire-and-forget with the
    // result ignored, so a failed send still looked like a clean assignment
    // (2026-09-23 production case -- the client was never emailed and
    // nothing said so). See lib/matches/notify-client.ts.
    const notified = await notifyClientOfMatch(submission.id);

    setMatches((m) =>
      m.map((x) => (x.id === matchId ? { ...x, status: "assigned", assigned_client_id: clientId } : x))
    );
    setBusyId(null);
    // The only prior feedback was the row's own status pill flipping to
    // "Assigned to X" -- easy to miss, and gave no indication a real
    // submission (not just a label change) had just been created. A real
    // ops test (Carlos Mendez persona, 2026-09-16) assigned an opportunity
    // and couldn't tell whether anything had actually happened.
    if (notified.sent) {
      showToast(
        `Assigned — a draft submission was created for ${clientName(clientId)} and they were emailed. It's in the inbox under "Waiting on client" until they add their bid file.`,
        "success"
      );
    } else {
      showToast(
        `Assigned to ${clientName(clientId)}, but ${notified.message.charAt(0).toLowerCase()}${notified.message.slice(1)} Resend it from the inbox's "Waiting on client" list.`,
        "error"
      );
    }
  }

  async function handleDismiss(matchId: string) {
    setBusyId(matchId);

    const { error: updateError } = await supabase
      .from("matched_opportunities")
      .update({ status: "dismissed" })
      .eq("id", matchId);

    if (updateError) {
      showToast(updateError.message, "error");
      setBusyId(null);
      return;
    }

    setMatches((m) => m.map((x) => (x.id === matchId ? { ...x, status: "dismissed" } : x)));
    setBusyId(null);
    router.refresh();
  }

  // Works regardless of assignment status, including the common case of a
  // bad/test scraper or email-ingestion result that was never assigned —
  // deleting an already-assigned match here does NOT touch the real
  // submission it produced, only this matched_opportunities row itself.
  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);

    await supabase.from("audit_log").insert({
      org_id: orgId,
      actor_id: actorId,
      event_type: "matched_opportunity_deleted",
      event_detail: {
        matched_opportunity_id: deleteTarget.id,
        source_title: deleteTarget.source_title,
        source_agency: deleteTarget.source_agency,
      },
    });

    const { error } = await supabase.from("matched_opportunities").delete().eq("id", deleteTarget.id);

    if (error) {
      showToast(error.message, "error");
      setDeleting(false);
      return;
    }

    setMatches((m) => m.filter((x) => x.id !== deleteTarget.id));
    setDeleting(false);
    setDeleteTarget(null);
  }

  return (
    <div className="flex flex-col gap-6 mt-4">
      <form
        onSubmit={handleLogOpportunity}
        className="bg-surface-container p-space-base rounded-xl shadow-sm flex flex-col gap-space-base"
      >
        <div className="flex items-center gap-space-xs">
          <span className="material-symbols-outlined text-primary text-[20px]">travel_explore</span>
          <h2 className="font-headline text-[18px] text-on-surface font-bold">Log an opportunity</h2>
        </div>
        <RfpDocumentUpload onExtracted={handleOpportunityExtracted} />
        <div className="flex flex-col md:flex-row gap-space-base items-end flex-wrap">
          <div className="flex-1 min-w-[160px] flex flex-col gap-space-2xs">
            <label htmlFor="log-opportunity-title" className="text-label-sm text-on-surface-variant font-bold uppercase tracking-wider">Title</label>
            <input id="log-opportunity-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full border-0 bg-surface-container-low text-on-surface text-body-md px-space-md py-space-sm rounded-lg placeholder:text-outline outline-none focus:bg-surface-container-highest focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
            />
          </div>
          <div className="flex-1 min-w-[160px] flex flex-col gap-space-2xs">
            <label htmlFor="log-opportunity-agency" className="text-label-sm text-on-surface-variant font-bold uppercase tracking-wider">Agency</label>
            <input id="log-opportunity-agency"
              value={agency}
              onChange={(e) => setAgency(e.target.value)}
              required
              className="w-full border-0 bg-surface-container-low text-on-surface text-body-md px-space-md py-space-sm rounded-lg placeholder:text-outline outline-none focus:bg-surface-container-highest focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
            />
          </div>
          <div className="flex-1 min-w-[160px] flex flex-col gap-space-2xs">
            <label htmlFor="log-opportunity-solicitation-number" className="text-label-sm text-on-surface-variant font-bold uppercase tracking-wider">Solicitation number</label>
            <input id="log-opportunity-solicitation-number"
              value={solicitationNumber}
              onChange={(e) => setSolicitationNumber(e.target.value)}
              className="w-full border-0 bg-surface-container-low text-on-surface text-body-md px-space-md py-space-sm rounded-lg placeholder:text-outline outline-none focus:bg-surface-container-highest focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
            />
          </div>
          <div className="flex flex-col gap-space-2xs">
            <label htmlFor="log-opportunity-due-date" className="text-label-sm text-on-surface-variant font-bold uppercase tracking-wider">Due date</label>
            <input id="log-opportunity-due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="border-0 bg-surface-container-low text-on-surface text-body-md px-space-md py-space-sm rounded-lg outline-none focus:bg-surface-container-highest focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
            />
          </div>
        </div>
        <div className="flex flex-col gap-space-2xs">
          <label htmlFor="log-opportunity-scope-of-work" className="text-label-sm text-on-surface-variant font-bold uppercase tracking-wider">Scope of work</label>
          <textarea id="log-opportunity-scope-of-work"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            rows={3}
            placeholder="What the job actually involves…"
            className="w-full border-0 bg-surface-container-low text-on-surface text-body-md px-space-md py-space-sm rounded-lg placeholder:text-outline outline-none focus:bg-surface-container-highest focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary resize-y"
          />
        </div>
        <button
          type="submit"
          disabled={logging}
          className="self-end px-space-lg py-space-sm bg-primary-container hover:bg-primary text-on-primary-container font-headline text-[14px] font-bold uppercase tracking-wider rounded-xl shadow-md flex items-center gap-space-sm active:scale-[0.99] transition-[background-color,opacity,transform] disabled:opacity-40 disabled:active:scale-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {logging && <Spinner />}
          {logging ? "Logging…" : "Log opportunity"}
        </button>
      </form>

      <MatchesToolbar
        filters={filters}
        counts={counts}
        searchDraft={searchDraft}
        onSearchDraft={setSearchDraft}
        onApply={applyFilters}
        tabHref={(status) => filtersHref(pathname, { ...filters, status, page: 1 })}
        viewCounts={viewCounts}
        viewHref={(view) => filtersHref(pathname, { ...filters, view, page: 1 })}
      />

      {loadError && <p className="text-body-md text-error">{loadError}</p>}

      {selectableIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 -mb-2">
          <label className="inline-flex items-center gap-2 text-label-md text-on-surface-variant cursor-pointer">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded" />
            Select all on this page
          </label>
          {selected.size > 0 && (
            <button
              type="button"
              onClick={() => setBulkConfirmOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-surface-container-highest text-on-surface text-label-sm uppercase tracking-wider font-bold hover:opacity-90 transition active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Dismiss selected ({selected.size})
            </button>
          )}
        </div>
      )}

      {/* Table — needs real width for the title/agency/status columns plus
          an inline assign-to select and two buttons in the last one, so
          it's reserved for wide-enough viewports. Below xl, the card list
          further down carries the same data and controls stacked. */}
      <div className="hidden xl:block bg-surface-container-low rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-body-md table-fixed">
          <thead className="bg-surface-container-high">
            <tr>
              <th className="w-10 px-space-sm py-space-sm"><span className="sr-only">Select</span></th>
              <th className="text-left px-space-base py-space-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-bold w-[24%]">Bid title</th>
              <th className="text-left px-space-base py-space-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-bold w-[16%]">Agency</th>
              <th className="text-left px-space-base py-space-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-bold w-[16%]">Deadline</th>
              <th className="text-left px-space-base py-space-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-bold w-[8%]">Score</th>
              <th className="text-left px-space-base py-space-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-bold w-[12%]">Status</th>
              <th className="text-left px-space-base py-space-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-bold w-[24%] relative"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {filteredMatches.map((m) => {
              const due = dueDateInfo(m.due_date, m.status);
              return (
                <tr
                  key={m.id}
                  className="border-t border-outline-variant align-top hover:bg-surface-container-high transition"
                >
                  <td className="px-space-sm py-space-base">
                    {isSelectable(m) && (
                      <input
                        type="checkbox"
                        checked={selected.has(m.id)}
                        onChange={() => toggleSelected(m.id)}
                        aria-label={`Select ${m.source_title}`}
                        className="rounded mt-1"
                      />
                    )}
                  </td>
                  <td className="px-space-base py-space-base text-on-surface font-bold break-words">
                    {m.source_url ? (
                      <a
                        href={m.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-sm"
                      >
                        {m.source_title}
                      </a>
                    ) : (
                      m.source_title
                    )}
                  </td>
                  <td className="px-space-base py-space-base text-on-surface-variant break-words">
                    <span className="inline-flex items-center gap-space-xs flex-wrap">
                      <span className="material-symbols-outlined text-outline text-[16px]">account_balance</span>
                      {m.source_agency}
                      {m.trade_id ? (
                        <span className="inline-flex px-2 py-0.5 rounded text-label-sm font-bold uppercase tracking-wider bg-secondary-container text-on-secondary-container">
                          {trades.find((t) => t.id === m.trade_id)?.label ?? "Trade"}
                        </span>
                      ) : (
                        <TradeTagBadge title={m.source_title} scope={m.scope} />
                      )}
                    </span>
                  </td>
                  <td className={`px-space-base py-space-base font-code ${due.className}`}>{due.label}</td>
                  <td className="px-space-base py-space-base text-on-surface-variant font-code">{m.match_score ?? "—"}</td>
                  <td className="px-space-base py-space-base">
                    <StatusPill match={m} clientName={clientName} />
                  </td>
                  <td className="px-space-base py-space-base">
                    <div className="flex items-center gap-2 flex-wrap">
                      {m.status === "new" ? (
                        <AssignControls
                          match={m}
                          clients={clients}
                          trades={trades}
                          // Falls back to the computed suggestion only when the admin
                  // hasn't touched this row's dropdown yet -- once they pick
                  // anything, assignSelections[m.id] takes over. The admin
                  // still has to click Assign to confirm; nothing here
                  // auto-assigns just because a value is pre-selected.
                  selected={assignSelections[m.id] ?? m.suggested_client_id ?? ""}
                          onSelect={(v) => setAssignSelections((s) => ({ ...s, [m.id]: v }))}
                          onAssign={() => handleAssignClick(m.id)}
                          onDismiss={() => handleDismiss(m.id)}
                          onDelete={() => setDeleteTarget(m)}
                          busy={busyId === m.id}
                        />
                      ) : m.status === "expired" ? (
                        <RestoreControls onRestore={() => handleRestore(m.id)} onDelete={() => setDeleteTarget(m)} busy={busyId === m.id} />
                      ) : (
                        <DeleteIconButton onClick={() => setDeleteTarget(m)} />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredMatches.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-on-surface-variant">
                  {emptyMessage(filters, counts)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Card list — narrower than xl. */}
      <div className="xl:hidden bg-surface-container-low rounded-xl shadow-sm divide-y divide-outline-variant overflow-hidden">
        {filteredMatches.map((m) => {
          const due = dueDateInfo(m.due_date, m.status);
          return (
            <div
              key={m.id}
              className="flex flex-col gap-3 px-space-base py-space-base"
            >
              <div className="flex items-start justify-between gap-3">
                {isSelectable(m) && (
                  <input
                    type="checkbox"
                    checked={selected.has(m.id)}
                    onChange={() => toggleSelected(m.id)}
                    aria-label={`Select ${m.source_title}`}
                    className="rounded mt-1 shrink-0"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-on-surface font-bold break-words">
                    {m.source_url ? (
                      <a href={m.source_url} target="_blank" rel="noreferrer" className="text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-sm">
                        {m.source_title}
                      </a>
                    ) : (
                      m.source_title
                    )}
                  </p>
                  <p className="text-label-md text-on-surface-variant break-words flex items-center gap-1 flex-wrap mt-0.5">
                    <span className="material-symbols-outlined text-outline text-[14px]">account_balance</span>
                    {m.source_agency}
                    {m.trade_id ? (
                      <span className="inline-flex px-2 py-0.5 rounded text-label-sm font-bold uppercase tracking-wider bg-secondary-container text-on-secondary-container">
                        {trades.find((t) => t.id === m.trade_id)?.label ?? "Trade"}
                      </span>
                    ) : (
                      <TradeTagBadge title={m.source_title} scope={m.scope} />
                    )}
                  </p>
                </div>
                <StatusPill match={m} clientName={clientName} className="shrink-0" />
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-label-md">
                <span className={`font-code ${due.className}`}>{due.label}</span>
                <span className="text-on-surface-variant font-code">Score: {m.match_score ?? "—"}</span>
              </div>
              {m.status === "new" ? (
                <AssignControls
                  match={m}
                  clients={clients}
                  trades={trades}
                  // Falls back to the computed suggestion only when the admin
                  // hasn't touched this row's dropdown yet -- once they pick
                  // anything, assignSelections[m.id] takes over. The admin
                  // still has to click Assign to confirm; nothing here
                  // auto-assigns just because a value is pre-selected.
                  selected={assignSelections[m.id] ?? m.suggested_client_id ?? ""}
                  onSelect={(v) => setAssignSelections((s) => ({ ...s, [m.id]: v }))}
                  onAssign={() => handleAssignClick(m.id)}
                  onDismiss={() => handleDismiss(m.id)}
                  onDelete={() => setDeleteTarget(m)}
                  busy={busyId === m.id}
                  stacked
                />
              ) : m.status === "expired" ? (
                <div className="flex justify-end">
                  <RestoreControls onRestore={() => handleRestore(m.id)} onDelete={() => setDeleteTarget(m)} busy={busyId === m.id} />
                </div>
              ) : (
                <div className="flex justify-end">
                  <DeleteIconButton onClick={() => setDeleteTarget(m)} />
                </div>
              )}
            </div>
          );
        })}
        {filteredMatches.length === 0 && (
          <p className="px-4 py-6 text-center text-on-surface-variant">{emptyMessage(filters, counts)}</p>
        )}
      </div>

      <Pagination
        page={filters.page}
        pageSize={pageSize}
        total={totalForView}
        hrefFor={(page) => filtersHref(pathname, { ...filters, page })}
      />

      <ConfirmDialog
        open={bulkConfirmOpen}
        onClose={() => setBulkConfirmOpen(false)}
        onConfirm={handleBulkDismiss}
        title={`Dismiss ${selected.size} ${selected.size === 1 ? "match" : "matches"}?`}
        description={`This moves the ${selected.size} selected ${selected.size === 1 ? "match" : "matches"} to Dismissed. Nothing is deleted, and you can still find them under the Dismissed tab.`}
        confirmLabel={bulkBusy ? "Dismissing…" : `Dismiss ${selected.size}`}
      />

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        confirmText={deleteTarget?.source_title ?? ""}
        title="Delete this opportunity?"
        description={
          deleteTarget?.assigned_client_id
            ? `This permanently deletes the "${deleteTarget?.source_title}" opportunity record. It's already assigned to ${clientName(deleteTarget?.assigned_client_id ?? null)}: that client's actual submission is NOT affected, only this review-queue entry.`
            : `This permanently deletes the "${deleteTarget?.source_title}" opportunity record. This cannot be undone.`
        }
        busy={deleting}
      />

      <ConfirmDialog
        open={mismatchTarget !== null}
        onClose={() => setMismatchTarget(null)}
        onConfirm={() => {
          if (mismatchTarget) performAssign(mismatchTarget.matchId);
          setMismatchTarget(null);
        }}
        title="Trade doesn't match this client"
        description={
          mismatchTarget
            ? `This opportunity looks like ${mismatchTarget.opportunityTrade} work, but the selected client is tagged ${mismatchTarget.clientTrade}. Assign it anyway?`
            : ""
        }
        confirmLabel="Assign anyway"
      />
    </div>
  );
}

// Best-effort category tag (see lib/opportunity-trade-tag.ts) so an admin
// can tell what kind of client a listing might fit without reading the
// full scope -- renders nothing when nothing actually matches, same
// never-guess rule as the rest of this app.
function TradeTagBadge({ title, scope }: { title: string; scope: string | null }) {
  const tag = opportunityTradeTag({ title, scope });
  if (!tag) return null;
  return (
    <span className="inline-flex px-2 py-0.5 rounded text-label-sm font-bold uppercase tracking-wider bg-tertiary-container text-on-tertiary-container">
      {tag}
    </span>
  );
}

function StatusPill({
  match,
  clientName,
  className = "",
}: {
  match: Match;
  clientName: (id: string | null) => string;
  className?: string;
}) {
  if (match.status === "assigned") {
    // Deliberately ignores the incoming `className` (mobile's caller passes
    // "shrink-0" for the pill badges below) — a flex sibling with
    // flex-shrink: 0 and unbounded text (a long client name) refuses to
    // shrink itself, so the *other* sibling (the title/agency block) was
    // absorbing 100% of the squeeze and collapsing to width: 0, wrapping
    // its own break-words text one character per line. Letting this text
    // shrink and wrap too (min-w-0 + break-words) shares the squeeze
    // between both siblings instead.
    return (
      <span className="text-body-md text-on-surface-variant break-words min-w-0">
        Assigned to {clientName(match.assigned_client_id)}
      </span>
    );
  }
  if (match.status === "expired") {
    return (
      <span className={`inline-flex px-2.5 py-1 rounded text-label-sm font-bold uppercase tracking-wider bg-error-container text-on-error-container ${className}`}>
        Expired
      </span>
    );
  }
  if (match.status === "dismissed") {
    return (
      <span className={`inline-flex px-2.5 py-1 rounded text-label-sm font-bold uppercase tracking-wider bg-surface-variant text-on-surface-variant ${className}`}>
        Dismissed
      </span>
    );
  }
  return (
    <span className={`inline-flex px-2.5 py-1 rounded text-label-sm font-bold uppercase tracking-wider bg-secondary-container text-on-secondary-container ${className}`}>
      New
    </span>
  );
}

function AssignControls({
  match,
  clients,
  trades,
  selected,
  onSelect,
  onAssign,
  onDismiss,
  onDelete,
  busy,
  stacked = false,
}: {
  match: Match;
  clients: Client[];
  trades: Trade[];
  selected: string;
  onSelect: (value: string) => void;
  onAssign: () => void;
  onDismiss: () => void;
  // Renders the small trash-icon delete button in the same row as
  // Assign/Dismiss when provided, so a card/row never needs its own
  // separate full-width delete bar underneath.
  onDelete?: () => void;
  busy: boolean;
  stacked?: boolean;
}) {
  return (
    <div className={`flex ${stacked ? "flex-col" : "items-center"} gap-2 min-w-0`}>
      <Combobox
        options={clients.map((c) => ({ id: c.id, label: clientOptionLabel(c, trades) }))}
        value={selected}
        onChange={onSelect}
        placeholder="Assign to…"
        emptyMessage="No client matches"
        // A native <select> sizes itself to its longest option by default,
        // ignoring a flex/table-cell parent's width — a long client name
        // here (e.g. "River City Janitorial Partners LLC") was blowing the
        // whole row past the table's own 100% width. min-w-0 lets the
        // Combobox's own input actually shrink; the fixed max-w keeps it
        // from doing this again with more clients.
        className={stacked ? "w-full" : "w-32 max-w-[9rem] shrink"}
      />
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onAssign}
          disabled={busy}
          className="px-3 py-1.5 rounded-lg bg-primary-container hover:bg-primary text-on-primary-container text-label-sm uppercase tracking-wider font-bold transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {busy && <Spinner />}
          Assign
        </button>
        <button
          type="button"
          onClick={onDismiss}
          disabled={busy}
          className="px-3 py-1.5 rounded-lg bg-surface-container-highest text-on-surface text-label-sm uppercase tracking-wider font-bold hover:opacity-90 transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Dismiss
        </button>
        {onDelete && <DeleteIconButton onClick={onDelete} />}
      </div>
    </div>
  );
}

function DeleteIconButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Delete opportunity"
      title="Delete opportunity"
      className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-error hover:bg-error-container/20 transition active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-error"
    >
      <span className="material-symbols-outlined text-[18px]">delete</span>
    </button>
  );
}

function emptyMessage(filters: MatchFilters, counts: Record<TabKey, number>): string {
  const narrowed = filters.deadline !== "any" || filters.source !== "all" || filters.suggested || !!filters.q;
  if (narrowed) return "Nothing matches these filters.";
  if (counts.all === 0) return "No opportunities logged yet.";
  if (filters.status === "new") return "No new matches right now. You're caught up.";
  return `No ${filters.status === "all" ? "" : filters.status + " "}matches.`;
}

const selectClass =
  "border-0 bg-surface-container-low text-on-surface text-label-md px-space-sm py-1.5 rounded-lg outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary";

function MatchesToolbar({
  filters,
  counts,
  searchDraft,
  onSearchDraft,
  onApply,
  tabHref,
  viewCounts,
  viewHref,
}: {
  filters: MatchFilters;
  counts: Record<TabKey, number>;
  searchDraft: string;
  onSearchDraft: (v: string) => void;
  onApply: (patch: Partial<MatchFilters>) => void;
  tabHref: (status: TabKey) => string;
  viewCounts: { trades: number; other: number };
  viewHref: (view: MatchFilters["view"]) => string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <nav aria-label="Trade view" className="flex flex-wrap gap-2">
        {([
          ["trades", "Your trades"],
          ["other", "Other trades"],
        ] as const).map(([key, label]) => {
          const active = filters.view === key;
          return (
            <Link
              key={key}
              href={viewHref(key)}
              aria-current={active ? "page" : undefined}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-label-md font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                active ? "bg-primary text-on-primary" : "bg-surface-container-low text-on-surface hover:bg-surface-container-high"
              }`}
            >
              {label}
              <span className="font-code text-body-sm">{viewCounts[key]}</span>
            </Link>
          );
        })}
      </nav>
      <nav aria-label="Match status" className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const active = filters.status === tab.key;
          return (
            <Link
              key={tab.key}
              href={tabHref(tab.key)}
              aria-current={active ? "page" : undefined}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-label-md font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                active ? "bg-primary-container text-on-primary-container" : "bg-surface-container-low text-on-surface hover:bg-surface-container-high"
              }`}
            >
              {tab.label}
              <span className="font-code text-body-sm">{counts[tab.key]}</span>
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-wrap items-center gap-3">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            onApply({ q: searchDraft.trim() });
          }}
          className="relative flex items-center w-full sm:w-72"
        >
          <span className="material-symbols-outlined absolute left-3.5 text-on-surface-variant text-[20px] pointer-events-none">search</span>
          <input
            value={searchDraft}
            onChange={(e) => onSearchDraft(e.target.value)}
            placeholder="Search title, agency, solicitation #…"
            aria-label="Search matches"
            className="w-full border-0 bg-surface-container-low text-on-surface text-body-md pl-11 pr-space-md py-space-sm rounded-lg placeholder:text-outline outline-none focus:bg-surface-container-highest focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
          />
        </form>

        <label className="inline-flex items-center gap-2 text-label-md text-on-surface-variant">
          Deadline
          <select
            value={filters.deadline}
            onChange={(e) => onApply({ deadline: e.target.value as MatchFilters["deadline"] })}
            className={selectClass}
          >
            <option value="any">Any</option>
            <option value="7">Closing in 7 days</option>
            <option value="30">Closing in 30 days</option>
            <option value="none">No deadline</option>
          </select>
        </label>

        <label className="inline-flex items-center gap-2 text-label-md text-on-surface-variant">
          Source
          <select
            value={filters.source}
            onChange={(e) => onApply({ source: e.target.value as MatchFilters["source"] })}
            className={selectClass}
          >
            <option value="all">All</option>
            <option value="sam">SAM.gov</option>
            <option value="local">Local (JAA, City)</option>
            <option value="other">Email &amp; manual</option>
          </select>
        </label>

        <label className="inline-flex items-center gap-2 text-label-md text-on-surface-variant cursor-pointer">
          <input
            type="checkbox"
            checked={filters.suggested}
            onChange={(e) => onApply({ suggested: e.target.checked })}
            className="rounded"
          />
          Has a suggested client
        </label>

        <label className="inline-flex items-center gap-2 text-label-md text-on-surface-variant sm:ml-auto">
          Sort
          <select
            value={filters.sort}
            onChange={(e) => onApply({ sort: e.target.value as MatchFilters["sort"] })}
            className={selectClass}
          >
            <option value="deadline">Deadline, soonest first</option>
            <option value="score">Best match score</option>
            <option value="newest">Newest</option>
          </select>
        </label>
      </div>
    </div>
  );
}

function Pagination({
  page,
  pageSize,
  total,
  hrefFor,
}: {
  page: number;
  pageSize: number;
  total: number;
  hrefFor: (page: number) => string;
}) {
  if (total <= pageSize && page === 1) return null;
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const linkClass =
    "px-3 py-1.5 rounded-lg bg-surface-container-low text-on-surface text-label-md font-semibold hover:bg-surface-container-high transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
  return (
    <nav aria-label="Pages" className="flex items-center justify-between gap-3 flex-wrap">
      <span className="text-label-md text-on-surface-variant font-code">
        {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} className={linkClass}>
            Previous
          </Link>
        ) : (
          <span className={`${linkClass} opacity-40 pointer-events-none`} aria-disabled="true">
            Previous
          </span>
        )}
        <span className="text-label-md text-on-surface-variant">
          Page {page} of {lastPage}
        </span>
        {page < lastPage ? (
          <Link href={hrefFor(page + 1)} className={linkClass}>
            Next
          </Link>
        ) : (
          <span className={`${linkClass} opacity-40 pointer-events-none`} aria-disabled="true">
            Next
          </span>
        )}
      </div>
    </nav>
  );
}

function RestoreControls({ onRestore, onDelete, busy }: { onRestore: () => void; onDelete: () => void; busy: boolean }) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <button
        type="button"
        onClick={onRestore}
        disabled={busy}
        title="Move back to New, e.g. if the deadline was extended"
        className="px-3 py-1.5 rounded-lg bg-surface-container-highest text-on-surface text-label-sm uppercase tracking-wider font-bold hover:opacity-90 transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {busy && <Spinner />}
        Restore
      </button>
      <DeleteIconButton onClick={onDelete} />
    </div>
  );
}
