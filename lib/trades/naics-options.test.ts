import { test } from "node:test";
import assert from "node:assert/strict";
import { offeredNaicsOptions, naicsOptionsWithSelected, clientTradeLabel, clientTradeIds } from "./naics-options.ts";
import type { Trade } from "./types.ts";

const JAN: Trade = {
  id: "jan",
  label: "Janitorial",
  naics: [
    { code: "561720", label: "Janitorial Services" },
    { code: "561740", label: "Carpet and Upholstery Cleaning Services" },
  ],
  nigpCodes: [],
  keywords: [],
  active: true,
  sortOrder: 1,
};
const ELEC: Trade = { ...JAN, id: "elec", label: "Electrical", naics: [{ code: "238210", label: "Electrical Contractors" }], sortOrder: 2 };
const OFF: Trade = { ...JAN, id: "off", label: "Roofing", naics: [{ code: "238160", label: "Roofing Contractors" }], active: false, sortOrder: 3 };

test("offered options are active trades' codes in sort order, labelled code: label", () => {
  assert.deepEqual(offeredNaicsOptions([ELEC, OFF, JAN]), [
    { value: "561720", label: "561720: Janitorial Services" },
    { value: "561740", label: "561740: Carpet and Upholstery Cleaning Services" },
    { value: "238210", label: "238210: Electrical Contractors" },
  ]);
});

test("a client's saved code that is no longer offered stays as an option, labelled with the code alone", () => {
  const offered = offeredNaicsOptions([JAN]);
  assert.deepEqual(naicsOptionsWithSelected(offered, ["561720", "238160"]), [
    ...offered,
    { value: "238160", label: "238160" },
  ]);
});

test("no duplicate option when the saved code is offered", () => {
  const offered = offeredNaicsOptions([JAN]);
  assert.deepEqual(naicsOptionsWithSelected(offered, ["561720"]), offered);
});

test("client trade label uses trade names, including switched-off trades, and raw codes otherwise", () => {
  assert.equal(clientTradeLabel(["561740", "561720", "238160", "999999"], [JAN, OFF]), "Janitorial, Roofing, 999999");
  assert.equal(clientTradeLabel([], [JAN]), null);
  assert.equal(clientTradeLabel(null, [JAN]), null);
});

test("client trade ids list each matching trade once", () => {
  assert.deepEqual(clientTradeIds(["561720", "561740", "238210"], [JAN, ELEC]), ["jan", "elec"]);
  assert.deepEqual(clientTradeIds(undefined, [JAN]), []);
});
