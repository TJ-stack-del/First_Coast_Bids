import { test } from "node:test";
import assert from "node:assert/strict";
import { filesFingerprint, isScanStale, needsRescan, filesToRead, nextFilesRead, carryForward, claimFilter, allowForce } from "./scan-state.ts";

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
  // Final review, Important 7: a dead run is a failure -- shown as timed out
  // with Check again, not retried (and re-billed) on every page load.
  assert.equal(needsRescan({ ...done("a"), status: "running", started_at: "2026-09-25T11:50:00Z" }, "a|b", now), false, "a dead run isn't retried automatically");
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

// Final review, Important 5 and 6: only files actually read count as read,
// earlier coverage survives a failed run, and notices aren't wiped.
const DOCS = [
  { file_name: "rfq.pdf", created_at: "t1" },
  { file_name: "add1.pdf", created_at: "t2" },
  { file_name: "add2.pdf", created_at: "t3" },
  { file_name: "forms.doc", created_at: "t4" },
];

test("a file counts as read only if the AI read all of it without failing", () => {
  const read = nextFilesRead({
    previousRead: ["rfq.pdf@t1"],
    docs: DOCS,
    toRead: ["add1.pdf", "add2.pdf", "forms.doc"],
    pagesRead: [
      { file: "add1.pdf", total: 9, read: 9 },
      { file: "add2.pdf", total: 60, read: 20 },
    ],
    failedFiles: [],
    unreadable: ["forms.doc"],
  });
  assert.deepEqual(read.sort(), ["add1.pdf@t2", "rfq.pdf@t1"], "add2 was cut off, forms.doc unreadable");
});

test("a file with a failed AI chunk isn't counted as read", () => {
  const read = nextFilesRead({
    previousRead: undefined,
    docs: DOCS.slice(0, 1),
    toRead: ["rfq.pdf"],
    pagesRead: [{ file: "rfq.pdf", total: 48, read: 48 }],
    failedFiles: ["rfq.pdf"],
    unreadable: [],
  });
  assert.deepEqual(read, []);
});

test("coverage of files not re-read this time is kept, and removed files drop out", () => {
  const read = nextFilesRead({
    previousRead: ["rfq.pdf@t1", "gone.pdf@t0"],
    docs: DOCS.slice(0, 2),
    toRead: [],
    pagesRead: [],
    failedFiles: [],
    unreadable: [],
  });
  assert.deepEqual(read, ["rfq.pdf@t1"]);
});

test("earlier notices for files not re-read are carried forward", () => {
  const out = carryForward(
    [{ file: "rfq.pdf", total: 200, read: 120 }, { file: "gone.pdf", total: 3, read: 1 }],
    [{ file: "add1.pdf", total: 9, read: 9 }],
    ["add1.pdf"],
    ["rfq.pdf", "add1.pdf"]
  );
  assert.deepEqual(out, [{ file: "rfq.pdf", total: 200, read: 120 }, { file: "add1.pdf", total: 9, read: 9 }]);
});

// Final review, Important 3: a client can't force paid re-reads, and
// concurrent requests can't all start a reading.
test("only an admin can force a full re-read", () => {
  assert.equal(allowForce(true, true), true);
  assert.equal(allowForce(true, false), false);
  assert.equal(allowForce(false, true), false);
});

test("a reading is claimed only if none is running (or the running one is dead)", () => {
  assert.equal(
    claimFilter(new Date("2026-09-25T12:00:00Z")),
    'checklist_scan.is.null,checklist_scan->>status.neq.running,checklist_scan->>started_at.lt."2026-09-25T11:58:30.000Z"'
  );
});

test("the claim filter works for another scan column", () => {
  const f = claimFilter(new Date("2026-09-26T12:00:00.000Z"), "clin_scan");
  assert.ok(f.startsWith("clin_scan.is.null,clin_scan->>status.neq.running,clin_scan->>started_at.lt."));
  assert.ok(claimFilter(new Date("2026-09-26T12:00:00.000Z")).startsWith("checklist_scan.is.null"));
});
