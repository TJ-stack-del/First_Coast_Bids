import { detectItems } from "../checklist/detectors.ts";
import type { Kind } from "../checklist/types.ts";
import { detectMandatorySiteVisit } from "../compliance/mandatory-site-visit.ts";
import { assessWageRisk } from "../compliance/wage-risk.ts";
import { CONDITIONAL_REQUIREMENTS, TRADE_SPECIFIC_CERTIFICATIONS } from "../compliance/requirements-reference.ts";

// The homepage's free bid read: what a solicitation asks a bidder for,
// found by the same plain-code detectors the team's checklist and matrix
// use, run in the visitor's own browser. No AI, nothing uploaded. Every item
// carries the page and the bid's own words, never a paraphrase, so a
// visitor can check each one against their copy (PRODUCT.md: never
// fabricate a fact). It's a first read, not the review: patterns can miss
// things, and the page says so.

export type ReadGroup = "deal_breaker" | "forms" | "money" | "registrations";

export type ReadItem = {
  key: string;
  group: ReadGroup;
  label: string;
  // Plain-words reason, only on deal-breakers.
  why: string | null;
  page: number;
  quote: string;
};

export type BidRead = { items: ReadItem[]; pagesRead: number };

export const GROUP_ORDER: ReadGroup[] = ["deal_breaker", "forms", "money", "registrations"];

const KIND_GROUP: Partial<Record<Kind, ReadGroup>> = {
  form: "forms",
  amendment: "forms",
  sworn_statement: "forms",
  far_provision: "forms",
  wage_determination: "money",
  sam_registration: "registrations",
};

// Requirement-reference entries whose trigger words are specific enough to
// mean "the bid asks for this" when they appear anywhere in a whole
// solicitation. The trade certifications keyed off loose words ("lawn
// care", "electrical", "patient") are left out: they describe the client's
// trade, and in a 60-page bid they'd fire on boilerplate.
const REFERENCE_PICKS: { id: string; group: ReadGroup; why: string | null }[] = [
  { id: "bid-bond", group: "deal_breaker", why: "A bid that needs a bond and arrives without one is usually rejected. Bonds take days to arrange with a surety." },
  { id: "performance-payment-bond", group: "money", why: null },
  { id: "background-check", group: "registrations", why: null },
  { id: "cui-nist-800-171-cmmc", group: "deal_breaker", why: "Controlled information rules mean real security controls, often a paid assessment, before award. Know this before you spend time bidding." },
  { id: "va-section-508-checklist", group: "registrations", why: null },
];

const REFERENCE = [...CONDITIONAL_REQUIREMENTS, ...TRADE_SPECIFIC_CERTIFICATIONS];

// "Workers' Compensation" coverage, "General liability ... $1,000,000".
const INSURANCE_TYPES: { key: string; label: string; pattern: RegExp }[] = [
  { key: "general-liability", label: "General liability insurance", pattern: /\b(?:commercial )?general liability\b/i },
  { key: "workers-comp", label: "Workers' compensation insurance", pattern: /\bworkers'? ?comp(?:ensation)?\b/i },
  { key: "auto-liability", label: "Auto liability insurance", pattern: /\b(?:business |commercial )?auto(?:mobile)? liability\b/i },
  { key: "professional-liability", label: "Professional liability insurance", pattern: /\bprofessional liability\b|\berrors (?:and|&) omissions\b/i },
  { key: "umbrella", label: "Umbrella / excess liability insurance", pattern: /\b(?:umbrella|excess) liability\b/i },
];
const DOLLARS = /\$\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:million|M)\b)?/i;

