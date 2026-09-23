import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildSamDailyParams,
  buildSamBackfillParams,
  selectSamRows,
  formatSamDate,
  SAM_NAICS_CODES,
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

test("selectSamRows keeps only our trade codes that are biddable and still open", () => {
  const rows = [
    { id: "keep", naicsCode: "561720", type: "Solicitation", responseDeadLine: "2026-10-01T12:00:00-04:00" },
    { id: "keep-no-deadline", naicsCode: "238210", type: "Presolicitation", responseDeadLine: null },
    { id: "other-trade", naicsCode: "336411", type: "Solicitation", responseDeadLine: "2026-10-01T12:00:00-04:00" },
    { id: "no-naics", naicsCode: null, type: "Solicitation", responseDeadLine: "2026-10-01T12:00:00-04:00" },
    { id: "award", naicsCode: "561720", type: "Award Notice", responseDeadLine: "2026-10-01T12:00:00-04:00" },
    { id: "closed", naicsCode: "561720", type: "Solicitation", responseDeadLine: "2026-09-01T12:00:00-04:00" },
  ];
  assert.deepEqual(
    selectSamRows(rows, NOW).map((r) => r.id),
    ["keep", "keep-no-deadline"]
  );
});

test("all 11 trade codes are covered", () => {
  assert.equal(SAM_NAICS_CODES.length, 11);
  assert.equal(new Set(SAM_NAICS_CODES).size, 11);
});
