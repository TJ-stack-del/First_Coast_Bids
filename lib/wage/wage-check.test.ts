import { test } from "node:test";
import assert from "node:assert/strict";
import { staffingText, wageCheckFor, wageCheckLines, wageCheckForWorksheet } from "./wage-check.ts";

const jan = { code: "11150", title: "Janitor", rate: 17.04, workers: 2, hoursPerWeek: 32.14, hoursSource: null };
const base = { floor: 86427.26, lines: [jan], wdNumber: "2015-4539", wdRevision: 32, now: "2026-09-25T12:00:00.000Z" };

test("staffing lists each position with workers and hours; empty lines are left out", () => {
  assert.equal(staffingText([jan]), "2 × Janitor at 32.14 hours/week each");
  assert.equal(
    staffingText([jan, { ...jan, code: "11210", title: "Laborer, Grounds Maintenance", workers: 1, hoursPerWeek: 20 }, { ...jan, workers: 0 }]),
    "2 × Janitor at 32.14 hours/week each; 1 × Laborer, Grounds Maintenance at 20 hours/week each"
  );
});

test("no bid price, or no floor yet: nothing for the client", () => {
  assert.equal(wageCheckFor({ ...base, bidPrice: null }), null);
  assert.equal(wageCheckFor({ ...base, floor: 0, bidPrice: 90000 }), null);
});

test("with a bid price: the saved line", () => {
  assert.deepEqual(wageCheckFor({ ...base, bidPrice: 112943.14 }), {
    floor: 86427.26, bidPrice: 112943.14, staffing: "2 × Janitor at 32.14 hours/week each",
    wdNumber: "2015-4539", wdRevision: 32, updatedAt: "2026-09-25T12:00:00.000Z",
  });
});

test("the client's wording, with the warning only below the floor", () => {
  const ok = wageCheckLines(wageCheckFor({ ...base, bidPrice: 112943.14 }));
  assert.equal(
    ok.main,
    "Federal wage law requires at least $86,427/year in labor for this contract (2 × Janitor at 32.14 hours/week each, WD 2015-4539 Rev. 32). Your price: $112,943/year."
  );
  assert.equal(ok.warning, null);
  const low = wageCheckLines(wageCheckFor({ ...base, bidPrice: 80000 }));
  assert.equal(low.warning, "This price is below the legal minimum. We'll go over it with you before you submit.");
});

test("the client's line comes from the saved worksheet itself, so Re-fill and a WD switch refresh it (final review I2)", async () => {
  const { readFileSync } = await import("node:fs");
  const { parseWd } = await import("./parse-wd.ts");
  const { computeFloor, roundCents } = await import("./floor.ts");
  const wd = parseWd(readFileSync(new URL("./fixtures/wd-2015-4539-r32.txt", import.meta.url), "utf8")).wd;
  const lines = [{ ...jan, rate: 17.04 }];
  const options = { includeVacation: true, eo13658: false };
  const ws = { wd_parsed: wd, wd_number: "2015-4539", wd_revision: 32, lines, options, bid_price: "90000" };
  const c = wageCheckForWorksheet(ws, "2026-09-25T12:00:00.000Z");
  assert.equal(c.floor, roundCents(computeFloor(lines, wd, options).total.floor));
  assert.equal(c.bidPrice, 90000);
  assert.equal(c.wdRevision, 32);
  assert.equal(wageCheckForWorksheet({ ...ws, bid_price: null }, "x"), null);
});
