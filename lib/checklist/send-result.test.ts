import { test } from "node:test";
import assert from "node:assert/strict";
import { describeSendResult } from "./send-result.ts";

test("sent reports the count", () => {
  assert.deepEqual(describeSendResult(200, { sent: true, count: 3 }), { sent: true, message: "Sent the client their list (3 items)." });
  assert.equal(describeSendResult(200, { sent: true, count: 1 }).message, "Sent the client their list (1 item).");
});
test("known reasons read plainly", () => {
  assert.match(describeSendResult(200, { sent: false, reason: "nothing_new" }).message, /nothing new/i);
  assert.match(describeSendResult(200, { sent: false, reason: "no_client_email" }).message, /no email address/i);
  assert.match(describeSendResult(200, { sent: false, reason: "test_submission" }).message, /test submission/i);
});
test("failures are never reported as sent", () => {
  const r = describeSendResult(502, { error: "Resend: rate limited" });
  assert.equal(r.sent, false);
  assert.match(r.message, /rate limited/);
  assert.equal(describeSendResult(0, null).sent, false);
});
