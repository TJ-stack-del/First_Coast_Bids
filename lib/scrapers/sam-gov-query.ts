import { SAM_BIDDABLE_PTYPES, shouldKeepSamNotice } from "../matches/rules.ts";

// Pure request-building and row-selection for the SAM.gov scraper, kept
// separate from the fetch so it's unit-tested (sam-gov-query.test.ts).
//
// Quota shape (decided 2026-09-23): the public API key allows only a
// handful of requests a day (it hit its limit at 13 on 2026-09-22), so the
// daily run makes ONE request -- recent Florida postings of biddable types
// across every NAICS code, with our trade codes picked out locally from each
// row's naicsCode. Florida-only is a product decision: clients are Northeast
// Florida trade businesses. Measured 2026-09-23: nationwide volume (~925
// biddable postings/day) would not fit one 1,000-row request; Florida does.
// A one-time backfill of older still-open postings goes one NAICS code per
// request instead, run by hand across a few days.

// The full, real set of NAICS codes a First Coast Bids client could
// plausibly have on file: lib/business-options.ts's COMMON_NAICS_CODES
// checkbox list, plus lib/compliance/known-trades.ts's IT/computer-support
// codes (only ever entered via the intake form's free-text "Other NAICS
// code" field, never a checkbox). 238220 is included even though
// KNOWN_TRADES' own HVAC entry excludes it as a *compliance-coverage*
// signal -- that exclusion serves a different feature (scope-text
// compliance flagging) and doesn't apply here.
export const SAM_NAICS_CODES = [
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
] as const;

export const SAM_STATE = "FL";
export const SAM_PAGE_LIMIT = 1000; // the API's documented maximum

const DAY_MS = 24 * 60 * 60 * 1000;

// MM/dd/yyyy, the only date format the API accepts.
export function formatSamDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()}`;
}

function baseParams(apiKey: string, postedFrom: Date, postedTo: Date): URLSearchParams {
  const params = new URLSearchParams({
    api_key: apiKey,
    postedFrom: formatSamDate(postedFrom),
    postedTo: formatSamDate(postedTo),
    state: SAM_STATE,
    limit: String(SAM_PAGE_LIMIT),
  });
  // Repeated `ptype` params (the API's documented multi-value format).
  for (const code of SAM_BIDDABLE_PTYPES) params.append("ptype", code);
  return params;
}

// Daily: yesterday through today. The overlap with the previous run is
// deliberate (a posting made late yesterday after the last run is still
// caught); app/api/scrape's title+agency dedup skips anything seen before.
export function buildSamDailyParams(apiKey: string, now: Date): URLSearchParams {
  return baseParams(apiKey, new Date(now.getTime() - DAY_MS), now);
}

// Backfill: one NAICS code over the widest window the API allows. The
// window starts one day short of a year back: SAM.gov counts both end
// dates and rejects the same calendar date last year with 400 "Date range
// must be no more than 1 year apart" (verified live 2026-09-23).
export function buildSamBackfillParams(apiKey: string, now: Date, naicsCode: string): URLSearchParams {
  const from = new Date(now);
  from.setFullYear(now.getFullYear() - 1);
  from.setDate(from.getDate() + 1);
  const params = baseParams(apiKey, from, now);
  params.set("ncode", naicsCode);
  return params;
}

export type SamRow = {
  naicsCode?: string | null;
  type?: string | null;
  responseDeadLine?: string | null;
};

// Keep rows in one of our trade codes that are biddable and still open
// (lib/matches/rules.ts decides "biddable" and "still open").
export function selectSamRows<T extends SamRow>(rows: T[], now: Date): T[] {
  const codes = new Set<string>(SAM_NAICS_CODES);
  return rows.filter((r) => !!r.naicsCode && codes.has(r.naicsCode) && shouldKeepSamNotice(r, now));
}

// The daily run's rolling catch-up (decided 2026-09-23): each UTC day it
// also runs the 12-month backfill for ONE trade code, rotating through all
// 11, so older still-open Florida postings are caught without anyone
// calling the route by hand (the production CRON_SECRET is a Vercel
// sensitive variable nobody can read back). Costs one extra request a day;
// title+agency dedup makes repeats free. A full cycle takes 11 days.
export function backfillCodeForDate(now: Date): string {
  const utcDay = Math.floor(now.getTime() / DAY_MS);
  return SAM_NAICS_CODES[utcDay % SAM_NAICS_CODES.length];
}
