import type { ScrapedOpportunity } from "./jaa";
import { SAM_BIDDABLE_PTYPES, shouldKeepSamNotice } from "../matches/rules";

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
  type?: string;
};

type RawOpportunitiesResponse = {
  opportunitiesData?: RawOpportunity[];
};

function parseOpportunity(raw: RawOpportunity, now: Date): ScrapedOpportunity | null {
  if (!raw.title) return null; // no usable title -- skip rather than insert a blank row
  // Backstop for the `ptype` request filter below, plus the deadline check
  // the API can't do for us without also dropping deadline-less
  // presolicitations (see lib/matches/rules.ts). Without this, the
  // 12-month lookback imported award notices and long-closed bids by the
  // hundred into the admin Matches queue.
  if (!shouldKeepSamNotice(raw, now)) return null;
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
  // Repeated `ptype` params (the API's documented multi-value format), not
  // a comma-joined one.
  for (const code of SAM_BIDDABLE_PTYPES) params.append("ptype", code);

  const res = await fetch(`${OPPORTUNITIES_API_BASE}?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`SAM.gov Opportunities API request failed for NAICS ${naicsCode}: ${res.status} ${res.statusText}`);
  }

  const raw = (await res.json()) as RawOpportunitiesResponse;
  return (raw.opportunitiesData ?? [])
    .map((o) => parseOpportunity(o, today))
    .filter((o): o is ScrapedOpportunity => o !== null);
}

// Small, fixed batch size, not full concurrency across all 11 codes at
// once -- SAM.gov's public API has no documented per-key rate limit this
// was tuned against, and firing 11 requests simultaneously against a
// government API on a shared free-tier key is a worse first move than a
// modest batch. 4 at a time cuts worst-case sequential latency by roughly
// 4x (this route's real timeout risk -- see the batching comment above
// fetchOpportunitiesForNaicsCode) while staying conservative.
const BATCH_SIZE = 4;

export async function scrapeSamGov(): Promise<ScrapedOpportunity[]> {
  const apiKey = process.env.SAM_GOV_API_KEY;
  if (!apiKey) {
    throw new Error("scrapeSamGov: SAM_GOV_API_KEY is not set.");
  }

  const results: ScrapedOpportunity[] = [];
  const codeErrors: string[] = [];

  // Batched, not one sequential loop that aborts on the first failure --
  // a single rate-limited or transient-5xx NAICS code (of 11 real,
  // separate API calls, since SAM.gov accepts only one NAICS code per
  // request) must not discard opportunities already fetched from every
  // code that succeeded before it. Promise.allSettled gives per-item
  // error isolation within each batch, matching this app's existing
  // per-item isolation convention (see app/api/check-sam-status's
  // per-client try/catch) rather than the all-or-nothing behavior a
  // single throw inside Promise.all would have. Only throws for the
  // whole function if every single code failed -- that's the real
  // "something is systemically broken" signal (e.g. a revoked API key),
  // which must still surface as a loud scraper-level error rather than a
  // silent, indistinguishable-from-"no results today" empty array.
  for (let i = 0; i < NAICS_CODES.length; i += BATCH_SIZE) {
    const batch = NAICS_CODES.slice(i, i + BATCH_SIZE);
    const settled = await Promise.allSettled(batch.map((code) => fetchOpportunitiesForNaicsCode(code, apiKey)));

    settled.forEach((outcome, idx) => {
      const code = batch[idx];
      if (outcome.status === "fulfilled") {
        results.push(...outcome.value);
      } else {
        const message = outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason);
        console.error("[sam-gov] failed to fetch opportunities for NAICS code", { code, message });
        codeErrors.push(`${code}: ${message}`);
      }
    });
  }

  if (codeErrors.length === NAICS_CODES.length) {
    throw new Error(`scrapeSamGov: every NAICS code request failed -- ${codeErrors.join("; ")}`);
  }

  return results;
}
