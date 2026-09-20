-- SAM.gov registration tracking, added for the SAM.gov adoption
-- initiative (docs/superpowers/specs/2026-09-20-sam-gov-adoption-design.md).
-- sam_uei is optional -- only clients pursuing federal work need one.
-- sam_registration_status is plain unconstrained text (mirrors
-- packages.package_type's existing convention), expected values are
-- "active" / "inactive" / "not_registered" / "unknown", written only by
-- the app/api/check-sam-status cron -- never trust an unset value as
-- "active" anywhere that gates federal matching.
alter table "public"."clients"
  add column if not exists "sam_uei" text,
  add column if not exists "sam_registration_status" text,
  add column if not exists "sam_registration_expires_at" date,
  add column if not exists "sam_status_checked_at" timestamptz;
