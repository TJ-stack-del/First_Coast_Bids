import { test } from "node:test";
import assert from "node:assert/strict";
import { priceLines } from "./price.ts";

const L = (clin: string, period_index: number | null, position = 1, extra = {}) => ({
  clin, description: "", quantity: 12, unit: "MO", unit_kind: "month" as const, period_index, position,
  quote: null, page: null, source_file: null, quote_status: "verified" as const, revised_by: null, unit_price_override: null, sort: 0, ...extra,
});

test("one CLIN a year, monthly, 3% a year compounding; total is the sum of rounded amounts", () => {
  const r = priceLines({ lines: [L("0001", 0), L("1001", 1), L("2001", 2)], bidPrice: 90000, increasePct: 3, shares: {} });
  assert.deepEqual(r.lines.map((l) => [l.unitPrice, l.amount]), [[7500, 90000], [7725, 92700], [7956.75, 95481]]);
  assert.equal(r.total, 90000 + 92700 + 95481);
  assert.equal(r.missing, 0);
});

test("a 6-month base: unit is the year's price / 12, amount x 6 (Lake Tahoe)", () => {
  const r = priceLines({ lines: [L("0001", 0, 1, { quantity: 6 })], bidPrice: 100000, increasePct: 0, shares: {} });
  assert.deepEqual([r.lines[0].unitPrice, r.lines[0].amount], [8333.33, 49999.98]);
});

test("two buildings: shares 40/60 carry to the option years; a bad split leaves them blank", () => {
  const lines = [L("0001", 0, 1), L("0002", 0, 2), L("1001", 1, 1), L("1002", 1, 2)];
  const ok = priceLines({ lines, bidPrice: 120000, increasePct: 0, shares: { "1": 40, "2": 60 } });
  assert.deepEqual(ok.lines.map((l) => l.amount), [48000, 72000, 48000, 72000]);
  const bad = priceLines({ lines, bidPrice: 120000, increasePct: 0, shares: { "1": 40, "2": 50 } });
  assert.equal(bad.sharesProblem, "The split adds up to 90%, not 100%.");
  assert.deepEqual(bad.lines.map((l) => [l.amount, l.problem]), [[null, "no_share"], [null, "no_share"], [null, "no_share"], [null, "no_share"]]);
  assert.equal(bad.total, null);
  assert.equal(bad.missing, 4);
});

test("nothing is guessed: no bid, no increase, other units, no quantity, unknown period", () => {
  const none = priceLines({ lines: [L("0001", 0), L("1001", 1)], bidPrice: null, increasePct: null, shares: {} });
  assert.deepEqual(none.lines.map((l) => l.problem), ["no_bid", "no_bid"]);
  const noInc = priceLines({ lines: [L("0001", 0), L("1001", 1)], bidPrice: 90000, increasePct: null, shares: {} });
  assert.deepEqual(noInc.lines.map((l) => [l.amount, l.problem]), [[90000, null], [null, "no_increase"]]);
  const other = priceLines({ lines: [L("0001", 0, 1, { unit: "JB", unit_kind: "other" }), L("0002", 0, 2, { quantity: null })], bidPrice: 90000, increasePct: 0, shares: { "1": 50, "2": 50 } });
  assert.deepEqual(other.lines.map((l) => l.problem), ["unit", "no_quantity"]);
  const unknown = priceLines({ lines: [L("00002", null)], bidPrice: 90000, increasePct: 0, shares: {} });
  assert.equal(unknown.lines[0].problem, "no_period");
});

test("a unit price the admin typed wins and is marked", () => {
  const r = priceLines({ lines: [L("0001", 0, 1, { unit: "JB", unit_kind: "other", quantity: 4, unit_price_override: 250 })], bidPrice: null, increasePct: null, shares: {} });
  assert.deepEqual([r.lines[0].unitPrice, r.lines[0].amount, r.lines[0].typed, r.lines[0].problem], [250, 1000, true, null]);
  assert.equal(r.total, 1000);
});

test("lump sums: a period's share of the year by its months (MVY's 9-month base)", () => {
  const lump = (clin: string, p: number, months: number) => L(clin, p, 1, { quantity: null, unit: null, unit_kind: "lump", period_months: months });
  const r = priceLines({ lines: [lump("00001", 0, 9), lump("00002", 1, 12)], bidPrice: 120000, increasePct: 3, shares: {} });
  assert.deepEqual(r.lines.map((l) => [l.unitPrice, l.amount, l.problem]), [[90000, 90000, null], [123600, 123600, null]]);
  assert.equal(r.total, 213600);
});

test("a typed price on a lump-sum line is one lump", () => {
  const r = priceLines({ lines: [L("00001", 0, 1, { quantity: null, unit: null, unit_kind: "lump", period_months: 12, unit_price_override: 95000 })], bidPrice: null, increasePct: null, shares: {} });
  assert.deepEqual([r.lines[0].amount, r.lines[0].problem], [95000, null]);
});
