import { test } from "node:test";
import assert from "node:assert/strict";
import { ARTICLES, getArticle } from "./articles.ts";
import { nextSteps } from "./next-steps.ts";

const SLUGS = ["what-is-an-rfp", "is-government-work-for-me", "where-bids-are-posted", "getting-registered", "your-first-bid", "before-you-submit", "compliance-matrix"];

test("the seven articles, in path order, with the spec's slugs", () => {
  assert.deepEqual(ARTICLES.map((a) => a.slug), SLUGS);
  assert.equal(getArticle("nope"), undefined);
});

test("every article has a title, summary, description, body and at least one https source", () => {
  for (const a of ARTICLES) {
    assert.ok(a.title && a.summary && a.description && a.body.length > 0, a.slug);
    assert.ok(a.sources.length > 0 && a.sources.every((s) => s.url.startsWith("https://")), a.slug);
  }
});

test("every step the check can suggest exists", () => {
  for (const bidBefore of [true, false]) for (const registered of [true, false]) for (const licensed of [true, false]) for (const bidInHand of [true, false]) {
    for (const s of nextSteps({ bidBefore, registered, licensed, bidInHand })) {
      assert.ok(s.target === "pilot" || getArticle(s.target), s.target);
    }
  }
});

test("each article is 400 to 900 words, with no em dashes", () => {
  for (const a of ARTICLES) {
    const text = a.body
      .map((b) => ("text" in b ? b.text : "") + ("title" in b ? " " + b.title : "") + ("items" in b ? " " + JSON.stringify(b.items) : ""))
      .join(" ");
    const words = text.split(/\s+/).filter(Boolean).length;
    assert.ok(words >= 400 && words <= 900, `${a.slug}: ${words} words`);
    assert.ok(!/—/.test(text + a.title + a.summary + a.description), `${a.slug} has an em dash`);
  }
});

const textOf = (slug: string) => {
  const a = getArticle(slug)!;
  return a.body.map((b) => ("text" in b ? b.text : "") + ("title" in b ? " " + b.title : "") + ("items" in b ? " " + JSON.stringify(b.items) : "")).join(" ");
};

test("no unsourced 'most' claims anywhere in the guide (final review 4)", () => {
  for (const a of ARTICLES) assert.ok(!/\bmost\b/i.test(textOf(a.slug)), `${a.slug} says "most"`);
});

test("workers' comp: owners who are officers or LLC members count, and exemptions exist (final review 2)", () => {
  const t = textOf("getting-registered");
  assert.match(t, /LLC members count/);
  assert.match(t, /exemption/i);
  assert.match(t, /HVAC, electrical and plumbing/);
});

test("licensing names plumbing and fertilizer/pesticide application (final review 3)", () => {
  for (const slug of ["is-government-work-for-me", "getting-registered"]) {
    const t = textOf(slug);
    assert.match(t, /plumbing/i, slug);
    assert.match(t, /fertilizer or pesticide/i, slug);
  }
});
