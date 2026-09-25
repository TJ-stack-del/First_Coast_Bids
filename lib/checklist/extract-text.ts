import { extractText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";
import { detectDocumentKind } from "../document-parsing.ts";
import type { FilePages } from "./detectors.ts";

// The document's own text, page by page -- what the detectors scan, what the
// AI reads for text-layer PDFs, and what every quote is verified against.
// pages: null means no readable text (e.g. a scanned PDF).
const MIN_READABLE_CHARS = 40;

export async function extractFileText(
  fileName: string,
  buffer: Buffer
): Promise<FilePages & { totalPages: number | null }> {
  const kind = detectDocumentKind("", fileName);
  if (kind === "pdf") {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { totalPages, text } = await extractText(pdf, { mergePages: false });
    const pages = (text as string[]).map((p) => p ?? "");
    const readable = pages.join("").replace(/\s/g, "").length >= MIN_READABLE_CHARS;
    return { fileName, pages: readable ? pages : null, totalPages };
  }
  const text = kind === "docx" ? (await mammoth.extractRawText({ buffer })).value : buffer.toString("utf-8");
  return { fileName, pages: text.trim() ? [text] : null, totalPages: 1 };
}
