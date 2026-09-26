// Single source of truth for "which deliverable types does this submission
// need" -- pure, deterministic, no I/O. Previously this decision lived
// inline in DeliverablesPanel.tsx (a boolean expression mixed into JSX);
// pulling it out here makes it testable and gives the new estimate-driven
// suggestion (DeliverablesPanel's "Estimate from RFP" button) and the
// existing manual toggle the same one definition to agree on.
//
// Deliberately does NOT decide automatically which mode a submission is
// in -- estimated_value is often a rough guess (admin-entered or, now,
// extracted-then-admin-confirmed), so switching the actual deliverable set
// always stays a manual admin action (DeliverablesPanel's "Switch to lean
// package" button). isLeanEligible only answers "should we suggest it."

export const FULL_DELIVERABLE_TYPES = [
  "capability_statement",
  "compliance_matrix",
  "technical_narrative",
] as const;

export const LEAN_DELIVERABLE_TYPES = [
  "rate_sheet",
  "executive_cover",
  "certificate_of_insurance",
] as const;

export type PackageMode = "full" | "lean";

// A federal bid with a CLIN price table also needs its Rate sheet (the
// priced table, docs/superpowers/specs/2026-09-25-clin-pricing-design.md).
export function getRequiredDeliverableTypes(mode: PackageMode, hasClins = false): readonly string[] {
  if (mode === "lean") return LEAN_DELIVERABLE_TYPES;
  return hasClins ? [...FULL_DELIVERABLE_TYPES, "rate_sheet"] : FULL_DELIVERABLE_TYPES;
}

// Lean is sticky once a lean-only deliverable exists. A Rate sheet alone
// means lean only when the bid has no CLIN table (a federal full package
// has one too).
export function isLeanPackage(existingTypes: string[], hasClins: boolean): boolean {
  if (existingTypes.some((t) => t === "executive_cover" || t === "certificate_of_insurance")) return true;
  return !hasClins && existingTypes.includes("rate_sheet");
}

export function isLeanEligible(estimatedValue: number | null, leanPackageThreshold: number): boolean {
  return estimatedValue != null && estimatedValue > 0 && estimatedValue < leanPackageThreshold;
}
