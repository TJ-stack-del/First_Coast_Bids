import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeRescan } from "./rescan.ts";

const line = (clin: string, extra = {}) => ({ clin, read_clin: clin, edited: [] as string[], dismissed: false, description: clin, quantity: 12, unit: "MO", unit_kind: "month" as const, period_index: 0, position: 1, quote: clin, page: 1, source_file: "a.pdf", quote_status: "verified" as const, revised_by: null, unit_price_override: null, sort: 0, ...extra });

test("re-reading keeps lines the admin added and prices the admin typed", () => {
  const existing = [line("0001", { unit_price_override: 7000 }), line("9999", { quote_status: "admin", quote: null, read_clin: null }), line("0002")];
  const fresh = [line("0001", { description: "Custodial (amended)" }), line("1001", { period_index: 1 })];
  const out = mergeRescan(existing, fresh);
  assert.deepEqual(out.map((l) => [l.clin, l.description, l.unit_price_override, l.quote_status]), [
    ["0001", "Custodial (amended)", 7000, "verified"],
    ["1001", "1001", null, "verified"],
    ["9999", "9999", null, "admin"],
  ]);
});

test("the admin's corrections survive a re-read: period, quantity, a renamed CLIN (final review I-2)", () => {
  const existing = [
    line("00002", { period_index: 1, quantity: 6, edited: ["period_index", "quantity"] }),
    line("0003", { read_clin: "O003", edited: ["clin"] }),
  ];
  const fresh = [line("00002", { period_index: null, quantity: 12 }), line("O003")];
  const out = mergeRescan(existing, fresh);
  assert.deepEqual(out.map((l) => [l.clin, l.read_clin, l.period_index, l.quantity, l.edited]), [
    ["00002", "00002", 1, 6, ["period_index", "quantity"]],
    ["0003", "O003", 0, 12, ["clin"]],
  ]);
});

test("a line the admin removed stays removed (final review I-2)", () => {
  const out = mergeRescan([line("9001", { dismissed: true })], [line("9001")]);
  assert.deepEqual(out.map((l) => [l.clin, l.dismissed]), [["9001", true]]);
});

test("a partial reading never drops lines it didn't see; a full one drops only unedited ones (final review I-3)", () => {
  const existing = [line("0001"), line("1001", { edited: ["description"] }), line("2001")];
  const partial = mergeRescan(existing, [line("0001")], { partial: true });
  assert.deepEqual(partial.map((l) => l.clin), ["0001", "1001", "2001"]);
  const full = mergeRescan(existing, [line("0001")]);
  assert.deepEqual(full.map((l) => l.clin), ["0001", "1001"]);
});
