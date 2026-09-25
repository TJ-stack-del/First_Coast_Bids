import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeTradeInput, validateTrade } from "./validate.ts";
import type { Trade } from "./types.ts";

const EXISTING: Trade = {
  id: "jan",
  label: "Janitorial",
  naics: [{ code: "561720", label: "Janitorial Services" }],
  nigpCodes: ["910-39"],
  keywords: ["janitorial"],
  active: false, // inactive trades still own their codes
  sortOrder: 1,
  wdPositionCode: null,
};

function errorsOf(raw: unknown, all: Trade[] = [EXISTING]): string[] {
  const r = validateTrade(normalizeTradeInput(raw), all);
  return r.ok ? [] : r.errors;
}

test("normalises: trims, lowercases and dedupes keywords; drops empty rows", () => {
  const t = normalizeTradeInput({
    label: "  Pressure washing ",
    naics: [{ code: " 561790 ", label: " Other Services " }, { code: "", label: "" }],
    nigpCodes: [" 910-52 ", "", "910-52"],
    keywords: ["  Pressure   WASH ", "", "pressure wash"],
  });
  assert.deepEqual(t, {
    id: undefined,
    label: "Pressure washing",
    naics: [{ code: "561790", label: "Other Services" }],
    nigpCodes: ["910-52"],
    keywords: ["pressure wash"],
    active: true,
    wdPositionCode: null,
    });
});

test("a valid new trade passes", () => {
  assert.deepEqual(errorsOf({ label: "Pressure washing", keywords: ["pressure wash"] }), []);
});

test("codes typed with spaces or without the dash are rejected, naming the value", () => {
  const errs = errorsOf({ label: "X", naics: [{ code: "561 720", label: "Y" }], nigpCodes: ["91039"] });
  assert.ok(errs.includes('NAICS code "561 720" must be exactly 6 digits.'));
  assert.ok(errs.includes('NIGP code "91039" must look like 910-39.'));
});

test("a NAICS code needs a label", () => {
  assert.ok(errorsOf({ label: "X", naics: [{ code: "561790", label: "" }] }).includes("NAICS code 561790 needs a label."));
});

test("a code already in another trade is rejected, even if that trade is off", () => {
  const errs = errorsOf({ label: "Cleaning", naics: [{ code: "561720", label: "J" }], nigpCodes: ["910-39"] });
  assert.ok(errs.includes("NAICS code 561720 is already in Janitorial."));
  assert.ok(errs.includes("NIGP code 910-39 is already in Janitorial."));
});

test("editing a trade doesn't conflict with its own codes", () => {
  assert.deepEqual(errorsOf({ id: "jan", label: "Janitorial", naics: [{ code: "561720", label: "J" }] }), []);
});

test("duplicate label (any case) is rejected", () => {
  assert.ok(errorsOf({ label: "JANITORIAL", keywords: ["mop"] }).includes('A trade called "JANITORIAL" already exists.'));
});

test("a trade that can't match anything is rejected", () => {
  assert.ok(
    errorsOf({ label: "Empty" }).includes("Add at least one NAICS code, NIGP code or keyword, or this trade can't match any bid.")
  );
});

test("keywords shorter than 3 characters are rejected", () => {
  assert.ok(errorsOf({ label: "IT", keywords: ["it"] }).includes('Keyword "it" is too short. Use at least 3 characters.'));
});

test("label is required and at most 60 characters", () => {
  assert.ok(errorsOf({ label: "  ", keywords: ["mop"] }).includes("Give the trade a name."));
  assert.ok(errorsOf({ label: "x".repeat(61), keywords: ["mop"] }).includes("Keep the trade name under 60 characters."));
});

test("garbage input normalises to an empty trade instead of throwing", () => {
  assert.equal(normalizeTradeInput(null).label, "");
  assert.deepEqual(normalizeTradeInput({ naics: "nope", keywords: 5 }).naics, []);
});
test("wage-worksheet position code: 5 digits", () => {
  const ok = normalizeTradeInput({ label: "Janitorial", keywords: ["janitorial"], wdPositionCode: " 11150 " });
  assert.equal(ok.wdPositionCode, "11150");
  assert.deepEqual(validateTrade(ok, []).errors, []);
  const bad = normalizeTradeInput({ label: "Janitorial", keywords: ["janitorial"], wdPositionCode: "1115" });
  assert.ok(validateTrade(bad, []).errors.includes('Position code "1115" must be 5 digits, like 11150.'));
  const blank = normalizeTradeInput({ label: "Janitorial", keywords: ["janitorial"], wdPositionCode: "" });
  assert.equal(blank.wdPositionCode, null);
});
test("a production rate sent by an old page is ignored, not saved", () => {
  const t = normalizeTradeInput({ label: "Janitorial", keywords: ["janitorial"], productionRate: "3500" }) as Record<string, unknown>;
  assert.equal("productionRate" in t, false);
});
