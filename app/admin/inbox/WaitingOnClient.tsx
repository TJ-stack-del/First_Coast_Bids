"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/Toast";
import { notifyClientOfMatch } from "@/lib/matches/notify-client";

export type WaitingDraft = {
  id: string;
  company_name: string;
  agency: string;
  solicitation_number: string | null;
  due_date: string | null;
  assigned_at: string;
  email_sent_at: string | null;
};

// Bids an admin assigned from Matches that the client hasn't finished yet.
// Assigning creates a *draft* submission (the client still has to attach
// their bid file), and the board below only lists finished submissions, so
// these used to be invisible from the inbox -- an assigned RFP looked lost
// (2026-09-23 production report). Only drafts created by an assignment are
// listed, never a visitor's abandoned intake form. Each row shows whether
// the client was actually emailed, with a resend.
export function WaitingOnClient({ drafts }: { drafts: WaitingDraft[] }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (drafts.length === 0) return null;

  async function resend(id: string) {
    setBusyId(id);
    const result = await notifyClientOfMatch(id);
    setBusyId(null);
    showToast(result.message, result.sent ? "success" : "error");
    if (result.sent) router.refresh();
  }

  return (
    <section aria-labelledby="waiting-on-client" className="mt-6 bg-surface-container-low rounded-xl shadow-sm overflow-hidden">
      <div className="px-gutter py-3 border-b border-outline-variant flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="waiting-on-client" className="text-[15px] font-headline uppercase tracking-wide font-bold text-on-surface">
          Waiting on client <span className="font-code text-body-sm">{drafts.length}</span>
        </h2>
        <p className="text-[12px] text-on-surface-variant">
          Assigned from Matches. Moves to the board once the client adds their bid file.
        </p>
      </div>
      <ul className="divide-y divide-outline-variant">
        {drafts.map((d) => (
          <li key={d.id} className="px-gutter py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
            <div className="min-w-0 flex-1">
              <p className="text-body-md font-bold text-on-surface break-words">{d.company_name}</p>
              <p className="text-body-sm text-on-surface-variant break-words">
                {d.agency}
                {d.solicitation_number ? ` · ${d.solicitation_number}` : ""}
              </p>
            </div>
            <div className="text-body-sm text-on-surface-variant font-code shrink-0">
              {d.due_date ? `Due ${new Date(d.due_date).toLocaleDateString()}` : "No deadline"} · Assigned{" "}
              {new Date(d.assigned_at).toLocaleDateString()}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {d.email_sent_at ? (
                <span className="text-body-sm text-secondary font-bold">
                  Emailed {new Date(d.email_sent_at).toLocaleDateString()}
                </span>
              ) : (
                <span className="text-body-sm text-error font-bold">Client not emailed</span>
              )}
              <button
                type="button"
                onClick={() => resend(d.id)}
                disabled={busyId === d.id}
                className="px-3 py-1.5 rounded-lg bg-surface-container-highest text-on-surface text-label-sm uppercase tracking-wider font-bold hover:opacity-90 transition-opacity active:scale-[0.97] disabled:opacity-40 flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {busyId === d.id && <Spinner />}
                {d.email_sent_at ? "Resend email" : "Send email"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
