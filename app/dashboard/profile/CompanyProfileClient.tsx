"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CompanyProfileUpload, type ExtractedCompanyProfile } from "@/components/ui/CompanyProfileUpload";
import { useToast } from "@/components/Toast";
import { uploadRfpDocument } from "@/lib/storage";
import { CompanyInfoForm } from "./CompanyInfoForm";
import type { NaicsOption } from "@/lib/trades/naics-options";

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

// Owns the upload+extraction step so a client can fill in most of this page
// from an existing document instead of retyping it — CompanyInfoForm itself
// stays a plain controlled-by-initial-props form; this just remounts it
// (via `key`) with merged values once extraction returns, same pattern the
// rest of the form already uses (nothing is saved to the clients row until
// the client hits Save, so an extraction the client doesn't want is a no-op
// unless they submit it).
export function CompanyProfileClient({
  clientId,
  initialInfo,
  offeredNaics,
}: {
  clientId: string;
  initialInfo: CompanyInfo;
  offeredNaics: NaicsOption[];
}) {
  const [info, setInfo] = useState(initialInfo);
  const [version, setVersion] = useState(0);
  const [savingCerts, setSavingCerts] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const { showToast } = useToast();

  async function handleExtracted(data: ExtractedCompanyProfile, file: File) {
    setInfo((current) => ({
      ...current,
      license_number: data.licenseNumber ?? current.license_number,
      business_registration_number: data.businessRegistrationNumber ?? current.business_registration_number,
      years_in_business: data.yearsInBusiness ?? current.years_in_business,
      business_address: data.businessAddress ?? current.business_address,
      business_phone: data.businessPhone ?? current.business_phone,
      insurance_provider: data.insuranceProvider ?? current.insurance_provider,
      insurance_policy_number: data.insurancePolicyNumber ?? current.insurance_policy_number,
      general_liability_coverage: data.generalLiabilityCoverage ?? current.general_liability_coverage,
      workers_comp_coverage: data.workersCompCoverage ?? current.workers_comp_coverage,
      commercial_auto_coverage: data.commercialAutoCoverage ?? current.commercial_auto_coverage,
      naics_codes: data.naicsCodes.length > 0 ? [...new Set([...current.naics_codes, ...data.naicsCodes])] : current.naics_codes,
    }));
    setVersion((v) => v + 1);

    if (data.certifications.length === 0) {
      showToast("Filled in what we found. Review it below before saving.", "success");
      return;
    }

    setSavingCerts(true);
    const uploaded = await uploadRfpDocument(supabase, `${clientId}/certifications/${Date.now()}-${file.name}`, file);

    if (uploaded.error) {
      showToast(`Filled in what we found, but couldn't attach the document to certifications: ${uploaded.error}`, "error");
      setSavingCerts(false);
      return;
    }
    const path = uploaded.path;

    const rows = data.certifications.map((c) => ({
      client_id: clientId,
      record_type: c.recordType,
      cert_type: c.certType,
      other_label: c.recordType === "small_business_cert" && c.certType === "Other" ? c.otherLabel : null,
      certification_number: c.certificationNumber,
      jurisdiction_state: c.jurisdictionState,
      licensing_board: c.licensingBoard,
      expiration_date: c.expirationDate,
      file_url: path,
      file_name: file.name,
    }));
    const { error: insertError } = await supabase.from("client_certifications").insert(rows);
    setSavingCerts(false);

    if (insertError) {
      showToast(`Filled in what we found, but couldn't save certifications: ${insertError.message}`, "error");
      return;
    }

    showToast(
      `Filled in what we found, and added ${data.certifications.length} certification${data.certifications.length === 1 ? "" : "s"} below for our team to verify.`,
      "success"
    );
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <CompanyProfileUpload onExtracted={handleExtracted} />
      {savingCerts && <p className="text-body-md text-on-surface-variant">Saving certifications…</p>}
      <CompanyInfoForm key={version} clientId={clientId} initialInfo={info} offeredNaics={offeredNaics} />
    </div>
  );
}
