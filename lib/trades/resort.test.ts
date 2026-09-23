import { test } from "node:test";
import assert from "node:assert/strict";
import { applyTradeChange, planResort, summarizeMoves, describeSummary, resortConflict } from "./resort.ts";
import type { Trade } from "./types.ts";

const JAN: Trade = {
  id: "jan",
  label: "Janitorial",
  naics: [{ code: "561720", label: "Janitorial Services" }],
  nigpCodes: [],
  keywords: ["janitorial"],
  active: true,
  sortOrder: 1,
};
const rows = [
  { id: "r1", title: "Citywide Janitorial Services", naicsCode: null, nigpCodes: [], tradeId: null },
  { id: "r2", title: "Pressure Washing of Sidewalks", naicsCode: null, nigpCodes: [], tradeId: null },
  { id: "r3", title: "Bridge Replacement", naicsCode: null, nigpCodes: [], tradeId: null },
  { id: "r4", title: "Custodial", naicsCode: "561720", nigpCodes: [], tradeId: "jan" },
];

test("adding a trade moves matching open rows into it and leaves the rest", () => {
  const after = applyTradeChange([JAN], {
    id: "pw",
    label: "Pressure washing",
    naics: [],
    nigpCodes: [],
    keywords: ["pressure wash"],
    active: true,
  });
  assert.equal(after.find((t) => t.id === "pw")?.sortOrder, 2, "new trades go last");
  const moves = planResort(rows, after);
  // r1 was never sorted (seed happened after it was scraped) -> Janitorial.
  assert.deepEqual(moves, [
    { id: "r1", from: null, to: "jan" },
    { id: "r2", from: null, to: "pw" },
  ]);
});

test("switching a trade off moves its rows to Other trades", () => {
  const after = applyTradeChange([JAN], { ...JAN, active: false });
  assert.deepEqual(planResort(rows, after), [{ id: "r4", from: "jan", to: null }]);
});

test("a re-sort with no change moves only rows whose stored trade is stale", () => {
  assert.deepEqual(planResort(rows, [JAN]), [{ id: "r1", from: null, to: "jan" }]);
});

test("NIGP codes stored on a row count when re-sorting", () => {
  const nigp: Trade = { ...JAN, id: "n", label: "N", naics: [], keywords: [], nigpCodes: ["910-39"], sortOrder: 2 };
  const moves = planResort([{ id: "x", title: "Services", naicsCode: null, nigpCodes: ["910-39"], tradeId: null }], [JAN, nigp]);
  assert.deepEqual(moves, [{ id: "x", from: null, to: "n" }]);
});

test("summary groups by destination and reads plainly", () => {
  const after = applyTradeChange([JAN], { ...JAN, active: false });
  const moves = [...planResort(rows, after), { id: "z", from: null, to: "jan" }];
  const s = summarizeMoves(moves, [JAN]);
  assert.deepEqual(s, {
    total: 2,
    into: [
      { tradeId: "jan", label: "Janitorial", count: 1 },
      { tradeId: null, label: "Other trades", count: 1 },
    ],
  });
  assert.equal(describeSummary(s), "This moves 2 open matches: 1 into Janitorial, 1 to Other trades.");
  assert.equal(describeSummary({ total: 0, into: [] }), "No open matches change trade.");
  assert.equal(
    describeSummary({ total: 1, into: [{ tradeId: "jan", label: "Janitorial", count: 1 }] }),
    "This moves 1 open match: 1 into Janitorial."
  );
});

test("a count that changed since the preview is a conflict", () => {
  assert.equal(resortConflict(3, 3), null);
  assert.equal(
    resortConflict(5, 3),
    "Matches changed since the preview: 5 would move now, not 3. Check the new count and confirm again."
  );
});
