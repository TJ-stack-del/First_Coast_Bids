import type { GuideArticle, Step } from "./types.ts";

// The "New to bidding?" guide's articles, in reading order
// (docs/superpowers/specs/2026-09-26-newcomer-guide-design.md). Undated and
// evergreen. Every fact is checked against the sources listed with it on the
// day it's written; the user reads every article before it goes live.

export const STEP_LABELS: Record<Step, string> = { learn: "Learn the basics", ready: "Get ready", start: "Start bidding" };

export const ARTICLES: GuideArticle[] = [
  {
    slug: "what-is-an-rfp",
    title: "What's an RFP?",
    summary: "The words you'll meet in every government bid, in plain English.",
    description: "RFP, ITB, RFQ, addendum, pre-bid meeting, bid bond: what the words in a government bid mean, in plain English.",
    step: "learn",
    body: [{ kind: "p", text: "An RFP is how a government agency asks businesses to offer to do a job." }],
    sources: [{ label: "Florida Statutes, s. 287.012 (definitions)", url: "https://www.flsenate.gov/Laws/Statutes/2025/287.012" }],
  },
  {
    slug: "is-government-work-for-me",
    title: "Is government work right for my business?",
    summary: "What agencies buy from trade businesses, and the honest trade-offs.",
    description: "What cleaning, grounds, HVAC, electrical and IT businesses can sell to government, and the honest pros and cons of bidding.",
    step: "learn",
    body: [{ kind: "p", text: "Agencies buy the same trade work private customers do, with more paperwork." }],
    sources: [{ label: "U.S. Department of Labor: Service Contract Act", url: "https://www.dol.gov/agencies/whd/government-contracts/service-contracts" }],
  },
  {
    slug: "where-bids-are-posted",
    title: "Where bids are posted around Jacksonville",
    summary: "Federal, city, county, school and authority bids, and the sites they use.",
    description: "Where Jacksonville-area agencies post bids: SAM.gov, the city, the counties, school districts, JEA, JTA, JAXPORT and the sites they use.",
    step: "learn",
    body: [{ kind: "p", text: "Each agency posts its bids in its own place." }],
    sources: [{ label: "SAM.gov contract opportunities", url: "https://sam.gov/content/opportunities" }],
  },
  {
    slug: "getting-registered",
    title: "Getting registered",
    summary: "SAM.gov, local vendor accounts, and what to have ready.",
    description: "How to register to bid: SAM.gov for federal work, free vendor accounts for local agencies, and the documents to have ready.",
    step: "ready",
    body: [{ kind: "p", text: "Before you can bid, you register as a vendor." }],
    sources: [{ label: "SAM.gov: entity registration", url: "https://sam.gov/entity-registration" }],
  },
  {
    slug: "your-first-bid",
    title: "Your first bid, step by step",
    summary: "From finding a bid to hearing back, in order.",
    description: "Your first government bid, step by step: reading it, the dates that matter, site visits, questions, pricing, submitting and what comes after.",
    step: "start",
    body: [{ kind: "p", text: "A bid has a set order, and the dates matter most." }],
    sources: [{ label: "Florida Statutes, s. 120.57 (bid protests)", url: "https://www.flsenate.gov/Laws/Statutes/2025/120.57" }],
  },
  {
    slug: "before-you-submit",
    title: "Five things to check before submitting",
    summary: "The last-pass checks agencies actually reject bids over.",
    description: "A last-pass checklist before you submit a government bid: page limits, required forms, signatures, addenda and the price form.",
    step: "start",
    body: [{ kind: "p", text: "Most rejected bids fail on details, not on price." }],
    sources: [{ label: "Florida Statutes, s. 287.057 (competitive solicitation)", url: "https://www.flsenate.gov/Laws/Statutes/2025/287.057" }],
  },
  {
    slug: "compliance-matrix",
    title: "Why a compliance matrix matters",
    summary: "How evaluators score your bid, and how a matrix makes it easy to score well.",
    description: "Evaluators score against the RFP's requirements line by line. A compliance matrix shows them where you meet each one.",
    step: "start",
    body: [{ kind: "p", text: "Evaluators score line by line against the requirements." }],
    sources: [{ label: "FAR 15.305: proposal evaluation", url: "https://www.acquisition.gov/far/15.305" }],
  },
];

export function getArticle(slug: string): GuideArticle | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}
