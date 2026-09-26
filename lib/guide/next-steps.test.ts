import { test } from "node:test";
import assert from "node:assert/strict";
import { nextSteps } from "./next-steps.ts";

const all = [true, false].flatMap((bidBefore) => [true, false].flatMap((registered) => [true, false].flatMap((licensed) => [true, false].map((bidInHand) => ({ bidBefore, registered, licensed, bidInHand })))));

test("every one of the 16 answer combinations gives 1 to 3 distinct steps", () => {
  assert.equal(all.length, 16);
  for (const a of all) {
    const s = nextSteps(a).map((x) => x.target);
    assert.ok(s.length >= 1 && s.length <= 3, JSON.stringify(a));
    assert.equal(new Set(s).size, s.length, "no step twice: " + JSON.stringify(a));
  }
});

test("a bid in hand always puts the Pilot first", () => {
  for (const a of all.filter((x) => x.bidInHand)) assert.equal(nextSteps(a)[0].target, "pilot", JSON.stringify(a));
});

test("not registered, or no license/insurance: Getting registered", () => {
  assert.ok(nextSteps({ bidBefore: true, registered: false, licensed: true, bidInHand: false }).some((s) => s.target === "getting-registered"));
  const noLicense = nextSteps({ bidBefore: true, registered: true, licensed: false, bidInHand: false });
  assert.equal(noLicense[0].target, "getting-registered");
  assert.match(noLicense[0].why, /license|insurance/i);
});

test("a complete newcomer: registered first, then the first bid, then what an RFP is", () => {
  assert.deepEqual(nextSteps({ bidBefore: false, registered: false, licensed: false, bidInHand: false }).map((s) => s.target), ["getting-registered", "your-first-bid", "what-is-an-rfp"]);
});

test("ready but no bid in hand: where bids are posted, then the Pilot", () => {
  assert.deepEqual(nextSteps({ bidBefore: true, registered: true, licensed: true, bidInHand: false }).map((s) => s.target), ["where-bids-are-posted", "pilot"]);
});

test("an experienced bidder with a bid in hand: just the Pilot", () => {
  assert.deepEqual(nextSteps({ bidBefore: true, registered: true, licensed: true, bidInHand: true }).map((s) => s.target), ["pilot"]);
});
