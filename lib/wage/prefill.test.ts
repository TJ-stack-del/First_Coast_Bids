import { test } from "node:test";
import assert from "node:assert/strict";
import { parseWdReference, prefillLines, sanitizeLines, sanitizeNumber, shouldAutoLoad, readNumberText, pickWdSuggestion, rerateLines, wdRefChanged, prefillGuidance, bidPriceForSave, applyPrefilledHours, readOptionalNumberText } from "./prefill.ts";
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
    wd: WD, positionCode: "11150", productionRate: 3500, cleanableSqft: 45000, serviceDaysPerWeek: 5
  });
  assert.equal(missingCode, null);
  assert.equal(hoursNeeded, false);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].rate, 17.04);
  assert.equal(lines[0].workers, 2, "64.29 h/week needs 2 workers");
  assert.equal(lines[0].hoursPerWeek, 32.14);
  assert.equal(lines[0].hoursSource, "from 45,000 sq ft at 3,500 sq ft/hr × 5 days");
});

test("service days fall back to 5, and the source says it was assumed", () => {
  const a = prefillLines({ wd: WD, positionCode: "11150", productionRate: 3000, cleanableSqft: 30000, serviceDaysPerWeek: null });
  assert.equal(a.lines[0].hoursPerWeek, 50 / 2);
  assert.equal(a.lines[0].hoursSource, "from 30,000 sq ft at 3,000 sq ft/hr × 5 days (assumed; the solicitation didn't say)");
  const b = prefillLines({ wd: WD, positionCode: "11150", productionRate: 3000, cleanableSqft: 30000, serviceDaysPerWeek: 3 });
  assert.equal(b.lines[0].hoursSource, "from 30,000 sq ft at 3,000 sq ft/hr × 3 days");
});

test("no square footage (or no production rate): hours are left for the admin, flagged", () => {
  const { lines, hoursNeeded } = prefillLines({ wd: WD, positionCode: "11150", productionRate: null, cleanableSqft: 45000, serviceDaysPerWeek: 5 });
  assert.equal(hoursNeeded, true);
  assert.equal(lines[0].workers, 1);
  assert.equal(lines[0].hoursPerWeek, 0);
});

