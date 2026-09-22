import { test } from "node:test";
import assert from "node:assert/strict";
import { isSamRegistrationExpiringSoon } from "./expiration-warning.ts";

test("isSamRegistrationExpiringSoon returns false when there is no expiration date on file", () => {
  assert.equal(isSamRegistrationExpiringSoon(null, new Date("2026-09-20")), false);
});

test("isSamRegistrationExpiringSoon returns true when the expiration date is within 30 days", () => {
  assert.equal(isSamRegistrationExpiringSoon("2026-10-10", new Date("2026-09-20")), true);
});

test("isSamRegistrationExpiringSoon returns false when the expiration date is more than 30 days out", () => {
  assert.equal(isSamRegistrationExpiringSoon("2027-01-01", new Date("2026-09-20")), false);
});

test("isSamRegistrationExpiringSoon returns false when the expiration date has already passed", () => {
  assert.equal(isSamRegistrationExpiringSoon("2026-01-01", new Date("2026-09-20")), false);
});
