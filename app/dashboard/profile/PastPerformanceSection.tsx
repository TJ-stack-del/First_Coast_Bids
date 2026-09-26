"use client";

import { useId, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/Spinner";
import { uploadAndInsertRecord, deleteRecordAndFile } from "@/lib/storage";
import { AddTriggerButton } from "@/components/ui/AddTriggerButton";

type VerificationStatus = "self_reported" | "confirmed_federal_award" | "unconfirmed";

type PastPerformance = {
  id: string;
  reference_client_name: string;
  scope_of_work: string;
  contract_value: string | null;
  outcome: string | null;
  created_at: string;
  photo_url: string | null;
  photo_file_name: string | null;
  prime_gc_name: string | null;
  on_time_percentage: number | null;
  verification_status: VerificationStatus;
};

const inputClass =
  "px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary";

// Real place for the two capability-statement "Past Performance" bracket
// rows generate-draft/route.ts otherwise always leaves unfilled — see that
// route's own comment on why. Self-reported by default, same as
// Differentiators on this same page -- NOT an official credential the way
// a certification file is, so no admin verify gate. The one exception:
// "Check federal records" runs a real check against USASpending.gov's
// public API (via /api/verify-past-performance) and only ever upgrades
// the status to "confirmed_federal_award" on an actual match -- a clean
// no-match (the common case for local/school-district work) leaves it
// self-reported, never shown as a red flag. checkResult below exists
// purely so that outcome is actually visible: a UX review found the
// button previously gave zero feedback on either a clean no-match or a
// genuine request failure, both looking identical to "nothing happened."
export function PastPerformanceSection({
  clientId,
  initialEntries,
}: {
  clientId: string;
  initialEntries: PastPerformance[];
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [showForm, setShowForm] = useState(initialEntries.length === 0);
  const [referenceClientName, setReferenceClientName] = useState("");
  const [scopeOfWork, setScopeOfWork] = useState("");
  const [contractValue, setContractValue] = useState("");
  const [outcome, setOutcome] = useState("");
  const [primeGcName, setPrimeGcName] = useState("");
  const [onTimePercentage, setOnTimePercentage] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<Record<string, "no_match" | "failed" | undefined>>({});
  const supabase = createClient();
  const idPrefix = useId();

  function resetForm() {
    setReferenceClientName("");
    setScopeOfWork("");
    setContractValue("");
    setOutcome("");
    setPrimeGcName("");
    setOnTimePercentage("");
    setPhoto(null);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!referenceClientName.trim() || !scopeOfWork.trim()) {
      setError("Client name and scope of work are required.");
      return;
    }
    const onTimeValue = onTimePercentage.trim() ? Number(onTimePercentage) : null;
    if (onTimeValue != null && (Number.isNaN(onTimeValue) || onTimeValue < 0 || onTimeValue > 100)) {
      setError("On-time % must be a number from 0 to 100.");
      return;
    }

    setSubmitting(true);

    const result = await uploadAndInsertRecord<PastPerformance>(supabase, {
      path: photo ? `${clientId}/past-performance/${Date.now()}-${photo.name}` : "",
      file: photo,
      table: "client_past_performance",
      fileUrlColumn: "photo_url",
      fileNameColumn: "photo_file_name",
      genericErrorMessage: "Couldn't save that.",
      payload: {
        client_id: clientId,
        reference_client_name: referenceClientName.trim(),
        scope_of_work: scopeOfWork.trim(),
        contract_value: contractValue.trim() || null,
        outcome: outcome.trim() || null,
        prime_gc_name: primeGcName.trim() || null,
        on_time_percentage: onTimeValue,
      },
    });

    if (result.error) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    setEntries((e) => [{ ...result.row, photo_url: result.signedUrl }, ...e]);
    resetForm();
    setSubmitting(false);
  }

  async function handleRemove(id: string) {
    setRemovingId(id);
    const { error: deleteError } = await deleteRecordAndFile(supabase, "client_past_performance", id, "photo_url");
    if (!deleteError) {
      setEntries((e) => e.filter((entry) => entry.id !== id));
    }
    setRemovingId(null);
  }

  async function handleCheckFederal(id: string) {
    setCheckingId(id);
    setCheckResult((r) => ({ ...r, [id]: undefined }));
    try {
      const res = await fetch("/api/verify-past-performance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.status) {
        setEntries((e) => e.map((entry) => (entry.id === id ? { ...entry, verification_status: data.status } : entry)));
        setCheckResult((r) => ({ ...r, [id]: data.status === "self_reported" ? "no_match" : data.status === "unconfirmed" ? "failed" : undefined }));
      } else {
        setCheckResult((r) => ({ ...r, [id]: "failed" }));
      }
    } catch {
      setCheckResult((r) => ({ ...r, [id]: "failed" }));
    } finally {
      setCheckingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {showForm ? (
      <form
        onSubmit={handleAdd}
        className="border border-outline-variant rounded-xl p-4 flex flex-col gap-4"
      >
        <div className="flex flex-col md:flex-row gap-3 items-start md:items-end flex-wrap">
          <div className="flex-1 min-w-[160px]">
            <label htmlFor={`${idPrefix}-ref-name`} className="text-label-md text-on-surface-variant block mb-1">Client / agency name</label>
            <input
              id={`${idPrefix}-ref-name`}
              value={referenceClientName}
              onChange={(e) => setReferenceClientName(e.target.value)}
              placeholder="e.g. City of Round Rock"
              className={`w-full ${inputClass}`}
            />
          </div>

          <div className="flex-1 min-w-[200px]">
            <label htmlFor={`${idPrefix}-scope`} className="text-label-md text-on-surface-variant block mb-1">Scope of work</label>
            <input
              id={`${idPrefix}-scope`}
              value={scopeOfWork}
              onChange={(e) => setScopeOfWork(e.target.value)}
              placeholder="e.g. HVAC preventive maintenance, 3 buildings"
              className={`w-full ${inputClass}`}
            />
          </div>
        </div>

        {/* Everything below is optional detail, visually separated from the
            two required fields above -- a UX review flagged this form's 7
            fields as one flat unbroken row with no chunking. */}
        <div className="pt-3 border-t border-outline-variant flex flex-col gap-2">
          <span className="text-label-sm text-on-surface-variant uppercase tracking-wider">Details (optional)</span>
          <div className="flex flex-col md:flex-row gap-3 items-start md:items-end flex-wrap">
            <div>
              <label htmlFor={`${idPrefix}-value`} className="text-label-md text-on-surface-variant block mb-1">Contract value</label>
              <input
                id={`${idPrefix}-value`}
                value={contractValue}
                onChange={(e) => setContractValue(e.target.value)}
                placeholder="e.g. $185,000"
                className={inputClass}
              />
            </div>

            <div className="flex-1 min-w-[160px]">
              <label htmlFor={`${idPrefix}-outcome`} className="text-label-md text-on-surface-variant block mb-1">Outcome</label>
              <input
                id={`${idPrefix}-outcome`}
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                placeholder="e.g. Completed on time, renewed 2 years"
                className={`w-full ${inputClass}`}
              />
            </div>

            <div>
              <label htmlFor={`${idPrefix}-prime-gc`} className="text-label-md text-on-surface-variant block mb-1">Prime GC</label>
              <input
                id={`${idPrefix}-prime-gc`}
                value={primeGcName}
                onChange={(e) => setPrimeGcName(e.target.value)}
                placeholder="e.g. Turner Construction"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor={`${idPrefix}-on-time`} className="text-label-md text-on-surface-variant block mb-1">On-time %</label>
              <input
                id={`${idPrefix}-on-time`}
                type="number"
                min={0}
                max={100}
                value={onTimePercentage}
                onChange={(e) => setOnTimePercentage(e.target.value)}
                placeholder="e.g. 100"
                className={`${inputClass} w-24`}
              />
            </div>

            <div className="flex-1 min-w-[160px]">
              <label htmlFor={`${idPrefix}-photo`} className="text-label-md text-on-surface-variant block mb-1">Project photo</label>
              <label htmlFor={`${idPrefix}-photo`} className="px-4 py-2 rounded border border-primary text-primary text-label-md font-bold hover:bg-surface-container-low transition cursor-pointer inline-block focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
                {photo ? photo.name : "Choose photo"}
                <input id={`${idPrefix}-photo`} type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} className="sr-only" />
              </label>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="py-2 px-4 bg-primary-container text-on-primary-container rounded text-label-md font-semibold hover:opacity-90 hover:-translate-y-0.5 transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary w-fit"
          >
            {submitting && <Spinner />}
            {submitting ? "Adding…" : "Add project"}
          </button>
          {entries.length > 0 && (
            <button type="button" onClick={() => setShowForm(false)} className="text-label-md text-on-surface-variant hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-sm">
              Cancel
            </button>
          )}
        </div>
      </form>
      ) : (
        <div>
          <AddTriggerButton label="Add past project" onClick={() => setShowForm(true)} />
        </div>
      )}

      {error && <p className="text-body-md text-error">{error}</p>}

      {entries.length === 0 ? (
        !showForm && <p className="text-body-md text-on-surface-variant">No past projects added yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center justify-between gap-3 px-4 py-3 rounded border border-outline-variant bg-surface flex-wrap"
            >
              <div className="flex items-center gap-3">
                {entry.photo_url && (
                  // eslint-disable-next-line @next/next/no-img-element -- a private, signed storage URL, not an optimizable static asset
                  <img
                    src={entry.photo_url}
                    alt={`Project photo for ${entry.reference_client_name}`}
                    className="w-14 h-14 rounded object-cover border border-outline-variant"
                  />
                )}
                <div>
                  <p className="text-body-md text-on-surface font-bold flex items-center gap-2">
                    {entry.reference_client_name}
                    {entry.contract_value ? ` · ${entry.contract_value}` : ""}
                    {entry.verification_status === "confirmed_federal_award" && (
                      <span className="text-[10px] px-2 py-0.5 rounded border font-bold uppercase bg-secondary-container text-on-secondary-container border-primary/20">
                        Confirmed via USASpending.gov
                      </span>
                    )}
                  </p>
                  <p className="text-label-md text-on-surface-variant">
                    {entry.scope_of_work}
                    {entry.outcome ? ` · ${entry.outcome}` : ""}
                    {entry.prime_gc_name ? ` · Prime: ${entry.prime_gc_name}` : ""}
                    {entry.on_time_percentage != null ? ` · ${entry.on_time_percentage}% on-time` : ""}
                  </p>
                  {checkResult[entry.id] === "no_match" && (
                    <p className="text-label-md text-on-surface-variant italic mt-0.5" role="status">
                      Checked — no federal award match found (expected for local/school-district work).
                    </p>
                  )}
                  {checkResult[entry.id] === "failed" && (
                    <p className="text-label-md text-error mt-0.5" role="status">
                      Couldn't complete the check — try again in a moment.
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {entry.verification_status !== "confirmed_federal_award" && (
                  <button
                    type="button"
                    onClick={() => handleCheckFederal(entry.id)}
                    disabled={checkingId === entry.id}
                    className="min-h-[44px] sm:min-h-0 px-1 text-label-md text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-sm disabled:opacity-40 flex items-center gap-2"
                  >
                    {checkingId === entry.id && <Spinner />}
                    Check federal records
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleRemove(entry.id)}
                  disabled={removingId === entry.id}
                  className="min-h-[44px] sm:min-h-0 px-1 text-on-surface-variant hover:text-error text-label-md hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-sm disabled:opacity-40 flex items-center gap-2"
                >
                  {removingId === entry.id && <Spinner />}
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
