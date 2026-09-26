import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyLink } from "./link-check.ts";

test("a working link is ok; a trailing-slash or http→https redirect is still ok", () => {
  assert.equal(classifyLink({ url: "https://www.jea.com/procurement/", status: 200, finalUrl: "https://www.jea.com/procurement/" }), "ok");
  assert.equal(classifyLink({ url: "https://www.jea.com/procurement/", status: 200, finalUrl: "https://www.jea.com/procurement" }), "ok");
});

test("a known script-blocking site's 403 is reported, not a failure (final review 6)", () => {
  assert.equal(classifyLink({ url: "https://www.dol.gov/agencies/whd/government-contracts/service-contracts", status: 403, finalUrl: null }), "blocked");
  assert.equal(classifyLink({ url: "https://www.claycountygov.com/government/purchasing/formal-bid-solicitations", status: 403, finalUrl: null }), "blocked");
  assert.equal(classifyLink({ url: "https://www.example.gov/x", status: 403, finalUrl: null }), "bad");
});

test("a page that now redirects somewhere else (a soft 404) is flagged as moved", () => {
  assert.equal(classifyLink({ url: "https://www.sjcfl.us/active-bids/", status: 200, finalUrl: "https://www.sjcfl.us/" }), "moved");
});

test("errors and 4xx/5xx are bad", () => {
  assert.equal(classifyLink({ url: "https://a.gov/x", status: 404, finalUrl: "https://a.gov/x" }), "bad");
  assert.equal(classifyLink({ url: "https://a.gov/x", status: null, finalUrl: null }), "bad");
});

test("a known script-blocking site that times out is blocked, not bad", () => {
  assert.equal(classifyLink({ url: "https://www.myfloridacfo.com/division/wc/employer/coverage-requirements", status: null, finalUrl: null }), "blocked");
});
