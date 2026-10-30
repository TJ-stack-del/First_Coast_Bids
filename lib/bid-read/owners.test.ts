import { test } from "node:test";
import assert from "node:assert/strict";
import { ownerFor, summarise } from "./owners.ts";
import { readBid } from "./read.ts";
import { SAMPLE_BID_PAGES } from "./sample-bid.ts";

test("only the client can attend, arrange a bond, screen staff or send a certificate", () => {
  for (const key of ["deal:site-visit", "ref:bid-bond", "ref:performance-payment-bond", "ref:background-check", "ins:general-liability"]) {
    assert.equal(ownerFor({ key }).who, "you", key);
  }
});

test("forms are filled in by us and signed by the client", () => {
  for (const key of ["sworn:public-entity-crimes", "form:sf-1449", "far:52.212-3", "addendum:1", "addendum:ack-all"]) {
    assert.equal(ownerFor({ key }).who, "we", key);
    assert.equal(ownerFor({ key }).task, "Fill it in for you to sign", key);
  }
});

test("every item the sample bid turns up has an owner and a task", () => {
  const owned = readBid(SAMPLE_BID_PAGES).items.map(ownerFor);
  assert.ok(owned.every((o) => o.task.length > 0));
  assert.deepEqual(
    owned.reduce((n, o) => ({ ...n, [o.who]: (n[o.who] ?? 0) + 1 }), {} as Record<string, number>),
    { we: 6, you: 6 }
  );
});

test("summaries list each job once, only for what the bid contains", () => {
  const items = readBid(SAMPLE_BID_PAGES).items;
  assert.equal(summarise(items, "we"), "track the deadline and fill in the forms for you to sign");
  assert.equal(summarise(items, "you"), "attend the site visit, get the bonds, send insurance certificates, and screen your staff");
  assert.equal(summarise([{ key: "sworn:e-verify" }], "you"), "");
});
