import { test } from "node:test";
import assert from "node:assert/strict";
import { ask, FAQS } from "./answers.ts";

const top = (q: string) => ask(q)[0]?.title;

test("everyday questions find the right answer first", () => {
  assert.equal(top("how much does it cost"), "How does pricing work?");
  assert.equal(top("how fast can you do it"), "How long does it take?");
  assert.equal(top("do you send the bid for me"), "Who submits the bid?");
  assert.equal(top("can you get me a bond"), "Do you provide bonds or insurance?");
  assert.equal(top("do you work on federal SAM bids"), "Do you do federal bids?");
  assert.equal(top("will I win"), "Do you guarantee I'll win the bid?");
  assert.equal(top("do you do lawn mowing contracts"), "Which trades do you work with?");
  assert.equal(top("is the pilot free, what's the catch"), "Is the Pilot really free?");
  assert.equal(top("do you need my password"), "Who submits the bid?");
  assert.equal(top("can I change the documents"), "Can I review everything before it goes out?");
  assert.equal(top("what do I need to get started"), "What do I need to get started?");
});

test("bid words find the guide's glossary", () => {
  const r = ask("what is an addendum");
  assert.equal(r[0].kind, "term");
  assert.match(r[0].title, /Addendum/);
  assert.match(r[0].href!.url, /^\/guide\//);
  assert.match(top("what does responsive mean")!, /Responsive/);
});

test("an unrelated question gets nothing back, not noise", () => {
  assert.deepEqual(ask("what's the weather like tomorrow"), []);
  assert.deepEqual(ask(""), []);
  assert.deepEqual(ask("the and of"), []);
});

test("every FAQ has a category, question, answer and some tags", () => {
  for (const f of FAQS) {
    assert.ok(f.category && f.q.endsWith("?") && f.a.length > 40 && f.tags.length > 0, f.q);
  }
});
