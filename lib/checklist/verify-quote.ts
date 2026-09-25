import type { QuoteStatus } from "./types.ts";

// Checks that a quote really appears in the document text the app extracted
// itself -- the guard against a suggestion whose "quote" the AI invented.
// Both sides are normalised the same way, because PDF text differs from a
// copied quote in ways that don't change meaning: ligatures ("ﬁ"), words
// hyphenated across line breaks, curly quotes, soft hyphens. Hyphens are
// dropped entirely on both sides so "sub-\ncontractors", "sub-contractors"
// and "subcontractors" all compare equal.
export function normalizeForMatch(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/­/g, "")
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/-\s*\n\s*/g, "")
    .replace(/-/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const MIN_QUOTE_CHARS = 8;

export function verifyQuote(quote: string, fileText: string | null): QuoteStatus {
  if (fileText === null || !fileText.trim()) return "unreadable";
  const q = normalizeForMatch(quote);
  if (q.length < MIN_QUOTE_CHARS) return "not_found";
  return normalizeForMatch(fileText).includes(q) ? "verified" : "not_found";
}
