import { test } from "node:test";
import assert from "node:assert/strict";
import { describeWithdrawResult } from "./withdraw.ts";

test("withdrawn and emailed is a clean success", () => {
  const r = describeWithdrawResult(200, { withdrawn: true, emailed: true });
  assert.equal(r.withdrawn, true);
  assert.equal(r.complete, true);
  assert.match(r.message, /client was emailed/);
});

test("withdrawn but the email failed says so and passes the error through", () => {
  const r = describeWithdrawResult(200, { withdrawn: true, emailed: false, emailError: "Resend: rate limited" });
  assert.equal(r.withdrawn, true);
  assert.equal(r.complete, false);
  assert.match(r.message, /didn't send \(Resend: rate limited\)/);
  assert.match(r.message, /directly/);
});

test("a client with no email is told to be contacted directly", () => {
  const r = describeWithdrawResult(200, { withdrawn: true, emailed: false, reason: "no_client_email" });
  assert.equal(r.complete, false);
  assert.match(r.message, /no email on file/);
});

test("a test submission withdraws without an email", () => {
  const r = describeWithdrawResult(200, { withdrawn: true, emailed: false, reason: "test_submission" });
  assert.equal(r.withdrawn, true);
  assert.match(r.message, /test submission/);
});

test("a refused or failed withdrawal is never reported as withdrawn", () => {
  const refused = describeWithdrawResult(409, { error: "Only an unfinished assigned bid can be withdrawn." });
  assert.equal(refused.withdrawn, false);
  assert.match(refused.message, /unfinished assigned bid/);
  assert.equal(describeWithdrawResult(500, null).withdrawn, false);
  assert.equal(describeWithdrawResult(0, null).withdrawn, false);
  assert.equal(describeWithdrawResult(200, {}).withdrawn, false);
});
