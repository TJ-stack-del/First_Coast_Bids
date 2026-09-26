import { test } from "node:test";
import assert from "node:assert/strict";
import { coerceClinItems } from "./ai-pass.ts";

test("AI output is coerced: bad rows dropped, numbers kept, blanks null", () => {
  const out = coerceClinItems({ lines: [
    { clin: " 0001 ", description: "Custodial", quantity: 12, unit: "MO", quote: "0001 Custodial 12 MO", page: 3, source_file: "a.pdf", period_start: "10/01/2026", period_end: " 09/30/2027 " },
    { clin: "", description: "x", quantity: 1, unit: "EA", quote: "q", page: 1, source_file: "" },
    { clin: "1001", description: "Opt 1", quantity: null, unit: null, quote: "1001 Opt 1", page: 0, source_file: "", period_start: "", period_end: null },
  ] });
  assert.deepEqual(out, [
    { clin: "0001", description: "Custodial", quantity: 12, unit: "MO", quote: "0001 Custodial 12 MO", page: 3, source_file: "a.pdf", period_start: "10/01/2026", period_end: "09/30/2027" },
    { clin: "1001", description: "Opt 1", quantity: null, unit: null, quote: "1001 Opt 1", page: null, source_file: null, period_start: null, period_end: null },
  ]);
  assert.deepEqual(coerceClinItems(null), []);
});
