"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "./Spinner";
import { FadeMessage } from "./FadeMessage";
import { SubmissionDocuments } from "./SubmissionDocuments";
import { finalizeSubmission, type FitCheckResult } from "@/lib/submissions";

// The "Your bid file" step — upload the RFP, then either save for later or
// lock the submission. Shared by the intake wizard (a brand-new client's
// last step) and the dashboard's "complete your bid" card (an existing
// client finishing a submission an admin pre-filled from a matched
// opportunity) so both stay in sync on what "done" actually means.
export function BidFileStep({
  submissionId,
  clientId,
  onSubmitted,
  onFitCheck,
}: {
  submissionId: string;
  clientId: string;
  onSubmitted?: () => void;
  onFitCheck?: (result: FitCheckResult | null) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [infoAttested, setInfoAttested] = useState(false);
  const supabase = createClient();

  async function handleSaveDraft() {
    setSaving(true);
    setError(null);
    await supabase
      .from("submissions")
      .update({ draft_saved_at: new Date().toISOString() })
      .eq("id", submissionId);
    setSaving(false);
    setSaved(true);
  }

  async function handleFinalSubmit() {
    setSaving(true);
    setError(null);
    try {
      await finalizeSubmission(supabase, submissionId, onFitCheck, acknowledged, clientId, infoAttested);
      onSubmitted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't submit.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <SubmissionDocuments submissionId={submissionId} />

      {/* Nothing here actually requires a file -- handleFinalSubmit below
          is only ever gated on the two checkboxes (see its disabled prop),
          never on doc count. Without saying so, though, there's no visible
          difference between "still working on step 3" and "genuinely done
          with nothing to attach," so a client with no file yet (e.g. a
          Retainer prospect with no specific RFP in hand) has no way to
          tell they can already finish. */}
      <p className="text-body-sm text-on-surface-variant">
        No file yet? That's fine — you can send this now and add it later from your dashboard.
      </p>

      {error && <p className="text-body-md text-error">{error}</p>}

      <label className="flex items-start gap-3 text-body-md text-on-surface-variant">
        <input
          type="checkbox"
          checked={infoAttested}
          onChange={(e) => setInfoAttested(e.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 rounded border-outline-variant text-primary focus:ring-primary"
        />
        I certify that all information provided in this submission is true and accurate to the
        best of my knowledge.
      </label>

      <label className="flex items-start gap-3 text-body-md text-on-surface-variant">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 rounded border-outline-variant text-primary focus:ring-primary"
        />
        I understand that First Coast Bids helps prepare my bid but does not guarantee I will win the
        contract.
      </label>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleSaveDraft}
          disabled={saving}
          className="flex-1 py-3 px-4 bg-surface border border-outline-variant rounded text-label-md hover:bg-surface-container-high transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 flex items-center justify-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {saving && <Spinner />}
          {saving ? "Saving…" : "Save & finish later"}
        </button>
        <button
          type="button"
          onClick={handleFinalSubmit}
          disabled={saving || !acknowledged || !infoAttested}
          className="flex-1 py-3 px-4 bg-primary-container text-on-primary-container rounded text-label-md hover:opacity-90 transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 flex items-center justify-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {saving && <Spinner />}
          {saving ? "Sending…" : "Send it to us"}
          {!saving && <span className="material-symbols-outlined text-[18px]">arrow_forward</span>}
        </button>
      </div>
      <FadeMessage show={saved} className="text-body-md text-primary block">
        Saved. You can come back anytime.
      </FadeMessage>
    </div>
  );
}
