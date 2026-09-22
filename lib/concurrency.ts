// A small worker-pool runner for independent async items under both a
// concurrency limit and a wall-clock deadline. Built for cron routes
// running inside a platform time limit (e.g. Vercel's maxDuration) that
// previously processed items fully sequentially -- sequential processing
// made wall-clock time scale linearly with item count, so a realistic
// item count could blow through the deadline mid-run with no record of
// which items were never reached.
//
// Concurrency alone (Promise.all over all items at once) would still risk
// an unbounded number of simultaneous outbound requests; a bounded pool
// caps that while still running far more in parallel than one-at-a-time.
// The deadline check lets already-in-flight work finish normally (it does
// not abort a request mid-flight) but stops the pool from *starting* new
// work once time is up, and every item never started is returned as
// `skipped` -- a real, observable signal instead of the run just
// terminating silently.
export async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  deadline: number,
  worker: (item: T) => Promise<void>
): Promise<{ skipped: T[] }> {
  let nextIndex = 0;
  const skipped: T[] = [];

  async function runOneWorker(): Promise<void> {
    while (true) {
      if (Date.now() >= deadline) {
        while (nextIndex < items.length) {
          skipped.push(items[nextIndex]);
          nextIndex++;
        }
        return;
      }
      const i = nextIndex;
      if (i >= items.length) return;
      nextIndex++;
      await worker(items[i]);
    }
  }

  const poolSize = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: poolSize }, () => runOneWorker()));

  return { skipped };
}
