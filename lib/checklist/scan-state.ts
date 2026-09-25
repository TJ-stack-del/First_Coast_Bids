export type ScanState = {
  status: "running" | "done" | "failed";
  started_at: string;
  finished_at?: string;
  files_fingerprint: string;
  error?: string | null;
  pages_read?: { file: string; total: number; read: number }[];
  ai_failed?: string[];
  // "name@uploaded_at" of every file covered so far (see filesToRead).
  files_read?: string[];
};

// Same files, same fingerprint: a finished scan of them is reused instead of
// paying for another AI reading. A plain sorted join rather than a hash:
// this module is also imported by the admin panel (a client component), and
// node:crypto can't be bundled for the browser.
export function filesFingerprint(files: { file_name: string; created_at: string }[]): string {
  return files
    .map((f) => `${f.file_name}@${f.created_at}`)
    .sort()
    .join("|");
}

// Vercel stops the function at 60 seconds and nothing records the kill, so
// "running" for more than 90 seconds means it died: show it as timed out
// and allow a new run.
const STALE_AFTER_MS = 90_000;

export function isScanStale(scan: ScanState | null, now: Date): boolean {
  if (!scan || scan.status !== "running") return false;
  return now.getTime() - new Date(scan.started_at).getTime() > STALE_AFTER_MS;
}

// Whether the panel should start a new reading by itself: the last reading
// covered a different set of files (files uploaded while it ran were
// skipped -- a real case: three quick uploads, only the first was read).
// Never for a bid that was never read (old bids aren't read, and paid for,
// just by opening them) and never to retry a failure (Check again does that).
export function needsRescan(scan: ScanState | null, currentFingerprint: string | null, now: Date): boolean {
  if (!scan || currentFingerprint === null) return false;
  if (scan.status === "running") return isScanStale(scan, now);
  if (scan.status === "failed") return false;
  return scan.files_fingerprint !== currentFingerprint;
}

function filePart(f: { file_name: string; created_at: string }): string {
  return `${f.file_name}@${f.created_at}`;
}

// Which files the AI should read this time. An automatic re-read (new files
// were added) reads only the files the last reading didn't cover: re-reading
// the rest paid for them twice and produced second wordings of the same
// items (real case, 2026-09-25: 44 -> 62 suggestions on one RFQ). "Check
// again" (force) and a first reading read everything. The plain-code
// detectors always run on every file regardless.
export function filesToRead(
  docs: { file_name: string; created_at: string }[],
  previous: ScanState | null,
  force: boolean
): string[] {
  if (force || !previous?.files_read) return docs.map((d) => d.file_name);
  const seen = new Set(previous.files_read);
  return docs.filter((d) => !seen.has(filePart(d))).map((d) => d.file_name);
}

export function filesReadParts(docs: { file_name: string; created_at: string }[]): string[] {
  return docs.map(filePart);
}
