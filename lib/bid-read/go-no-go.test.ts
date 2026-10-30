import { test } from "node:test";
import assert from "node:assert/strict";
import { daysLeft, questionsFor, verdict } from "./go-no-go.ts";
import { readBid } from "./read.ts";
import { SAMPLE_BID_PAGES } from "./sample-bid.ts";

const items = readBid(SAMPLE_BID_PAGES).items;
const qs = questionsFor(items);
const all = (a: "yes" | "unsure" | "no") => Object.fromEntries(qs.map((q) => [q.key, a]));

test("the sample bid asks about the site visit, the bonds, insurance and background checks, once each", () => {
  assert.deepEqual(
    qs.map((q) => q.key),
    ["deal:site-visit", "ref:bid-bond", "ref:performance-payment-bond", "ins", "ref:background-check"]
  );
  assert.match(qs.find((q) => q.key === "ins")!.ask, /General liability: \$1,000,000; Workers' compensation: statutory limits/);
});

test("days left counts calendar days to the read's deadline", () => {
  assert.equal(daysLeft(items, new Date(2026, 9, 30, 15)), 19);
  assert.equal(daysLeft([], new Date()), null);
});

test("all yes with time to spare is good to go", () => {
  const v = verdict(qs, all("yes"), 19);
  assert.equal(v.kind, "go");
  assert.match(v.detail, /19 days left/);
});

test("a no on a must-have means hold off, naming it", () => {
  const v = verdict(qs, { ...all("yes"), "deal:site-visit": "no" }, 19);
  assert.equal(v.kind, "hold");
  assert.deepEqual(v.kind === "hold" && v.reasons.map((r) => r.key), ["deal:site-visit"]);
});

test("not sure, or a no on something you can sort out, is go with things to line up", () => {
  const v = verdict(qs, { ...all("yes"), "ref:bid-bond": "unsure", ins: "no" }, 19);
  assert.equal(v.kind, "lineup");
  assert.equal(v.title, "Go, with 2 things to line up");
});

test("a bond still to get with too few days left is very tight", () => {
  const v = verdict(qs, { ...all("yes"), "ref:bid-bond": "unsure" }, 4);
  assert.equal(v.kind, "hold");
  assert.equal(v.title, "It's very tight");
  assert.equal(verdict(qs, all("yes"), 4).kind, "go");
  assert.equal(verdict(qs, all("yes"), 2).kind, "hold");
});

test("past the deadline is closed whatever the answers; unanswered waits", () => {
  assert.equal(verdict(qs, all("yes"), -1).kind, "closed");
  assert.equal(verdict(qs, {}, 19).kind, "unanswered");
});

test("a bid with nothing only you can do is simply good to go", () => {
  assert.equal(verdict([], {}, null).kind, "go");
});
