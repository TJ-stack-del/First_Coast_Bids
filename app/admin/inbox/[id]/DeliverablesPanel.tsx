"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/Spinner";
import { FadeMessage } from "@/components/ui/FadeMessage";
import { PacketButtons } from "@/components/ui/PacketButtons";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { signRfpDocumentUrl, uploadRfpDocument } from "@/lib/storage";
import { useToast } from "@/components/Toast";
import {
  FULL_DELIVERABLE_TYPES as FULL_TYPE_VALUES,
  LEAN_DELIVERABLE_TYPES as LEAN_TYPE_VALUES,
  isLeanEligible,
} from "@/lib/deliverables/package-routing";

type Deliverable = {
  id: string;
  deliverable_type: string;
  file_url: string | null;
  content: string | null;
  created_at: string;
};

type RfpRequirement = {
  requirement: string;
  detail: string;
  quote: string;
  page: number | null;
  source_file: string | null;
};

const DELIVERABLE_LABELS: Record<string, string> = {
  capability_statement: "Capability statement",
  compliance_matrix: "Compliance matrix",
  technical_narrative: "Technical narrative",
  rate_sheet: "Rate sheet",
  executive_cover: "Executive cover",
  certificate_of_insurance: "Certificate of insurance",
};

// {value, label} pairs, built from the shared source-of-truth type lists in
// lib/deliverables/package-routing.ts -- see that file's header comment for
// why the actual mode switch stays a manual admin action rather than
// something estimated_value flips on its own.
const FULL_DELIVERABLE_TYPES = FULL_TYPE_VALUES.map((value) => ({ value, label: DELIVERABLE_LABELS[value] }));
const LEAN_DELIVERABLE_TYPES = LEAN_TYPE_VALUES.map((value) => ({ value, label: DELIVERABLE_LABELS[value] }));

function deliverableLabel(type: string) {
  return DELIVERABLE_LABELS[type] ?? type;
}

// The compliance matrix stays one freeform pipe-delimited text blob (an
// admin can hand-edit/reformat/add rows) rather than real structured
// per-row data -- restructuring it would cost that editing freedom for a
// need nobody's hit yet. This is the smallest real fix instead: find the
// one row whose Requirement cell exactly matches (generate-draft/route.ts
// always writes `r.requirement` verbatim as that cell, so an exact match
// is reliable for RFP-sourced rows specifically) and rewrite just its
// Status cell -- same row format lib/pdf/deliverables-packet.ts's own
// parser expects (`Requirement | Status | Detail`).
function findRowStatus(content: string, requirement: string): string | null {
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.includes("|") || trimmed.startsWith("[")) continue;
    const cells = trimmed.split("|").map((c) => c.trim());
    if (cells[0] === requirement) return cells[1] ?? null;
  }
  return null;
}

function markRowVerified(content: string, requirement: string): string {
  const lines = content.split("\n");
  const index = lines.findIndex((line) => {
    const trimmed = line.trim();
    if (!trimmed.includes("|") || trimmed.startsWith("[")) return false;
    return trimmed.split("|")[0]?.trim() === requirement;
  });
  if (index === -1) return content;
  const cells = lines[index].split("|");
  if (cells.length < 2) return content;
  cells[1] = " VERIFIED ";
  lines[index] = cells.join("|");
  return lines.join("\n");
}

// A fixed rows={3} box hid most of a real capability statement or technical
// narrative (both can run several hundred words) behind an internal
// scrollbar -- same complaint as the compliance matrix's old fixed-height
// boxes, just without that one's row structure to build a form out of, so
// this stays a plain textarea sized to roughly fit its own content instead.
function estimateRows(text: string): number {
  const lineBreaks = (text.match(/\n/g) ?? []).length + 1;
  const wrapped = Math.ceil(text.length / 90);
  return Math.max(6, Math.min(24, Math.max(lineBreaks, wrapped)));
}

