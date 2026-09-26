import { test } from "node:test";
import assert from "node:assert/strict";
import { pilotPriceLine, pilotFaqPhrase, PILOT_CTA } from "./pilot-offer.ts";

test("the Pilot's price line follows the cohort toggle, never a bare 'free'", () => {
  assert.equal(pilotPriceLine(true), "Free for the first 10 clients");
  assert.equal(pilotPriceLine(false), "Pricing confirmed with you directly");
  assert.deepEqual(PILOT_CTA, { label: "Start a pilot bid", href: "/intake?package=pilot" });
});

test("the FAQ's Pilot sentence follows the same toggle (final review 5)", () => {
  assert.equal(pilotFaqPhrase(true), "Pilot is free for our first 10 clients");
  assert.equal(pilotFaqPhrase(false), "Pilot pricing is confirmed with you directly");
});
