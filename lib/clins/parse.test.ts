import { test } from "node:test";
import assert from "node:assert/strict";
import { unitKind, periodIndex, periodMonths, lineKind, verifiedMonths, assignPeriodsAndPositions, assignPositions, dedupeClins, clinInQuote } from "./parse.ts";

test("units: months, years, anything else", () => {
  for (const u of ["MO", "Mo", "MOS", "Months", "month", "12 MO"]) assert.equal(unitKind(u), "month", u);
  for (const u of ["YR", "Year", "years"]) assert.equal(unitKind(u), "year", u);
  for (const u of ["EA", "JB", "HR", "Lot"]) assert.equal(unitKind(u), "other", u);
  assert.equal(unitKind(null), "other");
  assert.equal(unitKind(null, "Custodial services, 12 months"), "other", "the unit column decides, not the description");
});

test("periods from wording: option wording wins over 'Base Period' dates (Lake Tahoe)", () => {
  const all = ["0001", "0002", "1001", "1002"];
  assert.equal(periodIndex("0001", "LTBMU Janitorial Services at the Supervisors Office. Base Period 15 Oct 2026 - 30 April 2027", all), 0);
  assert.equal(periodIndex("1001", "Option Year 1 LTBMU Janitorial Services at the Supervisors Office. Base Period 1 May 2027 - 30 April 2028 (Option Line Item)", all), 1);
  assert.equal(periodIndex("30001", "Option Period Three janitorial", ["00001", "30001"]), 3);
});

test("periods from numbering when the table uses the x001 pattern (JDMTA, Crow Agency)", () => {
  const four = ["0001", "1001", "2001", "3001", "4001"];
  assert.deepEqual(four.map((c) => periodIndex(c, "Custodial Services for JDMTA", four)), [0, 1, 2, 3, 4]);
  const five = ["00001", "10001", "20001"];
  assert.deepEqual(five.map((c) => periodIndex(c, "Janitorial Services for Crow Agency Buildings", five)), [0, 1, 2]);
});

test("a plain sequence: wording decides (MVY); without wording the period is unknown", () => {
  const seq = ["00001", "00002", "00003", "00004", "00005"];
  const descs = ["Base Year MVY janitorial services", "Option Year 1 MVY janitorial", "Option Year 2 MVY", "Option Year 3 MVY", "Option Year 4 MVY"];
  assert.deepEqual(seq.map((c, i) => periodIndex(c, descs[i], seq)), [0, 1, 2, 3, 4]);
  assert.equal(periodIndex("00002", "Janitorial services", seq), null);
});

test("positions number the lines within each period by CLIN, and sort follows period then position", () => {
  const base = { description: "", quantity: 12, unit: "MO", unit_kind: "month" as const, quote: null, page: null, source_file: null, quote_status: "verified" as const, revised_by: null, unit_price_override: null };
  const out = assignPeriodsAndPositions([
    { ...base, clin: "1002", description: "Option Year 1 Meyers" },
    { ...base, clin: "0002", description: "Meyers Work Center" },
    { ...base, clin: "0001", description: "Supervisors Office" },
    { ...base, clin: "1001", description: "Option Year 1 Supervisors" },
  ]);
  assert.deepEqual(out.map((l) => [l.clin, l.period_index, l.position, l.sort]), [
    ["0001", 0, 1, 0], ["0002", 0, 2, 1], ["1001", 1, 1, 2], ["1002", 1, 2, 3],
  ]);
});

test("an amendment re-listing a CLIN wins, and says so", () => {
  const c = (clin: string, description: string) => ({ clin, description, quantity: 12, unit: "MO", quote: `${clin} ${description}`, page: 1, source_file: null });
  const out = dedupeClins([
    { file: "sol.pdf", items: [c("0001", "Old"), c("1001", "Opt 1")] },
    { file: "amd1.pdf", items: [c("0001", "New")] },
  ]);
  assert.deepEqual(out.map((l) => [l.clin, l.description, l.source_file, l.revised_by]), [
    ["0001", "New", "amd1.pdf", "amd1.pdf"],
    ["1001", "Opt 1", "sol.pdf", null],
  ]);
});

test("the quote must contain the CLIN number as a whole token", () => {
  assert.equal(clinInQuote("0001", "0001    Custodial Services for JDMTA            12     Months"), true);
  assert.equal(clinInQuote("0001", "10001  Janitorial"), false);
  assert.equal(clinInQuote("0002AA", "0002AA Carpet cleaning"), true);
});

