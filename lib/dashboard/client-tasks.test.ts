import { test } from "node:test";
import assert from "node:assert/strict";
import { clientTasks, standingLabel, needsAction } from "./client-tasks.ts";

const bid = (o = {}) => ({ id: "b", draft: false, stage: "in_review", isRetainerPlaceholder: false, pendingCount: 0, ...o });

test("each kind of task, with the count in the label", () => {
  assert.deepEqual(clientTasks([bid({ id: "d", draft: true, stage: "submitted" })], 100), [{ bidId: "d", kind: "bid_file", label: "Add your bid file" }]);
  assert.deepEqual(clientTasks([bid({ id: "c", pendingCount: 2 })], 100), [{ bidId: "c", kind: "items", label: "Answer 2 items" }]);
  assert.equal(clientTasks([bid({ id: "c", pendingCount: 1 })], 100)[0].label, "Answer 1 item");
  assert.deepEqual(clientTasks([bid({ id: "r", stage: "deliverables_ready" })], 100), [{ bidId: "r", kind: "review", label: "Review your package" }]);
  assert.equal(clientTasks([bid({ id: "r", stage: "client_review" })], 100)[0].kind, "review");
});

test("one task per bid, most urgent first: bid file, then items, then review", () => {
  assert.deepEqual(clientTasks([bid({ id: "x", stage: "deliverables_ready", pendingCount: 3 })], 100).map((t) => t.kind), ["items"]);
  assert.deepEqual(clientTasks([bid({ id: "x", draft: true, pendingCount: 3 })], 100).map((t) => t.kind), ["bid_file"]);
});

test("nothing waiting: no tasks", () => {
  assert.deepEqual(clientTasks([bid(), bid({ id: "z", stage: "closed" })], 100), []);
});

test("the Retainer placeholder never asks for a bid file; it asks for the profile only while incomplete", () => {
  const r = bid({ id: "ret", draft: true, isRetainerPlaceholder: true });
  assert.deepEqual(clientTasks([r], 80), [{ bidId: "ret", kind: "profile", label: "Complete your profile" }]);
  assert.deepEqual(clientTasks([r], 100), []);
});

test("tasks follow today's needs-action rule exactly for which bids appear", () => {
  const bids = [bid({ id: "1", draft: true }), bid({ id: "2", pendingCount: 1 }), bid({ id: "3", stage: "deliverables_ready" }), bid({ id: "4" }), bid({ id: "5", stage: "closed" })];
  assert.deepEqual(clientTasks(bids, 100).map((t) => t.bidId), bids.filter((b) => needsAction(b)).map((b) => b.id));
  assert.deepEqual(bids.filter((b) => needsAction(b)).map((b) => b.id), ["1", "2", "3"]);
});

test("where a bid stands, in plain words", () => {
  assert.equal(standingLabel({ draft: true, stage: "submitted", isRetainerPlaceholder: false }), "Waiting for your bid file");
  assert.equal(standingLabel({ draft: true, stage: "submitted", isRetainerPlaceholder: true }), "Watching for a good fit");
  assert.equal(standingLabel({ draft: false, stage: "submitted", isRetainerPlaceholder: false }), "Received");
  assert.equal(standingLabel({ draft: false, stage: "in_review", isRetainerPlaceholder: false }), "In review with us");
  assert.equal(standingLabel({ draft: false, stage: "deliverables_ready", isRetainerPlaceholder: false }), "Ready for your review");
  assert.equal(standingLabel({ draft: false, stage: "client_review", isRetainerPlaceholder: false }), "With you for review");
  assert.equal(standingLabel({ draft: false, stage: "closed", isRetainerPlaceholder: false }), "Closed");
});
