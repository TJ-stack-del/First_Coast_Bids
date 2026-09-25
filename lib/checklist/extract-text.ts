import { extractText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";
import { detectDocumentKind } from "../document-parsing.ts";
import type { FilePages } from "./detectors.ts";

// The document's own text, page by page -- what the detectors scan, what the
// AI reads for text-layer PDFs, and what every quote is verified against.
// pages: null means no readable text, and `problem` says why:
//   no_text          a PDF with no text layer (scanned) -- the AI can still read it as a PDF
//   unsupported_type not PDF/Word/text (e.g. legacy .doc, spreadsheets) -- never sent to the AI
//   unreadable_file  corrupt or not what its name says
// Never throws: one bad file must not sink the reading of the others.
const MIN_READABLE_CHARS = 40;

export type ExtractProblem = "no_text" | "unsupported_type" | "unreadable_file";

export async function extractFileText(
  fileName: string,
  buffer: Buffer
): Promise<FilePages & { totalPages: number | null; problem: ExtractProblem | null }> {
  const kind = detectDocumentKind("", fileName);
  if (!kind) return { fileName, pages: null, totalPages: null, problem: "unsupported_type" };
  try {
    if (kind === "pdf") {
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const { totalPages, text } = await extractText(pdf, { mergePages: false });
      const pages = (text as string[]).map((p) => p ?? "");
      const readable = pages.join("").replace(/\s/g, "").length >= MIN_READABLE_CHARS;
      return { fileName, pages: readable ? pages : null, totalPages, problem: readable ? null : "no_text" };
    }
    const text = kind === "docx" ? (await mammoth.extractRawText({ buffer })).value : buffer.toString("utf-8");
    return { fileName, pages: text.trim() ? [text] : null, totalPages: 1, problem: text.trim() ? null : "no_text" };
  } catch {
    return { fileName, pages: null, totalPages: null, problem: "unreadable_file" };
  }
}
