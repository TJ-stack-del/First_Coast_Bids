import type { Block, GuideArticle } from "./types.ts";

// Reading time and an "In this article" list for the guide (round 17),
// worked out from each article's own blocks so they can't drift from the
// text.

const WPM = 200;

function blockText(b: Block): string {
  switch (b.kind) {
    case "h2":
    case "p":
      return b.text;
    case "list":
      return b.items.join(" ");
    case "callout":
      return `${b.title} ${b.text}`;
    case "terms":
      return b.items.map((t) => `${t.term} ${t.meaning}`).join(" ");
  }
}

export function readingMinutes(a: Pick<GuideArticle, "summary" | "body">): number {
  const words = [a.summary, ...a.body.map(blockText)].join(" ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WPM));
}

// "The main kinds of solicitation" -> "the-main-kinds-of-solicitation"
export function headingId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function contents(a: Pick<GuideArticle, "body">): { id: string; text: string }[] {
  return a.body.filter((b): b is Extract<Block, { kind: "h2" }> => b.kind === "h2").map((b) => ({ id: headingId(b.text), text: b.text }));
}
