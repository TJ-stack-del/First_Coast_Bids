// Pure rules for keeping the Matches queue manageable once the SAM.gov
// scraper is live: which SAM notices are worth importing, when an
// untouched match expires, which source a match came from, and how the
// admin page's filters are read from its URL. No I/O here so every rule
// is unit-tested (rules.test.ts) -- these are the pieces that could
// otherwise misbehave silently.

// SAM.gov's `ptype` codes for notices a contractor can actually respond
// to: o = Solicitation, k = Combined Synopsis/Solicitation,
// p = Presolicitation, r = Sources Sought (the last two are early
// signals of an upcoming bid). Excluded: a = Award Notice (already
// awarded), u = Justification, s = Special Notice, g = Sale of Surplus
// Property, i = Intent to Bundle. Codes from GSA's own API docs
// (open.gsa.gov/api/get-opportunities-public-api), and verified with a
// live call on 2026-09-22 that the API really filters on them rather than
// silently ignoring the param.
export const SAM_BIDDABLE_PTYPES = ["o", "k", "p", "r"] as const;

// The `type` strings SAM.gov returns for those same four codes, exactly as
// observed in that live call. Checked again after fetching as a backstop,
// in case `ptype` ever stops being honored.
const SAM_BIDDABLE_NOTICE_TYPES = new Set([
  "Solicitation",
  "Combined Synopsis/Solicitation",
  "Presolicitation",
  "Sources Sought",
]);

export function isBiddableSamNoticeType(type: string | null | undefined): boolean {
  return !!type && SAM_BIDDABLE_NOTICE_TYPES.has(type);
}

// A deadline that's missing or unparseable is never "past": presolicitations
// often have no response date yet, and dropping them would lose the early
// signal they exist for.
export function isPastDeadline(dueDate: string | null | undefined, now: Date): boolean {
  if (!dueDate) return false;
  const t = new Date(dueDate).getTime();
  if (Number.isNaN(t)) return false;
  return t < now.getTime();
}

export function shouldKeepSamNotice(
  raw: { type?: string | null; responseDeadLine?: string | null },
  now: Date
): boolean {
  return isBiddableSamNoticeType(raw.type) && !isPastDeadline(raw.responseDeadLine, now);
}

// A match expires 24h after its due_date, not at it. Local scrapers and
// hand-logged matches store date-only deadlines as midnight UTC, which is
// 7-8pm the *previous* evening in Jacksonville -- expiring at due_date
// itself would pull a bid off the queue before its actual due day. A day's
// delay in hiding a truly dead lead costs nothing.
const EXPIRY_GRACE_MS = 24 * 60 * 60 * 1000;

export function expiryCutoff(now: Date): string {
  return new Date(now.getTime() - EXPIRY_GRACE_MS).toISOString();
}

// matched_opportunities has no source column; every producer's links are
// distinctive enough to classify from source_url. Email-ingested and
// hand-logged matches have no link (or an arbitrary one) and fall to "other".
export type MatchSource = "sam" | "local" | "other";

export const SAM_HOST_FRAGMENT = "sam.gov";
export const LOCAL_HOST_FRAGMENTS = [
  "flyjacksonville.com", // JAA (lib/scrapers/jaa.ts)
  "jacksonville.gov", // City of Jacksonville forecast PDFs (lib/scrapers/coj-forecast.ts)
  "eims.fa.us2.oraclecloud.com", // City of Jacksonville procurement portal (lib/scrapers/coj.ts)
];

export function matchSource(url: string | null | undefined): MatchSource {
  if (!url) return "other";
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return "other";
  }
  if (host === SAM_HOST_FRAGMENT || host.endsWith(`.${SAM_HOST_FRAGMENT}`)) return "sam";
  if (LOCAL_HOST_FRAGMENTS.some((f) => host === f || host.endsWith(`.${f}`))) return "local";
  return "other";
}

export const MATCH_STATUSES = ["new", "assigned", "dismissed", "expired"] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

export type MatchFilters = {
  status: MatchStatus | "all";
  deadline: "any" | "7" | "30" | "none";
  source: "all" | MatchSource;
  suggested: boolean;
  q: string;
  sort: "deadline" | "score" | "newest";
  page: number;
};

export const MATCHES_PAGE_SIZE = 50;

type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

// Whitelist every param: the URL is user-editable, and these values flow
// straight into a database query.
export function parseMatchFilters(sp: SearchParams): MatchFilters {
  const page = Number.parseInt(first(sp.page) ?? "", 10);
  return {
    status: oneOf(first(sp.status), [...MATCH_STATUSES, "all"] as const, "new"),
    deadline: oneOf(first(sp.deadline), ["any", "7", "30", "none"] as const, "any"),
    source: oneOf(first(sp.source), ["all", "sam", "local", "other"] as const, "all"),
    suggested: first(sp.suggested) === "1",
    q: sanitizeSearch(first(sp.q) ?? ""),
    sort: oneOf(first(sp.sort), ["deadline", "score", "newest"] as const, "deadline"),
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

// The search term is embedded in a PostgREST or(...) filter string, where
// commas, parentheses, `*` and backslashes are syntax. Strip them rather
// than escape: nobody searches bid titles for those characters.
export function sanitizeSearch(q: string): string {
  return q
    .replace(/[,()*\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}
