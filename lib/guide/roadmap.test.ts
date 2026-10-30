import { test } from "node:test";
import assert from "node:assert/strict";
import { roadmap } from "./roadmap.ts";
import { getArticle } from "./articles.ts";

const status = (r: ReturnType<typeof roadmap>) => r.stations.map((s) => `${s.id}:${s.status}`);

test("brand new: license first, everything else later", () => {
  const r = roadmap({ bidBefore: false, registered: false, licensed: false, bidInHand: false });
  assert.deepEqual(status(r), ["licensed:next", "registered:later", "found:later", "understood:later", "prepared:later", "submitted:later"]);
  assert.equal(r.headline, "Here's your road to a first bid.");
});

test("licensed and registered with no bid yet: finding one is next", () => {
  const r = roadmap({ bidBefore: false, registered: true, licensed: true, bidInHand: false });
  assert.equal(r.stations.find((s) => s.status === "next")!.id, "found");
  assert.equal(r.headline, "You're 2 of 6 steps along.");
});

test("everything in place with a bid in hand: reading it is next", () => {
  const r = roadmap({ bidBefore: true, registered: true, licensed: true, bidInHand: true });
  const next = r.stations.find((s) => s.status === "next")!;
  assert.equal(next.id, "understood");
  assert.equal(next.action!.href, "/#read");
  assert.equal(r.stations.at(-1)!.action, null);
});

test("a bid in hand but not registered: registering comes first, and says why", () => {
  const r = roadmap({ bidBefore: false, registered: false, licensed: true, bidInHand: true });
  const next = r.stations.find((s) => s.status === "next")!;
  assert.equal(next.id, "registered");
  assert.match(next.why, /can't submit without it/);
  assert.equal(r.stations.find((s) => s.id === "found")!.status, "done");
});

test("exactly one next station, and every guide link is a real article", () => {
  for (const bits of [0, 1, 2, 3, 5, 7, 9, 15]) {
    const a = { bidBefore: !!(bits & 1), registered: !!(bits & 2), licensed: !!(bits & 4), bidInHand: !!(bits & 8) };
    const r = roadmap(a);
    assert.equal(r.stations.filter((s) => s.status === "next").length, 1, JSON.stringify(a));
    for (const s of r.stations) {
      const slug = s.action?.href.match(/^\/guide\/(.+)$/)?.[1];
      if (slug) assert.ok(getArticle(slug), slug);
    }
  }
});
