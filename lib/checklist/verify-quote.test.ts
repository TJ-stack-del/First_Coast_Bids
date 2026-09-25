import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeForMatch, verifyQuote } from "./verify-quote.ts";
import { defaultOwner } from "./types.ts";

const PAGE =
  "Offerors shall complete blocks 12, 17a, 23, 24, and 30 of the SF 1449.\n" +
  "All sub-\ncontractors must be identified. The ofﬁce of the Contracting Ofﬁcer will\n" +
  "not accept “late” offers. Pre­award survey may apply.";

test("an exact quote is verified", () => {
  assert.equal(verifyQuote("Offerors shall complete blocks 12, 17a, 23, 24, and 30 of the SF 1449.", PAGE), "verified");
});

test("line breaks, ligatures, curly quotes and soft hyphens don't break a real quote", () => {
  assert.equal(verifyQuote("All subcontractors must be identified.", PAGE), "verified");
  assert.equal(verifyQuote("All sub-contractors must be identified.", PAGE), "verified");
  assert.equal(verifyQuote("The office of the Contracting Officer will not accept \"late\" offers.", PAGE), "verified");
  assert.equal(verifyQuote("Preaward survey may apply.", PAGE), "verified");
});

test("a quote that isn't in the document is not found", () => {
  assert.equal(verifyQuote("Offerors shall submit a bid bond of 5 percent.", PAGE), "not_found");
});

test("a very short quote can't be verified", () => {
  assert.equal(verifyQuote("SF", PAGE), "not_found");
});

test("a file with no readable text is unreadable, not 'not found'", () => {
  assert.equal(verifyQuote("anything at all here", null), "unreadable");
  assert.equal(verifyQuote("anything at all here", "   \n "), "unreadable");
});

test("normalizeForMatch lowercases and collapses whitespace", () => {
  assert.equal(normalizeForMatch("  Hello\n\n  World  "), "hello world");
});

test("owners default by kind", () => {
  assert.equal(defaultOwner("form"), "client");
  assert.equal(defaultOwner("sworn_statement"), "client");
  assert.equal(defaultOwner("wage_determination"), "admin");
  assert.equal(defaultOwner("submission_rule"), "admin");
});