test("a default position missing from this WD is reported, not guessed", () => {
  const { lines, missingCode } = prefillLines({ wd: WD, positionCode: "99999", productionRate: 3500, cleanableSqft: 45000, serviceDaysPerWeek: 5 });
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

// Found in the dev end-to-end run (2026-09-25): the worksheet showed "Enter
// the wage determination" before the solicitation was read and stayed that
// way after the checklist found WD 2015-4539 -- an extra step for one person
// on a 48-hour clock. It fills itself in once the WD becomes known.
test("the worksheet reloads itself when the checklist finds the WD", () => {
  assert.equal(shouldAutoLoad("no_wd", null, "Price labor at or above Wage Determination 2015-4539 (Rev. 32)"), true);
  assert.equal(shouldAutoLoad("no_wd", "WD 2015-4539", "WD 2015-4539"), false, "same WD, nothing new");
  // An amendment's newer WD while the worksheet is open: re-check it, which
  // saves pending edits first and returns the saved worksheet plus the
  // "solicitation now names Rev. N" banner (final review C1).
  assert.equal(shouldAutoLoad("ready", "2015-4539|31", "2015-4539|32"), true);
  assert.equal(shouldAutoLoad("loading", null, "WD 2015-4539"), false, "never while a load is running");
  assert.equal(shouldAutoLoad("no_wd", null, null), false);
});

// Found in the dev end-to-end run (2026-09-25): typing "35.5" into hours
// saved 355 -- each keystroke was turned into a number, so "35." lost its
// point. A box keeps the text as typed; this reads it.
test("a number box's text is read without losing a half-typed decimal", () => {
  assert.equal(readNumberText("35."), 35);
  assert.equal(readNumberText("35.5"), 35.5);
  assert.equal(readNumberText("1,250"), 1250);
  assert.equal(readNumberText(""), 0);
  assert.equal(readNumberText("."), 0);
  assert.equal(readNumberText("abc"), null, "not a number: leave the value as it was");
  assert.equal(readNumberText("-4"), null, "negative isn't allowed");
});

// ---- Final review fixes (2026-09-25) ----

test("I2: a bid price typed with $ and commas is read, not dropped", () => {
  assert.equal(readNumberText("$90,000"), 90000);
  assert.equal(readNumberText(" 90,000.50 "), 90000.5);
});

test("I5: a revision is read with or without brackets", () => {
  assert.deepEqual(parseWdReference("2015-4539 Rev. 32"), { number: "2015-4539", revision: 32 });
  assert.deepEqual(parseWdReference("2015-4539 Rev 32"), { number: "2015-4539", revision: 32 });
  assert.deepEqual(parseWdReference("WD 2015-4539, Revision No. 32"), { number: "2015-4539", revision: 32 });
  assert.deepEqual(parseWdReference("2015-4539 (Rev.-27)"), { number: "2015-4539", revision: 27 });
});

test("I5: the WD comes from the newest non-rejected WD suggestion (amendments supersede), number from its key", () => {
  const sug = [
    { kind: "wage_determination", dedupe_key: "wd:2015-4523", label: "Price labor at or above Wage Determination 2015-4523 (Rev. 36)", status: "rejected", created_at: "2026-09-25T10:00:00Z" },
    { kind: "wage_determination", dedupe_key: "wd:2015-4539:r32", label: "Price labor at or above Wage Determination 2015-4539 (Rev. 32)", status: "approved", created_at: "2026-09-25T10:00:02Z" },
    { kind: "form", dedupe_key: "form:sf-1449", label: "SF-1449", status: "pending", created_at: "2026-09-25T09:00:00Z" },
    { kind: "wage_determination", dedupe_key: "wd:2015-4539:r33", label: "Price labor at or above Wage Determination 2015-4539 (Rev. 33)", status: "pending", created_at: "2026-09-25T10:00:05Z" },
  ];
  assert.deepEqual(pickWdSuggestion(sug), { number: "2015-4539", revision: 33 }, "the amendment's newer revision wins");
  assert.deepEqual(pickWdSuggestion(sug.slice(0, 3)), { number: "2015-4539", revision: 32 });
  assert.equal(pickWdSuggestion([]), null);
  assert.equal(pickWdSuggestion([sug[0]]), null, "only a rejected one: none");
});

test("C1: switching WD keeps positions that exist in the new WD, re-rated, and drops the rest", () => {
  const other = { ...WD, positions: [{ code: "11150", title: "Janitor", rate: 18.5, footnote: null }] };
  const out = rerateLines(
    [
      { code: "11150", title: "Janitor", rate: 17.04, workers: 2, hoursPerWeek: 32.14, hoursSource: "from 45,000 sq ft" },
      { code: "11210", title: "Laborer, Grounds Maintenance", rate: 17.94, workers: 1, hoursPerWeek: 20, hoursSource: null },
    ],
    other
  );
  assert.deepEqual(out, [{ code: "11150", title: "Janitor", rate: 18.5, workers: 2, hoursPerWeek: 32.14, hoursSource: "from 45,000 sq ft" }]);
});

test("C1: a changed WD number or revision is detected", () => {
  assert.equal(wdRefChanged({ number: "2015-4539", revision: 32 }, { number: "2015-4539", revision: 33 }), true);
  assert.equal(wdRefChanged({ number: "2015-4539", revision: 32 }, { number: "2015-4523", revision: 32 }), true);
  assert.equal(wdRefChanged({ number: "2015-4539", revision: 32 }, { number: "2015-4539", revision: 32 }), false);
  assert.equal(wdRefChanged({ number: "2015-4539", revision: 32 }, { number: "2015-4539", revision: null }), false, "no stated revision isn't a change");
  assert.equal(wdRefChanged({ number: "2015-4539", revision: 32 }, null), false);
});

test("guidance names the client for their numbers, and Settings only for the position code", () => {
  const base = { tradeLabel: "Janitorial", positionCode: "11150", clientName: "Acme Cleaning", productionRate: 3500, cleanableSqft: 45000, missingCode: null, missingPricing: [] };
  assert.deepEqual(prefillGuidance({ ...base, tradeLabel: null }), ["No trade matched this bid, so no position was pre-filled. Add a position below."]);
  assert.deepEqual(prefillGuidance({ ...base, positionCode: null }), [
    "Set a wage worksheet position code for Janitorial in Settings → Trades to pre-fill positions.",
  ]);
  assert.deepEqual(prefillGuidance({ ...base, positionCode: "99999", missingCode: "99999" }), [
    "Position 99999 (the Janitorial default) isn't in this wage determination. Add a position below.",
  ]);
  assert.deepEqual(prefillGuidance({ ...base, productionRate: null }), ["Enter Acme Cleaning's sq ft per hour to pre-fill hours."]);
  assert.deepEqual(prefillGuidance({ ...base, cleanableSqft: null }), ["The solicitation didn't state square footage, so enter hours per week."]);
  assert.deepEqual(prefillGuidance({ ...base, missingPricing: ["overhead %", "profit %"] }), ["Missing Acme Cleaning's overhead % and profit %."]);
  assert.deepEqual(prefillGuidance({ ...base, missingPricing: ["supplies", "overhead %", "profit %"] }), [
    "Missing Acme Cleaning's supplies, overhead % and profit %.",
  ]);
  assert.deepEqual(prefillGuidance(base), []);
});

test("pre-filled hours replace blank or pre-filled ones, never hours the admin typed", () => {
  const pre = [{ code: "11150", title: "Janitor", rate: 17.04, workers: 2, hoursPerWeek: 32.14, hoursSource: "from 45,000 sq ft …" }];
  const blank = [{ ...pre[0], workers: 1, hoursPerWeek: 0, hoursSource: null }];
  assert.deepEqual(applyPrefilledHours(blank, pre), pre);
  const oldPrefill = [{ ...pre[0], workers: 3, hoursPerWeek: 30, hoursSource: "from 45,000 sq ft at 2,000 …" }];
  assert.deepEqual(applyPrefilledHours(oldPrefill, pre), pre);
  const typed = [{ ...pre[0], workers: 2, hoursPerWeek: 36, hoursSource: null }];
  assert.deepEqual(applyPrefilledHours(typed, pre), typed);
  const other = [{ ...pre[0], code: "11210", hoursPerWeek: 0, hoursSource: null }];
  assert.deepEqual(applyPrefilledHours(other, pre), other);
});

test("an optional number box: blank is missing, typed text is read, junk keeps the old value", () => {
  assert.equal(readOptionalNumberText(""), null);
  assert.equal(readOptionalNumberText("  "), null);
  assert.equal(readOptionalNumberText("12"), 12);
  assert.equal(readOptionalNumberText("12."), 12);
  assert.equal(readOptionalNumberText("$1,500"), 1500);
  assert.equal(readOptionalNumberText("0"), 0);
  assert.equal(readOptionalNumberText("abc"), undefined);
});

test("a bid price that isn't a usable number is saved as empty, never as $0", () => {
  assert.equal(bidPriceForSave(-5), null);
  assert.equal(bidPriceForSave(""), null);
  assert.equal(bidPriceForSave(undefined), null);
  assert.equal(bidPriceForSave("abc"), null);
  assert.equal(bidPriceForSave(90000), 90000);
  assert.equal(bidPriceForSave(0), 0);
});

test("a pasted '12%' or '12 %' is read as 12, not dropped (final review I1)", () => {
  assert.equal(readOptionalNumberText("12%"), 12);
  assert.equal(readOptionalNumberText("12 %"), 12);
  assert.equal(readNumberText("8%"), 8);
  assert.equal(readOptionalNumberText("12 percent"), undefined);
});
