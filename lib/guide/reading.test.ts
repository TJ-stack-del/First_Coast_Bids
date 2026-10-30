import { test } from "node:test";
import assert from "node:assert/strict";
import { contents, headingId, readingMinutes } from "./reading.ts";
import { ARTICLES } from "./articles.ts";

test("reading time is at least a minute and grows with the text", () => {
  assert.equal(readingMinutes({ summary: "Short.", body: [{ kind: "p", text: "A few words." }] }), 1);
  const long = Array(600).fill("word").join(" ");
  assert.equal(readingMinutes({ summary: "", body: [{ kind: "p", text: long }] }), 3);
});

test("every article gets a sensible reading time and its own headings as contents", () => {
  for (const a of ARTICLES) {
    const m = readingMinutes(a);
    assert.ok(m >= 1 && m <= 20, `${a.slug}: ${m} min`);
    const c = contents(a);
    assert.equal(c.length, a.body.filter((b) => b.kind === "h2").length);
    assert.equal(new Set(c.map((x) => x.id)).size, c.length, `${a.slug}: duplicate heading ids`);
  }
});

test("heading ids are plain and stable", () => {
  assert.equal(headingId("The main kinds of solicitation"), "the-main-kinds-of-solicitation");
  assert.equal(headingId("What's a W-9?"), "what-s-a-w-9");
});
