"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/Toast";
import { buildSingleItemRequestDraft } from "@/lib/client-info-request";

type ChecklistItem = { id: string; label: string; status: string };

const OTHER_VALUE = "__other__";

// Consolidates around the checklist as the single source of truth for
// "what's outstanding," per BUILD-ORDER-BIDPULSE.md: this used to be a
// standalone freeform box that happened to create a checklist item as a
// side effect (backwards -- messaging was creating tracking). Now the
// primary path is picking an EXISTING checklist item and sending a
// notification tied to it; "Other" is the fallback for something not
// already tracked, which still creates a new item exactly as before.
export function RequestInfoForm({
  submissionId,
  prefillText,
  checklist,
}: {
  submissionId: string;
  prefillText: string;
  checklist: ChecklistItem[];
}) {
  // Only items still actually outstanding are worth requesting again --
  // a done/waived item has nothing left to ask for.
  const openItems = checklist.filter((item) => item.status !== "done" && item.status !== "waived");

  const [selected, setSelected] = useState<string>(OTHER_VALUE);
  const [message, setMessage] = useState(prefillText);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const { showToast } = useToast();

  function handleSelect(value: string) {
    setSelected(value);
    if (value === OTHER_VALUE) {
      setMessage(prefillText);
    } else {
      const item = openItems.find((i) => i.id === value);
      setMessage(item ? buildSingleItemRequestDraft(item.label) : "");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setSubmitting(true);

    try {
      const res = await fetch("/api/request-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId,
          message: message.trim(),
          checklistItemId: selected === OTHER_VALUE ? null : selected,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        showToast(data.error ?? "Couldn't send the request.", "error");
        return;
      }

      if (data.sent) {
        showToast("Request sent to client.", "success");
      } else if (data.reason === "test_submission") {
        showToast("Checklist item updated (test submission, no email sent).", "success");
      } else if (data.reason === "no_client_email") {
        showToast("Checklist item updated, but this client has no email on file.", "error");
      }

      setSelected(OTHER_VALUE);
      setMessage(prefillText);
      router.refresh();
    } catch {
      showToast("Couldn't send the request.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
      <h3 className="text-title-lg text-primary mb-4 flex items-center gap-2">
        <span className="material-symbols-outlined text-primary text-[20px]">mail</span>
        Request info from client
      </h3>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {openItems.length > 0 && (
          <div>
            <label className="text-label-md text-on-surface-variant block mb-1">What do you need?</label>
            <select
              value={selected}
              onChange={(e) => handleSelect(e.target.value)}
              className="w-full px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
            >
              {openItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
              <option value={OTHER_VALUE}>Other (write your own)</option>
            </select>
          </div>
        )}
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          placeholder="What do you need from the client?"
          className="w-full px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
        />
        <p className="text-label-md text-on-surface-variant">
          {selected === OTHER_VALUE
            ? "This creates a checklist item the client can see and emails them directly."
            : "This emails the client about the selected checklist item and marks it in progress."}
        </p>
        <button
          type="submit"
          disabled={submitting || !message.trim()}
          className="self-start py-2.5 px-5 bg-primary-container text-on-primary-container rounded text-label-md font-semibold hover:opacity-90 hover:-translate-y-0.5 transition active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {submitting && <Spinner />}
          {submitting ? "Sending…" : "Send request"}
        </button>
      </form>
    </div>
  );
}
