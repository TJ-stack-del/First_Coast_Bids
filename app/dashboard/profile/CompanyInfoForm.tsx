"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/Spinner";
import { FadeMessage } from "@/components/ui/FadeMessage";
import { CheckboxGroup } from "@/components/ui/CheckboxGroup";
import { SMALL_BUSINESS_STATUSES, COMMON_SET_ASIDES, COMMON_NAICS_CODES } from "@/lib/business-options";

type CompanyInfo = {
  license_number: string | null;
  business_registration_number: string | null;
  years_in_business: number | null;
  business_address: string | null;
  business_phone: string | null;
  insurance_provider: string | null;
  insurance_policy_number: string | null;
  general_liability_coverage: string | null;
  workers_comp_coverage: string | null;
  commercial_auto_coverage: string | null;
  differentiators: string | null;
  naics_codes: string[];
  small_business_statuses: string[];
  set_asides: string[];
  sam_uei: string | null;
};

// Existing rows may hold values that predate these checkbox lists (e.g. a
// local set-aside typed in before this changed from free text), so on load
// each array is split into "matches a known checkbox" and "everything
// else" — the leftover surfaces in the free-text field instead of silently
// vanishing.
function splitKnown(values: string[], known: readonly string[]): { checked: string[]; other: string } {
  const checked = values.filter((v) => known.includes(v));
  const other = values.filter((v) => !known.includes(v));
  return { checked, other: other.join(", ") };
}

const FIELDS: { key: keyof CompanyInfo; label: string; type?: string; area?: boolean }[] = [
  { key: "license_number", label: "Trade/occupational license number" },
  { key: "business_registration_number", label: "Business registration number (e.g. Sunbiz Doc#)" },
  { key: "years_in_business", label: "Years in business", type: "number" },
  { key: "business_address", label: "Business address" },
  { key: "business_phone", label: "Business phone" },
  { key: "insurance_provider", label: "Insurance provider" },
  { key: "insurance_policy_number", label: "Insurance policy number" },
  { key: "general_liability_coverage", label: "General liability coverage (e.g. $1M/$2M)" },
  { key: "workers_comp_coverage", label: "Workers' comp coverage" },
  { key: "commercial_auto_coverage", label: "Commercial auto coverage" },
  { key: "sam_uei", label: "SAM.gov Unique Entity ID (UEI) — only if you plan to bid on federal work" },
];

