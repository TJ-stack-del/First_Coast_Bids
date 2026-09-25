import { defaultOwner, type Candidate, type Kind } from "./types.ts";

// Plain-code detection of fixed identifiers in solicitation text: standard
// forms, amendment/addendum numbers, wage determinations, FAR provisions
// that need bidder action, Florida sworn statements, and SAM registration.
// Runs on every page of every readable file (unlike the AI pass, which may
// be capped), and quotes the matched line verbatim.

export type FilePages = { fileName: string; pages: string[] | null };

type Rule = {
  pattern: RegExp; // must be global
  // Returns null to skip this match (e.g. square footage).
  build: (m: RegExpExecArray, line: string, textBefore: string) => { key: string; kind: Kind; federal: boolean; label: string; detail: string | null } | null;
};

const FORM_LABELS: Record<string, string> = {
  "1449": "Complete and sign SF-1449 (Solicitation/Contract/Order for Commercial Products and Commercial Services)",
  "1442": "Complete and sign SF-1442 (Solicitation, Offer and Award, Construction)",
  "33": "Complete and sign SF-33 (Solicitation, Offer and Award)",
  "18": "Complete SF-18 (Request for Quotations)",
  "30": "Acknowledge each amendment (SF-30)",
};

const FAR_ACTIONS: Record<string, string> = {
  "52.212-3": "Complete FAR 52.212-3 Offeror Representations and Certifications (or confirm they're current in SAM)",
  "52.204-24": "Complete the FAR 52.204-24 telecommunications representation",
  "52.204-26": "Complete the FAR 52.204-26 telecommunications representation",
  "52.209-5": "Complete the FAR 52.209-5 certification regarding responsibility matters",
  "52.219-1": "Complete the FAR 52.219-1 small business program representations",
  "52.222-22": "Complete the FAR 52.222-22 previous contracts and compliance reports representation",
  "52.222-25": "Complete the FAR 52.222-25 affirmative action compliance representation",
};

const SWORN: { key: string; pattern: RegExp; label: string }[] = [
  { key: "public-entity-crimes", pattern: /public entity crimes?/gi, label: "Public Entity Crimes sworn statement (s. 287.133, F.S.)" },
  { key: "drug-free-workplace", pattern: /drug[- ]free workplace/gi, label: "Drug-Free Workplace form (s. 287.087, F.S.)" },
  { key: "scrutinized-companies", pattern: /scrutinized compan/gi, label: "Scrutinized Companies certification" },
  { key: "e-verify", pattern: /\bE-?Verify\b/gi, label: "E-Verify affidavit" },
  { key: "conflict-of-interest", pattern: /conflict of interest (?:statement|form|disclosure|certification)/gi, label: "Conflict of Interest statement" },
];

// "10,000 SF 30 days" is square footage, not form SF-30.
const SQUARE_FEET_BEFORE = /\d[\d,.]*\s*$/;

const RULES: Rule[] = [
  {
    pattern: /\b(?:SF|Standard Form)[\s-]?(1449|1442|33|18|30)\b/g,
    build: (m, _line, before) => {
      if (m[0].startsWith("SF") && SQUARE_FEET_BEFORE.test(before)) return null;
      const n = m[1];
      return { key: `form:sf-${n}`, kind: n === "30" ? "amendment" : "form", federal: true, label: FORM_LABELS[n], detail: null };
    },
  },
  {
    pattern: /\bAmendment\s+(?:No\.?\s*)?(\d{4})\b/gi,
    build: (m) => ({ key: `amendment:${m[1]}`, kind: "amendment", federal: false, label: `Acknowledge Amendment ${m[1]}`, detail: null }),
  },
  {
    pattern: /\bAddend(?:um|a)\s+(?:No\.?\s*|#\s*)?(\d{1,3})\b/gi,
    build: (m) => ({ key: `addendum:${m[1]}`, kind: "amendment", federal: false, label: `Acknowledge Addendum ${m[1]}`, detail: null }),
  },
  {
    // "acknowledge receipt of all addenda" (local bids) and "acknowledge
    // receipt of amendments" (federal RFQs, e.g. FA252126QB143).
    // General wording only: a specific "Acknowledge Amendment 0001" has its own item.
    pattern: /\backnowledg\w*\s+(?:receipt\s+of\s+(?:all\s+|any\s+)?(?:addend|amendment)|(?:all|any)\s+(?:addend|amendment)|(?:addenda|amendments)\b)/gi,
    build: () => ({ key: "addendum:ack-all", kind: "amendment", federal: false, label: "Acknowledge every addendum or amendment", detail: null }),
  },
  {
    pattern: /\b(?:WD|Wage Determination)\s*(?:No\.?|Number|#)?\s*:?\s*(\d{4}-\d{4})(?:\s*\(?\s*Rev(?:ision)?\.?\s*(?:No\.?\s*)?-?\s*(\d{1,3})\)?)?/gi,
    build: (m) => ({
      key: `wd:${m[1]}`,
      kind: "wage_determination",
      federal: true,
      label: `Price labor at or above Wage Determination ${m[1]}${m[2] ? ` (Rev. ${m[2]})` : ""}`,
      detail: null,
    }),
  },
  {
    pattern: /\b52\.2\d{2}-\d{1,3}\b/g,
    build: (m) =>
      FAR_ACTIONS[m[0]]
        ? { key: `far:${m[0]}`, kind: "far_provision", federal: true, label: FAR_ACTIONS[m[0]], detail: null }
        : null,
  },
  {
    pattern: /\b(?:System for Award Management|SAM registration|registered in SAM)\b/gi,
    build: () => ({ key: "sam:registration", kind: "sam_registration", federal: true, label: "Confirm the client's SAM registration is active", detail: null }),
  },
  ...SWORN.map(
    (s): Rule => ({
      pattern: s.pattern,
      build: () => ({ key: `sworn:${s.key}`, kind: "sworn_statement", federal: false, label: s.label, detail: null }),
    })
  ),
];

// The line containing position `index`, trimmed, at most 300 characters.
function lineAt(text: string, index: number): string {
  const start = text.lastIndexOf("\n", index) + 1;
  const endNl = text.indexOf("\n", index);
  const line = text.slice(start, endNl === -1 ? text.length : endNl).trim();
  return line.length <= 300 ? line : line.slice(0, 300);
}

export function detectItems(files: FilePages[]): Candidate[] {
  const found = new Map<string, Candidate>();
  for (const file of files) {
    if (!file.pages) continue;
    file.pages.forEach((pageText, i) => {
      for (const rule of RULES) {
        rule.pattern.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = rule.pattern.exec(pageText)) !== null) {
          const built = rule.build(m, lineAt(pageText, m.index), pageText.slice(Math.max(0, m.index - 20), m.index));
          if (!built || found.has(built.key)) continue;
          found.set(built.key, {
            ...built,
            quote: lineAt(pageText, m.index),
            page: i + 1,
            source_file: file.fileName,
            found_by: "detector",
            suggested_owner: defaultOwner(built.kind),
          });
        }
      }
    });
  }
  return [...found.values()];
}

// The detector key for the first fixed identifier in free text, so an AI
// item about "SF-1449" merges with the detector's "form:sf-1449".
export function identifierKey(text: string): string | null {
  for (const rule of RULES.slice(0, 6)) {
    rule.pattern.lastIndex = 0;
    const m = rule.pattern.exec(text);
    if (!m) continue;
    const built = rule.build(m, text, text.slice(Math.max(0, m.index - 20), m.index));
    if (built) return built.key;
  }
  return null;
}
