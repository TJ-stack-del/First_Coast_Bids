import { test } from "node:test";
import assert from "node:assert/strict";
import { runWithConcurrency } from "./concurrency.ts";

test("runWithConcurrency processes every item when given ample time", async () => {
  const items = [1, 2, 3, 4, 5];
  const processed: number[] = [];

  const { skipped } = await runWithConcurrency(items, 2, Date.now() + 10_000, async (item) => {
    processed.push(item);
  });

  assert.deepEqual(processed.sort(), items);
  assert.deepEqual(skipped, []);
});

test("runWithConcurrency never runs more than `concurrency` workers at once", async () => {
  const items = [1, 2, 3, 4, 5, 6];
  let inFlight = 0;
  let maxInFlight = 0;

  await runWithConcurrency(items, 2, Date.now() + 10_000, async () => {
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 5));
    inFlight--;
  });

  assert.equal(maxInFlight, 2);
});

test("runWithConcurrency skips items not yet started once the deadline passes", async () => {
  const items = [1, 2, 3, 4, 5, 6, 7, 8];
  const processed: number[] = [];
  // A deadline in the past -- no item should ever start.
  const { skipped } = await runWithConcurrency(items, 3, Date.now() - 1, async (item) => {
    processed.push(item);
  });

  assert.deepEqual(processed, []);
  assert.deepEqual(skipped, items);
});

test("runWithConcurrency lets in-flight work finish but stops starting new work past the deadline", async () => {
  const items = [1, 2, 3, 4, 5, 6];
  const processed: number[] = [];
  // Deadline passes partway through -- some items processed, the rest skipped.
  const deadline = Date.now() + 20;

  const { skipped } = await runWithConcurrency(items, 1, deadline, async (item) => {
    processed.push(item);
    await new Promise((resolve) => setTimeout(resolve, 15));
  });

  assert.ok(processed.length > 0, "at least one item should have been processed before the deadline");
  assert.ok(processed.length < items.length, "not every item should have been processed");
  assert.deepEqual(new Set([...processed, ...skipped]), new Set(items));
});
