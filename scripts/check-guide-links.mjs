// Checks every source link in the "New to bidding?" guide still answers,
// and still lands on the same page. Run before merging guide changes:
//   npm run check:links
// Also runs weekly in CI (.github/workflows/guide-links.yml). Known
// script-blocking sites are reported but don't fail the run; see
// lib/guide/link-check.ts.
import { ARTICLES } from "../lib/guide/articles.ts";
import { classifyLink } from "../lib/guide/link-check.ts";

const urls = [...new Set(ARTICLES.flatMap((a) => a.sources.map((s) => s.url)))];
const counts = { ok: 0, blocked: 0, moved: 0, bad: 0 };
for (const url of urls) {
  let status = null;
  let finalUrl = null;
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
      headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36" },
    });
    status = res.status;
    finalUrl = res.url;
  } catch {
    // a timeout or network error counts as bad
  }
  const result = classifyLink({ url, status, finalUrl });
  counts[result]++;
  console.log(`${result.toUpperCase().padEnd(7)} ${status ?? "error"} ${url}${result === "moved" ? ` -> ${finalUrl}` : ""}`);
}
console.log(`${counts.ok} ok, ${counts.blocked} blocked by the site (checked by hand), ${counts.moved} moved, ${counts.bad} bad, of ${urls.length}`);
process.exit(counts.moved || counts.bad ? 1 : 0);
