import { test } from "node:test";
import assert from "node:assert/strict";
import { coerceAiItems } from "./ai-pass.ts";

test("valid items are kept and normalised", () => {
  const items = coerceAiItems({
    items: [
      { kind: "bond", federal: false, label: " Bid bond ", detail: "5% of bid", quote: "A bid bond of 5% is required.", page: 4, source_file: "rfp.pdf", suggested_owner: "client" },
      { kind: "submission_rule", federal: false, label: "Submit by email", detail: "", quote: "Email offers to the CO.", page: 0, source_file: "", suggested_owner: "admin" },
    ],
  });
  assert.equal(items.length, 2);
  assert.deepEqual(items[0], {
    kind: "bond", federal: false, label: "Bid bond", detail: "5% of bid", quote: "A bid bond of 5% is required.",
    page: 4, source_file: "rfp.pdf", found_by: "ai", key: null, suggested_owner: "client",
  });
  assert.equal(items[1].page, null, "0 means unknown");
  assert.equal(items[1].source_file, null, "empty means unknown");
  assert.equal(items[1].detail, null);
});

test("items with an unknown kind, no label or no quote are dropped", () => {
  const items = coerceAiItems({
    items: [
      { kind: "pizza", label: "x", quote: "long enough quote" },
      { kind: "bond", label: "", quote: "long enough quote" },
      { kind: "bond", label: "Bid bond", quote: "" },
    ],
  });
  assert.deepEqual(items, []);
});

test("a bad owner falls back to the kind's default", () => {
  const [item] = coerceAiItems({ items: [{ kind: "wage_determination", label: "WD", quote: "WD 2015-4523 applies here", suggested_owner: "nobody" }] });
  assert.equal(item.suggested_owner, "admin");
});

test("garbage input yields nothing", () => {
  assert.deepEqual(coerceAiItems(null), []);
  assert.deepEqual(coerceAiItems({ items: "no" }), []);
});
