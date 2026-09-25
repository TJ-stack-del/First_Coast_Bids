import { test } from "node:test";
import assert from "node:assert/strict";
import { parseOwnerOverrides } from "./owner-overrides.ts";

// Final review, Important 1: "Approve all verified" must use the owners the
// admin chose on screen, not the AI's suggestion.
test("valid owner choices are kept", () => {
  assert.deepEqual(parseOwnerOverrides({ a: "admin", b: "client" }), { a: "admin", b: "client" });
});

test("anything that isn't admin/client is ignored", () => {
  assert.deepEqual(parseOwnerOverrides({ a: "owner", b: 5, c: null }), {});
  assert.deepEqual(parseOwnerOverrides(null), {});
  assert.deepEqual(parseOwnerOverrides(["admin"]), {});
  assert.deepEqual(parseOwnerOverrides("admin"), {});
});
