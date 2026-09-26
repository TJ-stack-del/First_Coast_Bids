// Checks every source link in the "New to bidding?" guide still answers.
// Run: node --experimental-strip-types scripts/check-guide-links.mjs
// Some government sites block scripts (403 or a CAPTCHA): open those in a
// browser and check them by hand rather than dropping the source.
import { ARTICLES } from "../lib/guide/articles.ts";

const urls = [...new Set(ARTICLES.flatMap((a) => a.sources.map((s) => s.url)))];
let bad = 0;
for (const url of urls) {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
      headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36" },
    });
    const ok = res.status < 400;
    if (!ok) bad++;
    console.log(`${ok ? "OK " : "BAD"} ${res.status} ${url}`);
  } catch (err) {
    bad++;
    console.log(`BAD ${err instanceof Error ? err.name : "error"} ${url}`);
  }
}
console.log(`${urls.length - bad}/${urls.length} links answered`);
process.exit(bad ? 1 : 0);
