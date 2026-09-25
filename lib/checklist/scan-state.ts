export type ScanState = {
  status: "running" | "done" | "failed";
  started_at: string;
  finished_at?: string;
  files_fingerprint: string;
  error?: string | null;
  pages_read?: { file: string; total: number; read: number }[];
  ai_failed?: string[];
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
