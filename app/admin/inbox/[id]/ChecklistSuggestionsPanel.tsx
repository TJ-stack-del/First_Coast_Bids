"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/Toast";
import { isScanStale, needsRescan, type ScanState } from "@/lib/checklist/scan-state";
import { describeSendResult } from "@/lib/checklist/send-result";
import { splitForReview } from "@/lib/checklist/attention";

export type Suggestion = {
  id: string;
  kind: string;
  federal: boolean;
  label: string;
  detail: string | null;
  quote: string;
  page: number | null;
  source_file: string | null;
  quote_status: "verified" | "not_found" | "unreadable";
  found_by: "ai" | "detector";
  suggested_owner: "client" | "admin";
  status: "pending" | "approved" | "rejected";
};

const QUOTE_BADGE: Record<Suggestion["quote_status"], { text: string; className: string }> = {
  verified: { text: "Quote verified", className: "bg-secondary-container text-on-secondary-container" },
  not_found: { text: "Quote not found", className: "bg-error-container text-on-error-container" },
  unreadable: { text: "Couldn't verify: scanned document", className: "bg-surface-container-high text-on-surface-variant" },
};

// Suggested checklist items read from the solicitation
// (docs/superpowers/specs/2026-09-25-submission-checklist-design.md). Nothing
// here reaches the client until an admin approves it with an owner.
export function ChecklistSuggestionsPanel({
  submissionId,
  initialScan,
  initialSuggestions,
  rfpDocumentUrls,
  hasRfpFiles,
  currentFingerprint,
  unsentClientItems,
}: {
  submissionId: string;
  initialScan: ScanState | null;
  initialSuggestions: Suggestion[];
  rfpDocumentUrls: Record<string, string>;
  hasRfpFiles: boolean;
  currentFingerprint: string | null;
  unsentClientItems: number;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [scan, setScan] = useState(initialScan);
  const [owners, setOwners] = useState<Record<string, "client" | "admin">>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [showRejected, setShowRejected] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showRoutine, setShowRoutine] = useState(false);

  const running = scan?.status === "running" && !isScanStale(scan, new Date());
  const timedOut = scan?.status === "running" && isScanStale(scan, new Date());

  // While a scan runs, poll its state; refresh the page when it finishes.
  useEffect(() => {
    if (!running) return;
    const supabase = createClient();
    const timer = setInterval(async () => {
      const { data } = await supabase.from("submissions").select("checklist_scan").eq("id", submissionId).single();
      const next = (data?.checklist_scan ?? null) as ScanState | null;
      setScan(next);
      if (next?.status !== "running") router.refresh();
    }, 3000);
    return () => clearInterval(timer);
  }, [running, submissionId, router]);

  // Files added while a reading ran (or after it) are read automatically,
  // once per set of files.
  const [autoStartedFor, setAutoStartedFor] = useState<string | null>(null);
  useEffect(() => {
    if (!currentFingerprint || autoStartedFor === currentFingerprint) return;
    if (!needsRescan(scan, currentFingerprint, new Date())) return;
    setAutoStartedFor(currentFingerprint);
    setScan({ status: "running", started_at: new Date().toISOString(), files_fingerprint: "" });
    fetch("/api/checklist-scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId }),
    })
      .catch(() => {})
      .finally(() => router.refresh());
  }, [scan, currentFingerprint, autoStartedFor, submissionId, router]);

  async function checkAgain() {
    setScan({ status: "running", started_at: new Date().toISOString(), files_fingerprint: "" });
    const res = await fetch("/api/checklist-scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId, force: true }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) showToast(body?.error ?? `The check failed (HTTP ${res.status}).`, "error");
    router.refresh();
  }

  async function decide(s: Suggestion, action: "approve" | "reject" | "restore") {
    setBusy(s.id);
    const res = await fetch(`/api/checklist-suggestions/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, owner: owners[s.id] ?? s.suggested_owner }),
    });
    const body = await res.json().catch(() => null);
    setBusy(null);
    if (!res.ok) showToast(body?.error ?? `That didn't work (HTTP ${res.status}).`, "error");
    router.refresh();
  }

  const pending = initialSuggestions.filter((s) => s.status === "pending");
  // One person, 48-hour turnaround: items needing a look come first; the
  // routine rest (verified, non-federal, client-owned) go through one button.
  const { attention, routine } = splitForReview(pending);
  const rejected = initialSuggestions.filter((s) => s.status === "rejected");

  async function approveAll() {
    setConfirmAll(false);
    setBusy("all");
    const res = await fetch("/api/checklist-suggestions/approve-verified", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId, expected: routine.length, ids: routine.map((r) => r.id), owners }),
    });
    const body = await res.json().catch(() => null);
    setBusy(null);
    if (!res.ok) showToast(body?.error ?? `That didn't work (HTTP ${res.status}).`, "error");
    else showToast(`Approved ${body.approved}${body.failed ? `, ${body.failed} failed` : ""}.`, body.failed ? "error" : "success");
    router.refresh();
  }

  async function sendList() {
    setBusy("send");
    const res = await fetch("/api/send-checklist-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId }),
    });
    const result = describeSendResult(res.status, await res.json().catch(() => null));
    setBusy(null);
    showToast(result.message, result.sent ? "success" : "error");
    router.refresh();
  }

  // One line per item; the detail and quote open on click.
  function row(s: Suggestion) {
    const docUrl = s.source_file ? rfpDocumentUrls[s.source_file] : undefined;
    const owner = owners[s.id] ?? s.suggested_owner;
    const open = !!expanded[s.id];
    return (
      <li key={s.id} className="py-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setExpanded((m) => ({ ...m, [s.id]: !open }))}
            className="min-w-0 flex-1 text-left text-body-md font-bold text-on-surface hover:underline"
          >
            {s.label}
          </button>
          {s.quote_status !== "verified" && (
            <span className={`px-2 py-0.5 rounded text-label-sm font-bold ${QUOTE_BADGE[s.quote_status].className}`}>
              {QUOTE_BADGE[s.quote_status].text}
            </span>
          )}
          {s.federal && <span className="px-2 py-0.5 rounded text-label-sm font-bold bg-tertiary-container text-on-tertiary-container">Federal</span>}
          {s.status === "pending" ? (
            <div className="flex items-center gap-2">
              <div role="group" aria-label="Owner" className="inline-flex rounded-lg border border-outline-variant overflow-hidden">
                {(["admin", "client"] as const).map((o) => (
                  <button
                    key={o}
                    type="button"
                    aria-pressed={owner === o}
                    onClick={() => setOwners((m) => ({ ...m, [s.id]: o }))}
                    className={`px-2.5 py-1 text-label-sm font-bold ${owner === o ? "bg-primary text-on-primary" : "bg-surface text-on-surface"}`}
                  >
                    {o === "admin" ? "Me" : "Client"}
                  </button>
                ))}
              </div>
              <button type="button" disabled={busy !== null} onClick={() => decide(s, "approve")} className="px-2.5 py-1 rounded-lg bg-primary text-on-primary text-label-sm font-bold disabled:opacity-40">
                Approve
              </button>
              <button type="button" disabled={busy !== null} onClick={() => decide(s, "reject")} className="px-2.5 py-1 rounded-lg border border-outline-variant text-on-surface text-label-sm font-bold disabled:opacity-40">
                Reject
              </button>
              {busy === s.id && <Spinner />}
            </div>
          ) : (
            <button type="button" disabled={busy !== null} onClick={() => decide(s, "restore")} className="text-primary text-label-sm font-bold">
              Restore
            </button>
          )}
        </div>
        {open && (
          <div className="mt-2 flex flex-col gap-1">
            {s.detail && <p className="text-body-sm text-on-surface-variant">{s.detail}</p>}
            <blockquote className="text-body-sm text-on-surface-variant border-l-2 border-outline-variant pl-3 italic">
              &ldquo;{s.quote}&rdquo;
              {docUrl && s.page != null ? (
                <a href={`${docUrl}#page=${s.page}`} target="_blank" rel="noreferrer" className="not-italic ml-2 text-primary font-bold underline">
                  {s.source_file}, p. {s.page}
                </a>
              ) : (
                <span className="not-italic ml-2">
                  {s.source_file ?? ""}
                  {s.page != null ? `, p. ${s.page}` : ""}
                </span>
              )}
              {s.quote_status === "verified" && <span className="not-italic ml-2 text-secondary font-bold">Quote verified</span>}
              {s.found_by === "detector" && <span className="not-italic ml-2">(found by plain-code check)</span>}
            </blockquote>
          </div>
        )}
      </li>
    );
  }

  return (
    <section aria-labelledby="checklist-suggestions" className="mt-6 bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="checklist-suggestions" className="text-title-lg text-primary">Checklist suggestions</h2>
        <div className="flex items-center gap-3">
          {scan?.finished_at && <span className="text-body-sm text-on-surface-variant">Last read {new Date(scan.finished_at).toLocaleString()}</span>}
          <button type="button" onClick={checkAgain} disabled={running || !hasRfpFiles} className="px-3 py-1.5 rounded-lg border border-outline-variant text-label-sm font-bold disabled:opacity-40">
            {scan ? "Check again" : "Read the solicitation"}
          </button>
        </div>
      </div>

      {!hasRfpFiles && <p className="mt-3 text-body-md text-on-surface-variant">Upload the agency&apos;s solicitation file to get suggestions.</p>}
      {running && (
        <p className="mt-3 text-body-md text-on-surface flex items-center gap-2">
          <Spinner /> Reading the solicitation…
        </p>
      )}
      {timedOut && <p className="mt-3 text-body-md text-error">The last reading timed out. Check again to retry.</p>}
      {scan?.status === "failed" && <p className="mt-3 text-body-md text-error">{scan.error ?? "The last reading failed."} Check again to retry.</p>}
      {scan?.pages_read
        ?.filter((p) => p.read < p.total)
        .map((p) => (
          <p key={p.file} className="mt-2 text-body-sm text-on-surface-variant">
            Only pages 1–{p.read} of {p.file} were read.
          </p>
        ))}
      {scan?.ai_failed && scan.ai_failed.length > 0 && scan.status === "done" && (
        <p className="mt-2 text-body-sm text-error">
          Part of the document couldn&apos;t be read: {scan.ai_failed.map((f) => `${f.file} (${f.message})`).join("; ")}
        </p>
      )}
      {scan?.unreadable?.map((u) => (
        <p key={u.file} className="mt-2 text-body-sm text-error">
          Couldn&apos;t read {u.file}: {u.problem}.
        </p>
      ))}

      {attention.length > 0 && (
        <div className="mt-5">
          <h3 className="text-label-md uppercase tracking-wider font-bold text-on-surface-variant">
            Needs a look ({attention.length})
          </h3>
          <p className="text-body-sm text-on-surface-variant">Federal items, items for you, and quotes that couldn&apos;t be verified.</p>
          <ul className="divide-y divide-outline-variant">{attention.map(row)}</ul>
        </div>
      )}
      {routine.length > 0 && (
        <div className="mt-5">
          <button
            type="button"
            aria-expanded={showRoutine}
            onClick={() => setShowRoutine((v) => !v)}
            className="text-label-md uppercase tracking-wider font-bold text-on-surface-variant hover:underline"
          >
            {showRoutine ? "Hide" : "Show"} routine items ({routine.length})
          </button>
          <p className="text-body-sm text-on-surface-variant">Verified quotes, for the client. Safe to approve together.</p>
          {showRoutine && <ul className="divide-y divide-outline-variant">{routine.map(row)}</ul>}
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        {routine.length > 0 && (
          <button type="button" disabled={busy !== null} onClick={() => setConfirmAll(true)} className="px-4 py-2 rounded-lg bg-primary text-on-primary text-label-md font-bold disabled:opacity-40">
            Approve routine items ({routine.length})
          </button>
        )}
        {unsentClientItems > 0 && (
          <button type="button" disabled={busy !== null} onClick={sendList} className="px-4 py-2 rounded-lg border border-primary text-primary text-label-md font-bold flex items-center gap-2 disabled:opacity-40">
            {busy === "send" && <Spinner />}
            Send the client their list ({unsentClientItems})
          </button>
        )}
        {rejected.length > 0 && (
          <button type="button" onClick={() => setShowRejected((v) => !v)} className="text-on-surface-variant text-label-md font-bold">
            {showRejected ? "Hide rejected" : `Show rejected (${rejected.length})`}
          </button>
        )}
      </div>
      {showRejected && <ul className="mt-3 divide-y divide-outline-variant opacity-80">{rejected.map(row)}</ul>}

      <ConfirmDialog
        open={confirmAll}
        onClose={() => setConfirmAll(false)}
        onConfirm={approveAll}
        title="Approve the routine items?"
        description={`This adds ${routine.length} verified client items to the bid's checklist. Items under "Needs a look" aren't included. Nothing is emailed until you send the client their list.`}
        confirmLabel="Approve all"
      />
    </section>
  );
}
