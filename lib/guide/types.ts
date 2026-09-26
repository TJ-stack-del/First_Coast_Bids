// The "New to bidding?" guide (docs/superpowers/specs/2026-09-26-newcomer-guide-design.md).

export type Step = "learn" | "ready" | "start";

// Article text as structured blocks, rendered as plain text (never HTML).
export type Block =
  | { kind: "h2"; text: string }
  | { kind: "p"; text: string }
  | { kind: "list"; items: string[]; ordered?: boolean }
  | { kind: "callout"; title: string; text: string }
  | { kind: "terms"; items: { term: string; meaning: string }[] };

export type GuideArticle = {
  slug: string;
  title: string;
  summary: string;
  step: Step;
  description: string;
  body: Block[];
  sources: { label: string; url: string }[];
};

// The four yes/no answers of "Where do I start?".
export type Answers = { bidBefore: boolean; registered: boolean; licensed: boolean; bidInHand: boolean };

// An article slug, or "pilot" for the Pilot offer.
export type NextStep = { target: string; why: string };
