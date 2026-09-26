"use client";

import { useState } from "react";
import { LifecycleStepper, stageNumber } from "@/components/ui/LifecycleStepper";
import { DeliverablesSection } from "./DeliverablesSection";
import { SubmissionMessages } from "@/components/ui/SubmissionMessages";
import { WageCheckNotice } from "./WageCheckNotice";
import type { Submission, ChecklistItem, Deliverable } from "./page";
import { displayAgency } from "@/lib/agency-display";

const CHECKLIST_STATUS_LABELS: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  done: "Done",
  waived: "Waived",
};

function formatCurrency(value: number | null): string | null {
  if (value == null) return null;
  return `$${value.toLocaleString()}`;
}

// Collapsible per the client-dashboard polish request: the identity row,
// stage progress, and deadline/value stats stay visible either way (enough
// to scan a bid at a glance), while the heavier content -- trade note,
// scope, "what we still need from you" checklist, deliverables, message
// thread -- collapses so a client with several bids doesn't scroll through
// full detail on every one. Defaults open when there's something to act on
// (a pending checklist item, or deliverables once they exist); collapses by
// default otherwise.
export function SubmissionCard({
  submission,
  checklist,
  deliverables,
  tradeKnown,
  pkg,
  companyName,
  orgId,
  clientId,
  senderName,
  senderEmail,
}: {
  submission: Submission;
  checklist: ChecklistItem[];
  deliverables: Deliverable[];
  tradeKnown: boolean;
  pkg: { package_type: string; price_note: string | null } | null;
  companyName: string;
  orgId: string;
  clientId: string;
  senderName: string;
  senderEmail: string;
}) {
  const showDeliverables = stageNumber(submission.stage) >= stageNumber("deliverables_ready");
  const formattedValue = formatCurrency(submission.estimated_value);
  const pendingChecklistCount = checklist.filter((c) => c.status !== "done" && c.status !== "waived").length;
  const [open, setOpen] = useState(pendingChecklistCount > 0 || deliverables.length > 0);

  return (
    <div className="bg-surface-container-low rounded-xl shadow-md overflow-hidden">
      <div className="p-space-base flex flex-col gap-space-base">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-label-sm text-primary font-bold uppercase tracking-wider">
              <span>{submission.solicitation_number ?? "No solicitation #"}</span>
              <span className="text-outline-variant">·</span>
              <span className="text-on-surface-variant normal-case font-medium">{companyName}</span>
            </div>
            <h3 className="text-headline-md font-headline text-on-surface font-bold mt-1">{displayAgency(submission.agency)}</h3>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {pkg && (
              <span className="px-2 py-0.5 rounded bg-surface-container-highest text-on-surface-variant text-label-sm font-bold uppercase tracking-wider capitalize">
                {pkg.package_type.replace(/_/g, " ")}
              </span>
            )}
            {submission.is_test && (
              <span className="px-2 py-0.5 rounded bg-surface-container-highest text-on-surface-variant text-label-sm font-bold uppercase tracking-wider">
                Test
              </span>
            )}
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-label={open ? "Collapse bid details" : "Expand bid details"}
              className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
            >
              {/* One chevron that turns, rather than two glyphs swapped -- the
                  rotation is the acknowledgment that the card heard the click. */}
              <span
                className={`material-symbols-outlined text-[20px] transition-transform duration-200 ease-out motion-reduce:transition-none ${
                  open ? "rotate-180" : ""
                }`}
                aria-hidden="true"
              >
                expand_more
              </span>
            </button>
          </div>
        </div>

        <LifecycleStepper currentStage={stageNumber(submission.stage)} />

        {submission.mandatory_site_visit_concern && (
          <div className="bg-error-container/10 border border-error/30 rounded-xl p-space-base flex gap-space-md">
            <span className="material-symbols-outlined text-error text-[20px] shrink-0">warning</span>
            <div>
              <p className="text-label-sm text-error font-bold uppercase tracking-wider mb-1">
                Mandatory site visit: read this
              </p>
              <p className="text-body-md text-on-surface">{submission.mandatory_site_visit_explanation}</p>
            </div>
          </div>
        )}

        <div className={`grid gap-space-sm ${formattedValue ? "grid-cols-2" : "grid-cols-1"}`}>
          <div className="bg-surface-container-lowest rounded-lg p-space-md">
            <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">Submission deadline</p>
            <p className="text-body-lg text-on-surface font-bold mt-0.5">
              {submission.due_date ? new Date(submission.due_date).toLocaleDateString() : "Not set"}
            </p>
          </div>
          {formattedValue && (
            <div className="bg-surface-container-lowest rounded-lg p-space-md">
              <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">Estimated value</p>
              <p className="text-body-lg text-on-surface font-bold mt-0.5 font-code">{formattedValue}</p>
            </div>
          )}
        </div>

        {/* Always visible (not in the collapsible part): a below-floor
            warning must never be hidden. */}
        {submission.wage_check && <WageCheckNotice check={submission.wage_check} />}

        {/* Opening drops the details in from under the header; closing is
            instant (exits faster than entrances, and nothing is left to read). */}
        {open && (
          <div className="animate-disclose flex flex-col gap-space-base">
            {!tradeKnown && (
              <div className="bg-surface-container-high border border-tertiary/30 rounded-xl p-space-base flex gap-space-md">
                <span className="material-symbols-outlined text-tertiary text-[20px] shrink-0">info</span>
                <div>
                  <p className="text-label-sm text-on-surface font-bold uppercase tracking-wider mb-1">
                    A note about your trade
                  </p>
                  <p className="text-body-md text-on-surface-variant">
                    We&apos;re still building extra bid-help for your kind of business, but we&apos;ll still write
                    your capability statement and approach summary in full. Our compliance checklist might not
                    catch everything specific to your trade yet, so our team will flag anything that needs your
                    attention while reviewing your bid. You can always ask us directly if you&apos;re not sure
                    about something.
                  </p>
                </div>
              </div>
            )}

            {submission.scope && (
              <div>
                <p className="text-label-sm text-on-surface-variant uppercase tracking-wider mb-1">Scope</p>
                <p className="text-body-md text-on-surface-variant">{submission.scope}</p>
              </div>
            )}

            <div className="bg-surface-container-lowest rounded-lg overflow-hidden">
              <div className="px-space-md py-space-sm flex items-center justify-between">
                <h4 className="text-label-sm text-on-surface font-bold uppercase tracking-wider flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[18px]">fact_check</span>
                  What we still need from you
                </h4>
                {pendingChecklistCount > 0 && (
                  <span className="text-label-sm text-primary font-bold font-code">
                    {pendingChecklistCount} pending
                  </span>
                )}
              </div>
              {checklist.length > 0 ? (
                <div className="flex flex-col">
                  {checklist.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between px-space-md py-space-sm border-t border-outline-variant ${
                        item.status === "done" ? "opacity-70" : ""
                      }`}
                    >
                      <span className={`text-body-md text-on-surface ${item.status === "done" ? "line-through" : ""}`}>
                        {item.label}
                        {item.notes && <span className="block text-body-sm text-on-surface-variant">{item.notes}</span>}
                      </span>
                      <span className="text-label-sm px-2 py-0.5 rounded font-bold bg-surface-container-high text-on-surface-variant uppercase tracking-wider">
                        {CHECKLIST_STATUS_LABELS[item.status] ?? item.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-body-md text-on-surface-variant px-space-md py-4">Nothing pending right now.</p>
              )}
            </div>

            {showDeliverables && (
              <DeliverablesSection
                submissionId={submission.id}
                orgId={orgId}
                clientId={clientId}
                deliverables={deliverables}
                stage={submission.stage}
              />
            )}

            <SubmissionMessages
              submissionId={submission.id}
              orgId={orgId}
              clientId={clientId}
              viewerRole="client"
              senderName={senderName}
              senderEmail={senderEmail}
            />
          </div>
        )}
      </div>
    </div>
  );
}
