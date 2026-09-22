import { test } from "node:test";
import assert from "node:assert/strict";
import { getSamStatusMessage } from "./status-message.ts";

test("getSamStatusMessage returns null when the client has no SAM UEI on file", () => {
  assert.equal(
    getSamStatusMessage({ sam_uei: null, sam_registration_status: null, sam_registration_expires_at: null }),
    null
  );
});

test("getSamStatusMessage returns the not-active message when status is not active, even if expires_at is within 30 days", () => {
  const nearFuture = new Date();
  nearFuture.setDate(nearFuture.getDate() + 10);
  const expiresAt = nearFuture.toISOString().slice(0, 10);

  const message = getSamStatusMessage({
    sam_uei: "ABC123XYZ01",
    sam_registration_status: "inactive",
    sam_registration_expires_at: expiresAt,
  });

  assert.match(message ?? "", /not active/);
  assert.doesNotMatch(message ?? "", /expires/);
});

test("getSamStatusMessage returns the expiring-soon message when status is active and expiring within 30 days", () => {
  const nearFuture = new Date();
  nearFuture.setDate(nearFuture.getDate() + 10);
  const expiresAt = nearFuture.toISOString().slice(0, 10);

  const message = getSamStatusMessage({
    sam_uei: "ABC123XYZ01",
    sam_registration_status: "active",
    sam_registration_expires_at: expiresAt,
  });

  assert.match(message ?? "", /expires/);
});

test("getSamStatusMessage returns null when status is active and not expiring soon", () => {
  const farFuture = new Date();
  farFuture.setDate(farFuture.getDate() + 200);
  const expiresAt = farFuture.toISOString().slice(0, 10);

  assert.equal(
    getSamStatusMessage({
      sam_uei: "ABC123XYZ01",
      sam_registration_status: "active",
      sam_registration_expires_at: expiresAt,
    }),
    null
  );
});
