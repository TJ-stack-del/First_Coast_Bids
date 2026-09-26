import { test } from "node:test";
import assert from "node:assert/strict";
import { pilotPriceLine, PILOT_CTA } from "./pilot-offer.ts";

test("the Pilot's price line follows the cohort toggle, never a bare 'free'", () => {
  assert.equal(pilotPriceLine(true), "Free for the first 10 clients");
  assert.equal(pilotPriceLine(false), "Pricing confirmed with you directly");
  assert.deepEqual(PILOT_CTA, { label: "Start a pilot bid", href: "/intake?package=pilot" });
});
