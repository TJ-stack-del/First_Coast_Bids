import { test } from "node:test";
import assert from "node:assert/strict";
import { chunkPages } from "./chunk.ts";

test("pages are packed into chunks with document and page markers", () => {
  const { chunks, pagesRead } = chunkPages([{ fileName: "a.pdf", pages: ["one", "two", "three"] }], 40);
  assert.ok(chunks.length >= 2);
  assert.match(chunks[0].text, /^--- Document: a\.pdf ---\n--- Page 1 ---\none/);
  assert.equal(chunks[0].startPage, 1);
  assert.equal(chunks.at(-1)!.endPage, 3);
  assert.deepEqual(pagesRead, [{ file: "a.pdf", total: 3, read: 3 }]);
});

test("unreadable files produce no chunks", () => {
  assert.deepEqual(chunkPages([{ fileName: "scan.pdf", pages: null }]).chunks, []);
});

test("the total cap stops reading and records how far each file got", () => {
  const page = "x".repeat(100);
  // Each page block is "--- Page N ---\n" + 100 chars + "\n" = 116 chars: 4 fit in 480, a 5th would not.
  const { chunks, pagesRead } = chunkPages([{ fileName: "big.pdf", pages: Array(10).fill(page) }], 1000, 480);
  assert.equal(chunks.at(-1)!.endPage, 4);
  assert.deepEqual(pagesRead, [{ file: "big.pdf", total: 10, read: 4 }]);
});
