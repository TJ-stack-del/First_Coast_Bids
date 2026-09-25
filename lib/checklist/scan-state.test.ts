import { test } from "node:test";
import assert from "node:assert/strict";
import { filesFingerprint, isScanStale, needsRescan, filesToRead } from "./scan-state.ts";

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

test("files added during or after a reading trigger another reading (real case: 3 quick uploads, only the first read)", () => {
  const now = new Date("2026-09-25T12:00:00Z");
  const done = (fp: string) => ({ status: "done" as const, started_at: "2026-09-25T11:59:00Z", files_fingerprint: fp });
  assert.equal(needsRescan(done("a"), "a|b|c", now), true, "new files since the last reading");
  assert.equal(needsRescan(done("a|b|c"), "a|b|c", now), false, "already read these files");
  assert.equal(needsRescan({ ...done("a"), status: "running", started_at: "2026-09-25T11:59:50Z" }, "a|b", now), false, "wait for the running one");
  assert.equal(needsRescan({ ...done("a"), status: "running", started_at: "2026-09-25T11:50:00Z" }, "a|b", now), true, "a dead run doesn't block");
  assert.equal(needsRescan({ ...done("a"), status: "failed" }, "a", now), false, "a failure isn't retried automatically");
  assert.equal(needsRescan(null, "a", now), false, "a bid never read isn't read automatically (no surprise AI cost)");
  assert.equal(needsRescan(done("a"), null, now), false, "no files, nothing to read");
});

test("an automatic re-read only sends files the last reading didn't cover; Check again sends all", () => {
  const docs = [
    { file_name: "rfq.pdf", created_at: "2026-09-25T09:00:00Z" },
    { file_name: "addendum-1.pdf", created_at: "2026-09-25T09:00:01Z" },
  ];
  const previous = { status: "done" as const, started_at: "x", files_fingerprint: "rfq.pdf@2026-09-25T09:00:00Z", files_read: ["rfq.pdf@2026-09-25T09:00:00Z"] };
  assert.deepEqual(filesToRead(docs, previous, false), ["addendum-1.pdf"]);
  assert.deepEqual(filesToRead(docs, previous, true), ["rfq.pdf", "addendum-1.pdf"]);
  assert.deepEqual(filesToRead(docs, null, false), ["rfq.pdf", "addendum-1.pdf"], "first reading reads everything");
  // A file re-uploaded under the same name is a new file.
  assert.deepEqual(filesToRead([{ file_name: "rfq.pdf", created_at: "2026-09-26T00:00:00Z" }], previous, false), ["rfq.pdf"]);
});
