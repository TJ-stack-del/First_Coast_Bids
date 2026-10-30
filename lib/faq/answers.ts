import { ARTICLES } from "../guide/articles.ts";
import { pilotFaqPhrase } from "../pilot-offer.ts";

// The FAQ's questions and "Ask us anything" (round 16): every answer restates
// something the site or PRODUCT.md already says -- no new promise lives only
// here. Searched with plain keyword matching (no AI) alongside the guide's
// glossary terms and article summaries, so a question finds an answer
// wherever the site already gives one.

export type Faq = { q: string; a: string; category: string; tags: string[]; href?: { label: string; url: string } };

export const FAQS: Faq[] = [
  {
    category: "About us",
    q: "What is First Coast Bids?",
    a: "A done-for-you bid prep service. You send us your RFP; our team prepares the capability statement, compliance matrix and technical narrative for you.",
    tags: ["what do you do", "service", "who are you", "about"],
  },
  {
    category: "About us",
    q: "Where are you based?",
    a: "Northeast Florida. We work with small trade businesses bidding on city, county, school, authority, state and federal work.",
    tags: ["located", "location", "jacksonville", "florida", "local", "area"],
  },
  {
    category: "About us",
    q: "Which trades do you work with?",
    a: "HVAC, janitorial, landscaping, IT and computer support, and electrical. If you're in a related trade, start a bid anyway: if it's outside what we know well, you'll hear that up front, before you've paid anything.",
    tags: ["trade", "industry", "hvac", "janitorial", "cleaning", "landscaping", "lawn", "it", "computer", "electrical", "electrician", "plumbing", "roofing"],
  },
  {
    category: "About us",
    q: "Do you guarantee I'll win the bid?",
    a: "No one can guarantee an award. What we promise is a careful, complete package, checked line by line against the RFP's own requirements, with anything we couldn't confirm marked for you to fill in.",
    tags: ["win", "guarantee", "award", "chance", "odds", "promise"],
  },
  {
    category: "How it works",
    q: "What do I get back?",
    a: "Three documents bound as one package: a capability statement, a compliance matrix and a technical narrative, checked against the agency's rules. You can see a sample on the Gallery page.",
    tags: ["deliverables", "documents", "package", "capability statement", "compliance matrix", "technical narrative", "output"],
    href: { label: "See a sample package", url: "/gallery" },
  },
  {
    category: "How it works",
    q: "How long does it take?",
    a: "We aim to have your package ready to preview within 48 hours of getting the bid file. If your deadline is tighter than that, we tell you straight away.",
    tags: ["how long", "fast", "quick", "turnaround", "time", "days", "hours", "48", "rush", "deadline soon", "urgent"],
  },
  {
    category: "How it works",
    q: "Who submits the bid?",
    a: "You do, through your own agency portal account. Government portals tie submissions to your company's registered vendor account. We never ask for your login and never submit on your behalf.",
    tags: ["submit", "send", "portal", "login", "password", "upload", "file it", "turn in"],
  },
  {
    category: "How it works",
    q: "What if you don't know something about my company?",
    a: "It stays a visible blank in brackets, like [License number]. We never fill one in with a guess, and you can't download the package until every blank is filled.",
    tags: ["made up", "fabricate", "guess", "placeholder", "missing", "blank", "accurate", "accuracy", "wrong", "invent"],
  },
  {
    category: "How it works",
    q: "Can I review everything before it goes out?",
    a: "Yes. You preview real pages from your own bid before anything's due, and you review and sign the package yourself before you submit it.",
    tags: ["review", "check", "edit", "change", "documents", "approve", "preview", "see it first"],
  },
  {
    category: "How it works",
    q: "What if the bid has a mandatory site visit?",
    a: "You or someone from your company has to attend and sign in; missing a mandatory visit usually gets a bid thrown out. We flag it, with its date and page, on day one.",
    tags: ["site visit", "walkthrough", "pre-bid", "meeting", "mandatory"],
  },
  {
    category: "How it works",
    q: "Do you provide bonds or insurance?",
    a: "No. A bid bond comes from a surety and insurance from your agent. We tell you exactly what the bid asks for and check your certificate against the stated minimums.",
    tags: ["bond", "surety", "insurance", "certificate", "coi", "liability", "workers comp"],
  },
  {
    category: "How it works",
    q: "Do you do federal bids?",
    a: "Yes, as well as city, county, school, authority and state bids. Federal bids need an active SAM.gov registration; we check yours and handle the wage rules and price table the bid sets out.",
    tags: ["federal", "sam", "sam.gov", "government", "dod", "military", "navy", "air force", "va", "wage determination", "clin"],
  },
  {
    category: "How it works",
    q: "Can you find bids for me?",
    a: "On the Retainer, yes: we send you bids that fit your trade, and prepare up to 2 full bids a month. Otherwise, our guide shows where agencies around Jacksonville post bids.",
    tags: ["find", "search", "opportunities", "leads", "where are bids", "look for"],
    href: { label: "Where bids are posted", url: "/guide/where-bids-are-posted" },
  },
  {
    category: "Pricing",
    q: "How does pricing work?",
    a: `One-off starts at $399, Retainer starts at $649/mo, and ${pilotFaqPhrase()}. We confirm the exact number with you directly before any work starts.`,
    tags: ["price", "cost", "fee", "how much", "charge", "pay", "expensive", "cheap", "$", "dollars"],
    href: { label: "See pricing", url: "/pricing" },
  },
  {
    category: "Pricing",
    q: "Do I need a card to start?",
    a: "No. No card is required to get started, and every document is free to preview before anything's due.",
    tags: ["card", "credit card", "payment", "free", "trial", "upfront"],
  },
  {
    category: "Pricing",
    q: "Is the Pilot really free?",
    a: `${pilotFaqPhrase()}, with no commitment after. It's one full bid, done for you, so you can see how the process works.`,
    tags: ["pilot", "free", "trial", "first bid", "catch"],
  },
  {
    category: "Getting started",
    q: "What do I need to get started?",
    a: "Just the RFP itself (or a link to it) and basic company info: NAICS codes, small-business status, and set-asides if you have them.",
    tags: ["start", "started", "begin", "requirements", "sign up", "information", "naics", "ready"],
  },
  {
    category: "Getting started",
    q: "Is my data secure?",
    a: "Your submission and files are tied to your account only, and every status change on your bid is recorded in an audit trail.",
    tags: ["data", "security", "secure", "privacy", "private", "safe", "confidential"],
  },
];

