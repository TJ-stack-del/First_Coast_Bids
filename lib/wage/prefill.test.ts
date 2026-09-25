import { test } from "node:test";
import assert from "node:assert/strict";
import { parseWdReference, prefillLines, sanitizeLines, sanitizeNumber } from "./prefill.ts";
import type { ParsedWd } from "./parse-wd.ts";

const WD: ParsedWd = {
  number: "2015-4539", revision: 32, revisedOn: null, state: "Florida", area: null,
  positions: [
    { code: "11150", title: "Janitor", rate: 17.04, footnote: null },
    { code: "11210", title: "Laborer, Grounds Maintenance", rate: 17.94, footnote: null },
  ],
  hwPerHour: 5.92, hwEo13706PerHour: 5.42, vacationWeeks: 2, holidays: 11, eo13658Min: 13.65, paidSickLeave: true,
};

test("the checklist's WD label gives number and revision", () => {
  assert.deepEqual(parseWdReference("Price labor at or above Wage Determination 2015-4523 (Rev. 27)"), { number: "2015-4523", revision: 27 });
  assert.deepEqual(parseWdReference("WD 2015-4539"), { number: "2015-4539", revision: null });
  assert.equal(parseWdReference("no wage determination here"), null);
});

test("hours come from square footage, production rate and days; split into full-time workers", () => {
  const { lines, missingCode, hoursNeeded } = prefillLines({
    wd: WD, positionCode: "11150", productionRate: 3500, cleanableSqft: 45000, serviceDaysPerWeek: 5, defaults: {},
  });
  assert.equal(missingCode, null);
  assert.equal(hoursNeeded, false);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].rate, 17.04);
  assert.equal(lines[0].workers, 2, "64.29 h/week needs 2 workers");
  assert.equal(lines[0].hoursPerWeek, 32.14);
  assert.equal(lines[0].hoursSource, "from 45,000 sq ft at 3,500 sq ft/hr × 5 days");
});

test("service days fall back to the business default, then to 5", () => {
  const a = prefillLines({ wd: WD, positionCode: "11150", productionRate: 3000, cleanableSqft: 30000, serviceDaysPerWeek: null, defaults: { serviceDaysPerWeek: 3 } });
  assert.equal(a.lines[0].workers * a.lines[0].hoursPerWeek, 30);
  const b = prefillLines({ wd: WD, positionCode: "11150", productionRate: 3000, cleanableSqft: 30000, serviceDaysPerWeek: null, defaults: {} });
  assert.equal(b.lines[0].workers * b.lines[0].hoursPerWeek, 50);
});

test("no square footage (or no production rate): hours are left for the admin, flagged", () => {
  const { lines, hoursNeeded } = prefillLines({ wd: WD, positionCode: "11150", productionRate: null, cleanableSqft: 45000, serviceDaysPerWeek: 5, defaults: {} });
  assert.equal(hoursNeeded, true);
  assert.equal(lines[0].workers, 1);
  assert.equal(lines[0].hoursPerWeek, 0);
});

test("a default position missing from this WD is reported, not guessed", () => {
  const { lines, missingCode } = prefillLines({ wd: WD, positionCode: "99999", productionRate: 3500, cleanableSqft: 45000, serviceDaysPerWeek: 5, defaults: {} });
  assert.equal(missingCode, "99999");
  assert.deepEqual(lines, []);
});

test("sanitizing: blank, negative, text and unknown codes never become NaN or negative", () => {
  const out = sanitizeLines(
    [
      { code: "11150", workers: "", hoursPerWeek: "abc" },
      { code: "11210", workers: -3, hoursPerWeek: 20 },
      { code: "00000", workers: 1, hoursPerWeek: 40 },
      "junk",
    ],
    WD
  );
  assert.deepEqual(out.map((l) => [l.code, l.rate, l.workers, l.hoursPerWeek]), [
    ["11150", 17.04, 0, 0],
    ["11210", 17.94, 0, 20],
  ]);
  assert.equal(sanitizeNumber("12.5", 0), 12.5);
  assert.equal(sanitizeNumber(Infinity, 7), 7);
  assert.equal(sanitizeNumber(-1, 7), 7);
});
