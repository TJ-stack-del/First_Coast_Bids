"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/Spinner";
import { FadeMessage } from "@/components/ui/FadeMessage";
import { useToast } from "@/components/Toast";

type Note = { id: string; note: string; created_at: string };
type ChecklistItem = { id: string; label: string; status: string; notes: string | null };

const STAGES = [
  "submitted",
  "in_review",
  "deliverables_ready",
  "client_review",
  "closed",
];

// Human text for the notify route's non-error "not sent" reasons — these
// aren't failures, so they're shown in a neutral tone, not error red.
const SKIP_REASON_LABELS: Record<string, string> = {
  test_submission: "test submission, no email sent",
  no_client_email: "client has no email on file",
  no_template_for_stage: "no email template for this stage",
  queued_for_retry: "email queued for automatic retry",
  delivery_failed: "email delivery needs manual attention",
  delivery_status_unconfirmed: "email sent; delivery record needs review",
};

export function AdminSubmissionActions({
  submissionId,
  actorId,
  currentStage,
  checklist,
  notes,
}: {
  submissionId: string;
  actorId: string;
  currentStage: string;
  checklist: ChecklistItem[];
  notes: Note[];
}) {
  const [stage, setStage] = useState(currentStage);
  // Stage can now also change from outside this component's own button
  // clicks — DeliverablesPanel's auto-advance (in_review → deliverables_ready)
  // updates the DB directly and calls router.refresh(), which re-renders this
  // component with a new currentStage prop. useState's initial value only
  // applies on mount, so without this the "Move to stage" highlight and the
  // banner below would silently go stale after an auto-advance.
  useEffect(() => {
    setStage(currentStage);
  }, [currentStage]);
  const [noteText, setNoteText] = useState("");
  const [localNotes, setLocalNotes] = useState(notes);
  const [localChecklist, setLocalChecklist] = useState(checklist);
  const [checklistLabel, setChecklistLabel] = useState("");
  const [addingChecklistItem, setAddingChecklistItem] = useState(false);
  const [savingStage, setSavingStage] = useState(false);
  const [notifySkipReason, setNotifySkipReason] = useState<string | null>(null);
  const [notifySuccess, setNotifySuccess] = useState(false);
  const [addingNote, setAddingNote] = useState(false);
  const [savedChecklistIds, setSavedChecklistIds] = useState<Record<string, boolean>>({});
  const supabase = createClient();
  const { showToast } = useToast();

  async function handleStageChange(newStage: string) {
    if (newStage === stage) return;
    setSavingStage(true);
    setNotifySkipReason(null);
    setNotifySuccess(false);

    try {
      const res = await fetch(`/api/admin/submissions/${submissionId}/transition-stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedStage: stage,
          newStage,
          trigger: "manual",
          requestId: crypto.randomUUID(),
        }),
      });
      const data = await res.json();
      if (res.status === 409) {
        if (typeof data?.currentStage === "string") setStage(data.currentStage);
        showToast(data?.error ?? "The stage changed in another tab.", "error");
        return;
      }
      if (!res.ok) throw new Error(data?.error ?? "Couldn't save the stage change.");

      if (typeof data?.currentStage === "string") setStage(data.currentStage);
      if (data.sent) {
        setNotifySuccess(true);
      } else if (data.reason && data.reason !== "unchanged") {
        setNotifySkipReason(data.reason ?? "skipped");
      }
      if (
        data.reason === "delivery_failed" ||
        data.reason === "delivery_status_unconfirmed"
      ) {
        showToast(
          data.reason === "delivery_status_unconfirmed"
            ? "Stage saved and email accepted, but its delivery record needs review."
            : "Stage saved, but email delivery needs manual attention.",
          "error"
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't save the stage change.";
      showToast(message, "error");
    } finally {
      setSavingStage(false);
    }
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteText.trim()) return;
    setAddingNote(true);

    const { data: newNote } = await supabase
      .from("admin_notes")
      .insert({ submission_id: submissionId, author_id: actorId, note: noteText })
      .select()
      .single();

    if (newNote) {
      setLocalNotes((n) => [newNote, ...n]);
      setNoteText("");
    }
    setAddingNote(false);
  }

  async function handleChecklistChange(itemId: string, newStatus: string) {
    const { error } = await supabase.from("checklist_items").update({ status: newStatus }).eq("id", itemId);
    if (!error) {
      setSavedChecklistIds((s) => ({ ...s, [itemId]: true }));
      setTimeout(() => setSavedChecklistIds((s) => ({ ...s, [itemId]: false })), 1500);
    }
  }

  async function handleAddChecklistItem(e: React.FormEvent) {
    e.preventDefault();
    if (!checklistLabel.trim()) return;
    setAddingChecklistItem(true);

    const { data: newItem, error } = await supabase
      .from("checklist_items")
      .insert({ submission_id: submissionId, label: checklistLabel.trim() })
      .select()
      .single();

    if (error || !newItem) {
      showToast(error?.message ?? "Couldn't add that item.", "error");
    } else {
      setLocalChecklist((c) => [...c, newItem]);
      setChecklistLabel("");
    }
    setAddingChecklistItem(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
        <h2 className="text-title-lg text-primary mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[20px]">timeline</span>
          Move to stage
          {savingStage && <Spinner className="text-primary" />}
        </h2>
        <div className="flex flex-wrap gap-2">
          {STAGES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => handleStageChange(s)}
              disabled={savingStage}
              className={`px-3 py-2 rounded text-label-md border transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                stage === s
                  ? "bg-primary-container text-on-primary-container border-primary"
                  : "bg-surface border-outline-variant text-on-surface hover:bg-surface-container-high"
              }`}
            >
              {s.replace(/_/g, " ")}
            </button>
          ))}
        </div>
        <FadeMessage show={notifySuccess} className="text-body-md text-primary block mt-3">
          Client notified by email.
        </FadeMessage>
        {notifySkipReason && (
          <p className="text-body-md text-on-surface-variant mt-3">
            Client not notified: {SKIP_REASON_LABELS[notifySkipReason] ?? notifySkipReason}.
          </p>
        )}
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
        <h2 className="text-title-lg text-primary mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[20px]">fact_check</span>
          Compliance checklist
        </h2>
        {/* Shows up on the client's own dashboard as "What we still need
            from you" — this is the only way to put something on that list. */}
        <form onSubmit={handleAddChecklistItem} className="flex gap-2 mb-4">
          <input
            type="text"
            value={checklistLabel}
            onChange={(e) => setChecklistLabel(e.target.value)}
            placeholder="e.g. Complete your Company Profile (address, phone, insurance)…"
            className="flex-1 px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
          />
          <button
            type="submit"
            disabled={addingChecklistItem}
            className="px-4 py-2 bg-primary-container text-on-primary-container rounded text-label-md hover:opacity-90 hover:-translate-y-0.5 transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {addingChecklistItem && <Spinner />}
            Add
          </button>
        </form>

        {localChecklist.length > 0 ? (
          <div className="flex flex-col gap-3">
            {localChecklist.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3">
                <span className="text-body-md text-on-surface">{item.label}</span>
                <div className="flex items-center gap-2">
                  <FadeMessage show={!!savedChecklistIds[item.id]} className="text-label-md text-primary">
                    Saved
                  </FadeMessage>
                  <select
                    defaultValue={item.status}
                    onChange={(e) => handleChecklistChange(item.id, e.target.value)}
                    className="px-2 py-1 rounded border border-outline-variant bg-surface text-body-md text-on-surface transition outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
                  >
                    <option value="not_started">Not started</option>
                    <option value="in_progress">In progress</option>
                    <option value="done">Done</option>
                    <option value="waived">Waived</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-body-md text-on-surface-variant">Nothing on the checklist yet.</p>
        )}
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
        <h2 className="text-title-lg text-primary mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[20px]">edit_note</span>
          Internal notes
        </h2>
        <form onSubmit={handleAddNote} className="flex gap-2 mb-4">
          <input
            type="text"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add a note…"
            className="flex-1 px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
          />
          <button
            type="submit"
            disabled={addingNote}
            className="px-4 py-2 bg-primary-container text-on-primary-container rounded text-label-md hover:opacity-90 hover:-translate-y-0.5 transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {addingNote && <Spinner />}
            Add
          </button>
        </form>
        <ul className="flex flex-col gap-2">
          {localNotes.map((n) => (
            <li key={n.id} className="text-body-md text-on-surface-variant border-t border-outline-variant pt-2">
              {n.note}
              <span className="text-label-md block mt-1">
                {new Date(n.created_at).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