export type Result = { kind: "faq" | "term" | "article"; title: string; text: string; href?: { label: string; url: string } };

const STOP = new Set(
  "a an and are as at be can do does for from get have how i if in is it its me my of on or the this to we what when where which who will with you your yours our us about there they need".split(" ")
);

// Words people use for the same thing.
const SYNONYMS: Record<string, string> = {
  cost: "price",
  costs: "price",
  fee: "price",
  fees: "price",
  charge: "price",
  much: "price",
  quickly: "fast",
  quick: "fast",
  long: "fast",
  turnaround: "fast",
  hours: "fast",
  days: "fast",
  guarantee: "win",
  guaranteed: "win",
  award: "win",
  bonds: "bond",
  surety: "bond",
  insured: "insurance",
  coi: "insurance",
  cleaning: "janitorial",
  custodial: "janitorial",
  lawn: "landscaping",
  mowing: "landscaping",
  electrician: "electrical",
  sent: "submit",
  send: "submit",
  sending: "submit",
  submitting: "submit",
  upload: "submit",
  walkthrough: "site",
  visit: "site",
  sam: "federal",
  card: "card",
  safe: "secure",
  security: "secure",
};

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9$.\s-]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^[.-]+|[.-]+$/g, ""))
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map((w) => SYNONYMS[w] ?? (w.endsWith("s") && w.length > 4 ? SYNONYMS[w.slice(0, -1)] ?? w.slice(0, -1) : w));
}

type Doc = Result & { title_w: Set<string>; tag_w: Set<string>; body_w: Set<string> };

function doc(r: Result, tags: string[] = []): Doc {
  return { ...r, title_w: new Set(words(r.title)), tag_w: new Set(words(tags.join(" "))), body_w: new Set(words(r.text)) };
}

const DOCS: Doc[] = [
  ...FAQS.map((f) => doc({ kind: "faq", title: f.q, text: f.a, href: f.href }, f.tags)),
  ...ARTICLES.flatMap((art) =>
    art.body.flatMap((b) =>
      b.kind === "terms"
        ? b.items.map((t) => doc({ kind: "term", title: t.term, text: t.meaning, href: { label: `From "${art.title}"`, url: `/guide/${art.slug}` } }))
        : []
    )
  ),
  ...ARTICLES.map((art) => doc({ kind: "article", title: art.title, text: art.summary, href: { label: "Read the guide", url: `/guide/${art.slug}` } })),
];

// The best answers for a question: words in a FAQ's question or tags count
// most, then a glossary term's name, then body text. Nothing under a real
// match comes back, so an unrelated question gets "ask us" rather than noise.
export function ask(query: string, limit = 3): Result[] {
  const q = words(query);
  if (q.length === 0) return [];
  const scored = DOCS.map((d) => {
    let score = 0;
    for (const w of q) {
      if (d.title_w.has(w)) score += d.kind === "term" ? 4 : 3;
      if (d.tag_w.has(w)) score += 3;
      if (d.body_w.has(w)) score += 1;
    }
    if (d.kind === "faq") score *= 1.2;
    return { d, score };
  })
    .filter((x) => x.score >= 3)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(({ d }) => ({ kind: d.kind, title: d.title, text: d.text, href: d.href }));
}
