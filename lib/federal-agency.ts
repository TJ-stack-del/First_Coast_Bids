// UEI/CAGE codes are SAM.gov federal-registration identifiers — asking for
// them by default made every draft look federal even for a city/county/
// authority bid (the common case for this app's actual clients so far).
// Keyword match against the agency name, defaulting to false (i.e. drop
// them) unless the agency clearly signals federal — a municipality, school
// district, or local authority name never matches any of these.
//
// Shared (not server-only) since both the generate-draft route and the
// client-bundled PDF packet generator need the identical determination —
// a federal bid must never show CAGE/UEI in one place and omit it in the
// other.
// Cabinet departments as SAM.gov and plain English both name them.
const DEPARTMENTS =
  "defense|veterans affairs|homeland security|energy|justice|state|treasury|agriculture|labor|commerce|education|interior|transportation|housing and urban development|health and human services";

const FEDERAL_AGENCY_PATTERNS: RegExp[] = [
  // Plain English: "Department of Veterans Affairs", "U.S. Department of Energy".
  new RegExp(`\\bdepartment of (the )?(${DEPARTMENTS})\\b`, "i"),
  // SAM.gov's API writes departments inverted or abbreviated
  // ("AGRICULTURE, DEPARTMENT OF", "INTERIOR, DEPARTMENT OF THE",
  // "DEPT OF DEFENSE.DEPT OF THE NAVY") -- added 2026-09-25 after real
  // Dept of Defense matches were found not counting as federal.
  new RegExp(`\\b(${DEPARTMENTS}), department of\\b`, "i"),
  new RegExp(`\\bdept\\.? of (the )?(${DEPARTMENTS}|army|navy|air force)\\b`, "i"),
  /\b(federal|u\.?s\.?\s+(government|department|army|navy|air force|marine corps|coast guard)|united states|\bGSA\b|general services administration|\bNASA\b|army corps of engineers|defense logistics agency|coast guard|sam\.gov)\b/i,
  // Jacksonville's own federal installations, as agencies or clients name them.
  /\b(naval (air )?station|\bNAS jacksonville\b|naval station mayport|marine corps|air force base)\b/i,
];

// A state agency that shares a federal department's name ("Florida
// Department of Transportation", "State of Florida Department of ...") is
// not federal. Before 2026-09-25 the plain "department of transportation"
// match wrongly treated FDOT as federal.
const STATE_AGENCY_PATTERN = /\b(florida|state of [a-z]+|state)\s+(department|dept\.?)\s+of\b/i;

export function isFederalAgency(agency: string): boolean {
  if (STATE_AGENCY_PATTERN.test(agency)) return false;
  return FEDERAL_AGENCY_PATTERNS.some((pattern) => pattern.test(agency));
}
