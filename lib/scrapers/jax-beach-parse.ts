// Pure parsing for Jacksonville Beach bid detail pages (jax-beach.ts does
// the fetching). Kept separate so it can be tested against real page text
// without the network, the same split as sam-gov-query.ts / sam-gov.ts.
//
// Why detail pages at all (2026-09-23): the list page's own fields proved
// unreliable in two ways, both real production bugs --
//   1. The city posted its janitorial RFP (RFP-2026-002) under the
//      placeholder title "OpenGov Procurement Platform", bid number
//      "OpenGov", with the real title only inside the description. It was
//      stored and assigned under that meaningless title.
//   2. Every listing says "Closes: Open Until Contracted", so due_date was
//      always null and nothing from this source could ever expire. The
//      janitorial RFP's real deadline (September 16, 2026 2:00 p.m.) was
//      only in the description text; a week after it closed it was still
//      being offered as new. The other two listings were "Pending Council
//      Award" -- also closed to new proposals, but still Status: Open.

export type JaxBeachDetail = {
  title: string | null;
  bidNumber: string | null;
  additionalStatus: string | null;
  description: string | null;
  closing: string | null;
};

// The detail page is an irregular CivicPlus table, but its flattened text
// always runs "Label: value Next Label: ..." in a fixed order. Each field
// is read up to the next known label.
const LABELS = [
  "Bid Number:",
  "Bid Title:",
  "Category:",
  "Status:",
  "Additional Status Information:",
  "Bid Recipient:",
  "Description:",
  "Publication Date/Time:",
  "Publication Information:",
  "Closing Date/Time:",
  "Submittal Information:",
  "Bid Opening Information:",
  "Addendum Information:",
  "Pre-bid Meeting:",
  "Contact Person:",
  "Download Available:",
  "Fee:",
  "Plan & Spec Available:",
  "Business Hours:",
  "Qualifications:",
  "Related Documents:",
  "Return To Main Bid Postings Page",
];

function field(text: string, label: string): string | null {
  const start = text.indexOf(label);
  if (start === -1) return null;
  const from = start + label.length;
  let end = text.length;
  for (const other of LABELS) {
    if (other === label) continue;
    const i = text.indexOf(other, from);
    if (i !== -1 && i < end) end = i;
  }
  const value = text.slice(from, end).replace(/\s+/g, " ").trim();
  return value || null;
}

export function parseJaxBeachDetail(pageText: string): JaxBeachDetail {
  const text = pageText.replace(/\s+/g, " ");
  return {
    title: field(text, "Bid Title:"),
    bidNumber: field(text, "Bid Number:"),
    additionalStatus: field(text, "Additional Status Information:"),
    description: field(text, "Description:"),
    closing: field(text, "Closing Date/Time:"),
  };
}

// A listing titled after the city's procurement portal rather than the
// solicitation itself ("OpenGov Procurement Platform", bid no. "OpenGov").
export function isPlaceholderListing(title: string | null, bidNumber: string | null): boolean {
  return /opengov|procurement (platform|portal)/i.test(`${title ?? ""} ${bidNumber ?? ""}`);
}

// Pulls "RFP-2026-002" + "Citywide Janitorial Services" out of a
// description like "REQUEST FOR PROPOSALSRFP-2026-002-Citywide Janitorial
// ServicesThe City of ..." (CivicPlus drops the line breaks, so words run
// together; the title ends where "The City" begins).
export function extractSolicitation(
  description: string | null
): { number: string; title: string | null } | null {
  if (!description) return null;
  const m = description.match(/(?<![a-z0-9])(RFP|RFQ|ITB|IFB|ITN|RFI)[-\s]?(\d{2,4}-\d{2,4})\b[-\s:]*(.*?)(?=The City\b|$)/);
  if (!m) return null;
  const title = m[3].replace(/\s+/g, " ").trim();
  return { number: `${m[1]}-${m[2]}`, title: title || null };
}

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

// Same tolerance as coj.ts's parseCojDate: the Eastern wall-clock time is
// stored as if it were UTC rather than converted exactly. An admin checks
// the exact time on source_url; what matters here is the right day.
function toIso(year: number, month: number, day: number, hour: number, minute: number): string | null {
  const d = new Date(Date.UTC(year, month - 1, day, hour, minute));
  return Number.isNaN(d.getTime()) || d.getUTCDate() !== day ? null : d.toISOString();
}

function to24h(hour: number, meridiem: string | undefined): number {
  if (!meridiem) return hour;
  const pm = /^p/i.test(meridiem);
  return (hour % 12) + (pm ? 12 : 0);
}

// The deadline, from a real "Closing Date/Time" if the city filled one in,
// otherwise from the description's "until (September 16, 2026 2:00 p.m.)".
// "Open Until Contracted" and anything unrecognised give null -- never a
// guessed date.
export function extractDeadline(detail: Pick<JaxBeachDetail, "closing" | "description">): string | null {
  const closing = detail.closing?.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})\s*(AM|PM))?/i);
  if (closing) {
    const [, mo, d, y, h, mi, mer] = closing;
    return toIso(Number(y), Number(mo), Number(d), h ? to24h(Number(h), mer) : 23, mi ? Number(mi) : 59);
  }
  const desc = detail.description?.match(
    /\buntil\s*\(?\s*([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})(?:[\s,@at]+(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s*m\.?)?/i
  );
  if (desc) {
    const [, monthName, d, y, h, mi, mer] = desc;
    const month = MONTHS.indexOf(monthName.toLowerCase()) + 1;
    if (month === 0) return null;
    return toIso(Number(y), month, Number(d), h ? to24h(Number(h), mer) : 23, mi ? Number(mi) : h ? 0 : 59);
  }
  return null;
}

// "Pending Council Award", "Awarded", "Closed", "Cancelled", "Under
// Evaluation" -- the city leaves Status: Open on these, but proposals are
// no longer being taken.
export function isClosedToProposals(additionalStatus: string | null): boolean {
  return /pending|award|closed|cancel|evaluat|rejected/i.test(additionalStatus ?? "");
}
