import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildSamDailyParams,
  buildSamBackfillParams,
  selectSamRows,
  formatSamDate,
  backfillCodeForDate,
} from "./sam-gov-query.ts";

const NOW = new Date(2026, 8, 23, 13, 0, 0); // Sept 23 2026, local time

test("formatSamDate is MM/dd/yyyy", () => {
  assert.equal(formatSamDate(new Date(2026, 0, 5)), "01/05/2026");
});

test("daily params: one request, yesterday through today, Florida, biddable types, max page, no NAICS filter", () => {
  const p = buildSamDailyParams("KEY", NOW);
  assert.equal(p.get("postedFrom"), "09/22/2026");
  assert.equal(p.get("postedTo"), "09/23/2026");
  assert.equal(p.get("state"), "FL");
  assert.equal(p.get("limit"), "1000");
  assert.deepEqual(p.getAll("ptype").sort(), ["k", "o", "p", "r"]);
  assert.equal(p.get("ncode"), null, "daily run covers every NAICS code in one request");
  assert.equal(p.get("api_key"), "KEY");
});

test("backfill params: one NAICS code, window one day short of a year (SAM.gov's limit)", () => {
  const p = buildSamBackfillParams("KEY", NOW, "561720");
  assert.equal(p.get("ncode"), "561720");
  assert.equal(p.get("postedFrom"), "09/24/2025");
  assert.equal(p.get("postedTo"), "09/23/2026");
  assert.equal(p.get("state"), "FL");
  assert.deepEqual(p.getAll("ptype").sort(), ["k", "o", "p", "r"]);
});

test("backfill window handles a leap day without exceeding a year", () => {
  const p = buildSamBackfillParams("KEY", new Date(2028, 1, 29, 12), "561720");
  assert.equal(p.get("postedFrom"), "03/02/2027"); // Feb 29 -> (no Feb 29 2027 -> Mar 1) + 1 day
  assert.equal(p.get("postedTo"), "02/29/2028");
});

const CODES = ["561720", "238210", "238220"];

test("selectSamRows keeps only the given trade codes that are biddable and still open", () => {
  const rows = [
    { id: "keep", naicsCode: "561720", type: "Solicitation", responseDeadLine: "2026-10-01T12:00:00-04:00" },
    { id: "keep-no-deadline", naicsCode: "238210", type: "Presolicitation", responseDeadLine: null },
    { id: "other-trade", naicsCode: "336411", type: "Solicitation", responseDeadLine: "2026-10-01T12:00:00-04:00" },
    { id: "no-naics", naicsCode: null, type: "Solicitation", responseDeadLine: "2026-10-01T12:00:00-04:00" },
    { id: "award", naicsCode: "561720", type: "Award Notice", responseDeadLine: "2026-10-01T12:00:00-04:00" },
    { id: "closed", naicsCode: "561720", type: "Solicitation", responseDeadLine: "2026-09-01T12:00:00-04:00" },
  ];
  assert.deepEqual(
    selectSamRows(rows, NOW, CODES).map((r) => r.id),
    ["keep", "keep-no-deadline"]
  );
});

test("with no trade codes, nothing is selected", () => {
  const rows = [{ id: "a", naicsCode: "561720", type: "Solicitation", responseDeadLine: null }];
  assert.deepEqual(selectSamRows(rows, NOW, []), []);
});

test("backfillCodeForDate rotates through the given codes, one per UTC day", () => {
  const start = Date.UTC(2026, 8, 23);
  const DAY = 24 * 60 * 60 * 1000;
  const codes = Array.from({ length: CODES.length }, (_, i) => backfillCodeForDate(new Date(start + i * DAY), CODES));
  assert.deepEqual([...codes].sort(), [...CODES].sort(), "each code once per cycle");
  assert.equal(backfillCodeForDate(new Date(start + CODES.length * DAY), CODES), codes[0], "then the cycle repeats");
});

test("backfillCodeForDate returns null when there are no codes", () => {
  assert.equal(backfillCodeForDate(NOW, []), null);
});

test("backfillCodeForDate is stable within a UTC day", () => {
  assert.equal(
    backfillCodeForDate(new Date(Date.UTC(2026, 8, 23, 0, 0, 1)), CODES),
    backfillCodeForDate(new Date(Date.UTC(2026, 8, 23, 23, 59, 59)), CODES)
  );
});
