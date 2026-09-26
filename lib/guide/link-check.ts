// Deciding what a guide source link's check result means
// (scripts/check-guide-links.mjs). Some government sites block scripts with
// a 403 even though they load fine in a browser: those hosts are reported,
// not failed, so the check can stay green and still be trusted. A link that
// now redirects to a different page (often an agency's homepage after a
// reorganisation) is a soft 404: flagged as moved.

// Checked by hand in a real browser on 2026-09-26: all load. They answer
// scripts with a 403 or by stalling until the request times out.
export const SCRIPT_BLOCKED_HOSTS = ["www.dol.gov", "www.claycountygov.com", "www.myfloridacfo.com"];

export type LinkResult = "ok" | "blocked" | "moved" | "bad";

const path = (u: string) => {
  const x = new URL(u);
  return x.hostname.replace(/^www\./, "") + x.pathname.replace(/\/+$/, "") + x.search;
};

export function classifyLink(r: { url: string; status: number | null; finalUrl: string | null }): LinkResult {
  if ((r.status === 403 || r.status === null) && SCRIPT_BLOCKED_HOSTS.includes(new URL(r.url).hostname)) return "blocked";
  if (r.status === null || r.status >= 400) return "bad";
  if (r.finalUrl && path(r.finalUrl) !== path(r.url)) return "moved";
  return "ok";
}
