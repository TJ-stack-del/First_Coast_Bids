import { test } from "node:test";
import assert from "node:assert/strict";
import { lineEdit, sharesEdit } from "./edit.ts";

test("a line edit keeps only what was sent, cleaned; the unit decides the kind", () => {
  assert.deepEqual(lineEdit({ clin: " 0002 ", description: " Meyers ", quantity: "6", unit: "MO" }, { quantity: null, unit: null, period_months: null }), {
    clin: "0002", description: "Meyers", quantity: 6, unit: "MO", unit_kind: "month",
  });
  assert.deepEqual(lineEdit({ period_index: "2" }, { quantity: 12, unit: "MO", period_months: null }), { period_index: 2 });
  assert.deepEqual(lineEdit({ period_index: "" }, { quantity: 12, unit: "MO", period_months: null }), { period_index: null });
  assert.deepEqual(lineEdit({ unit_price_override: "$1,250.50" }, { quantity: 1, unit: "JB", period_months: null }), { unit_price_override: 1250.5 });
  assert.deepEqual(lineEdit({ unit_price_override: "" }, { quantity: 1, unit: "JB", period_months: null }), { unit_price_override: null });
  // Clearing quantity and unit on a line with known months makes it a lump sum.
  assert.deepEqual(lineEdit({ quantity: "", unit: "" }, { quantity: 12, unit: "MO", period_months: 12 }), { quantity: null, unit: null, unit_kind: "lump" });
});

test("bad edits are refused, not saved as something else", () => {
  assert.equal(lineEdit({ clin: "  " }, { quantity: null, unit: null, period_months: null }), null);
  assert.equal(lineEdit({ period_index: "12" }, { quantity: null, unit: null, period_months: null }), null);
  assert.equal(lineEdit({ quantity: "-3" }, { quantity: null, unit: null, period_months: null }), null);
  assert.equal(lineEdit({ unit_price_override: "abc" }, { quantity: null, unit: null, period_months: null }), null);
});

test("shares: positions to percentages; anything unreadable is dropped", () => {
  assert.deepEqual(sharesEdit({ "1": "40", "2": 60, "3": "", x: 5, "4": -1 }), { "1": 40, "2": 60 });
  assert.deepEqual(sharesEdit(null), {});
});
