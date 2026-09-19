import type { SupabaseClient } from "@supabase/supabase-js";

// A Retainer signup has no specific bid yet, but every other admin-facing
// surface (the inbox, staleness rules, the 48-hour promise clock) assumes a
// real `submissions` row exists -- see IntakeWizard.tsx's
// handleRetainerProfileNext. `agency` is NOT NULL at the DB level, so this
// placeholder needs a real, honestly-labeled value. Shared as a constant
// (not duplicated as a literal in both IntakeWizard.tsx and
// dashboard/page.tsx) so the two can't silently drift apart.
export const RETAINER_PLACEHOLDER_AGENCY = "General inquiry — Retainer";

// Shared by the intake wizard's own "Your bid file" step and the
// dashboard's "complete your bid" card (components/ui/BidFileStep.tsx) —
// both lock a submission the same way, so the draft/stage flip and the
// audit-log entry live in one place instead of two copies that could drift.
//
// The fit-check fetch is deliberately fire-and-forget and only kicked off
// after the lock above has actually succeeded (real scope/agency data is
// saved) — never before. A caller that wants to show the result (the
// wizard's confirmation screen) passes onFitCheck; a caller that doesn't
// (the dashboard card, which just refreshes the page) can omit it.
export type FitCheckResult = {
  alignment: string;
  explanation: string;
  mandatorySiteVisitConcern: boolean;
  mandatorySiteVisitExplanation: string | null;
};

export async function finalizeSubmission(
  supabase: SupabaseClient,
  submissionId: string,
  onFitCheck?: (result: FitCheckResult | null) => void,
  // Real legal record that the client actively checked the "no guarantee of
  // winning" box, not just UI copy they could've skimmed past — BidFileStep
  // disables the submit button until this is true, so by the time this runs
  // it's already a hard true, but the audit_log row is what makes it provable
  // later rather than only ever having existed in React state.
  acknowledgedNoGuarantee?: boolean,
  // The submitting client's own id (BidFileStep's caller already has this —
  // see clientId prop on IntakeWizard/CompleteBidFile) — needed to set
  // info_attested_by in the same update that flips draft to false. Passed
  // in rather than derived here via a separate auth lookup, and re-checked
  // server-side regardless: the submissions UPDATE RLS policy's WITH CHECK
  // (supabase/migrations/20260904140124_add_attestation_tracking.sql)
  // requires info_attested_by to resolve to the caller's own client record
  // via is_own_client_record() whenever draft is being set to false, so a
  // client can't spoof this even though they're the one supplying it.
  clientId?: string,
  infoAttested?: boolean
) {
  // BidFileStep disables the submit button until this is checked, but that
  // alone is exactly the "relying on the client-side disable alone" gap
  // this brief called out — check again here before the write is even
  // attempted, for a clear error instead of surfacing a raw RLS/constraint
  // failure. The real backstop is still the DB: the RLS policy itself
  // rejects any draft->false write missing a valid attestation regardless
  // of what this function does, so this check is about a better error
  // message, not the actual security boundary.
  if (!infoAttested || !clientId) {
    throw new Error("Please confirm the information in this submission is accurate before sending.");
  }

  const { data: submission, error: submitError } = await supabase
    .from("submissions")
    .update({
      draft: false,
      submitted_at: new Date().toISOString(),
      stage: "submitted",
      info_attested_at: new Date().toISOString(),
      info_attested_by: clientId,
    })
    .eq("id", submissionId)
    .select("client_id")
    .single();

  if (submitError || !submission) {
    throw new Error(submitError?.message ?? "Couldn't submit.");
  }

  const { data: client } = await supabase
    .from("clients")
    .select("org_id")
    .eq("id", submission.client_id)
    .single();

  await supabase.from("audit_log").insert({
    submission_id: submissionId,
    org_id: client?.org_id,
    event_type: "submission_locked",
    event_detail: { event: "client_submitted" },
  });

  if (acknowledgedNoGuarantee) {
    await supabase.from("audit_log").insert({
      submission_id: submissionId,
      org_id: client?.org_id,
      event_type: "no_guarantee_acknowledged",
      event_detail: {
        text: "I understand that First Coast Bids helps prepare my bid but does not guarantee I will win the contract.",
      },
    });
  }

  await supabase.from("audit_log").insert({
    submission_id: submissionId,
    org_id: client?.org_id,
    event_type: "info_attested",
    event_detail: { submission_id: submissionId },
  });

  const fitCheckFetch = fetch("/api/generate-fit-check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ submissionId }),
  }).then((res) => res.json());

  if (onFitCheck) {
    fitCheckFetch
      .then((data) =>
        onFitCheck(
          data?.fit_alignment
            ? {
                alignment: data.fit_alignment,
                explanation: data.fit_explanation,
                mandatorySiteVisitConcern: !!data.mandatory_site_visit_concern,
                mandatorySiteVisitExplanation: data.mandatory_site_visit_explanation ?? null,
              }
            : null
        )
      )
      .catch(() => onFitCheck(null));
  } else {
    fitCheckFetch.catch(() => {});
  }
}
