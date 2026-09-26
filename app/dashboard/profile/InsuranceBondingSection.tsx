"use client";

import { useId, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/Spinner";
import { uploadAndInsertRecord, deleteRecordAndFile } from "@/lib/storage";
import { VerifiedBadge, DocLink } from "@/components/ui/DocumentBadges";
import { AddTriggerButton } from "@/components/ui/AddTriggerButton";

type InsurancePolicy = {
  id: string;
  policy_type: string;
  carrier_name: string | null;
  policy_number: string | null;
  per_occurrence_limit: string | null;
  aggregate_limit: string | null;
  expiration_date: string | null;
  file_url: string | null;
  file_name: string | null;
  verified: boolean;
};

type BondingRecord = {
  id: string;
  surety_name: string | null;
  bond_number: string | null;
  aggregate_bonding_capacity: string | null;
  single_project_bonding_capacity: string | null;
  expiration_date: string | null;
  file_url: string | null;
  file_name: string | null;
  verified: boolean;
};

const POLICY_TYPES: { value: string; label: string }[] = [
  { value: "general_liability", label: "General Liability" },
  { value: "workers_comp", label: "Workers' Comp" },
  { value: "commercial_auto", label: "Commercial Auto" },
  { value: "professional_liability", label: "Professional Liability" },
  { value: "umbrella", label: "Umbrella" },
];

const inputClass =
  "px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary";

// Split into two genuinely separate cards per explicit UX review finding --
// a single form whose entire field set swapped based on a "Category"
// toggle (8-9 simultaneous fields with no internal grouping) buried the
// fact that "Bonding Capacity" is a wholly different record type behind
// one dropdown. Two independent tables (client_insurance_policies,
// client_bonding_capacity), each with its own form/list, matches how the
// target mockup shows them as separate blocks. Both still reuse the exact
// same upload/verify mechanics (uploadAndInsertRecord, deleteRecordAndFile)
// as every other Compliance Vault section.
export function InsuranceBondingSection({
  clientId,
  initialPolicies,
  initialBonding,
}: {
  clientId: string;
  initialPolicies: InsurancePolicy[];
  initialBonding: BondingRecord[];
}) {
  return (
    <div className="flex flex-col gap-8">
      <InsurancePoliciesCard clientId={clientId} initialPolicies={initialPolicies} />
      <BondingCapacityCard clientId={clientId} initialBonding={initialBonding} />
    </div>
  );
}

function InsurancePoliciesCard({ clientId, initialPolicies }: { clientId: string; initialPolicies: InsurancePolicy[] }) {
  const [policies, setPolicies] = useState(initialPolicies);
  // Open by default only when there's nothing yet -- a first-time client
  // shouldn't have to discover a "+" button to add their first policy, but
  // a returning client with existing policies isn't confronted with a full
  // form on every visit (a follow-up UX review's page-weight finding).
  const [showForm, setShowForm] = useState(initialPolicies.length === 0);
  const [policyType, setPolicyType] = useState(POLICY_TYPES[0].value);
  const [carrierName, setCarrierName] = useState("");
  const [policyNumber, setPolicyNumber] = useState("");
  const [perOccurrenceLimit, setPerOccurrenceLimit] = useState("");
  const [aggregateLimit, setAggregateLimit] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();
  const idPrefix = useId();

  function resetForm() {
    setCarrierName("");
    setPolicyNumber("");
    setPerOccurrenceLimit("");
    setAggregateLimit("");
    setEffectiveDate("");
    setExpirationDate("");
    setFile(null);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const result = await uploadAndInsertRecord<InsurancePolicy>(supabase, {
      path: file ? `${clientId}/insurance/${Date.now()}-${file.name}` : "",
      file,
      table: "client_insurance_policies",
      genericErrorMessage: "Couldn't record the policy.",
      payload: {
        client_id: clientId,
        policy_type: policyType,
        carrier_name: carrierName.trim() || null,
        policy_number: policyNumber.trim() || null,
        per_occurrence_limit: perOccurrenceLimit.trim() || null,
        aggregate_limit: aggregateLimit.trim() || null,
        effective_date: effectiveDate || null,
        expiration_date: expirationDate || null,
      },
    });

    if (result.error) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    setPolicies((p) => [{ ...result.row, file_url: result.signedUrl }, ...p]);
    resetForm();
    setSubmitting(false);
  }

  async function handleRemove(id: string) {
    setRemovingId(id);
    const { error: deleteError } = await deleteRecordAndFile(supabase, "client_insurance_policies", id);
    if (!deleteError) {
      setPolicies((p) => p.filter((row) => row.id !== id));
    }
    setRemovingId(null);
  }

  return (
    <div>
      <h3 className="text-title-md text-on-surface font-bold mb-3">Insurance policies</h3>

      {showForm ? (
        <form onSubmit={handleAdd} className="border border-outline-variant rounded-xl p-4 flex flex-col md:flex-row gap-3 items-start md:items-end flex-wrap mb-4">
          <div>
            <label htmlFor={`${idPrefix}-policy-type`} className="text-label-md text-on-surface-variant block mb-1">Policy type</label>
            <select id={`${idPrefix}-policy-type`} value={policyType} onChange={(e) => setPolicyType(e.target.value)} className={inputClass}>
              {POLICY_TYPES.map((pt) => (
                <option key={pt.value} value={pt.value}>
                  {pt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${idPrefix}-carrier`} className="text-label-md text-on-surface-variant block mb-1">Carrier</label>
            <input id={`${idPrefix}-carrier`} value={carrierName} onChange={(e) => setCarrierName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor={`${idPrefix}-policy-number`} className="text-label-md text-on-surface-variant block mb-1">Policy # (optional)</label>
            <input id={`${idPrefix}-policy-number`} value={policyNumber} onChange={(e) => setPolicyNumber(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor={`${idPrefix}-occ-limit`} className="text-label-md text-on-surface-variant block mb-1">Per-occurrence limit</label>
            <input id={`${idPrefix}-occ-limit`} value={perOccurrenceLimit} onChange={(e) => setPerOccurrenceLimit(e.target.value)} placeholder="e.g. $1,000,000" className={inputClass} />
          </div>
          <div>
            <label htmlFor={`${idPrefix}-agg-limit`} className="text-label-md text-on-surface-variant block mb-1">Aggregate limit</label>
            <input id={`${idPrefix}-agg-limit`} value={aggregateLimit} onChange={(e) => setAggregateLimit(e.target.value)} placeholder="e.g. $2,000,000" className={inputClass} />
          </div>
          <div>
            <label htmlFor={`${idPrefix}-effective`} className="text-label-md text-on-surface-variant block mb-1">Effective (optional)</label>
            <input id={`${idPrefix}-effective`} type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor={`${idPrefix}-expires`} className="text-label-md text-on-surface-variant block mb-1">Expires (optional)</label>
            <input id={`${idPrefix}-expires`} type="date" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)} className={inputClass} />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label htmlFor={`${idPrefix}-file`} className="text-label-md text-on-surface-variant block mb-1">Document (optional)</label>
            <label htmlFor={`${idPrefix}-file`} className="px-4 py-2 rounded border border-primary text-primary text-label-md font-bold hover:bg-surface-container-low transition cursor-pointer inline-block focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
              {file ? file.name : "Choose file"}
              <input id={`${idPrefix}-file`} type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="sr-only" />
            </label>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="py-2 px-4 bg-primary-container text-on-primary-container rounded text-label-md font-semibold hover:opacity-90 hover:-translate-y-0.5 transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {submitting && <Spinner />}
              {submitting ? "Adding…" : "Add policy"}
            </button>
            {policies.length > 0 && (
              <button type="button" onClick={() => setShowForm(false)} className="text-label-md text-on-surface-variant hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-sm">
                Cancel
              </button>
            )}
          </div>
        </form>
      ) : (
        <div className="mb-4">
          <AddTriggerButton label="Add insurance policy" onClick={() => setShowForm(true)} />
        </div>
      )}

      {error && <p className="text-body-md text-error mb-3">{error}</p>}

      {policies.length === 0 ? (
        !showForm && <p className="text-body-md text-on-surface-variant">No insurance policies added yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {policies.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 rounded border border-outline-variant bg-surface flex-wrap">
              <div>
                <p className="text-body-md text-on-surface font-bold">
                  {POLICY_TYPES.find((pt) => pt.value === p.policy_type)?.label ?? p.policy_type}
                  {p.carrier_name ? ` — ${p.carrier_name}` : ""}
                </p>
                <p className="text-label-md text-on-surface-variant">
                  {p.expiration_date ? `Expires ${new Date(p.expiration_date).toLocaleDateString()}` : "No expiration on file"}
                  <DocLink url={p.file_url} name={p.file_name} />
                </p>
              </div>
              <div className="flex items-center gap-3">
                <VerifiedBadge verified={p.verified} />
                <button
                  type="button"
                  onClick={() => handleRemove(p.id)}
                  disabled={removingId === p.id}
                  className="min-h-[44px] sm:min-h-0 px-1 text-on-surface-variant hover:text-error text-label-md hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-sm disabled:opacity-40 flex items-center gap-2"
                >
                  {removingId === p.id && <Spinner />}
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

function BondingCapacityCard({ clientId, initialBonding }: { clientId: string; initialBonding: BondingRecord[] }) {
  const [bonding, setBonding] = useState(initialBonding);
  const [showForm, setShowForm] = useState(initialBonding.length === 0);
  const [suretyName, setSuretyName] = useState("");
  const [bondNumber, setBondNumber] = useState("");
  const [aggregateCapacity, setAggregateCapacity] = useState("");
  const [singleProjectCapacity, setSingleProjectCapacity] = useState("");
  const [obligee, setObligee] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();
  const idPrefix = useId();

  function resetForm() {
    setSuretyName("");
    setBondNumber("");
    setAggregateCapacity("");
    setSingleProjectCapacity("");
    setObligee("");
    setEffectiveDate("");
    setExpirationDate("");
    setFile(null);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const result = await uploadAndInsertRecord<BondingRecord>(supabase, {
      path: file ? `${clientId}/bonding/${Date.now()}-${file.name}` : "",
      file,
      table: "client_bonding_capacity",
      genericErrorMessage: "Couldn't record the bonding capacity.",
      payload: {
        client_id: clientId,
        surety_name: suretyName.trim() || null,
        bond_number: bondNumber.trim() || null,
        aggregate_bonding_capacity: aggregateCapacity.trim() || null,
        single_project_bonding_capacity: singleProjectCapacity.trim() || null,
        obligee: obligee.trim() || null,
        effective_date: effectiveDate || null,
        expiration_date: expirationDate || null,
      },
    });

    if (result.error) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    setBonding((b) => [{ ...result.row, file_url: result.signedUrl }, ...b]);
    resetForm();
    setSubmitting(false);
  }

  async function handleRemove(id: string) {
    setRemovingId(id);
    const { error: deleteError } = await deleteRecordAndFile(supabase, "client_bonding_capacity", id);
    if (!deleteError) {
      setBonding((b) => b.filter((row) => row.id !== id));
    }
    setRemovingId(null);
  }

  return (
    <div>
      <h3 className="text-title-md text-on-surface font-bold mb-3">Bonding capacity</h3>

      {showForm ? (
        <form onSubmit={handleAdd} className="border border-outline-variant rounded-xl p-4 flex flex-col md:flex-row gap-3 items-start md:items-end flex-wrap mb-4">
          <div>
            <label htmlFor={`${idPrefix}-surety`} className="text-label-md text-on-surface-variant block mb-1">Surety</label>
            <input id={`${idPrefix}-surety`} value={suretyName} onChange={(e) => setSuretyName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor={`${idPrefix}-bond-number`} className="text-label-md text-on-surface-variant block mb-1">Bond # (optional)</label>
            <input id={`${idPrefix}-bond-number`} value={bondNumber} onChange={(e) => setBondNumber(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor={`${idPrefix}-single-capacity`} className="text-label-md text-on-surface-variant block mb-1">Single-project capacity</label>
            <input id={`${idPrefix}-single-capacity`} value={singleProjectCapacity} onChange={(e) => setSingleProjectCapacity(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor={`${idPrefix}-agg-capacity`} className="text-label-md text-on-surface-variant block mb-1">Aggregate capacity</label>
            <input id={`${idPrefix}-agg-capacity`} value={aggregateCapacity} onChange={(e) => setAggregateCapacity(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor={`${idPrefix}-obligee`} className="text-label-md text-on-surface-variant block mb-1">Obligee (optional)</label>
            <input id={`${idPrefix}-obligee`} value={obligee} onChange={(e) => setObligee(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor={`${idPrefix}-effective`} className="text-label-md text-on-surface-variant block mb-1">Effective (optional)</label>
            <input id={`${idPrefix}-effective`} type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor={`${idPrefix}-expires`} className="text-label-md text-on-surface-variant block mb-1">Expires (optional)</label>
            <input id={`${idPrefix}-expires`} type="date" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)} className={inputClass} />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label htmlFor={`${idPrefix}-file`} className="text-label-md text-on-surface-variant block mb-1">Document (optional)</label>
            <label htmlFor={`${idPrefix}-file`} className="px-4 py-2 rounded border border-primary text-primary text-label-md font-bold hover:bg-surface-container-low transition cursor-pointer inline-block focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
              {file ? file.name : "Choose file"}
              <input id={`${idPrefix}-file`} type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="sr-only" />
            </label>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="py-2 px-4 bg-primary-container text-on-primary-container rounded text-label-md font-semibold hover:opacity-90 hover:-translate-y-0.5 transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {submitting && <Spinner />}
              {submitting ? "Adding…" : "Add bonding capacity"}
            </button>
            {bonding.length > 0 && (
              <button type="button" onClick={() => setShowForm(false)} className="text-label-md text-on-surface-variant hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-sm">
                Cancel
              </button>
            )}
          </div>
        </form>
      ) : (
        <div className="mb-4">
          <AddTriggerButton label="Add bonding capacity" onClick={() => setShowForm(true)} />
        </div>
      )}

      {error && <p className="text-body-md text-error mb-3">{error}</p>}

      {bonding.length === 0 ? (
        !showForm && <p className="text-body-md text-on-surface-variant">No bonding capacity added yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {bonding.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-3 rounded border border-outline-variant bg-surface flex-wrap">
              <div>
                <p className="text-body-md text-on-surface font-bold">
                  {b.surety_name ?? "Surety bond"}
                  {b.bond_number ? ` (#${b.bond_number})` : ""}
                </p>
                <p className="text-label-md text-on-surface-variant">
                  {b.expiration_date ? `Expires ${new Date(b.expiration_date).toLocaleDateString()}` : "No expiration on file"}
                  <DocLink url={b.file_url} name={b.file_name} />
                </p>
              </div>
              <div className="flex items-center gap-3">
                <VerifiedBadge verified={b.verified} />
                <button
                  type="button"
                  onClick={() => handleRemove(b.id)}
                  disabled={removingId === b.id}
                  className="min-h-[44px] sm:min-h-0 px-1 text-on-surface-variant hover:text-error text-label-md hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-sm disabled:opacity-40 flex items-center gap-2"
                >
                  {removingId === b.id && <Spinner />}
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
