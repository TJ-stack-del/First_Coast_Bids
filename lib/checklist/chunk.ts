import type { FilePages } from "./detectors.ts";

// Splits readable text into page-range chunks for parallel AI requests: one
// request over a long solicitation can outlast Vercel's 60-second limit.
// Each chunk carries document and page markers so the AI reports exact
// pages. totalCap bounds the whole reading; pagesRead says how far each
// file got so a partial read is shown, never hidden.
export type Chunk = { fileName: string; startPage: number; endPage: number; text: string };

export function chunkPages(
  files: FilePages[],
  maxChars = 60_000,
  totalCap = 360_000
): { chunks: Chunk[]; pagesRead: { file: string; total: number; read: number }[] } {
  const chunks: Chunk[] = [];
  const pagesRead: { file: string; total: number; read: number }[] = [];
  let used = 0;
  for (const file of files) {
    if (!file.pages) continue;
    let current: Chunk | null = null;
    let read = 0;
    for (let i = 0; i < file.pages.length; i++) {
      const block = `--- Page ${i + 1} ---\n${file.pages[i]}\n`;
      if (used + block.length > totalCap) break;
      if (!current || current.text.length + block.length > maxChars) {
        if (current) chunks.push(current);
        current = { fileName: file.fileName, startPage: i + 1, endPage: i + 1, text: `--- Document: ${file.fileName} ---\n` };
      }
      current.text += block;
      current.endPage = i + 1;
      used += block.length;
      read = i + 1;
    }
    if (current) chunks.push(current);
    pagesRead.push({ file: file.fileName, total: file.pages.length, read });
  }
  return { chunks, pagesRead };
}
