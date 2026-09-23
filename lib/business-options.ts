// Shared checkbox option lists for two client profile fields that used to
// be free-text comma lists (small_business_statuses, set_asides) — used by
// the intake wizard, the Company Profile page, and the document-extraction
// prompt, so all three stay in sync on exact label text. NAICS options come
// from the admin-managed trade list instead (lib/trades/naics-options.ts).

// Matches the client_certifications.cert_type values (schema.sql) where they
// overlap, so a status checked here reads the same as a certification typed
// there.
export const SMALL_BUSINESS_STATUSES = [
  "Small Business",
  "8(a)",
  "HUBZone",
  "WOSB",
  "EDWOSB",
  "SDVOSB",
  "VOSB",
  "MBE",
  "DBE",
  "SDB",
] as const;

// Only the set-asides common enough to be worth a checkbox everywhere else —
// local/regional set-asides (e.g. Jacksonville's JSEB) vary too much by
// jurisdiction to hardcode, so those go through the free-text "Other" field.
export const COMMON_SET_ASIDES = ["Total Small Business Set-Aside", "SDB Set-Aside"] as const;
