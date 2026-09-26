"use client";

import { LifecycleStepper, stageNumber } from "@/components/ui/LifecycleStepper";
import { DeliverablesSection } from "./DeliverablesSection";
import { SubmissionMessages } from "@/components/ui/SubmissionMessages";
import { WageCheckNotice } from "./WageCheckNotice";
import { formatDue } from "@/lib/dashboard/format-due";
import type { Submission, ChecklistItem, Deliverable } from "./page";

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

// The detail body of one bid row on the client dashboard (BidLedger.tsx
// owns the row, its one-line summary and which row is open). Everything a
// client can see about a bid: progress steps, site-visit warning,
// deadline/value, wage law check, trade note, scope, the "what we still
// need from you" checklist, deliverables and messages. Warnings that must
// never be hidden also show as flags on the collapsed row.
export function SubmissionCard({
  submission,
  checklist,
  deliverables,
  tradeKnown,
  pkg,
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
  orgId: string;
  clientId: string;
  senderName: string;
  senderEmail: string;
}) {
  const showDeliverables = stageNumber(submission.stage) >= stageNumber("deliverables_ready");
  const formattedValue = formatCurrency(submission.estimated_value);
  const pendingChecklistCount = checklist.filter((c) => c.status !== "done" && c.status !== "waived").length;

  return (
    <div className="flex flex-col gap-space-base">
      {pkg && (
        <p className="text-body-sm text-on-surface-variant">
          Package: <span className="capitalize">{pkg.package_type.replace(/_/g, " ")}</span>
        </p>
      )}
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
          <p className="text-body-lg text-on-surface font-bold mt-0.5 font-code">
            {formatDue(submission.due_date) ?? "Not set"}
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

      <div id={`bid-${submission.id}-checklist`} className="bg-surface-container-lowest rounded-lg overflow-hidden scroll-mt-24">
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
        <div id={`bid-${submission.id}-deliverables`} className="scroll-mt-24">
          <DeliverablesSection
            submissionId={submission.id}
            orgId={orgId}
            clientId={clientId}
            deliverables={deliverables}
            stage={submission.stage}
          />
        </div>
      )}

      <SubmissionMessages
        submissionId={submission.id}
        orgId={orgId}
        clientId={clientId}
        viewerRole="client"
        headingLevel={4}
        senderName={senderName}
        senderEmail={senderEmail}
      />
    </div>
  );
}