// Step 7 — admin prepares each deliverable either by pasting text or
// uploading a file; either counts as "prepared" per BUILD-ORDER-BIDPULSE.md
// ("start simple"). One row per deliverable_type: saving replaces whichever
// row already exists for that type instead of piling up duplicates, since
// schema.sql has no unique constraint enforcing that itself.
export function DeliverablesPanel({
  submissionId,
  orgId,
  actorId,
  initialDeliverables,
  lastPacketView,
  estimatedValue,
  leanPackageThreshold,
  rfpRequirements,
  rfpDocumentUrls,
}: {
  submissionId: string;
  orgId: string;
  actorId: string;
  initialDeliverables: Deliverable[];
  lastPacketView: { event_type: string; created_at: string } | null;
  estimatedValue: number | null;
  leanPackageThreshold: number;
  rfpRequirements: RfpRequirement[];
  // Signed URL per uploaded RFP filename, keyed the same way as each
  // requirement's own source_file -- lets "View in RFP" jump straight to
  // the right document (a submission can have more than one) instead of
  // just naming a page number and leaving the admin to find the file.
  rfpDocumentUrls: Record<string, string>;
}) {
  const [byType, setByType] = useState<Record<string, Deliverable | undefined>>(() => {
    const map: Record<string, Deliverable | undefined> = {};
    for (const d of initialDeliverables) map[d.deliverable_type] = d;
    return map;
  });
  // Sticky across reloads: if a lean-type deliverable already exists, stay
  // in lean mode rather than reverting to the full set and hiding it.
  const [leanMode, setLeanMode] = useState(() =>
    initialDeliverables.some((d) => LEAN_DELIVERABLE_TYPES.some((t) => t.value === d.deliverable_type))
  );
  const DELIVERABLE_TYPES = leanMode ? LEAN_DELIVERABLE_TYPES : FULL_DELIVERABLE_TYPES;
  const showLeanSuggestion = !leanMode && isLeanEligible(estimatedValue, leanPackageThreshold);
  const [drafts, setDrafts] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const d of initialDeliverables) map[d.deliverable_type] = d.content ?? "";
    return map;
  });
  const [saving, setSaving] = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);
  const [savedTypes, setSavedTypes] = useState<Record<string, boolean>>({});
  const [confirmReplaceType, setConfirmReplaceType] = useState<string | null>(null);
  // technical_narrative has no discrete RFP-sourced rows to string-match
  // against the way compliance_matrix does (see markRowVerified/
  // findRowStatus above) -- it's prose an admin writes themselves, so
  // there's nothing in its actual saved content to encode a per-requirement
  // status into. This is deliberately a lightweight, session-local writing
  // aid (an "addressed this while drafting" checklist), not a persisted
  // fact-verification record the way compliance_matrix's is -- per two
  // reviews, reusing the "Verified" label/mechanism here would imply an
  // extracted claim was confirmed when nothing here was ever extracted.
  const [addressedRequirements, setAddressedRequirements] = useState<Record<string, boolean>>({});
  const supabase = createClient();
  const { showToast } = useToast();
  const router = useRouter();
  const idPrefix = useId();

  // Mirrors advance-if-deliverables-complete's own REQUIRED_TYPES check —
  // duplicated rather than imported so this file doesn't need a shared
  // constants module for three strings, but the route itself is the one
  // that actually re-verifies against the DB before touching stage. This
  // call is just "hey, go check" — a best-effort ping, not something whose
  // success this component depends on.
  async function maybeAutoAdvance(updatedByType: Record<string, Deliverable | undefined>) {
    const required = ["capability_statement", "compliance_matrix", "technical_narrative"];
    const complete = required.every((t) => {
      const d = updatedByType[t];
      return !!d && (!!d.file_url || !!d.content?.trim());
    });
    if (!complete) return;

    try {
      const res = await fetch("/api/advance-if-deliverables-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId }),
      });
      const data = await res.json().catch(() => null);
      if (data?.advanced) {
        showToast("All three deliverables are ready. Stage moved to Deliverables ready.", "success");
        router.refresh();
      } else if (data?.reason === "has_placeholders") {
        showToast(
          "Still has [bracketed placeholders] to fill in. Won't move to Deliverables ready until they're replaced with real content.",
          "error"
        );
      }
    } catch {
      // Best-effort — a failed auto-advance check shouldn't surface as a
      // save error, since the save itself already succeeded.
    }
  }

  async function logPrepared(type: string, mode: "file" | "text") {
    // Best-effort: the save itself already succeeded by the time this runs
    // (see handleSaveText/handleUpload) -- a failed audit-log write
    // shouldn't surface as a save error, but shouldn't vanish silently
    // either if audit logs are ever relied on for compliance purposes.
    const { error } = await supabase.from("audit_log").insert({
      submission_id: submissionId,
      org_id: orgId,
      actor_id: actorId,
      event_type: "deliverable_prepared",
      event_detail: { deliverable_type: type, mode },
    });
    if (error) console.error("[DeliverablesPanel] audit_log insert failed", error);
  }

  async function upsert(type: string, fields: { file_url?: string | null; content?: string | null }) {
    const existing = byType[type];
    const payload = {
      submission_id: submissionId,
      deliverable_type: type,
      prepared_by: actorId,
      file_url: fields.file_url ?? null,
      content: fields.content ?? null,
    };

    if (existing) {
      const { data, error: updateError } = await supabase
        .from("deliverables")
        .update(payload)
        .eq("id", existing.id)
        .select()
        .single();
      if (updateError || !data) throw new Error(updateError?.message ?? "Couldn't save.");
      return data as Deliverable;
    }

    const { data, error: insertError } = await supabase
      .from("deliverables")
      .insert(payload)
      .select()
      .single();
    if (insertError || !data) throw new Error(insertError?.message ?? "Couldn't save.");
    return data as Deliverable;
  }

  async function handleSaveText(type: string) {
    setSaving(type);
    setSavedTypes((s) => ({ ...s, [type]: false }));
    try {
      const saved = await upsert(type, { content: drafts[type] ?? "" });
      const updated = { ...byType, [type]: saved };
      setByType((b) => ({ ...b, [type]: saved }));
      await logPrepared(type, "text");
      setSavedTypes((s) => ({ ...s, [type]: true }));
      await maybeAutoAdvance(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't save.";
      showToast(`${deliverableLabel(type)}: ${message}`, "error");
    } finally {
      setSaving(null);
    }
  }

  // Fills the text box with a generated starting draft — doesn't touch the
  // deliverables table itself, so nothing is saved until the admin hits
  // "Save text" as usual. Confirms first if there's existing content, since
  // this replaces the box wholesale rather than appending -- via the app's
  // own ConfirmDialog rather than the browser-native window.confirm() this
  // used to call, which was inconsistent with every other confirmation in
  // the app and couldn't be styled.
  function handleAutoDraft(type: string) {
    const existingText = (drafts[type] ?? "").trim();
    if (existingText) {
      setConfirmReplaceType(type);
      return;
    }
    runAutoDraft(type);
  }

  async function runAutoDraft(type: string) {
    setGenerating(type);
    setSavedTypes((s) => ({ ...s, [type]: false }));

    try {
      const res = await fetch("/api/generate-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId, deliverableType: type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Couldn't generate a draft.");
      setDrafts((d) => ({ ...d, [type]: data.content }));
      // A compliance-matrix draft caches fresh rfp_requirements (with
      // source quotes) on the submission row server-side -- refresh so the
      // "RFP source references" panel below picks it up without the admin
      // needing to reload the page themselves.
      if (type === "compliance_matrix") router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't generate a draft.";
      showToast(`${deliverableLabel(type)}: ${message}`, "error");
    } finally {
      setGenerating(null);
    }
  }

  async function handleUpload(type: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(type);
    setSavedTypes((s) => ({ ...s, [type]: false }));

    try {
      const { path, error: uploadError } = await uploadRfpDocument(
        supabase,
        `${submissionId}/deliverables/${type}-${Date.now()}-${file.name}`,
        file
      );
      if (uploadError) throw new Error(uploadError);

      // The bucket is private — the DB stores the bare path (`saved.file_url`
      // below), and every read site (including this one, right after upload)
      // generates its own signed URL rather than persisting one, since a
      // signed URL expires.
      const saved = await upsert(type, { file_url: path });
      const signedUrl = await signRfpDocumentUrl(supabase, path);
      const updated = { ...byType, [type]: saved };
      setByType((b) => ({ ...b, [type]: { ...saved, file_url: signedUrl } }));
      setDrafts((d) => ({ ...d, [type]: "" }));
      await logPrepared(type, "file");
      setSavedTypes((s) => ({ ...s, [type]: true }));
      await maybeAutoAdvance(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed.";
      showToast(`${deliverableLabel(type)}: ${message}`, "error");
    } finally {
      setSaving(null);
      e.target.value = "";
    }
  }

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
      <h2 className="text-title-lg text-primary mb-4 flex items-center gap-2">
        <span className="material-symbols-outlined text-primary text-[20px]">description</span>
        Deliverables
      </h2>

      {showLeanSuggestion && (
        <div className="mb-6 bg-surface-container-highest border border-outline-variant rounded-lg p-4 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-body-md text-on-surface">
            This bid is estimated at ${estimatedValue!.toLocaleString()}, under the $
            {leanPackageThreshold.toLocaleString()} lean-package threshold. A lean package (Rate Sheet +
            Executive Cover + Certificate of Insurance) may be more appropriate than the full deliverable set.
          </p>
          <button
            type="button"
            onClick={() => setLeanMode(true)}
            className="px-4 py-2 rounded border border-primary text-primary text-label-md font-bold hover:bg-surface-container-low transition active:scale-[0.97] shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Switch to lean package
          </button>
        </div>
      )}
      {leanMode && (
        <div className="mb-6 flex items-center justify-between gap-3">
          <p className="text-label-md text-on-surface-variant">Using the lean package.</p>
          <button type="button" onClick={() => setLeanMode(false)} className="text-label-md text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-sm">
            Use full package instead
          </button>
        </div>
      )}

      <div className="flex flex-col gap-6">
        {DELIVERABLE_TYPES.map((t) => {
          const existing = byType[t.value];
          const isSaving = saving === t.value;
          const isGenerating = generating === t.value;
          const isBusy = isSaving || isGenerating;
          return (
            <div key={t.value} className="border-t border-outline-variant pt-4 first:border-t-0 first:pt-0">
              <div className="flex items-center justify-between mb-2">
                <h3 id={`${idPrefix}-${t.value}-label`} className="text-label-md text-on-surface-variant uppercase tracking-wider">{t.label}</h3>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded border font-bold uppercase ${
                    existing
                      ? "bg-secondary-container text-on-secondary-container border-primary/20"
                      : "bg-surface-container-low text-on-surface-variant border-outline-variant"
                  }`}
                >
                  {existing ? "Draft" : "Not started"}
                </span>
              </div>

              {existing?.file_url && (
                <a
                  href={existing.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary font-bold hover:underline text-body-md block mb-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-sm"
                >
                  Current file
                </a>
              )}

              <textarea
                aria-labelledby={`${idPrefix}-${t.value}-label`}
                value={drafts[t.value] ?? ""}
                onChange={(e) => {
                  setDrafts((d) => ({ ...d, [t.value]: e.target.value }));
                  setSavedTypes((s) => ({ ...s, [t.value]: false }));
                }}
                rows={estimateRows(drafts[t.value] ?? "")}
                placeholder="Paste or write the content directly…"
                className="w-full px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary mb-2"
              />

              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleAutoDraft(t.value)}
                  disabled={isBusy}
                  className="px-4 py-2 rounded border border-outline-variant text-on-surface text-label-md font-bold hover:bg-surface-container-high transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {isGenerating ? <Spinner /> : <span className="material-symbols-outlined text-[18px]">auto_awesome</span>}
                  {isGenerating ? "Generating…" : "Auto-draft"}
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveText(t.value)}
                  disabled={isBusy}
                  className="px-4 py-2 bg-primary-container text-on-primary-container rounded text-label-md hover:opacity-90 hover:-translate-y-0.5 transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {isSaving && <Spinner />}
                  {isSaving ? "Saving…" : "Save text"}
                </button>
                <label className="px-4 py-2 rounded border border-primary text-primary text-label-md font-bold hover:bg-surface-container-low transition active:scale-[0.97] cursor-pointer flex items-center gap-2 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
                  {isSaving && <Spinner />}
                  {isSaving ? "Saving…" : "Upload file instead"}
                  <input
                    type="file"
                    onChange={(e) => handleUpload(t.value, e)}
                    disabled={isBusy}
                    className="sr-only"
                  />
                </label>
                <FadeMessage show={!!savedTypes[t.value]} className="text-body-md text-primary">
                  Saved
                </FadeMessage>
              </div>

              {t.value === "compliance_matrix" && rfpRequirements.some((r) => r.quote) && (
                <details className="group mt-3 border border-outline-variant rounded-lg">
                  <summary className="flex items-center gap-2 px-3 py-2 bg-surface-container-low cursor-pointer select-none text-label-md text-on-surface-variant font-bold list-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary">
                    <span className="material-symbols-outlined text-[18px] transition-transform group-open:rotate-90">
                      chevron_right
                    </span>
                    RFP source references ({rfpRequirements.filter((r) => r.quote).length})
                  </summary>
                  <div className="px-3 py-3 flex flex-col gap-3 border-t border-outline-variant">
                    <p className="text-label-md text-on-surface-variant">
                      Where each RFP-sourced row above came from. Search the real document for the quoted
                      text to confirm it, rather than re-reading the whole thing.
                    </p>
                    <ul className="flex flex-col gap-3">
                      {rfpRequirements
                        .filter((r) => r.quote)
                        .map((r, i) => {
                          const docUrl = r.source_file ? rfpDocumentUrls[r.source_file] : undefined;
                          const rowStatus = findRowStatus(drafts[t.value] ?? "", r.requirement);
                          const isVerified = rowStatus?.trim().toUpperCase() === "VERIFIED";
                          return (
                            <li key={i} className="text-body-sm text-on-surface">
                              <div className="flex items-center justify-between gap-3 flex-wrap">
                                <span>
                                  <span className="font-bold">{r.requirement}</span>
                                  {r.page != null && (
                                    <span className="text-on-surface-variant"> (p.{r.page})</span>
                                  )}
                                  {docUrl && r.page != null && (
                                    <a
                                      href={`${docUrl}#page=${r.page}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="ml-2 text-primary font-bold hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-sm"
                                    >
                                      View in RFP →
                                    </a>
                                  )}
                                </span>
                                {isVerified ? (
                                  <span className="shrink-0 text-[10px] px-2 py-0.5 rounded border font-bold uppercase bg-secondary-container text-on-secondary-container border-primary/20">
                                    Verified
                                  </span>
                                ) : rowStatus ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDrafts((d) => ({ ...d, [t.value]: markRowVerified(d[t.value] ?? "", r.requirement) }));
                                      setSavedTypes((s) => ({ ...s, [t.value]: false }));
                                    }}
                                    className="shrink-0 text-label-sm text-primary font-bold hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-sm"
                                  >
                                    Mark verified
                                  </button>
                                ) : null}
                              </div>
                              <blockquote className="mt-1 pl-3 border-l-2 border-outline-variant text-on-surface-variant italic">
                                &ldquo;{r.quote}&rdquo;
                              </blockquote>
                            </li>
                          );
                        })}
                    </ul>
                  </div>
                </details>
              )}

              {/* A real gap two reviews confirmed: technical_narrative never
                  fetches RFP-sourced data at all (see generate-draft/route.ts's
                  own "Only the compliance matrix uses this today" comment), so
                  it can't get the same per-row "Mark verified" treatment --
                  there's no extracted claim here to verify. But rfpRequirements
                  is already sitting in this component's own props regardless of
                  which deliverable type is open, at no extra extraction cost --
                  this surfaces it as a passive coverage checklist ("Addressed",
                  not "Verified") instead of leaving an admin writing this
                  narrative with zero visibility into what the RFP actually
                  asked for on technical approach/methodology. */}
              {t.value === "technical_narrative" && rfpRequirements.some((r) => r.quote) && (
                <details className="group mt-3 border border-outline-variant rounded-lg">
                  <summary className="flex items-center gap-2 px-3 py-2 bg-surface-container-low cursor-pointer select-none text-label-md text-on-surface-variant font-bold list-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary">
                    <span className="material-symbols-outlined text-[18px] transition-transform group-open:rotate-90">
                      chevron_right
                    </span>
                    RFP requirements to address ({rfpRequirements.filter((r) => r.quote).length})
                  </summary>
                  <div className="px-3 py-3 flex flex-col gap-3 border-t border-outline-variant">
                    <p className="text-label-md text-on-surface-variant">
                      What the RFP actually asked for — check these off as you write to make sure the
                      narrative doesn&apos;t drift from what the solicitation requires. This is a writing aid,
                      not a saved record: it resets on reload.
                    </p>
                    <ul className="flex flex-col gap-3">
                      {rfpRequirements
                        .filter((r) => r.quote)
                        .map((r, i) => {
                          const docUrl = r.source_file ? rfpDocumentUrls[r.source_file] : undefined;
                          const addressed = !!addressedRequirements[r.requirement];
                          return (
                            <li key={i} className="text-body-sm text-on-surface">
                              <label className="flex items-start gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={addressed}
                                  onChange={(e) =>
                                    setAddressedRequirements((a) => ({ ...a, [r.requirement]: e.target.checked }))
                                  }
                                  className="mt-1 shrink-0"
                                />
                                <span className={addressed ? "line-through text-on-surface-variant" : undefined}>
                                  <span className="font-bold">{r.requirement}</span>
                                  {r.page != null && (
                                    <span className="text-on-surface-variant"> (p.{r.page})</span>
                                  )}
                                  {docUrl && r.page != null && (
                                    <a
                                      href={`${docUrl}#page=${r.page}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="ml-2 text-primary font-bold hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-sm"
                                    >
                                      View in RFP →
                                    </a>
                                  )}
                                  <blockquote className="mt-1 pl-3 border-l-2 border-outline-variant text-on-surface-variant italic">
                                    &ldquo;{r.quote}&rdquo;
                                  </blockquote>
                                </span>
                              </label>
                            </li>
                          );
                        })}
                    </ul>
                  </div>
                </details>
              )}
            </div>
          );
        })}

        <div className="border-t border-outline-variant pt-4">
          <h3 className="text-label-md text-on-surface-variant uppercase tracking-wider mb-2">
            Complete bid package
          </h3>
          <PacketButtons submissionId={submissionId} orgId={orgId} viewerRole="admin" />
          <p className="text-label-md text-on-surface-variant mt-3">
            {lastPacketView
              ? `Client last ${lastPacketView.event_type === "client_downloaded_packet" ? "downloaded" : "viewed"}: ${new Date(
                  lastPacketView.created_at
                ).toLocaleString()}`
              : "Not yet viewed"}
          </p>
        </div>
      </div>

      <ConfirmDialog
        open={confirmReplaceType !== null}
        onClose={() => setConfirmReplaceType(null)}
        onConfirm={() => {
          const type = confirmReplaceType;
          setConfirmReplaceType(null);
          if (type) runAutoDraft(type);
        }}
        title="Replace current text?"
        description={`This will replace the current ${
          confirmReplaceType ? deliverableLabel(confirmReplaceType).toLowerCase() : ""
        } text with a generated draft.`}
        confirmLabel="Replace with generated draft"
      />
    </div>
  );
}
