import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InboxBoard } from "./InboxBoard";
import { WaitingOnClient, type WaitingDraft } from "./WaitingOnClient";

// This replaces the old self-serve /bids list — now shows every client's
// submissions, not just one contractor's own.

export default async function AdminInboxPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Without this check, a client account hitting this URL directly would
  // still render the page (RLS just narrows the query to their own single
  // row), mislabeled as "every client's submissions" — root already knows
  // where a client actually belongs.
  const { data: member } = await supabase
    .from("team_members")
    .select("id, full_name")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!member) redirect("/");

  // Real FIFO queue, oldest-submitted-first, so nothing sits unnoticed
  // further down the list — draft rows are excluded entirely (not yet
  // actionable, no submitted_at to queue by), and test rows sort after
  // every real one so rehearsal data never competes with real client
  // queue position (same principle as excluding is_test from reporting
  // elsewhere in the app). "Needs attention"/"Past due" stay as visual
  // badges computed below, not as a reordering signal — the point of a
  // real FIFO is that row position always matches submission order.
  const { data: rawSubmissions } = await supabase
    .from("submissions")
    .select(
      "id, agency, solicitation_number, stage, due_date, is_test, draft, submitted_at, updated_at, created_at, estimated_value, clients!submissions_client_id_fkey(company_name)"
    )
    .eq("draft", false)
    .order("is_test", { ascending: true })
    .order("submitted_at", { ascending: true });

  // Real per-submission "X of 3 core deliverables drafted" count -- one
  // query for every visible submission's deliverables rather than N+1.
  // Only the 3 core types count toward the /3 (a lean-package submission's
  // rate_sheet/executive_cover/certificate_of_insurance rows would never
  // reach 3/3 against this denominator, so they're excluded rather than
  // shown as permanently incomplete).
  // Drafts created by assigning a match (see WaitingOnClient). Identified by
  // their submission_created_from_match audit row, so a visitor's abandoned
  // intake draft never shows up here. Newest assignment wins if a
  // submission somehow has more than one.
  const { data: assignedRows } = await supabase
    .from("audit_log")
    .select("submission_id, created_at")
    .eq("event_type", "submission_created_from_match")
    .not("submission_id", "is", null)
    .order("created_at", { ascending: false });
  const assignedAt = new Map<string, string>();
  for (const row of assignedRows ?? []) {
    if (row.submission_id && !assignedAt.has(row.submission_id)) assignedAt.set(row.submission_id, row.created_at);
  }
  let waitingDrafts: WaitingDraft[] = [];
  if (assignedAt.size > 0) {
    const ids = [...assignedAt.keys()];
    const [{ data: draftRows }, { data: emailRows }] = await Promise.all([
      supabase
        .from("submissions")
        .select("id, agency, solicitation_number, due_date, clients!submissions_client_id_fkey(company_name)")
        .in("id", ids)
        .eq("draft", true),
      supabase
        .from("audit_log")
        .select("submission_id, created_at")
        .eq("event_type", "matched_opportunity_email_sent")
        .in("submission_id", ids)
        .order("created_at", { ascending: false }),
    ]);
    const emailedAt = new Map<string, string>();
    for (const row of emailRows ?? []) {
      if (row.submission_id && !emailedAt.has(row.submission_id)) emailedAt.set(row.submission_id, row.created_at);
    }
    waitingDrafts = (draftRows ?? [])
      .map((d: any) => ({
        id: d.id,
        company_name: d.clients?.company_name ?? "Unknown client",
        agency: d.agency,
        solicitation_number: d.solicitation_number,
        due_date: d.due_date,
        assigned_at: assignedAt.get(d.id)!,
        email_sent_at: emailedAt.get(d.id) ?? null,
      }))
      .sort((a, b) => b.assigned_at.localeCompare(a.assigned_at));
  }

  const CORE_DELIVERABLE_TYPES = new Set(["capability_statement", "compliance_matrix", "technical_narrative"]);
  const submissionIds = (rawSubmissions ?? []).map((s: any) => s.id);
  const deliverablesCountBySubmission = new Map<string, number>();
  if (submissionIds.length > 0) {
    const { data: deliverableRows } = await supabase
      .from("deliverables")
      .select("submission_id, deliverable_type")
      .in("submission_id", submissionIds);
    for (const row of deliverableRows ?? []) {
      if (!CORE_DELIVERABLE_TYPES.has(row.deliverable_type)) continue;
      deliverablesCountBySubmission.set(row.submission_id, (deliverablesCountBySubmission.get(row.submission_id) ?? 0) + 1);
    }
  }

  const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  // "Needs attention" — anything not already closed out, either past our
  // 48-hour turnaround promise (still stuck in submitted/in_review more
  // than 48h after the client's own submitted_at — a broken promise, not
  // just staleness) or simply untouched for 3+ days (no explicit
  // updated_at yet falls back to created_at).
  const submissions = (rawSubmissions ?? []).map((sub: any) => {
    const pastPromise =
      sub.stage !== "closed" &&
      (sub.stage === "submitted" || sub.stage === "in_review") &&
      !!sub.submitted_at &&
      now - new Date(sub.submitted_at).getTime() > FORTY_EIGHT_HOURS_MS;

    const lastTouched = sub.updated_at ?? sub.created_at;
    const isStale =
      sub.stage !== "closed" && now - new Date(lastTouched).getTime() >= THREE_DAYS_MS;

    const deliverablesDrafted = deliverablesCountBySubmission.get(sub.id) ?? 0;

    return { ...sub, pastPromise, isStale, deliverablesDrafted };
  });

  const stageLabels: Record<string, string> = {
    submitted: "Submitted",
    in_review: "In review",
    deliverables_ready: "Deliverables ready",
    client_review: "Client review",
    closed: "Closed",
  };

  const stagePillStyle: Record<string, string> = {
    submitted: "bg-surface-container-high text-on-surface-variant",
    in_review: "bg-surface-container-high text-on-surface-variant",
    deliverables_ready: "bg-secondary-container text-on-secondary-container",
    client_review: "bg-secondary-container text-on-secondary-container",
    closed: "bg-surface-variant text-on-surface-variant",
  };

  // Real, accurate one-line descriptions of what each stage actually means
  // (not fabricated metrics) and a per-stage dot color for the board
  // column headers, matching the Stitch "Industrial Precision" kanban
  // reference (admin-kanban.html) — same color role each stage plays there.
  const stageDescriptions: Record<string, string> = {
    submitted: "Awaiting first admin review",
    in_review: "Admin preparing deliverables",
    deliverables_ready: "Ready for the client to review",
    client_review: "Contractor reviewing the packet",
    closed: "Finished: won, lost, or closed out",
  };

  const stageDotColor: Record<string, string> = {
    submitted: "bg-tertiary-container",
    in_review: "bg-primary-container",
    deliverables_ready: "bg-tertiary",
    client_review: "bg-secondary",
    closed: "bg-outline",
  };

  // Real, computed aggregates for the footer strip below the board —
  // deliberately not the fabricated SLA-adherence/win-rate stats the Stitch
  // reference shows (this app tracks neither), just the two figures that
  // are actually derivable from real data. Test rows never contribute.
  const openSubmissions = submissions.filter((s) => s.stage !== "closed" && !s.is_test);
  const openCount = openSubmissions.length;
  const grossValue = openSubmissions.reduce((sum, s) => sum + (s.estimated_value ?? 0), 0);

  return (
    <>
      <div className="mt-6">
        <h1 className="text-headline-lg text-primary mb-1">Intake Inbox</h1>
        <p className="text-body-md text-on-surface-variant">
          Every client submission, across every stage.
        </p>
      </div>

      <WaitingOnClient drafts={waitingDrafts} />

      <InboxBoard
        submissions={submissions as any}
        stageLabels={stageLabels}
        stagePillStyle={stagePillStyle}
        stageDescriptions={stageDescriptions}
        stageDotColor={stageDotColor}
      />

      <div className="w-full bg-surface-container px-gutter py-4 rounded-xl shadow-md flex flex-wrap items-center gap-8">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-xl">folder_shared</span>
          <div className="flex flex-col">
            <span className="text-label-sm text-on-surface-variant uppercase tracking-wider">Open Pipeline Submissions</span>
            <span className="font-code text-body-lg text-on-surface font-bold">{openCount} Total Active</span>
          </div>
        </div>
        {grossValue > 0 && (
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-secondary text-xl">payments</span>
            <div className="flex flex-col">
              <span className="text-label-sm text-on-surface-variant uppercase tracking-wider">Gross Pipeline Value</span>
              <span className="font-code text-body-lg text-secondary font-bold">${grossValue.toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
