export type ScanState = {
  status: "running" | "done" | "failed";
  started_at: string;
  finished_at?: string;
  files_fingerprint: string;
  error?: string | null;
  pages_read?: { file: string; total: number; read: number }[];
  ai_failed?: { file: string; message: string }[];
  // Files that couldn't be read at all, and why (see extract-text.ts).
  unreadable?: { file: string; problem: string }[];
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
// just by opening them) and never to retry a failure or a dead run (Check
// again does that).
export function needsRescan(scan: ScanState | null, currentFingerprint: string | null, now: Date): boolean {
  if (!scan || currentFingerprint === null) return false;
  // A dead run is a failure: the panel shows "timed out" with Check again
  // rather than re-running (and re-billing) on every page load.
  if (scan.status === "running") return false;
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

// The files covered after this run: earlier coverage of files still present
// and not re-read now, plus files the AI read completely this run (every
// chunk succeeded, nothing cut off by the size cap, file readable). A file
// that failed or was only partly read stays uncovered, so it's shown and
// read again rather than silently counted as done.
export function nextFilesRead(opts: {
  previousRead: string[] | undefined;
  docs: { file_name: string; created_at: string }[];
  toRead: string[];
  pagesRead: { file: string; total: number; read: number }[];
  failedFiles: string[];
  unreadable: string[];
}): string[] {
  const previous = new Set(opts.previousRead ?? []);
  const toRead = new Set(opts.toRead);
  const out: string[] = [];
  for (const doc of opts.docs) {
    const part = filePart(doc);
    if (!toRead.has(doc.file_name)) {
      if (previous.has(part)) out.push(part);
      continue;
    }
    if (opts.failedFiles.includes(doc.file_name) || opts.unreadable.includes(doc.file_name)) continue;
    const pages = opts.pagesRead.find((p) => p.file === doc.file_name);
    if (pages && pages.read < pages.total) continue;
    out.push(part);
  }
  return out;
}

// Notices (partial reads, failures, unreadable files) about files that
// weren't re-read this run are kept, so a later upload doesn't wipe them.
export function carryForward<T extends { file: string }>(
  previous: T[] | undefined,
  current: T[],
  toRead: string[],
  currentNames: string[]
): T[] {
  const kept = (previous ?? []).filter((e) => !toRead.includes(e.file) && currentNames.includes(e.file));
  return [...kept, ...current];
}

// "Check again" re-reads every file with the AI -- a paid action, so only an
// admin can force it. A client's upload still triggers a normal reading.
export function allowForce(requested: boolean, isAdmin: boolean): boolean {
  return requested && isAdmin;
}

// PostgREST filter for claiming a reading atomically: the update only lands
// if no reading is running, or the running one is dead (see isScanStale).
// Several simultaneous requests therefore start one reading, not several.
export function claimFilter(now: Date): string {
  const staleBefore = new Date(now.getTime() - STALE_AFTER_MS).toISOString();
  return `checklist_scan.is.null,checklist_scan->>status.neq.running,checklist_scan->>started_at.lt."${staleBefore}"`;
}
