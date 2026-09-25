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
