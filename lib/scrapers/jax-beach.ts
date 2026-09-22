import * as cheerio from "cheerio";
import type { ScrapedOpportunity } from "./jaa";

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
// due_date is left null unconditionally, same as jaa.ts -- every bid
// observed on this page so far shows "Upon Contract" under Closes, not a
// real date (confirmed 2026-09-22), so there's no known real-date format to
// build a parser against yet the way coj.ts's parseCojDate could. Guessing
// a format risks silently mis-parsing "Upon Contract" itself into a bogus
// date; an admin can open source_url to check the real deadline instead.
export async function scrapeJaxBeach(): Promise<ScrapedOpportunity[]> {
  const res = await fetch(JAX_BEACH_BIDS_URL);
  if (!res.ok) {
    throw new Error(`Jacksonville Beach fetch failed: ${res.status} ${res.statusText}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  const opportunities: ScrapedOpportunity[] = [];

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

    opportunities.push({
      source_title: title,
      source_agency: SOURCE_AGENCY,
      source_url: href ? new URL(href, JAX_BEACH_BIDS_URL).toString() : null,
      due_date: null,
      solicitation_number: bidNumber,
      scope,
    });
  });

  return opportunities;
}
