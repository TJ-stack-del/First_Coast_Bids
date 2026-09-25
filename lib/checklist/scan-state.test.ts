import { test } from "node:test";
import assert from "node:assert/strict";
import { filesFingerprint, isScanStale } from "./scan-state.ts";

test("fingerprint depends on names and upload times, not order", () => {
  const a = filesFingerprint([{ file_name: "a.pdf", created_at: "2026-09-25T10:00:00Z" }, { file_name: "b.pdf", created_at: "2026-09-25T11:00:00Z" }]);
  const b = filesFingerprint([{ file_name: "b.pdf", created_at: "2026-09-25T11:00:00Z" }, { file_name: "a.pdf", created_at: "2026-09-25T10:00:00Z" }]);
  const c = filesFingerprint([{ file_name: "a.pdf", created_at: "2026-09-25T10:00:00Z" }]);
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test("a running scan older than 90 seconds is stale (the function was killed)", () => {
  const now = new Date("2026-09-25T12:00:00Z");
  const scan = (secondsAgo: number) => ({ status: "running" as const, started_at: new Date(now.getTime() - secondsAgo * 1000).toISOString(), files_fingerprint: "x" });
  assert.equal(isScanStale(scan(30), now), false);
  assert.equal(isScanStale(scan(91), now), true);
  assert.equal(isScanStale({ ...scan(500), status: "done" }, now), false);
  assert.equal(isScanStale(null, now), false);
});
