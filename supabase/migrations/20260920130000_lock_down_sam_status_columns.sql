-- The "clients update their own record" RLS policy (schema.sql) is
-- column-blind: it authorizes an UPDATE on the whole row once
-- is_own_client_record(id) passes, and GRANT ALL ON TABLE "clients" TO
-- "authenticated" backs it with table-level UPDATE privilege. That means
-- an authenticated client can currently PATCH sam_registration_status,
-- sam_registration_expires_at, and sam_status_checked_at directly via the
-- REST API and self-attest an "active" federal registration that was
-- never actually verified against SAM.gov -- exactly the kind of
-- paperwork-technicality gap this product exists to close, and it would
-- silently undermine any future plan that gates federal-opportunity
-- matching on these columns.
--
-- Those three columns are written only by app/api/check-sam-status's
-- cron route, using the service_role key -- a client should never be able
-- to write them directly. sam_uei stays client-writable by design
-- (clients enter their own UEI on the Company Profile form and at
-- intake), as do all of the other columns clients currently update
-- through CompanyInfoForm.tsx's handleSave and IntakeWizard.tsx's
-- handleProfileExtracted / handleRetainerProfileNext.
--
-- This revokes table-level UPDATE from "authenticated" and re-grants it
-- column-by-column for exactly the columns those two client-facing code
-- paths actually write, deliberately excluding the three cron-owned
-- columns. SELECT, INSERT, and the anon/service_role grants are
-- untouched -- service_role (used by the cron routes) keeps full UPDATE
-- access on the whole table.
--
-- The column list below must exactly match lib/clients/writable-fields.ts's
-- CLIENT_WRITABLE_FIELDS -- lib/clients/writable-fields.test.ts checks the
-- two against each other on every test run. If you're adding a new
-- client-writable column, update both, in the same commit, or the test
-- fails loudly instead of that column's save failing silently in
-- production later.
revoke update on table "public"."clients" from "authenticated";

grant update (
  license_number,
  business_registration_number,
  years_in_business,
  business_address,
  business_phone,
  insurance_provider,
  insurance_policy_number,
  general_liability_coverage,
  workers_comp_coverage,
  commercial_auto_coverage,
  differentiators,
  naics_codes,
  small_business_statuses,
  set_asides,
  sam_uei
) on table "public"."clients" to "authenticated";
