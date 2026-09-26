"use client";

import { PacketButtons } from "@/components/ui/PacketButtons";

type Deliverable = {
  id: string;
  deliverable_type: string;
  file_url: string | null;
  content: string | null;
  created_at: string;
};

// Simplified per Mike's ask: one Preview/Download pair for the complete
// packet (PacketButtons), not a separate Preview/Download row per
// deliverable type plus a combined packet below it -- that read as
// redundant, since PacketButtons' own preview modal already breaks out
// every deliverable type with its own heading in one place, and its
// download already produces the full combined PDF. The one real
// capability this drops: downloading a single deliverable type on its
// own as a raw .txt file (the old per-row Download did that) -- only the
// full packet can be downloaded now.
const CORE_TYPES = ["capability_statement", "compliance_matrix", "technical_narrative"];
const CORE_LABELS: Record<string, string> = {
  capability_statement: "Capability Statement",
  compliance_matrix: "Compliance Matrix",
  technical_narrative: "Technical Narrative",
};
const CORE_ICONS: Record<string, string> = {
  capability_statement: "badge",
  compliance_matrix: "fact_check",
  technical_narrative: "description",
};

export function DeliverablesSection({
  submissionId,
  orgId,
  clientId,
  deliverables,
  stage,
}: {
  submissionId: string;
  orgId: string;
  clientId: string;
  deliverables: Deliverable[];
  // Only "deliverables_ready" actually triggers the auto-advance-on-preview
  // behavior (see app/api/advance-on-client-preview/route.ts's own stage
  // check) -- the notice below only applies then, not once it's already
  // moved on to client_review.
  stage: string;
}) {
  // Real per-type status (a submission using the lean package instead
  // ships rate_sheet/executive_cover/certificate_of_insurance -- this list
  // only ever shows core-type rows it actually finds, never invents a
  // "pending" row for a type this submission was never going to produce).
  const present = CORE_TYPES.filter((t) => deliverables.some((d) => d.deliverable_type === t));

  // A row existing is not the same as it being done -- DeliverablesPanel.tsx's
  // own admin-side auto-advance check already treats an empty save as
  // incomplete (maybeAutoAdvance requires file_url or non-empty trimmed
  // content); this used to just check row existence, meaning an admin
  // could save a blank textarea and a client would see "Ready" on a
  // document with nothing in it. Same completeness rule, both sides now.
  function isComplete(type: string): boolean {
    return deliverables.some((d) => d.deliverable_type === type && (!!d.file_url || !!d.content?.trim()));
  }
  const readyCount = present.filter(isComplete).length;

  return (
    <div className="bg-surface-container-low rounded-xl shadow-sm overflow-hidden">
      <div className="px-space-base py-space-sm border-b border-outline-variant bg-surface-container-high flex items-center justify-between">
        {/* h4: sits inside a bid row's h3 on the dashboard (BidLedger.tsx). */}
        <h4 className="text-[16px] font-headline font-bold text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[20px]" aria-hidden="true">download</span>
          Your deliverables
        </h4>
        {deliverables.length > 0 && (
          <span className="text-label-sm text-secondary font-bold font-code">
            {readyCount} of {present.length} ready
          </span>
        )}
      </div>

      {deliverables.length > 0 ? (
        <div className="flex flex-col gap-space-sm p-space-base">
          {present.map((type) => (
            <div
              key={type}
              className="flex items-center gap-space-sm bg-surface-container-lowest rounded-lg px-space-md py-space-sm"
            >
              <span className="material-symbols-outlined text-secondary text-[20px]">{CORE_ICONS[type]}</span>
              <span className="flex-1 text-body-md text-on-surface font-semibold">{CORE_LABELS[type]}</span>
              {isComplete(type) ? (
                <span className="inline-flex px-2 py-0.5 rounded text-label-sm font-bold uppercase tracking-wider bg-secondary-container text-on-secondary-container">
                  Ready
                </span>
              ) : (
                <span className="inline-flex px-2 py-0.5 rounded text-label-sm font-bold uppercase tracking-wider bg-tertiary-container text-on-tertiary-container">
                  In progress
                </span>
              )}
            </div>
          ))}
          <div className="pt-space-xs flex flex-col gap-space-xs">
            <PacketButtons submissionId={submissionId} orgId={orgId} clientId={clientId} viewerRole="client" />
            {stage === "deliverables_ready" && (
              <p className="text-label-sm text-on-surface-variant">
                Opening the preview moves this bid to Client Review.
              </p>
            )}
          </div>
        </div>
      ) : (
        <p className="text-body-md text-on-surface-variant px-space-base py-6">Being prepared.</p>
      )}
    </div>
  );
}
