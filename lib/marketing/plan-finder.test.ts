import { test } from "node:test";
import assert from "node:assert/strict";
import { findPlan, yourTime } from "./plan-finder.ts";

const base = { wantsBidsFound: false, firstBid: false, pilotOpen: true };

test("a first bid while the free spots are open is a Pilot, whatever the pace", () => {
  assert.equal(findPlan({ ...base, firstBid: true, bidsPerMonth: 2 }).plan, "pilot");
  assert.equal(findPlan({ ...base, firstBid: true, pilotOpen: false, bidsPerMonth: 1 }).plan, "one_off");
});

test("one a month is One-off: $399 against $649", () => {
  const f = findPlan({ ...base, bidsPerMonth: 1 });
  assert.equal(f.plan, "one_off");
  assert.equal(f.oneOffMonthly, 399);
  assert.equal(f.retainerMonthly, 649);
});

test("two a month is Retainer: $798 of One-offs against $649", () => {
  const f = findPlan({ ...base, bidsPerMonth: 2 });
  assert.equal(f.plan, "retainer");
  assert.equal(f.oneOffMonthly, 798);
  assert.match(f.why, /\$798 a month; the Retainer starts at \$649/);
});

test("wanting bids found tips a slow pace to Retainer, saying One-off would cost less", () => {
  const f = findPlan({ ...base, bidsPerMonth: 0.5, wantsBidsFound: true });
  assert.equal(f.plan, "retainer");
  assert.match(f.why, /One-off would cost less at this pace \(\$200 a month\)/);
});

test("more than the Retainer covers means talk to us", () => {
  const f = findPlan({ ...base, bidsPerMonth: 3 });
  assert.equal(f.plan, "talk");
  assert.equal(f.retainerMonthly, null);
});

test("your time only shows from your own numbers", () => {
  assert.equal(yourTime(2, null, 60), null);
  assert.equal(yourTime(2, 12, null), null);
  assert.equal(yourTime(2, 12, 60), 1440);
});
