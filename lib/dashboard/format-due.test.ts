import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDue } from "./format-due.ts";

// A bid's deadline must read the same everywhere on the dashboard (the
// row summary and the open details), whatever the viewer's time zone.
test("an intake date (stored as midnight UTC) keeps its calendar day", () => {
  assert.equal(formatDue("2026-10-01"), "Oct 1, 2026");
  assert.equal(formatDue("2026-10-01T00:00:00+00:00"), "Oct 1, 2026");
});

test("the result doesn't depend on the machine's time zone", () => {
  const before = process.env.TZ;
  process.env.TZ = "America/New_York";
  try {
    assert.equal(formatDue("2026-10-01T00:00:00+00:00"), "Oct 1, 2026");
  } finally {
    process.env.TZ = before;
  }
});

test("no date: nothing to show", () => {
  assert.equal(formatDue(null), null);
  assert.equal(formatDue(""), null);
});
