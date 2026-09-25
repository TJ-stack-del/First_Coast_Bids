import { test } from "node:test";
import assert from "node:assert/strict";
import { needsAttention, splitForReview } from "./attention.ts";

type S = Parameters<typeof needsAttention>[0];
const s = (p: Partial<S>): S => ({ id: "x", kind: "other", quote_status: "verified", federal: false, suggested_owner: "client", found_by: "ai", ...p });

// Built for one person on a 48-hour turnaround: only what needs a human look
// is shown up front; everything else waits under one "Approve all".
test("unverified quotes, federal items and admin-owned items need attention", () => {
  assert.equal(needsAttention(s({ quote_status: "not_found" })), true);
  assert.equal(needsAttention(s({ quote_status: "unreadable" })), true);
  assert.equal(needsAttention(s({ federal: true, kind: "far_provision" })), true);
  assert.equal(needsAttention(s({ suggested_owner: "admin" })), true);
});

test("a verified, non-federal client item doesn't need attention", () => {
  assert.equal(needsAttention(s({})), false);
  assert.equal(needsAttention(s({ found_by: "detector" })), false);
});

test("splitForReview keeps order within each group", () => {
  const items = [s({ id: "a" }), s({ id: "b", federal: true, kind: "wage_determination" }), s({ id: "c" }), s({ id: "d", quote_status: "not_found" })];
  const { attention, routine } = splitForReview(items);
  assert.deepEqual(attention.map((i) => i.id), ["b", "d"]);
  assert.deepEqual(routine.map((i) => i.id), ["a", "c"]);
});

// Re-test 2026-09-25: on a federal bid the AI marks nearly every item
// federal, which put 12 of 13 items under "Needs a look". Only the federal
// KINDS carry the pricing/compliance stakes that need a look.
test("a federal bid's ordinary client items are routine; federal kinds still need a look", () => {
  assert.equal(needsAttention(s({ federal: true, kind: "form" })), false);
  assert.equal(needsAttention(s({ federal: true, kind: "other" })), false);
  assert.equal(needsAttention(s({ federal: true, kind: "wage_determination" })), true);
  assert.equal(needsAttention(s({ federal: true, kind: "sam_registration", suggested_owner: "admin" })), true);
});
