"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/Toast";

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

const POLICY_TYPE_LABELS: Record<string, string> = {
  general_liability: "General Liability",
  workers_comp: "Workers' Comp",
  commercial_auto: "Commercial Auto",
  professional_liability: "Professional Liability",
  umbrella: "Umbrella",
};

// Admin's half of the insurance/bonding feature -- same verify-toggle
// pattern as ClientCertifications.tsx (only a real admin action flips
// verified, never automatic; a document is required first, backed by the
// same CHECK-constraint shape on both new tables), just applied across two
// tables instead of one since a COI and a bond letter carry different
// fields.
export function AdminInsuranceBonding({
  orgId,
  actorId,
  insurancePolicies: initialPolicies,
  bondingRecords: initialBonding,
}: {
  orgId: string;
  actorId: string;
  insurancePolicies: InsurancePolicy[];
  bondingRecords: BondingRecord[];
}) {
  const [policies, setPolicies] = useState(initialPolicies);
  const [bonding, setBonding] = useState(initialBonding);
  const [saving, setSaving] = useState<string | null>(null);
  const supabase = createClient();
  const { showToast } = useToast();

  async function toggleVerify<T extends { id: string; file_url: string | null; verified: boolean }>(
    table: "client_insurance_policies" | "client_bonding_capacity",
    row: T,
    setRows: React.Dispatch<React.SetStateAction<T[]>>,
    eventType: string
  ) {
    const nextVerified = !row.verified;
    if (nextVerified && !row.file_url) {
      showToast("Can't mark reviewed without a document on file.", "error");
      return;
    }

    setSaving(row.id);
    const nowIso = new Date().toISOString();

    const { error } = await supabase
      .from(table)
      .update({
        verified: nextVerified,
        verified_at: nextVerified ? nowIso : null,
        verified_by: nextVerified ? actorId : null,
      })
      .eq("id", row.id);

    if (!error) {
      await supabase.from("audit_log").insert({
        org_id: orgId,
        actor_id: actorId,
        event_type: nextVerified ? `${eventType}_verified` : `${eventType}_unverified`,
        event_detail: { record_id: row.id },
      });
      setRows((rows) => rows.map((r) => (r.id === row.id ? { ...r, verified: nextVerified } : r)));
    } else {
      showToast(error.message, "error");
    }
    setSaving(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-body-sm text-on-surface-variant">
        Reviewing means opening the document and checking that the carrier, policy number, limits and expiry date match what the
        client entered, and that it hasn&apos;t expired. It doesn&apos;t confirm the policy with the insurer.
      </p>
      <div>
        <h4 className="text-label-md font-bold text-on-surface-variant uppercase tracking-wider mb-2">
          Insurance policies
        </h4>
        {policies.length === 0 ? (
          <p className="text-body-md text-on-surface-variant">No insurance policies on file.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {policies.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 rounded border border-outline-variant bg-surface flex-wrap">
                <div>
                  <p className="text-body-md text-on-surface font-bold">
                    {POLICY_TYPE_LABELS[p.policy_type] ?? p.policy_type}
                    {p.carrier_name ? ` — ${p.carrier_name}` : ""}
                    {p.policy_number ? ` (#${p.policy_number})` : ""}
                  </p>
                  <p className="text-label-md text-on-surface-variant">
                    {[
                      [p.per_occurrence_limit, p.aggregate_limit].filter(Boolean).join(" / ") || null,
                      p.expiration_date ? `Expires ${new Date(p.expiration_date).toLocaleDateString()}` : "No expiration on file",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    {p.file_url && (
                      <>
                        {" · "}
                        <a href={p.file_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-sm">
                          {p.file_name ?? "View document"}
                        </a>
                      </>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleVerify("client_insurance_policies", p, setPolicies, "insurance_policy")}
                  disabled={saving === p.id || (!p.verified && !p.file_url)}
                  title={!p.verified && !p.file_url ? "Can't mark reviewed without a document on file" : undefined}
                  className={`px-3 py-1.5 rounded text-label-md font-bold transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 disabled:cursor-not-allowed flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                    p.verified
                      ? "border border-outline-variant text-on-surface hover:bg-surface-container-high"
                      : "bg-primary-container text-on-primary-container hover:opacity-90"
                  }`}
                >
                  {saving === p.id && <Spinner />}
                  {p.verified ? "Document reviewed: mark unreviewed" : "Not yet reviewed: mark reviewed"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h4 className="text-label-md font-bold text-on-surface-variant uppercase tracking-wider mb-2">
          Bonding capacity
        </h4>
        {bonding.length === 0 ? (
          <p className="text-body-md text-on-surface-variant">No bonding capacity on file.</p>
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
                    {[
                      [b.single_project_bonding_capacity, b.aggregate_bonding_capacity].filter(Boolean).join(" single / ") || null,
                      b.expiration_date ? `Expires ${new Date(b.expiration_date).toLocaleDateString()}` : "No expiration on file",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    {b.file_url && (
                      <>
                        {" · "}
                        <a href={b.file_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-sm">
                          {b.file_name ?? "View document"}
                        </a>
                      </>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleVerify("client_bonding_capacity", b, setBonding, "bonding_capacity")}
                  disabled={saving === b.id || (!b.verified && !b.file_url)}
                  title={!b.verified && !b.file_url ? "Can't mark reviewed without a document on file" : undefined}
                  className={`px-3 py-1.5 rounded text-label-md font-bold transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 disabled:cursor-not-allowed flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                    b.verified
                      ? "border border-outline-variant text-on-surface hover:bg-surface-container-high"
                      : "bg-primary-container text-on-primary-container hover:opacity-90"
                  }`}
                >
                  {saving === b.id && <Spinner />}
                  {b.verified ? "Document reviewed: mark unreviewed" : "Not yet reviewed: mark reviewed"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
