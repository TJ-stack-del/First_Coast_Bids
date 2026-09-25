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
const HEADERS = { Accept: "application/hal+json" };

// The latest revision of a WD, from SAM.gov's public search.
async function latestRevision(number: string): Promise<number> {
  const res = await fetch(`${SAM}/sgs/v1/search/?index=wd&q=${encodeURIComponent(number)}&page=0&size=5&mode=search`, { headers: HEADERS });
  if (!res.ok) throw new Error(`SAM.gov search failed (${res.status}).`);
  const body = (await res.json()) as { _embedded?: { results?: { fullReferenceNumber?: string; revisionNumber?: number }[] } };
  const hit = body._embedded?.results?.find((r) => r.fullReferenceNumber === number);
  if (!hit || typeof hit.revisionNumber !== "number") throw new Error(`Wage determination ${number} wasn't found on SAM.gov.`);
  return hit.revisionNumber;
}

// The WD text for the revision the solicitation names, or the latest when
// it names none (the worksheet then warns the admin to confirm).
export async function fetchWdText(
  number: string,
  revision: number | null
): Promise<{ text: string; revision: number; revisionSource: "solicitation" | "latest" }> {
  const rev = revision ?? (await latestRevision(number));
  const res = await fetch(`${SAM}/wdol/v1/wd/${encodeURIComponent(number)}/${rev}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`SAM.gov didn't return wage determination ${number} Rev. ${rev} (${res.status}).`);
  const doc = extractWdDocument(await res.text());
  return { text: doc.text, revision: doc.revision, revisionSource: revision === null ? "latest" : "solicitation" };
}
