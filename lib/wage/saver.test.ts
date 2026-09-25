import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { createSaver, type SaveStatus } from "./saver.ts";

// Final review I3 (2026-09-25): autosave showed "Saved" even when the save
// failed, could land an older save over a newer one, and dropped the last
// edit when leaving the page within 0.8 s.
const settle = () => new Promise((r) => setImmediate(r));

function setup(results: (boolean | Error)[]) {
  const sent: number[] = [];
  const statuses: SaveStatus[] = [];
  let release: (() => void) | null = null;
  let hold = false;
  const saver = createSaver<number>({
    delay: 800,
    onStatus: (s) => statuses.push(s),
    send: async (p) => {
      sent.push(p);
      if (hold) await new Promise<void>((r) => (release = r));
      const r = results.shift() ?? true;
      if (r instanceof Error) throw r;
      return r;
    },
  });
  return { saver, sent, statuses, holdNext: () => (hold = true), releaseNow: () => { hold = false; release?.(); } };
}

test("rapid edits send once, with the latest values", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  const { saver, sent, statuses } = setup([true]);
  saver.schedule(1); saver.schedule(2); saver.schedule(3);
  mock.timers.tick(799); await settle();
  assert.deepEqual(sent, []);
  mock.timers.tick(1); await settle();
  assert.deepEqual(sent, [3]);
  assert.equal(statuses.at(-1), "saved");
  mock.timers.reset();
});

test("an edit made while a save is in flight is sent after it, never overtaken", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  const t = setup([true, true]);
  t.holdNext();
  t.saver.schedule(1); mock.timers.tick(800); await settle();
  assert.deepEqual(t.sent, [1]);
  t.saver.schedule(2); mock.timers.tick(800); await settle();
  assert.deepEqual(t.sent, [1], "second save waits for the first");
  t.releaseNow(); await settle(); await settle();
  assert.deepEqual(t.sent, [1, 2]);
  assert.equal(t.statuses.at(-1), "saved");
  mock.timers.reset();
});

test("a failed save shows as failed, and retry sends it again", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  const { saver, sent, statuses } = setup([false, new Error("network"), true]);
  saver.schedule(7); mock.timers.tick(800); await settle();
  assert.equal(statuses.at(-1), "error");
  await saver.retry();
  assert.equal(statuses.at(-1), "error", "a thrown error is a failure too");
  await saver.retry();
  assert.deepEqual(sent, [7, 7, 7]);
  assert.equal(statuses.at(-1), "saved");
  mock.timers.reset();
});

test("flush sends the pending edit right away (leaving the page)", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  const { saver, sent } = setup([true]);
  saver.schedule(9);
  await saver.flush();
  assert.deepEqual(sent, [9]);
  await saver.flush();
  assert.deepEqual(sent, [9], "nothing pending: nothing sent");
  mock.timers.reset();
});