const MONTH = "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
const DATE = new RegExp(`\\b${MONTH}\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4}\\b|\\b\\d{1,2}/\\d{1,2}/\\d{2,4}\\b`, "i");
const DEADLINE_WORDS = /\b(?:due|deadline|no later than|must be received|will be received|received (?:by|until)|bid opening|opening date|closing date|submitted by)\b/i;
// The deadline is the one for the bid itself. Without this, a "Questions
// Deadline" listed first (as real cover sheets do) read as the due date.
const SUBMISSION_WORDS = /\b(?:sealed |)(?:bids?|proposals?|offers?|quot(?:e|es|ations?)|responses?|submissions?|solicitation)\b|\b(?:closing date|opening date|bid opening)\b/i;
const NOT_THE_DEADLINE = /\b(?:questions?|inquir(?:y|ies)|clarifications?|pre-?bid|pre-?proposal|site visit|walk-?through|conference|award|protest|start date)\b/i;

const MAX_QUOTE = 240;

// The sentence around `index`: from the previous sentence end or line break
// to the next, cut to MAX_QUOTE around the match when the sentence is long
// (PDF text often runs a whole page as one line).
// A sentence ends at . ! or ? followed by a capitalised word, unless the
// period closes an abbreviation bids use mid-sentence ("Addendum No. 1",
// "Rev. 24", "s. 287.133, F.S. The").
const BOUNDARY = /(?<!\b(?:No|Nos|Rev|Inc|Co|Corp|St|Mr|Ms|Mrs|Dr|vs|Sec|Ch|F\.S|U\.S|e\.g|i\.e))[.!?](?=\s+["“(]?[A-Z])/g;

function lastBoundaryBefore(text: string, index: number): number {
  let last = -1;
  BOUNDARY.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = BOUNDARY.exec(text)) !== null && m.index < index) last = m.index;
  return last;
}

// The sentence around `index`: from the previous sentence end or line break
// to the next, cut to MAX_QUOTE around the match when the sentence is long
// (PDF text often runs a whole page as one line).
export function quoteAt(text: string, index: number, length = 0): string {
  const prevEnd = lastBoundaryBefore(text, index);
  let start = Math.max(text.lastIndexOf("\n", index - 1) + 1, prevEnd + 1);
  const afterMatch = index + length;
  BOUNDARY.lastIndex = afterMatch;
  const nextEnd = BOUNDARY.exec(text);
  const nextLine = text.indexOf("\n", afterMatch);
  const candidates = [text.length, nextLine, nextEnd ? nextEnd.index + 1 : -1].filter((n) => n >= 0);
  // A sentence that runs to the end of the text keeps its own final period.
  let end = Math.min(...candidates);
  let lead = "";
  let tail = "";
  if (end - start > MAX_QUOTE) {
    const half = Math.floor((MAX_QUOTE - length) / 2);
    if (index - start > half) {
      start = Math.max(start, index - half);
      lead = "…";
    }
    if (end - start > MAX_QUOTE) {
      end = start + MAX_QUOTE;
      tail = "…";
    }
  }
  // A list bullet at the start is layout, not the bid's words.
  const body = text.slice(start, end).replace(/\s+/g, " ").trim().replace(/^[•▪●◦·]\s*/, "");
  return (lead + body + tail).trim();
}

