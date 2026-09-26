import { test } from "node:test";
import assert from "node:assert/strict";
import { getRequiredDeliverableTypes, isLeanPackage } from "./package-routing.ts";

test("a full package with CLINs adds the Rate sheet; lean is unchanged", () => {
  assert.deepEqual([...getRequiredDeliverableTypes("full", true)], ["capability_statement", "compliance_matrix", "technical_narrative", "rate_sheet"]);
  assert.deepEqual([...getRequiredDeliverableTypes("full")], ["capability_statement", "compliance_matrix", "technical_narrative"]);
  assert.deepEqual([...getRequiredDeliverableTypes("lean", true)], ["rate_sheet", "executive_cover", "certificate_of_insurance"]);
});

test("a federal bid's Rate sheet doesn't flip it into the lean package", () => {
  assert.equal(isLeanPackage(["rate_sheet"], true), false);
  assert.equal(isLeanPackage(["rate_sheet"], false), true);
  assert.equal(isLeanPackage(["executive_cover"], true), true);
  assert.equal(isLeanPackage(["capability_statement"], false), false);
});
