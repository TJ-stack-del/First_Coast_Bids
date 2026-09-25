import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseWd } from "./parse-wd.ts";

const FL = readFileSync(new URL("./fixtures/wd-2015-4539-r32.txt", import.meta.url), "utf8");
const GA = readFileSync(new URL("./fixtures/wd-2015-4523-r36.txt", import.meta.url), "utf8");

test("the Jacksonville-area WD parses completely", () => {
  const { ok, wd, missing } = parseWd(FL);
  assert.equal(ok, true, missing.join(", "));
  assert.equal(wd!.number, "2015-4539");
  assert.equal(wd!.revision, 32);
  assert.equal(wd!.revisedOn, "8/27/2026");
  assert.equal(wd!.state, "Florida");
  assert.equal(wd!.area, "Florida Counties of Baker, Clay, Duval, Nassau and Saint Johns");
  // 360, confirmed independently (387 code lines minus 27 section headings).
  // A dozen titles wrap onto a second line; the plan's 346 came from a
  // pattern too strict to see them.
  assert.equal(wd!.positions.length, 360);
  assert.deepEqual(wd!.positions.find((p) => p.code === "15010"), {
    code: "15010", title: "Aircrew Training Devices Instructor (Non-Rated)", rate: 33.88, footnote: null,
  });
  assert.deepEqual(wd!.positions.find((p) => p.code === "11150"), { code: "11150", title: "Janitor", rate: 17.04, footnote: null });
  assert.equal(wd!.positions.find((p) => p.code === "11210")!.rate, 17.94);
  assert.equal(wd!.hwPerHour, 5.92);
  assert.equal(wd!.hwEo13706PerHour, 5.42);
  assert.equal(wd!.vacationWeeks, 2);
  assert.equal(wd!.holidays, 11);
  assert.equal(wd!.eo13658Min, 13.65);
  assert.equal(wd!.paidSickLeave, true);
});

test("the Georgia WD parses, with its own rates", () => {
  const { ok, wd } = parseWd(GA);
  assert.equal(ok, true);
  assert.equal(wd!.number, "2015-4523");
  assert.equal(wd!.positions.find((p) => p.code === "11150")!.rate, 14.3);
  assert.equal(wd!.positions.length, 361, "387 code lines minus 26 headings");
  assert.equal(wd!.area, "Georgia Counties of Appling, Bacon, Jeff Davis and Wayne");
});

test("section headings without a rate are not positions", () => {
  const { wd } = parseWd(FL);
  assert.equal(wd!.positions.some((p) => p.code === "11000"), false);
});

test("footnote columns and asterisks don't lose the rate", () => {
  const text = FL.replace(/^11150 - Janitor\s+17\.04$/m, "11150 - Janitor                                          1     17.04*");
  const { wd } = parseWd(text);
  assert.deepEqual(wd!.positions.find((p) => p.code === "11150"), { code: "11150", title: "Janitor", rate: 17.04, footnote: "1" });
});

test("a truncated WD fails validation and names what's missing", () => {
  const { ok, wd, missing } = parseWd(FL.slice(0, 2000));
  assert.equal(ok, false);
  assert.equal(wd, null);
  assert.ok(missing.includes("health & welfare rate"));
});