// Filled in once, reused as facts across every future bid (app/api/
// generate-draft, app/api/generate-fit-check) instead of re-asking the
// client the same questions on every submission.
export function CompanyInfoForm({
  clientId,
  initialInfo,
}: {
  clientId: string;
  initialInfo: CompanyInfo;
}) {
  const naicsKnownCodes = COMMON_NAICS_CODES.map((n) => n.code);
  const initialNaics = splitKnown(initialInfo.naics_codes, naicsKnownCodes);
  const initialSetAsides = splitKnown(initialInfo.set_asides, COMMON_SET_ASIDES);

  const [values, setValues] = useState<CompanyInfo>(initialInfo);
  const [naicsCodes, setNaicsCodes] = useState<string[]>(initialNaics.checked);
  const [naicsOther, setNaicsOther] = useState(initialNaics.other);
  const [smallBusinessStatuses, setSmallBusinessStatuses] = useState<string[]>(
    initialInfo.small_business_statuses
  );
  const [setAsides, setSetAsides] = useState<string[]>(initialSetAsides.checked);
  const [setAsideOther, setSetAsideOther] = useState(initialSetAsides.other);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  function setField(key: keyof CompanyInfo, value: string) {
    setValues((v) => ({
      ...v,
      [key]: key === "years_in_business" ? (value === "" ? null : Number(value)) : value === "" ? null : value,
    }));
    setSaved(false);
  }

  function parseOther(text: string): string[] {
    return text
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      ...values,
      naics_codes: [...naicsCodes, ...parseOther(naicsOther)],
      small_business_statuses: smallBusinessStatuses,
      set_asides: [...setAsides, ...parseOther(setAsideOther)],
    };

    const { error: updateError } = await supabase.from("clients").update(payload).eq("id", clientId);

    if (updateError) {
      setError(updateError.message);
    } else {
      setSaved(true);
      // Fit Check is a stored snapshot (submissions.fit_alignment/
      // fit_explanation), only ever (re)computed at intake final-submit or
      // admin "Assign" — nothing previously re-ran it when a client filled
      // in their profile afterward, so it silently went stale citing
      // missing license/insurance/certs that had since been added. Excludes
      // drafts (nothing to check yet) and closed submissions (already
      // delivered — recomputing wouldn't change anything client-facing).
      // Fire-and-forget, same pattern as MatchesPanel.tsx's own trigger —
      // a failed refresh here shouldn't block the profile save succeeding.
      const { data: activeSubmissions } = await supabase
        .from("submissions")
        .select("id")
        .eq("client_id", clientId)
        .eq("draft", false)
        .neq("stage", "closed");
      for (const s of activeSubmissions ?? []) {
        fetch("/api/generate-fit-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ submissionId: s.id }),
        }).catch(() => {});
      }
    }
    setSaving(false);
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className="text-label-md text-on-surface-variant block mb-1">{f.label}</label>
            <input
              type={f.type ?? "text"}
              value={values[f.key] ?? ""}
              onChange={(e) => setField(f.key, e.target.value)}
              className="w-full px-3 py-2.5 rounded border border-outline-variant bg-surface text-body-md text-on-surface outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
            />
          </div>
        ))}
      </div>

      <CheckboxGroup
        legend="NAICS codes that apply"
        options={COMMON_NAICS_CODES.map((n) => ({ value: n.code, label: `${n.code}: ${n.label}` }))}
        selected={naicsCodes}
        onChange={(v) => {
          setNaicsCodes(v);
          setSaved(false);
        }}
      />
      <div>
        <label className="text-label-md text-on-surface-variant block mb-1">Other NAICS code</label>
        <input
          type="text"
          value={naicsOther}
          onChange={(e) => {
            setNaicsOther(e.target.value);
            setSaved(false);
          }}
          className="w-full px-3 py-2.5 rounded border border-outline-variant bg-surface text-body-md text-on-surface outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
        />
      </div>

      <CheckboxGroup
        legend="Small business status"
        options={SMALL_BUSINESS_STATUSES.map((s) => ({ value: s, label: s }))}
        selected={smallBusinessStatuses}
        onChange={(v) => {
          setSmallBusinessStatuses(v);
          setSaved(false);
        }}
      />

      <CheckboxGroup
        legend="Set-asides that apply"
        options={COMMON_SET_ASIDES.map((s) => ({ value: s, label: s }))}
        selected={setAsides}
        onChange={(v) => {
          setSetAsides(v);
          setSaved(false);
        }}
      />
      <div>
        <label className="text-label-md text-on-surface-variant block mb-1">
          Other set-aside (e.g. a local/regional category)
        </label>
        <input
          type="text"
          value={setAsideOther}
          onChange={(e) => {
            setSetAsideOther(e.target.value);
            setSaved(false);
          }}
          className="w-full px-3 py-2.5 rounded border border-outline-variant bg-surface text-body-md text-on-surface outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
        />
      </div>

      <div>
        <label className="text-label-md text-on-surface-variant block mb-1">
          Differentiators / notable past projects
        </label>
        <textarea
          value={values.differentiators ?? ""}
          onChange={(e) => setField("differentiators", e.target.value)}
          rows={4}
          placeholder="What sets your company apart: track record, capacity, notable prior contracts…"
          className="w-full px-3 py-2.5 rounded border border-outline-variant bg-surface text-body-md text-on-surface outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="py-2 px-4 bg-primary-container text-on-primary-container rounded text-label-md font-semibold hover:opacity-90 hover:-translate-y-0.5 transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 flex items-center gap-2 w-fit focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {saving && <Spinner />}
          {saving ? "Saving…" : "Save company info"}
        </button>
        <FadeMessage show={saved} className="text-body-md text-primary">
          Saved
        </FadeMessage>
      </div>
      {error && <p className="text-body-md text-error">{error}</p>}
    </form>
  );
}
