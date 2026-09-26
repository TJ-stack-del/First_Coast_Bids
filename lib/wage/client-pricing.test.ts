import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeClientPricing, hasAnyPricing, missingPricing } from "./client-pricing.ts";

test("an empty or unknown value is all-missing, never zeros", () => {
  const p = normalizeClientPricing({});
  assert.deepEqual(p, { suppliesMode: "percent", suppliesValue: null, overheadPct: null, profitPct: null, productionRate: null, yearlyIncreasePct: null });
  assert.deepEqual(normalizeClientPricing(null), p);
  assert.equal(hasAnyPricing(p), false);
  assert.deepEqual(missingPricing(p), ["supplies", "overhead %", "profit %"]);
});

test("typed text is read: '12%', '$1,500', ' 3500 '", () => {
  const p = normalizeClientPricing({ suppliesMode: "flat", suppliesValue: "$1,500", overheadPct: "12%", profitPct: 0, productionRate: " 3500 " });
  assert.deepEqual(p, { suppliesMode: "flat", suppliesValue: 1500, overheadPct: 12, profitPct: 0, productionRate: 3500, yearlyIncreasePct: null });
  assert.equal(hasAnyPricing(p), true);
  assert.deepEqual(missingPricing(p), []);
});

test("negative, unreadable, or a zero production rate is missing", () => {
  const p = normalizeClientPricing({ suppliesValue: -1, overheadPct: "abc", profitPct: "", productionRate: 0 });
  assert.deepEqual(p, { suppliesMode: "percent", suppliesValue: null, overheadPct: null, profitPct: null, productionRate: null, yearlyIncreasePct: null });
});

test("0% profit is a real answer, not missing", () => {
  assert.deepEqual(missingPricing(normalizeClientPricing({ suppliesValue: 5, overheadPct: 10, profitPct: 0 })), []);
});

test("only a client with no saved numbers counts as a first save", () => {
  assert.equal(hasAnyPricing(normalizeClientPricing({})), false);
  assert.equal(hasAnyPricing(normalizeClientPricing({ productionRate: 3500, yearlyIncreasePct: null })), true);
  assert.equal(hasAnyPricing(normalizeClientPricing({ profitPct: 0 })), true);
});

test("the yearly increase is a client number: read, blank is missing, counts for the first save", () => {
  assert.equal(normalizeClientPricing({ yearlyIncreasePct: "3%" }).yearlyIncreasePct, 3);
  assert.equal(normalizeClientPricing({}).yearlyIncreasePct, null);
  assert.equal(hasAnyPricing(normalizeClientPricing({ yearlyIncreasePct: 0 })), true);
});
