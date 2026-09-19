// (Deploy pipeline check, 2026-09-05: harmless comment-only touch.)
// Replaces the earlier fit_alignment-based "fit" badge concept entirely
// (see BUILD-ORDER-BIDPULSE.md item #10). Real reasoning for the reversal:
// what fit_alignment actually measures is almost always "has this client
// filled out their profile," not anything about actual bid competitiveness
// (price, competitors, agency discretion) -- but "fit" reads as a
// competitive judgment no matter how it's worded or colored. A
// completeness percentage has no alarming word to soften in the first
// place, and directly tells the client something concrete and fixable.
//
// Deterministic field-presence check, not an LLM judgment call -- cheaper,
// more reliable, and avoids the exact "third-person AI text" voice problem
// that caused the earlier Request-info bug. Every field is weighted
// equally: no field here matters enough to the actual paperwork First Coast Bids
// prepares to justify a heavier or lighter weight than another, and equal
// weighting is the one scheme that doesn't need its own separate
// justification.
export type CompletenessField = {
  key: string;
  label: string;
  complete: boolean;
};

export function computeProfileCompleteness(input: {
  naicsCodes: string[] | null;
  licenseNumber: string | null;
  businessRegistrationNumber: string | null;
  insuranceProvider: string | null;
  generalLiabilityCoverage: string | null;
  workersCompCoverage: string | null;
  businessAddress: string | null;
  businessPhone: string | null;
  hasCertification: boolean;
}): { percent: number; missing: CompletenessField[] } {
  const fields: CompletenessField[] = [
    { key: "naics_codes", label: "NAICS codes", complete: (input.naicsCodes?.length ?? 0) > 0 },
    { key: "license_number", label: "Trade/occupational license number", complete: !!input.licenseNumber },
    {
      key: "business_registration_number",
      label: "Business registration number (e.g. Sunbiz Doc#)",
      complete: !!input.businessRegistrationNumber,
    },
    {
      key: "insurance",
      label: "Insurance provider or coverage details",
      complete: !!(input.insuranceProvider || input.generalLiabilityCoverage),
    },
    {
      key: "workers_comp",
      label: "Workers' comp coverage",
      complete: !!input.workersCompCoverage,
    },
    { key: "business_address", label: "Business address", complete: !!input.businessAddress },
    { key: "business_phone", label: "Business phone", complete: !!input.businessPhone },
    { key: "certification", label: "At least one certification on file", complete: input.hasCertification },
  ];

  const completeCount = fields.filter((f) => f.complete).length;
  const percent = Math.round((completeCount / fields.length) * 100);
  const missing = fields.filter((f) => !f.complete);

  return { percent, missing };
}
