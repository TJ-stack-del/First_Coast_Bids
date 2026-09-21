// The full, real set of values clients.sam_registration_status can hold --
// not just the two the SAM.gov Entity API itself distinguishes ("active"/
// "inactive"). "not_registered" is written by app/api/check-sam-status's
// cron route when the Entity API returns no matching entity at all (a
// different case from "found, but inactive"). "unknown" is documented in
// this feature's own migration (20260920120000_add_sam_registration_fields_
// to_clients.sql) as a real, intended state for "never successfully
// checked" -- no code path writes it explicitly yet (a client's row is
// simply null until the first successful cron check), but it's part of the
// real domain of this column and any code branching on
// sam_registration_status should account for it, not assume only two
// values are possible.
export type SamRegistrationStatus = "active" | "inactive" | "not_registered" | "unknown";
