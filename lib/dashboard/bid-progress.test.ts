import { test } from "node:test";
import assert from "node:assert/strict";
import { comingUp, countdownLabel, daysUntil, progressStep, urgency } from "./bid-progress.ts";

test("each stage lands on its step", () => {
  assert.equal(progressStep({ draft: true, stage: "submitted" }), 0);
  assert.equal(progressStep({ draft: false, stage: "submitted" }), 1);
  assert.equal(progressStep({ draft: false, stage: "in_review" }), 1);
  assert.equal(progressStep({ draft: false, stage: "deliverables_ready" }), 2);
  assert.equal(progressStep({ draft: false, stage: "client_review" }), 3);
  assert.equal(progressStep({ draft: false, stage: "closed" }), 4);
  assert.equal(progressStep({ draft: false, stage: "something_new" }), 1);
});

test("a bare date keeps its calendar day; a real time is read in Eastern time", () => {
  const today = new Date("2026-10-30T15:00:00Z"); // 11 a.m. Eastern, Oct 30
  assert.equal(daysUntil("2026-11-18T00:00:00+00:00", today), 19);
  // 1 a.m. UTC on Nov 2 is still Nov 1 in Jacksonville.
  assert.equal(daysUntil("2026-11-02T01:00:00+00:00", today), 2);
  assert.equal(daysUntil(null, today), null);
  assert.equal(daysUntil("not a date", today), null);
});

test("urgency and labels", () => {
  assert.deepEqual([urgency(-1), urgency(0), urgency(3), urgency(7), urgency(8), urgency(null)], ["past", "soon", "soon", "week", "ok", null]);
  assert.deepEqual([countdownLabel(-3), countdownLabel(-1), countdownLabel(0), countdownLabel(1), countdownLabel(19)], [
    "Due 3 days ago",
    "Due yesterday",
    "Due today",
    "Due tomorrow",
    "19 days left",
  ]);
});

test("coming up: open bids due from today on, soonest first, capped", () => {
  const rows = [
    { id: "a", days: 19, completed: false },
    { id: "b", days: -2, completed: false },
    { id: "c", days: 3, completed: false },
    { id: "d", days: 1, completed: true },
    { id: "e", days: null, completed: false },
    { id: "f", days: 0, completed: false },
  ];
  assert.deepEqual(comingUp(rows).map((r) => r.id), ["f", "c", "a"]);
  assert.deepEqual(comingUp(rows, 1).map((r) => r.id), ["f"]);
});
