"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// Admin-only in-app job aid, requested directly by Mike as something he can
// pull up without hunting for a separate document -- a slide-over drawer
// beats a PDF here because it lives in the same header on every admin page
// and can never go stale in a downloads folder somewhere. Content mirrors
// the REAL behavior of each admin screen as of this writing (stage names,
// button labels, thresholds) -- if that behavior changes, this needs a
// matching edit, the same way any other doc-in-code would.
//
// Plain <details>/<summary> per section rather than a hand-rolled accordion:
// fully keyboard- and screen-reader-operable with zero extra JS, and this
// is a reference panel, not a marketing surface -- native disclosure is the
// right tool, not a place to spend a custom interaction budget.
//
// Portalled into document.body (same pattern as Combobox.tsx's dropdown):
// this button renders inside AppShell's <header>, which has backdrop-blur.
// backdrop-filter establishes a containing block for position:fixed
// descendants, same as transform/filter/perspective would -- so without
// the portal, the drawer's "fixed inset-0" resolved against the ~65px
// header instead of the viewport, trapping the whole overlay and panel
// inside that sliver instead of covering the screen. A real reported bug,
// confirmed via a real screenshot showing exactly that.
export function AdminGuide() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Admin job aid"
        aria-label="Open admin job aid"
        className="w-11 h-11 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
      >
        <span className="material-symbols-outlined text-[22px]">help</span>
      </button>

      {open &&
        mounted &&
        createPortal(
          <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Admin job aid">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-full sm:w-[480px] bg-surface shadow-2xl overflow-y-auto motion-reduce:transition-none">
            <div className="sticky top-0 bg-surface border-b border-outline-variant px-6 py-4 flex items-center justify-between gap-3">
              <h2 className="text-title-lg text-primary font-bold">Admin job aid</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="w-9 h-9 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="px-6 py-5 flex flex-col gap-5">
              <p className="text-body-md text-on-surface-variant">
                A quick reference for the day-to-day workflow, not a full manual. Work reaches you two ways:
                a client submits through the intake form on their own, or you find an opportunity yourself and
                log it under Matches, then assign it to a client. Either way it becomes a submission that moves
                through five stages: Submitted, In Review, Deliverables Ready, Client Review, Closed.
              </p>

              <GuideSection title="Inbox" icon="inbox" defaultOpen>
                <GuideList
                  items={[
                    "Every client's submissions, oldest first. Drafts don't show up here yet since there's nothing to review.",
                    "Opening a submission that's still \"Submitted\" automatically moves it to \"In Review\" the moment you view it. That's how the queue knows you've started.",
                    "The banner at the top counts two things: submissions past the 48-hour turnaround promise (\"Past due\"), and submissions untouched for 3+ days (\"Needs attention\"). Click it to filter straight to those.",
                    "Board view groups by stage; List view is a sortable table/card list. Toggle at the top.",
                    "\"Include test submissions\" and \"Show closed\" are off/on by default for a reason: test rows never count toward the real queue, and closed work is done, so it's hidden by default.",
                    "Sort by submission order (first in, first worked) or by due date.",
                  ]}
                />
              </GuideSection>

              <GuideSection title="Working a submission" icon="assignment">
                <GuideList
                  items={[
                    "The colored badges up top are mechanical pre-flight checks (deliverable content present, certifications verified, no leftover [bracket placeholders]). Green means clear; amber means look closer before moving on.",
                    "Estimated value is admin-entered only, never asked of the client. Fill it in once you have a sense of the job's size; it drives the lean-package suggestion below.",
                    "Certifications: the client uploads the document from their own dashboard. Open it, then click \"Not yet reviewed → mark reviewed.\" A certification only counts as real anywhere generated (auto-drafts, the final PDF) once you've verified it, and you can't verify one with no document on file.",
                    "Move to stage: click any stage to move the submission there. This can send the client a real notification email; a message under the buttons tells you whether it sent, and why not if it didn't (test submission, no email on file, no template for that stage).",
                    "Compliance checklist: whatever you type here is exactly what the client sees on their own dashboard as \"What we still need from you.\" Update status per item: Not started, In progress, Done, Waived.",
                    "Internal notes are private. The client never sees these.",
                    "Payment: link a package (new, or reuse one already on file for that client, useful for retainer clients with several bids), then toggle Paid/Unpaid. That toggle is the real gate on the client being able to download deliverables. Pilot packages are always unlocked regardless, since those are on the house.",
                    "Deliverables: for each of the three core types, either Auto-draft (generates a starting draft to edit), type your own, or upload a file. Once all three have real content, the stage advances to Deliverables Ready automatically, but not while any of them still has a [bracketed placeholder] left in it. For a small/informal job under the lean-package threshold, switch to the lean 3-document set instead (Settings controls that dollar threshold).",
                    "Preview packet / Download packet combine everything prepared so far into the actual client-facing document.",
                    "Request info from client: pick an outstanding checklist item to email the client about it directly (marks it in progress), or choose \"Other\" to write a one-off request, which also adds it to the checklist.",
                    "Fit check runs on its own right when a client submits, or when you assign a matched opportunity. You don't trigger it yourself.",
                    "Mark as test submission for rehearsal or demo work; it then gets excluded from revenue totals and queue priority. Delete submission is permanent and asks you to type the agency name to confirm.",
                    "The audit log at the bottom is a timestamped record of everything that's happened on this submission.",
                  ]}
                />
              </GuideSection>

              <GuideSection title="Matches" icon="travel_explore">
                <GuideList
                  items={[
                    "For opportunities you find yourself rather than ones a client brings you. Upload the actual solicitation file to auto-fill the fields below, or type them in by hand: Title, Agency, Solicitation #, Due date, Scope.",
                    "Assign sends it to a client: this creates a draft submission for them with the agency/scope/due date already filled in, so they only need to attach the real bid file and send it.",
                    "Dismiss marks it as not being pursued. No submission gets created.",
                    "Deleting a logged opportunity here never touches a submission it already produced, only this review-queue entry.",
                  ]}
                />
              </GuideSection>

              <GuideSection title="Messages" icon="mail">
                <GuideList
                  items={[
                    "This is the general contact form from firstcoastbids.com/contact, not client-submission messaging (that lives on each submission's own detail page).",
                    "Mark read/unread to track what you've handled. There's no reply button here; reply using the sender's own email address shown on each message.",
                  ]}
                />
              </GuideSection>

              <GuideSection title="Settings" icon="settings">
                <GuideList
                  items={[
                    "One control today: Lean package threshold, the dollar amount below which the Deliverables panel suggests the lean 3-document package instead of the full set. Defaults to $35,000 (Florida's own state Category Two threshold): adjust it if a local agency you deal with often uses a different number.",
                  ]}
                />
              </GuideSection>

              <GuideSection title="Demoing to a prospect" icon="co_present">
                <GuideList
                  items={[
                    "Use a dedicated demo account, never a real client's data. Sign up through the normal intake flow with an obviously fake company name (e.g. \"Sample Co Demo\"), then open its submission from the inbox and mark it as a test submission. Test submissions are excluded from revenue totals and queue priority, so it never pollutes real reporting.",
                    "Set it up ahead of time, not live on the call. Move the demo submission through a couple of stages and prepare at least one real-looking deliverable beforehand, so you're not waiting on an empty checklist or a blank draft mid-pitch.",
                    "Open on the homepage: the \"before and after\" panel under the hero is the fastest way to show the actual transformation (messy RFP in, clean package out) in one screenshot-sized moment.",
                    "Walk the intake wizard from their seat: three short steps, plain-language questions, and the optional \"upload a document to autofill\" step. Point out there's no card required and no long form.",
                    "Show the client dashboard next: the compliance checklist (\"What we still need from you\"), stage progress, and the messaging thread. This is what they'll actually live in after they sign up.",
                    "If it feels right, show one screen from your own side (the submission detail page) to build trust: a real person checking off a compliance checklist reads as more credible than an all-automated process. Skip this if they're more interested in speed than process.",
                    "Close on a real, finished deliverable: open Preview packet on the demo submission so they see an actual capability statement and compliance matrix, not a mockup.",
                    "Wrap up with pricing (Pilot for a free first bid, One-off, Retainer) and a clear next step: send them straight to /intake, or start it together on the call.",
                    "Never open another real client's inbox row or submission during a demo, even by accident. If the inbox is already open on your screen, filter or scroll to the demo row before you start sharing.",
                  ]}
                />
              </GuideSection>
            </div>
          </div>
        </div>,
          document.body
        )}
    </>
  );
}

function GuideSection({
  title,
  icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group border border-outline-variant rounded-xl overflow-hidden"
    >
      <summary className="flex items-center gap-2 px-4 py-3 bg-surface-container-low cursor-pointer select-none text-title-lg text-primary font-bold list-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary">
        <span className="material-symbols-outlined text-[20px]">{icon}</span>
        {title}
        <span className="material-symbols-outlined text-[20px] ml-auto text-on-surface-variant transition-transform group-open:rotate-180">
          expand_more
        </span>
      </summary>
      <div className="px-4 py-3">{children}</div>
    </details>
  );
}

function GuideList({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5 text-body-md text-on-surface-variant">
          <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
