import type { ScrapedOpportunity } from "./jaa";

// SAM.gov's public Get Opportunities API -- a real typed REST client, not
// HTML scraping like jaa.ts/coj.ts. Confirmed against GSA's own published
// API docs (open.gsa.gov/api/get-opportunities-public-api), not guessed:
// exactly one NAICS code per request (no comma-separated support), a
// maximum 1-year range between postedFrom/postedTo, MM/dd/yyyy date format.
const OPPORTUNITIES_API_BASE = "https://api.sam.gov/opportunities/v2/search";
const SOURCE_AGENCY_FALLBACK = "Federal (SAM.gov)";

// The full, real set of NAICS codes a First Coast Bids client could
// plausibly have on file: lib/business-options.ts's COMMON_NAICS_CODES
// checkbox list, plus lib/compliance/known-trades.ts's IT/computer-support
// codes (only ever entered via the intake form's free-text "Other NAICS
// code" field, never a checkbox). 238220 is included even though
// KNOWN_TRADES' own HVAC entry excludes it as a *compliance-coverage*
// signal -- that exclusion serves a different feature (scope-text
// compliance flagging) and doesn't apply here, where a client who
// genuinely selected 238220 is a legitimate NAICS match for an
// opportunity carrying that code.
const NAICS_CODES = [
  "561720", // Janitorial Services
  "561790", // Other Services to Buildings and Dwellings
  "561740", // Carpet and Upholstery Cleaning Services
  "561730", // Landscaping Services
  "238220", // Plumbing, Heating, and Air-Conditioning Contractors
  "238290", // Other Building Equipment Contractors
  "561210", // Facilities Support Services
  "238210", // Electrical Contractors
  "541512", // Computer Systems Design Services
  "541519", // Other Computer Related Services
  "518210", // Data Processing, Hosting, and Related Services
];

function formatDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

type RawOpportunity = {
  title?: string;
  fullParentPathName?: string;
  solicitationNumber?: string;
  responseDeadLine?: string;
  naicsCode?: string;
  uiLink?: string;
};

type RawOpportunitiesResponse = {
  opportunitiesData?: RawOpportunity[];
};

function parseOpportunity(raw: RawOpportunity): ScrapedOpportunity | null {
  if (!raw.title) return null; // no usable title -- skip rather than insert a blank row
  return {
    source_title: raw.title,
    source_agency: raw.fullParentPathName || SOURCE_AGENCY_FALLBACK,
    source_url: raw.uiLink ?? null,
    due_date: raw.responseDeadLine ?? null,
    solicitation_number: raw.solicitationNumber ?? null,
    naics_code: raw.naicsCode ?? null,
  };
}

async function fetchOpportunitiesForNaicsCode(naicsCode: string, apiKey: string): Promise<ScrapedOpportunity[]> {
  const today = new Date();
  const oneYearAgo = new Date(today);
  oneYearAgo.setFullYear(today.getFullYear() - 1);
  // postedFrom/postedTo max range is exactly 1 year -- use "one year ago"
  // to "today" every run rather than tracking a high-water mark, since
  // the existing dedup-by-title-and-agency logic in app/api/scrape/route.ts
  // already prevents re-inserting anything still posted from a prior run.
  const params = new URLSearchParams({
    api_key: apiKey,
    ncode: naicsCode,
    postedFrom: formatDate(oneYearAgo),
    postedTo: formatDate(today),
    limit: "100",
  });

  const res = await fetch(`${OPPORTUNITIES_API_BASE}?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`SAM.gov Opportunities API request failed for NAICS ${naicsCode}: ${res.status} ${res.statusText}`);
  }

  const raw = (await res.json()) as RawOpportunitiesResponse;
  return (raw.opportunitiesData ?? [])
    .map(parseOpportunity)
    .filter((o): o is ScrapedOpportunity => o !== null);
}

export async function scrapeSamGov(): Promise<ScrapedOpportunity[]> {
  const apiKey = process.env.SAM_GOV_API_KEY;
  if (!apiKey) {
    throw new Error("scrapeSamGov: SAM_GOV_API_KEY is not set.");
  }

  const results: ScrapedOpportunity[] = [];
  for (const code of NAICS_CODES) {
    const found = await fetchOpportunitiesForNaicsCode(code, apiKey);
    results.push(...found);
  }
  return results;
}
