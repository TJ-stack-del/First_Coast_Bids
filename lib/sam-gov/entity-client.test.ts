import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEntityRegistrationResponse } from "./entity-client.ts";

test("parseEntityRegistrationResponse returns found:false when the entity data array is empty", () => {
  const result = parseEntityRegistrationResponse({ entityData: [] });
  assert.deepEqual(result, { found: false });
});

test("parseEntityRegistrationResponse returns active status and expiration date when the entity is found and active", () => {
  const result = parseEntityRegistrationResponse({
    entityData: [
      {
        entityRegistration: {
          registrationStatus: "Active",
          registrationExpirationDate: "2027-03-15",
        },
      },
    ],
  });
  assert.deepEqual(result, { found: true, status: "active", expiresAt: "2027-03-15" });
});

test("parseEntityRegistrationResponse returns inactive status when registrationStatus is not \"Active\"", () => {
  const result = parseEntityRegistrationResponse({
    entityData: [
      {
        entityRegistration: {
          registrationStatus: "Expired",
          registrationExpirationDate: "2025-01-01",
        },
      },
    ],
  });
  assert.deepEqual(result, { found: true, status: "inactive", expiresAt: "2025-01-01" });
});
