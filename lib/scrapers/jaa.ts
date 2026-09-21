import * as cheerio from "cheerio";

const JAA_BIDS_URL = "https://www.flyjacksonville.com/bids.aspx";
const SOURCE_AGENCY = "Jacksonville Aviation Authority (JAA)";

export type ScrapedOpportunity = {
  source_title: string;
  source_agency: string;
  source_url: string | null;
  due_date: string | null;
  // Optional since JAA's listing page never shows one — added for coj.ts,
  // which maps to matched_opportunities' dedicated solicitation_number
  // column (schema.sql), not a text field JAA has any equivalent of.
  solicitation_number?: string | null;
  // Optional — neither jaa.ts nor coj.ts's own listing pages show a real
  // scope description, only a title. Added for coj-forecast.ts, whose PDFs
  // do carry one; matched_opportunities.scope already existed in the
  // schema but no scraper populated it before this.
  scope?: string | null;
  // Optional — only lib/scrapers/sam-gov.ts populates this (SAM.gov
  // opportunities carry a real NAICS code; neither jaa.ts's nor coj.ts's
  // listing pages have an equivalent). Used downstream to compute a
  // suggested-client match against clients.naics_codes.
  naics_code?: string | null;
};

// flyjacksonville.com/bids.aspx is a plain server-rendered ASP.NET page —
// confirmed via a completely bare `fetch()` (no cookies, no custom
// headers, no JS) that the open-bid listing is already present in the
// initial HTML response, not loaded via postback. Each listing renders as
// a <span id="...lblTitleFirst_N"> holding the title, followed by a
// "Content.aspx?id=..." detail link in a later <tr> of the same table.
//
// The listing page doesn't show a due date anywhere, so due_date is left
// null rather than guessed — an admin can open source_url to check it
// before assigning. match_score is intentionally not set here either: it
// only means something once compared against a specific client, which
// happens at assignment time in app/admin/matches/, not at scrape time.
export async function scrapeJaa(): Promise<ScrapedOpportunity[]> {
  const res = await fetch(JAA_BIDS_URL);
  if (!res.ok) {
    throw new Error(`JAA fetch failed: ${res.status} ${res.statusText}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  const opportunities: ScrapedOpportunity[] = [];

  $('span[id*="lblTitleFirst"]').each((_, el) => {
    const title = $(el).text().trim();
    if (!title) return;

    const row = $(el).closest("tr");
    const detailLink = row.nextAll("tr").find('a[href^="Content.aspx"]').first();
    const href = detailLink.attr("href");

    opportunities.push({
      source_title: title,
      source_agency: SOURCE_AGENCY,
      source_url: href ? new URL(href, JAA_BIDS_URL).toString() : null,
      due_date: null,
    });
  });

  return opportunities;
}
