// The single canonical list of `clients` columns an authenticated (non-
// service-role) user is allowed to write directly via the REST API.
//
// This exists because that permission is enforced in a place TypeScript
// can't see: supabase/migrations/20260920130000_lock_down_sam_status_columns.sql's
// `grant update (...)` column list. Before this file existed, that SQL
// list and the fields actually written by CompanyInfoForm.tsx's handleSave
// and IntakeWizard.tsx's handleProfileExtracted/handleRetainerProfileNext
// were three independently hand-maintained lists with nothing keeping them
// in sync -- forgetting to update the SQL grant when adding a new
// client-writable field breaks that field's save with a silent RLS
// permission error in production that TypeScript can't catch (the same
// "looks fine at compile time, breaks at request time" failure class this
// repo's CLAUDE.md already documents for PostgREST embeds).
//
// This doesn't make the SQL grant self-updating (there's no mechanism to
// generate SQL from a TS constant in this project, and building one would
// be real over-engineering for a 15-item list) -- what it does is give
// lib/clients/writable-fields.test.ts a single place to check the SQL
// grant against, so a drift between the two fails a test loudly instead of
// failing a real client's save silently. Keep this list and the SQL
// migration's grant list in exact sync by hand; the test is what catches
// it if they ever aren't.
export const CLIENT_WRITABLE_FIELDS = [
  "license_number",
  "business_registration_number",
  "years_in_business",
  "business_address",
  "business_phone",
  "insurance_provider",
  "insurance_policy_number",
  "general_liability_coverage",
  "workers_comp_coverage",
  "commercial_auto_coverage",
  "differentiators",
  "naics_codes",
  "small_business_statuses",
  "set_asides",
  "sam_uei",
] as const;
