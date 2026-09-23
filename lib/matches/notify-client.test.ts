import { test } from "node:test";
import assert from "node:assert/strict";
import { describeNotifyResult } from "./notify-client.ts";

test("a sent email is a success", () => {
  assert.deepEqual(describeNotifyResult(200, { sent: true }), { sent: true, message: "Email sent to the client." });
});

test("a test submission is not an error, but says no email went out", () => {
  const r = describeNotifyResult(200, { sent: false, reason: "test_submission" });
  assert.equal(r.sent, false);
  assert.match(r.message, /test submission/i);
});

test("a client with no email address says so", () => {
  const r = describeNotifyResult(200, { sent: false, reason: "no_client_email" });
  assert.equal(r.sent, false);
  assert.match(r.message, /no email address/i);
});

test("a failed send passes the route's own error through", () => {
  const r = describeNotifyResult(502, { error: "Resend: domain not verified" });
  assert.equal(r.sent, false);
  assert.match(r.message, /domain not verified/);
});

test("an unreadable or empty failure still reports a failure, never success", () => {
  assert.equal(describeNotifyResult(500, null).sent, false);
  assert.equal(describeNotifyResult(200, {}).sent, false);
  assert.equal(describeNotifyResult(0, null).sent, false);
});
