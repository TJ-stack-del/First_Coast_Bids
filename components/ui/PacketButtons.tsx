"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { generateDeliverablesPacket } from "@/lib/pdf/deliverables-packet";
import { hasUnresolvedPlaceholders } from "@/lib/pdf/placeholder-check";

const DELIVERABLE_LABELS: Record<string, string> = {
  capability_statement: "Capability Statement",
  compliance_matrix: "Compliance Matrix",
  technical_narrative: "Technical Narrative",
  rate_sheet: "Rate Sheet",
  executive_cover: "Executive Cover",
  certificate_of_insurance: "Certificate of Insurance",
};
const FULL_ORDER = ["capability_statement", "compliance_matrix", "technical_narrative"];
const LEAN_ORDER = ["rate_sheet", "executive_cover", "certificate_of_insurance"];

// Drop this on both the admin submission detail page and the client
// dashboard: <PacketButtons submissionId={...} orgId={...} viewerRole="admin" | "client" />
//
// IMPORTANT: Preview never generates a real PDF file. Opening an actual
// PDF in a new tab uses the browser's own built-in viewer, which has its
// own download/print buttons — that would bypass the paywall entirely,
// since that's the browser's UI, not ours. Preview instead shows the
// same content as plain read-only text in an in-app modal, with no
// native save/print controls at all. Only Download produces a real file,
// and stays gated the same way the individual deliverable downloads are.
export function PacketButtons({
  submissionId,
  orgId,
  viewerRole,
  clientId,
}: {
  submissionId: string;
  orgId: string;
  viewerRole: "admin" | "client";
  // Only used for the client download-attestation flow below — admin's
  // own QC download never needs it, so callers on the admin side (e.g.
  // DeliverablesPanel.tsx) can omit it.
  clientId?: string;
}) {
  const [generating, setGenerating] = useState<"preview" | "download" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<{
    submission: any;
    deliverables: any[];
    // False for admin (always full content) and for a paid/pilot client.
    // True only when a client is looking at the sample -- drives the
    // modal's banner copy below.
    isSample: boolean;
  } | null>(null);
  // Set once a client's download has passed the payment gate and is
  // waiting on the attestation checkbox below — the actual file isn't
  // produced until handleConfirmDownload runs. Never set for
  // viewerRole === "admin", which skips straight to saveDoc.
  const [pendingDownload, setPendingDownload] = useState<{ submission: any; deliverables: any[] } | null>(null);
  const [downloadAttested, setDownloadAttested] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  // Admin viewing their own work-in-progress isn't a signal worth
  // recording — only the client's own view/download tells the admin
  // "they actually looked at this." No .select() on the insert: clients
  // can write to audit_log for their own submission but can't read it
  // back (admin-only per schema.sql), so asking for a returned row would
  // fail under RLS.
  async function logClientEvent(eventType: "client_viewed_packet" | "client_downloaded_packet") {
    if (viewerRole !== "client") return;
    await supabase.from("audit_log").insert({
      submission_id: submissionId,
      org_id: orgId,
      event_type: eventType,
    });
  }

  async function buildDoc() {
    const { data: submission, error: subError } = await supabase
      .from("submissions")
      .select(
        "agency, solicitation_number, due_date, scope, package_id, clients!submissions_client_id_fkey(company_name, contact_name, email, phone, naics_codes, set_asides, license_number, years_in_business, business_address, business_phone, insurance_provider, insurance_policy_number, general_liability_coverage, workers_comp_coverage, client_certifications(cert_type, other_label, verified))"
      )
      .eq("id", submissionId)
      .single();

    if (subError || !submission) throw new Error("Couldn't load this bid's details.");

    const { data: deliverables } = await supabase
      .from("deliverables")
      .select("deliverable_type, content, file_url")
      .eq("submission_id", submissionId);

    return { submission, deliverables: deliverables ?? [] };
  }

  async function isPaidOrPilot(packageId: string | null): Promise<boolean> {
    if (!packageId) return false;
    const { data: pkg } = await supabase
      .from("packages")
      .select("paid, package_type")
      .eq("id", packageId)
      .single();
    return !!pkg && (pkg.paid || pkg.package_type === "pilot");
  }

  // Only ever called when viewerRole === "client" — an admin previewing
  // the same shared component for QA never reaches this call at all, which
  // is what actually enforces "don't advance on an admin's own preview."
  // The route re-verifies ownership + current stage itself regardless of
  // what this component believes.
  async function maybeAdvanceOnPreview() {
    try {
      const res = await fetch("/api/advance-on-client-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId }),
      });
      const data = await res.json().catch(() => null);
      if (data?.advanced) router.refresh();
    } catch {
      // Best-effort — a failed auto-advance shouldn't block the preview.
    }
  }

  async function handlePreview() {
    setGenerating("preview");
    setError(null);
    try {
      if (viewerRole === "client") {
        // Goes through a server route, not buildDoc()'s direct client-side
        // query -- the whole point of a sample is that the full content
        // never reaches an unpaid client's browser in the first place. See
        // /api/preview-packet's own comment for why client-side truncation
        // of an already-fetched result wouldn't actually accomplish that.
        const res = await fetch("/api/preview-packet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ submissionId }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data) {
          throw new Error(data?.error || "Couldn't load the preview.");
        }
        setPreviewData({ submission: data.submission, deliverables: data.deliverables, isSample: !data.isPaidOrPilot });
        await logClientEvent("client_viewed_packet");
        await maybeAdvanceOnPreview();
      } else {
        const { submission, deliverables } = await buildDoc();
        setPreviewData({ submission, deliverables, isSample: false });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load the preview.");
    } finally {
      setGenerating(null);
    }
  }

  function saveDoc(submission: any, deliverables: any[]) {
    const doc = generateDeliverablesPacket(submission, deliverables);
    doc.save(`bid-package-${submission.agency.replace(/\s+/g, "-").toLowerCase()}.pdf`);
  }

  async function handleDownload() {
    setGenerating("download");
    setError(null);
    try {
      const { submission, deliverables } = await buildDoc();
      // Admin is the one producing this packet in the first place — the
      // payment gate exists to stop a CLIENT getting the finished file
      // before they've paid, not to stop staff pulling their own work
      // product to QC it or send it manually.
      const canDownload = viewerRole === "admin" || (await isPaidOrPilot(submission.package_id));
      if (!canDownload) {
        setError("Available once payment is confirmed.");
        return;
      }

      // A client must never receive a PDF that's still an unedited
      // auto-draft scaffold -- see placeholder-check.ts's header comment.
      // Admin's own QC download is deliberately exempt (same reasoning as
      // the payment-gate bypass above): staff need to pull the real,
      // in-progress state to see what still needs fixing, brackets
      // included -- that's the actual point of their download.
      if (viewerRole === "client") {
        const unresolved = deliverables.find(
          (d: any) => !d.file_url && hasUnresolvedPlaceholders(d.content)
        );
        if (unresolved) {
          setError("This packet isn't ready yet. Please check back soon or contact us if it's been a while.");
          return;
        }
      }

      // Client downloads need one more confirmation (the attestation
      // checkbox below) before the file is actually produced — see
      // handleConfirmDownload. Admin's own QC download skips straight
      // through to saveDoc, same as it already skips the payment gate
      // above: this attestation is a CLIENT confirming accuracy before
      // sending a document to an agency, not something that applies to
      // admin pulling their own work product.
      if (viewerRole === "client") {
        setPendingDownload({ submission, deliverables });
        return;
      }

      saveDoc(submission, deliverables);
      await logClientEvent("client_downloaded_packet");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't build the download.");
    } finally {
      setGenerating(null);
    }
  }

  async function handleConfirmDownload() {
    if (!pendingDownload || !clientId) return;
    setGenerating("download");
    setError(null);
    try {
      saveDoc(pendingDownload.submission, pendingDownload.deliverables);
      await logClientEvent("client_downloaded_packet");
      // Packet-level, not per-deliverable-type — the combined PDF is one
      // document a client reviews and downloads as a whole (see
      // DeliverablesSection.tsx's own simplification to a single
      // Preview/Download pair). Finer-grained attestation would need a
      // real per-type download action to attest against, which doesn't
      // exist.
      await supabase.from("download_attestations").insert({
        submission_id: submissionId,
        deliverable_type: "packet",
        attested_by: clientId,
      });
      await supabase.from("audit_log").insert({
        submission_id: submissionId,
        org_id: orgId,
        event_type: "download_attested",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't build the download.");
    } finally {
      setGenerating(null);
      setPendingDownload(null);
      setDownloadAttested(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handlePreview}
          disabled={generating !== null}
          className="px-4 py-2 rounded border border-primary text-primary text-label-md font-bold hover:bg-surface-container-low transition-colors disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {generating === "preview" ? "Loading…" : "Preview packet"}
        </button>
        <button
          type="button"
          onClick={handleDownload}
          disabled={generating !== null}
          className="px-4 py-2 rounded bg-primary-container text-on-primary-container text-label-md font-bold hover:opacity-90 transition-colors disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {generating === "download" ? "Building…" : "Download packet"}
        </button>
      </div>
      {error && <p className="text-body-md text-error">{error}</p>}

      {previewData && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6"
          onClick={() => setPreviewData(null)}
        >
          <div
            className="bg-surface-container-lowest rounded-xl max-w-2xl w-full max-h-[80vh] relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Watermark only — never appears in the actual downloaded PDF,
                which stays client-branded. Just a visual reminder that this
                in-app modal is a preview, not the deliverable itself. */}
            <Image
              src="/logo.svg"
              alt=""
              aria-hidden="true"
              width={180}
              height={40}
              className="absolute bottom-4 right-4 h-6 w-auto opacity-10 pointer-events-none select-none"
            />

            {/* Repeating diagonal text watermark, dynamic per client/date
                rather than generic — a light deterrent/traceability
                element if this modal is ever screenshotted despite
                select-none. overflow-hidden on this container clips the
                rotated grid at its edges; pointer-events-none keeps the
                real content (including the Close button) fully clickable
                underneath. Positioned relative to the OUTER modal box, not
                the scrollable content div below, so it stays put while
                that content scrolls — same as a real document watermark. */}
            <div
              aria-hidden="true"
              className="absolute inset-0 overflow-hidden pointer-events-none select-none z-0"
            >
              <div className="absolute inset-0 flex flex-wrap content-center justify-center gap-x-10 gap-y-6 rotate-[-30deg] scale-150 opacity-[0.07]">
                {Array.from({ length: 24 }).map((_, i) => (
                  <span key={i} className="text-on-surface text-label-sm font-bold whitespace-nowrap">
                    PREVIEW · {previewData.submission.clients?.company_name ?? "First Coast Bids"} ·{" "}
                    {new Date().toLocaleDateString()}
                  </span>
                ))}
              </div>
            </div>

            <div className="max-h-[80vh] overflow-y-auto p-8">
              <button
                type="button"
                onClick={() => setPreviewData(null)}
                className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface text-label-md font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-sm"
              >
                Close
              </button>
              <p className={`text-label-md text-error font-bold uppercase tracking-wide ${previewData.isSample ? "mb-1" : "mb-4"}`}>
                {previewData.isSample ? "Sample preview, not for distribution" : "Preview only, not for distribution"}
              </p>
              {previewData.isSample && (
                <p className="text-body-sm text-on-surface-variant mb-4">
                  This shows a real excerpt of each deliverable. The full package unlocks once payment is confirmed.
                </p>
              )}
              <h2 className="text-headline-md text-on-surface mb-1">
                {previewData.submission.clients?.company_name}
              </h2>
              <p className="text-body-md text-on-surface-variant mb-6">
                {previewData.submission.agency}
              </p>
              {(previewData.deliverables.some((d) => LEAN_ORDER.includes(d.deliverable_type))
                ? LEAN_ORDER
                : FULL_ORDER
              ).map((type) => {
                const d = previewData.deliverables.find((x) => x.deliverable_type === type);
                return (
                  <div key={type} className="mb-6">
                    <h3 className="text-title-lg text-on-surface font-bold mb-2">
                      {DELIVERABLE_LABELS[type]}
                    </h3>
                    <p className="text-body-md text-on-surface-variant whitespace-pre-wrap select-none">
                      {d?.content || "Not yet prepared."}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {pendingDownload && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6"
          onClick={() => {
            setPendingDownload(null);
            setDownloadAttested(false);
            setError(null);
          }}
        >
          <div
            className="bg-surface-container-lowest rounded-xl max-w-md w-full p-6 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-title-lg text-on-surface font-bold">Before you download</h3>
            <label className="flex items-start gap-3 text-body-md text-on-surface-variant">
              <input
                type="checkbox"
                checked={downloadAttested}
                onChange={(e) => setDownloadAttested(e.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 rounded border-outline-variant text-primary focus:ring-primary"
              />
              I&apos;ve reviewed this document, resolved any placeholders, and confirm it&apos;s
              accurate before submitting it to the agency.
            </label>
            {error && <p className="text-body-md text-error">{error}</p>}
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => {
                  setPendingDownload(null);
                  setDownloadAttested(false);
                  setError(null);
                }}
                disabled={generating !== null}
                className="px-4 py-2 rounded border border-outline-variant text-on-surface text-label-md font-bold hover:bg-surface-container-high transition-colors disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDownload}
                disabled={generating !== null || !downloadAttested}
                className="px-4 py-2 rounded bg-primary-container text-on-primary-container text-label-md font-bold hover:opacity-90 transition-colors disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {generating === "download" ? "Building…" : "Confirm & download"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
