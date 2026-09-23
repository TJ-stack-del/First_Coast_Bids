import * as cheerio from "cheerio";
import type { ScrapedOpportunity } from "./jaa";
import { isPastDeadline } from "@/lib/matches/rules";
import {
  parseJaxBeachDetail,
  isPlaceholderListing,
  extractSolicitation,
  extractDeadline,
  isClosedToProposals,
} from "./jax-beach-parse";

const JAX_BEACH_BIDS_URL = "https://www.jacksonvillebeach.org/Bids.aspx";
const SOURCE_AGENCY = "City of Jacksonville Beach";

// A separate, genuinely distinct municipality from "City of Jacksonville"
// (coj.ts) -- Jacksonville Beach is its own independent city government,
// not a district or department of the much larger consolidated
// Jacksonville/Duval County government. Not a duplicate source.
//
// www.jacksonvillebeach.org/Bids.aspx is a plain server-rendered CivicPlus/
// CivicEngage page -- confirmed via a completely bare curl (no cookies, no
// custom headers, no JS execution, no redirect dance) that every currently-
// open bid is already present in the initial HTML response. Unlike coj.ts's
// Oracle ADF loopback, this needed no special handling at all: closer to
// jaa.ts's own plain-fetch case.
//
// Each bid renders as a `div.listItemsRow.bid` (alternating with a `.alt`
// class for zebra-striping, irrelevant to scraping) containing three direct
// `<span>` children under `.bidTitle`: the title link, a "Bid No. <n>"
// line, and a truncated description ending in a "[Read on: ...]" link back
// to the same detail page. `.bidStatus` holds two sibling `<div>`s -- the
// first is just "Status:"/"Closes:" labels, the second holds the real
// values in the same order.
//
// The list page alone isn't enough (2026-09-23, see jax-beach-parse.ts):
// every listing says "Closes: Upon Contract", and one real RFP was posted
// under the placeholder title "OpenGov Procurement Platform". So each open
// row's detail page is fetched too (a handful of requests -- the city
// rarely has more than a few listings up) for the real title, number and
// deadline, and listings already closed to proposals are dropped.
export async function scrapeJaxBeach(): Promise<ScrapedOpportunity[]> {
  const res = await fetch(JAX_BEACH_BIDS_URL);
  if (!res.ok) {
    throw new Error(`Jacksonville Beach fetch failed: ${res.status} ${res.statusText}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  const rows: { title: string; url: string | null; bidNumber: string | null; scope: string | null }[] = [];

  $("div.listItemsRow.bid").each((_, row) => {
    const $row = $(row);

    // Only ever act on a listing this page itself marks "Open" -- a
    // defensive filter, not a currently-exercised one (every bid on the
    // page is Open as of 2026-09-22), in case a future page state ever
    // shows closed/awarded bids in the same list.
    const status = $row.find(".bidStatus > div").eq(1).find("span").eq(0).text().trim();
    if (status.toLowerCase() !== "open") return;

    const titleSpans = $row.find(".bidTitle > span");
    const titleLink = titleSpans.eq(0).find("a").first();
    const title = titleLink.text().trim();
    if (!title) return;

    const href = titleLink.attr("href");

    const bidNoText = titleSpans.eq(1).text().trim();
    const bidNumber = bidNoText.replace(/^Bid No\.\s*/i, "").trim() || null;

    // Strip the trailing "[Read on: ...]" link before taking the
    // description's text -- it's a real link back to the same detail
    // page, not part of the description itself.
    const descSpan = titleSpans.eq(2).clone();
    descSpan.find("a").remove();
    const scope = descSpan.text().replace(/\s*\[\s*\]\s*$/, "").trim() || null;

    rows.push({ title, url: href ? new URL(href, JAX_BEACH_BIDS_URL).toString() : null, bidNumber, scope });
  });

  const now = new Date();
  const opportunities: ScrapedOpportunity[] = [];

  for (const row of rows) {
    // No detail link means no way to check the deadline or status; a
    // listing that can't be checked isn't offered (the list page alone is
    // what let a closed RFP through before).
    if (!row.url) continue;

    // A failed detail fetch fails the whole source, visibly, in the scrape
    // result -- not a silent fallback to the list page's unreliable fields.
    const detailRes = await fetch(row.url);
    if (!detailRes.ok) {
      throw new Error(`Jacksonville Beach detail fetch failed for "${row.title}": ${detailRes.status}`);
    }
    const $detail = cheerio.load(await detailRes.text());
    $detail("script, style").remove();
    const detail = parseJaxBeachDetail($detail("body").text());

    if (isClosedToProposals(detail.additionalStatus)) continue;
    const dueDate = extractDeadline(detail);
    if (isPastDeadline(dueDate, now)) continue;

    let title = detail.title ?? row.title;
    let number = detail.bidNumber ?? row.bidNumber;
    if (isPlaceholderListing(title, number)) {
      const real = extractSolicitation(detail.description);
      // A placeholder whose real solicitation can't be read isn't offered:
      // "OpenGov Procurement Platform" is not something a client can bid.
      if (!real?.title) continue;
      title = real.title;
      number = real.number;
    }

    opportunities.push({
      source_title: title,
      source_agency: SOURCE_AGENCY,
      source_url: row.url,
      due_date: dueDate,
      solicitation_number: number,
      scope: detail.description ?? row.scope,
    });
  }

  return opportunities;
}