test("the same CLIN twice in one file (a table split across pages) isn't 'revised'", () => {
  const c = (clin: string, description: string) => ({ clin, description, quantity: 12, unit: "MO", quote: clin, page: 1, source_file: null });
  const out = dedupeClins([{ file: "sol.pdf", items: [c("0001", "Custodial"), c("0001", "Custodial services")] }]);
  assert.deepEqual(out.map((l) => [l.clin, l.revised_by]), [["0001", null]]);
});

test("positions follow the stored periods (an admin-set period is kept)", () => {
  const base = { description: "Janitorial", quantity: 12, unit: "MO", unit_kind: "month" as const, quote: null, page: null, source_file: null, quote_status: "admin" as const, revised_by: null, unit_price_override: null, position: 0, sort: 0 };
  const out = assignPositions([{ ...base, clin: "00002", period_index: 1 }, { ...base, clin: "00001", period_index: 0 }]);
  assert.deepEqual(out.map((l) => [l.clin, l.period_index, l.position, l.sort]), [["00001", 0, 1, 0], ["00002", 1, 1, 1]]);
});

test("'OP1' / 'ServicesOP3' wording is an option year (Montrose); 'DEVELOP 2' isn't", () => {
  const all = ["00010", "00020", "00040"];
  assert.equal(periodIndex("00010", "BASE SWD Janitorial Services BASE", all), 0);
  assert.equal(periodIndex("00020", "SWD Janitorial Services OP1", all), 1);
  assert.equal(periodIndex("00040", "SWD Janitorial ServicesOP3", all), 3);
  assert.equal(periodIndex("00020", "DEVELOP 2 plans", all), null);
});

test("months in a period of performance, end date inclusive", () => {
  assert.equal(periodMonths("10/01/2026", "09/30/2027"), 12);
  assert.equal(periodMonths("01/01/2027", "09/30/2027"), 9);
  assert.equal(periodMonths("15 Oct 2026", "30 April 2027"), 6.5);
  assert.equal(periodMonths("10/01/2027", "9/30/2028"), 12);
  assert.equal(periodMonths("soon", "09/30/2027"), null);
  assert.equal(periodMonths("09/30/2027", "10/01/2026"), null);
});

test("a whole-period line (no quantity, no unit) with known months is a lump sum", () => {
  assert.equal(lineKind(null, null, 12), "lump");
  assert.equal(lineKind(null, null, null), "other");
  assert.equal(lineKind("MO", 12, 12), "month");
  assert.equal(lineKind("JB", 1, 12), "other");
});

test("period months only from dates that really appear in the document", () => {
  const text = "Period of Performance: 01/01/2027 to\n   09/30/2027\n 00001 Base Year MVY";
  assert.equal(verifiedMonths("01/01/2027", "09/30/2027", text), 9);
  assert.equal(verifiedMonths("01/01/2027", "12/31/2027", text), null, "an end date not in the text is not used");
  assert.equal(verifiedMonths(null, "09/30/2027", text), null);
  assert.equal(verifiedMonths("01/01/2027", "09/30/2027", null), null);
});

test("'Air Force Base' in a description isn't the base period (final review I-1)", () => {
  const four = ["0001", "1001", "2001"];
  assert.deepEqual(four.map((c) => periodIndex(c, "Custodial Services, MacDill Air Force Base", four)), [0, 1, 2]);
  const seq = ["00001", "00002"];
  assert.equal(periodIndex("00002", "Janitorial, Eglin Air Force Base", seq), null, "no period wording: unknown, not base");
  assert.equal(periodIndex("00001", "Base Year janitorial, Naval Station Mayport", seq), 0);
  assert.equal(periodIndex("00010", "BASE SWD Janitorial Services BASE", ["00010", "00020"]), 0, "Montrose still reads as base");
});

test("a whole-contract date range isn't a lump-sum period (final review I-6)", () => {
  assert.equal(lineKind(null, null, 60), "other", "10/01/2026-09/30/2031 is the whole contract, not one period");
  assert.equal(lineKind(null, null, 12.5), "lump");
  assert.equal(lineKind(null, null, 13), "other");
  assert.equal(lineKind(null, null, 0.5), "lump");
});
