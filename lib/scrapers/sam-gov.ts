import type { ScrapedOpportunity } from "./jaa";
import { buildSamBackfillParams, buildSamDailyParams, selectSamRows } from "./sam-gov-query";

// SAM.gov's public Get Opportunities API -- a real typed REST client, not
// HTML scraping like jaa.ts/coj.ts. Confirmed against GSA's own published
// API docs (open.gsa.gov/api/get-opportunities-public-api), not guessed:
// one NAICS code per request at most, a maximum 1-year range between
// postedFrom/postedTo (counting both ends), MM/dd/yyyy dates, up to 1,000
// rows per request.
//
// The daily run makes exactly ONE request (see sam-gov-query.ts for the
// quota reasoning and the Florida-only decision). Previously it made one
// request per NAICS code (11/day), which exceeds what this key allows.
const OPPORTUNITIES_API_BASE = "https://api.sam.gov/opportunities/v2/search";
const SOURCE_AGENCY_FALLBACK = "Federal (SAM.gov)";

type RawOpportunity = {
  title?: string;
  fullParentPathName?: string;
  solicitationNumber?: string;
  responseDeadLine?: string;
  naicsCode?: string;
  uiLink?: string;
  type?: string;
};

type RawOpportunitiesResponse = {
  totalRecords?: number;
  opportunitiesData?: RawOpportunity[];
};

function toScraped(raw: RawOpportunity & { title: string }): ScrapedOpportunity {
  return {
    source_title: raw.title,
    source_agency: raw.fullParentPathName || SOURCE_AGENCY_FALLBACK,
    source_url: raw.uiLink ?? null,
    due_date: raw.responseDeadLine ?? null,
    solicitation_number: raw.solicitationNumber ?? null,
    naics_code: raw.naicsCode ?? null,
  };
}

function apiKeyOrThrow(caller: string): string {
  const apiKey = process.env.SAM_GOV_API_KEY;
  if (!apiKey) throw new Error(`${caller}: SAM_GOV_API_KEY is not set.`);
  return apiKey;
}

async function fetchAndSelect(
  params: URLSearchParams,
  now: Date,
  label: string,
  codes: readonly string[]
): Promise<ScrapedOpportunity[]> {
  const res = await fetch(`${OPPORTUNITIES_API_BASE}?${params.toString()}`);
  if (!res.ok) {
    // Include SAM.gov's own message (e.g. quota exhausted, bad date range):
    // a bare "400 Bad Request" is what hid the date-range bug for weeks.
    const body = (await res.text().catch(() => "")).slice(0, 300);
    throw new Error(`SAM.gov ${label} request failed: ${res.status} ${res.statusText} ${body}`.trim());
  }
  const raw = (await res.json()) as RawOpportunitiesResponse;
  const rows = raw.opportunitiesData ?? [];
  // A full page means some postings were cut off. Say so loudly rather than
  // silently under-importing; the window or state filter needs revisiting.
  if (typeof raw.totalRecords === "number" && raw.totalRecords > rows.length) {
    console.warn(`[sam-gov] ${label}: ${raw.totalRecords} postings matched but only ${rows.length} were returned`);
  }
  return selectSamRows(rows, now, codes)
    .filter((r): r is RawOpportunity & { title: string } => !!r.title)
    .map(toScraped);
}

// The daily cron's SAM.gov step: one request. `codes` are the active
// trades' NAICS codes (public.trades), passed in by app/api/scrape.
export async function scrapeSamGov(codes: readonly string[]): Promise<ScrapedOpportunity[]> {
  const apiKey = apiKeyOrThrow("scrapeSamGov");
  const now = new Date();
  return fetchAndSelect(buildSamDailyParams(apiKey, now), now, "daily", codes);
}

// One-time catch-up, one NAICS code per call, run by hand (see
// app/api/scrape's samBackfill param) across a few days to stay inside the
// daily quota. Picks up older Florida postings that are still open.
export async function scrapeSamGovBackfill(naicsCode: string, codes: readonly string[]): Promise<ScrapedOpportunity[]> {
  const apiKey = apiKeyOrThrow("scrapeSamGovBackfill");
  const now = new Date();
  return fetchAndSelect(buildSamBackfillParams(apiKey, now, naicsCode), now, `backfill ${naicsCode}`, codes);
}
