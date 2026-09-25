import { test } from "node:test";
import assert from "node:assert/strict";
import { computeLine, computeFloor, computePrice, belowFloor, roundCents } from "./floor.ts";
import type { ParsedWd } from "./parse-wd.ts";

const WD: ParsedWd = {
  number: "2015-4539", revision: 32, revisedOn: null, state: "Florida", area: null,
  positions: [{ code: "11150", title: "Janitor", rate: 17.04, footnote: null }],
  hwPerHour: 5.92, hwEo13706PerHour: 5.42, vacationWeeks: 2, holidays: 11, eo13658Min: 13.65, paidSickLeave: true,
};
const ON = { includeVacation: true, eo13658: false };
const janitors = (workers: number, hoursPerWeek: number) => ({ code: "11150", title: "Janitor", rate: 17.04, workers, hoursPerWeek, hoursSource: null });

test("two full-time janitors on the Jacksonville WD (worked by hand)", () => {
  const r = computeLine(janitors(2, 40), WD, ON);
  assert.equal(r.annualHours, 4160);
  assert.equal(roundCents(r.wages), 70886.4);
  assert.equal(roundCents(r.hw), 24627.2);
  assert.equal(roundCents(r.holidays), 2999.04);
  assert.equal(roundCents(r.vacation), 2726.4);
  assert.equal(roundCents(r.sick), 1908.48, "sick leave capped at 56 h per worker");
  assert.equal(roundCents(r.fica), 6006.8);
  assert.equal(roundCents(r.floor), 109154.32);
});

test("a part-time janitor is prorated (20 h/week)", () => {
  const r = computeLine(janitors(1, 20), WD, ON);
  assert.equal(roundCents(r.hw), 6156.8);
  assert.equal(roundCents(r.holidays), 749.76);
  assert.equal(roundCents(r.vacation), 681.6);
  assert.equal(roundCents(r.sick), 590.72, "1 h per 30 worked, under the cap");
  assert.equal(roundCents(r.floor), 27410.87);
});

test("health & welfare, holidays and vacation stop at 40 hours a week", () => {
  const r45 = computeLine(janitors(1, 45), WD, ON);
  const r40 = computeLine(janitors(1, 40), WD, ON);
  assert.equal(r45.hw, r40.hw);
  assert.equal(r45.holidays, r40.holidays);
  assert.equal(r45.vacation, r40.vacation);
  assert.ok(r45.wages > r40.wages);
});

test("vacation off removes vacation; EO 13658 only raises a rate below its minimum", () => {
  assert.equal(computeLine(janitors(1, 40), WD, { includeVacation: false, eo13658: false }).vacation, 0);
  const low = { ...janitors(1, 40), rate: 12.0 };
  assert.equal(computeLine(low, WD, { includeVacation: true, eo13658: true }).wage, 13.65);
  assert.equal(computeLine(janitors(1, 40), WD, { includeVacation: true, eo13658: true }).wage, 17.04);
  assert.equal(computeLine(low, WD, ON).wage, 12.0, "box unticked: the listed rate");
});

test("no paid sick leave when the WD doesn't state EO 13706", () => {
  assert.equal(computeLine(janitors(1, 40), { ...WD, paidSickLeave: false }, ON).sick, 0);
});

test("missing WD holidays/vacation count as zero, never NaN", () => {
  const r = computeLine(janitors(1, 40), { ...WD, holidays: null, vacationWeeks: null }, ON);
  assert.equal(r.holidays, 0);
  assert.equal(r.vacation, 0);
  assert.ok(Number.isFinite(r.floor));
});

test("computeFloor totals the lines", () => {
  const { total, lines } = computeFloor([janitors(2, 40), janitors(1, 20)], WD, ON);
  assert.equal(lines.length, 2);
  assert.equal(roundCents(total.floor), roundCents(109154.32448 + 27410.87152));
});

test("price = (floor + supplies) x (1 + overhead) x (1 + profit)", () => {
  const p = computePrice(109154.32448, { suppliesMode: "percent", suppliesValue: 8, overheadPct: 10, profitPct: 10 });
  assert.equal(roundCents(p.supplies), 8732.35);
  assert.equal(roundCents(p.price), 142642.87);
  const flat = computePrice(100000, { suppliesMode: "flat", suppliesValue: 5000, overheadPct: 0, profitPct: 0 });
  assert.equal(flat.price, 105000);
});

test("below-floor shortfall", () => {
  assert.equal(belowFloor(100000, 109154.32), 9154.32);
  assert.equal(belowFloor(120000, 109154.32), null);
  assert.equal(belowFloor(null, 109154.32), null);
});
