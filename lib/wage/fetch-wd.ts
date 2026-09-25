// Fetching Service Contract Act wage determinations from SAM.gov's public
// website endpoints (no API key; these don't count against the scraper's
// quota). extractWdDocument is the pure part: SAM.gov returns JSON whose
// "document" field holds the WD text, sometimes with raw control characters
// and wrapping quotes.

export function extractWdDocument(rawJson: string): { number: string; revision: number; text: string } {
  // Raw newlines/tabs inside the JSON string are invalid JSON: escape them.
  const cleaned = rawJson.replace(/[\u0000-\u001f]/g, (c) =>
    c === "\n" ? "\\n" : c === "\r" ? "\\r" : c === "\t" ? "\\t" : ""
  );
  const d = JSON.parse(cleaned) as { fullReferenceNumber?: unknown; revisionNumber?: unknown; document?: unknown };
  if (typeof d.fullReferenceNumber !== "string" || typeof d.revisionNumber !== "number" || typeof d.document !== "string") {
    throw new Error("SAM.gov didn't return a wage determination.");
  }
  const text = d.document.replace(/^\s*"/, "").replace(/"\s*$/, "").trim();
  return { number: d.fullReferenceNumber, revision: d.revisionNumber, text };
}
const SAM = "https://sam.gov/api/prod";
// A hung SAM.gov request fails in 20 s with a message, not at the 60 s limit.
const opts = () => ({ headers: { Accept: "application/hal+json" }, signal: AbortSignal.timeout(20_000) });

type SearchHit = { fullReferenceNumber?: string; revisionNumber?: number };

// The highest revision among the search hits for exactly this WD number.
export function highestRevision(results: SearchHit[] | undefined, number: string): number | null {
  const revs = (results ?? [])
    .filter((r) => r.fullReferenceNumber === number && typeof r.revisionNumber === "number")
    .map((r) => r.revisionNumber as number);
  return revs.length ? Math.max(...revs) : null;
}

// The latest revision of a WD, from SAM.gov's public search.
async function latestRevision(number: string): Promise<number> {
  const res = await fetch(`${SAM}/sgs/v1/search/?index=wd&q=${encodeURIComponent(number)}&page=0&size=25&mode=search`, opts());
  if (!res.ok) throw new Error(`SAM.gov search failed (${res.status}).`);
  const body = (await res.json()) as { _embedded?: { results?: SearchHit[] } };
  const rev = highestRevision(body._embedded?.results, number);
  if (rev === null) throw new Error(`Wage determination ${number} wasn't found on SAM.gov.`);
  return rev;
}

// The WD text for the revision the solicitation names, or the latest when
// it names none (the worksheet then warns the admin to confirm).
export async function fetchWdText(
  number: string,
  revision: number | null
): Promise<{ text: string; revision: number; revisionSource: "solicitation" | "latest" }> {
  const rev = revision ?? (await latestRevision(number));
  const res = await fetch(`${SAM}/wdol/v1/wd/${encodeURIComponent(number)}/${rev}`, opts());
  if (!res.ok) throw new Error(`SAM.gov didn't return wage determination ${number} Rev. ${rev} (${res.status}).`);
  const doc = extractWdDocument(await res.text());
  return { text: doc.text, revision: doc.revision, revisionSource: revision === null ? "latest" : "solicitation" };
}
