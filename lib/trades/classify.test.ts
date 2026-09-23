import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyOpportunity, keywordMatches, offeredNaicsCodes } from "./classify.ts";
import type { Trade } from "./types.ts";

function trade(p: Partial<Trade> & { id: string }): Trade {
  return { label: p.id, naics: [], nigpCodes: [], keywords: [], active: true, sortOrder: 0, ...p };
}

const JANITORIAL = trade({
  id: "jan",
  sortOrder: 1,
  naics: [{ code: "561720", label: "Janitorial Services" }],
  nigpCodes: ["910-39"],
  keywords: ["janitorial", "custodial"],
});
const HVAC = trade({
  id: "hvac",
  sortOrder: 2,
  naics: [{ code: "238220", label: "Plumbing, Heating, and Air-Conditioning Contractors" }],
  keywords: ["hvac", "boiler"],
});
const IT = trade({ id: "it", sortOrder: 3, keywords: ["it support", "a/c", "c++"] });
const ALL = [HVAC, IT, JANITORIAL]; // deliberately not in sort order

test("an exact NAICS code wins", () => {
  assert.equal(classifyOpportunity({ title: "Annual contract", naicsCode: "238220" }, ALL), "hvac");
});

test("codes beat keywords, even a keyword hit in an earlier trade", () => {
  // Title says "janitorial" (trade 1) but the code is HVAC's (trade 2).
  assert.equal(classifyOpportunity({ title: "Janitorial boiler room", naicsCode: "238220" }, ALL), "hvac");
});

test("NIGP codes match when there's no NAICS match", () => {
  assert.equal(classifyOpportunity({ title: "Services", nigpCodes: ["999-99", "910-39"] }, ALL), "jan");
});

test("title keywords match at the start of a word", () => {
  assert.equal(classifyOpportunity({ title: "Citywide Janitorial Services" }, ALL), "jan");
  assert.equal(classifyOpportunity({ title: "Boilers PM & Testing" }, ALL), "hvac");
});

test("a keyword inside another word does not match", () => {
  assert.equal(keywordMatches("Transit Support Services", "it support"), false);
  assert.equal(classifyOpportunity({ title: "Transit Support Services" }, ALL), null);
});

test("keywords with regex characters match literally and never throw", () => {
  assert.equal(keywordMatches("A/C unit replacement", "a/c"), true);
  assert.equal(keywordMatches("C++ developer", "c++"), true);
  assert.equal(keywordMatches("abc", "(("), false);
});

test("first trade in sort order wins when two keywords match", () => {
  assert.equal(classifyOpportunity({ title: "Custodial and HVAC services" }, ALL), "jan");
});

test("inactive trades are ignored", () => {
  const off = { ...JANITORIAL, active: false };
  assert.equal(classifyOpportunity({ title: "Janitorial", naicsCode: "561720" }, [off, HVAC]), null);
});

test("no match means Other trades (null)", () => {
  assert.equal(classifyOpportunity({ title: "Bridge Replacement" }, ALL), null);
  assert.equal(classifyOpportunity({ title: "Anything" }, []), null);
});

test("offeredNaicsCodes lists active trades' codes once, in sort order", () => {
  const dup = trade({ id: "x", sortOrder: 9, naics: [{ code: "561720", label: "dup" }] });
  const off = trade({ id: "off", active: false, naics: [{ code: "111111", label: "off" }] });
  assert.deepEqual(offeredNaicsCodes([HVAC, off, JANITORIAL, dup]), ["561720", "238220"]);
});
