import { readBid } from "./read.ts";

// The sign-up form's bid fields, read from the bid the visitor already
// dropped on the homepage, so they don't type back what we just read.
// Plain code, cover-page conventions only: an explicit label ("Issuing
// Agency", "Solicitation Number") or the way local bids head their first
// page. A field we can't find stays blank for the visitor to fill: a
// guessed agency is worse than an empty box.

export type CarriedFields = {
  agency: string | null;
  solicitationNumber: string | null;
  dueDate: string | null; // yyyy-mm-dd, the form's date input format
};

const AGENCY_LABEL = /^\s*(?:issuing agency|issuing office|agency|issued by|owner|purchasing agency)\s*[:\-–—]?\s+(.{3,100})$/im;
const AGENCY_HEADING =
  /\b(?:(?:City|Town|County|Village|State) of [A-Z][A-Za-z.' -]{1,40}|(?:[A-Z][A-Za-z.'-]+ ){1,4}(?:County|School District|Public Schools|Housing Authority|Port Authority|Transportation Authority|Aviation Authority|Authority|Board of County Commissioners|Utilities|College|University))\b/;

const SOLICITATION =
  /\b(?:RFP|RFQ|ITB|IFB|RFI|ITN|RFSQ|Solicitation|Bid|Invitation to Bid|Invitation to Negotiate|Request for (?:Proposals?|Quotes?|Quotations?))\)?\s*(?:No\.?|Number|#)\s*[:.]?\s*([A-Z0-9][A-Z0-9_./-]{2,30}[A-Z0-9])\b/i;

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

// "Oct 6, 2026", "November 18, 2026", "Sept 22 2026", "10/06/2026", "10/6/26".
export function toIsoDate(text: string): string | null {
  const pad = (n: number) => String(n).padStart(2, "0");
  const valid = (y: number, m: number, d: number) => m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 2000 && y <= 2100;
  const named = /^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/.exec(text.trim());
  if (named) {
    const [m, d, y] = [MONTHS[named[1].toLowerCase()], Number(named[2]), Number(named[3])];
    return m && valid(y, m, d) ? `${y}-${pad(m)}-${pad(d)}` : null;
  }
  const slashed = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(text.trim());
  if (slashed) {
    const [m, d] = [Number(slashed[1]), Number(slashed[2])];
    const y = slashed[3].length === 2 ? 2000 + Number(slashed[3]) : Number(slashed[3]);
    return valid(y, m, d) ? `${y}-${pad(m)}-${pad(d)}` : null;
  }
  return null;
}

function cleanAgency(raw: string): string {
  return raw
    .replace(/\([^)]*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/[\s,;:–—-]+$/, "")
    .trim();
}

const SMALL_WORDS = new Set(["of", "the", "and", "for", "to"]);

// "CITY OF JACKSONVILLE BEACH" -> "City of Jacksonville Beach": cover pages
// often set the agency in capitals.
function titleCaseShouting(line: string): string {
  if (!/[A-Z]{3}/.test(line) || line !== line.toUpperCase()) return line;
  return line
    .toLowerCase()
    .split(" ")
    .map((w, i) => (i > 0 && SMALL_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

export function readBidFields(pages: string[]): CarriedFields {
  const front = pages.slice(0, 2).join("\n");

  const labelled = AGENCY_LABEL.exec(front);
  let agency = labelled ? cleanAgency(labelled[1]) : null;
  if (!agency) {
    // The heading lines at the top of page 1, where local bids name themselves.
    const top = (pages[0] ?? "").split("\n").slice(0, 15).map(titleCaseShouting).join("\n");
    const heading = AGENCY_HEADING.exec(top);
    agency = heading ? cleanAgency(heading[0]) : null;
  }

  const number = SOLICITATION.exec(front);
  const solicitationNumber = number && /\d/.test(number[1]) ? number[1] : null;

  const deadline = readBid(pages).items.find((i) => i.key === "deal:deadline");
  const dueDate = deadline ? toIsoDate(deadline.label.replace(/^Deadline:\s*/, "")) : null;

  return { agency: agency || null, solicitationNumber, dueDate };
}