export function readBid(pages: string[]): BidRead {
  const found = new Map<string, ReadItem>();
  const add = (item: ReadItem) => {
    if (!found.has(item.key)) found.set(item.key, item);
  };

  pages.forEach((text, i) => {
    const page = i + 1;
    const lower = text.toLowerCase();

    // Fixed identifiers: forms, sworn statements, addenda, FAR clauses, wage
    // determinations, SAM. The checklist detector quotes the whole line it
    // matched on, and PDF lines often hold several sentences, so it reads
    // one sentence at a time and its "line" is exactly that sentence.
    for (const c of detectItems([{ fileName: "bid", pages: sentences(text) }])) {
      const group = KIND_GROUP[c.kind];
      if (!group || !c.key) continue;
      const quote = c.quote.replace(/\s+/g, " ").replace(/^[•▪●◦·]\s*/, "");
      add({ key: c.key, group, label: c.label, why: null, page, quote: quote.length > MAX_QUOTE ? `${quote.slice(0, MAX_QUOTE)}…` : quote });
    }

    const visit = detectMandatorySiteVisit(text);
    if (visit.flagged && visit.matched) {
      add({
        key: "deal:site-visit",
        group: "deal_breaker",
        label: "Mandatory site visit or pre-bid meeting",
        why: "Skip it and the bid is usually thrown out unopened, however good it is. Someone has to attend and sign in.",
        page,
        quote: quoteAt(text, text.indexOf(visit.matched), visit.matched.length),
      });
    }

    const dateMatch = findDeadline(text);
    if (dateMatch) {
      add({
        key: "deal:deadline",
        group: "deal_breaker",
        label: `Deadline: ${dateMatch.date}`,
        why: "Late bids aren't opened. Check the exact time and time zone, and how it has to be delivered.",
        page,
        quote: quoteAt(text, dateMatch.index, dateMatch.length),
      });
    }

    for (const pick of REFERENCE_PICKS) {
      const ref = REFERENCE.find((r) => r.id === pick.id);
      if (!ref) continue;
      const hit = ref.triggerKeywords.find((k) => lower.includes(k));
      if (!hit) continue;
      add({ key: `ref:${pick.id}`, group: pick.group, label: ref.label, why: pick.why, page, quote: quoteAt(text, lower.indexOf(hit), hit.length) });
    }

    for (const ins of INSURANCE_TYPES) {
      const m = ins.pattern.exec(text);
      if (!m) continue;
      // Only a stated minimum counts: the amount has to sit in the same sentence.
      const sentence = quoteAt(text, m.index, m[0].length);
      // The amount after this coverage's name, not one named earlier in the
      // sentence. Workers' comp set by statute stays "statutory limits", even
      // when the sentence goes on to give an employer's-liability figure.
      const statutory = ins.key === "workers-comp" && /\bstatut/i.test(sentence);
      const after = sentence.slice(Math.max(0, sentence.search(ins.pattern)));
      const amount = statutory ? "statutory limits" : DOLLARS.exec(after)?.[0].replace(/\s+/g, " ") ?? null;
      if (!amount) continue;
      add({ key: `ins:${ins.key}`, group: "money", label: `${ins.label}: ${amount}`, why: null, page, quote: sentence });
    }
  });

  // A wage determination number already says it all; otherwise flag the
  // plain-words wage language.
  if (![...found.keys()].some((k) => k.startsWith("wd:"))) {
    pages.forEach((text, i) => {
      const wage = assessWageRisk(text);
      if (wage.concern && wage.matched) {
        add({
          key: "money:wage",
          group: "money",
          label: "Set wage rates apply (prevailing or living wage)",
          why: null,
          page: i + 1,
          quote: quoteAt(text, text.indexOf(wage.matched), wage.matched.length),
        });
      }
    });
  }

  // Group, then the order a reader meets them in the bid.
  const position = (item: ReadItem) =>
    pages[item.page - 1].replace(/\s+/g, " ").indexOf(item.quote.replace(/^…|…$/g, ""));
  const items = [...found.values()].sort(
    (a, b) =>
      GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) || a.page - b.page || position(a) - position(b)
  );
  return { items, pagesRead: pages.length };
}

function sentences(text: string): string[] {
  return text
    .replace(BOUNDARY, "$&\n")
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// The first date whose sentence (or table line) says it's when the bid
// itself is due. No match is better than the wrong date.
function findDeadline(text: string): { date: string; index: number; length: number } | null {
  const re = new RegExp(DATE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const sentence = quoteAt(text, m.index, m[0].length);
    if (DEADLINE_WORDS.test(sentence) && SUBMISSION_WORDS.test(sentence) && !NOT_THE_DEADLINE.test(sentence)) {
      return { date: m[0], index: m.index, length: m[0].length };
    }
  }
  return null;
}
