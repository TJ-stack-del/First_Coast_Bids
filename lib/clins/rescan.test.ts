import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeRescan } from "./rescan.ts";

const line = (clin: string, extra = {}) => ({ clin, description: clin, quantity: 12, unit: "MO", unit_kind: "month" as const, period_index: 0, position: 1, quote: clin, page: 1, source_file: "a.pdf", quote_status: "verified" as const, revised_by: null, unit_price_override: null, sort: 0, ...extra });

test("re-reading keeps lines the admin added and prices the admin typed", () => {
  const existing = [line("0001", { unit_price_override: 7000 }), line("9999", { quote_status: "admin", quote: null }), line("0002")];
  const fresh = [line("0001", { description: "Custodial (amended)" }), line("1001", { period_index: 1 })];
  const out = mergeRescan(existing, fresh);
  assert.deepEqual(out.map((l) => [l.clin, l.description, l.unit_price_override, l.quote_status]), [
    ["0001", "Custodial (amended)", 7000, "verified"],
    ["1001", "1001", null, "verified"],
    ["9999", "9999", null, "admin"],
  ]);
});
