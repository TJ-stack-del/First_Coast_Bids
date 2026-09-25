import { test } from "node:test";
import assert from "node:assert/strict";
import { detectItems, identifierKey } from "./detectors.ts";

function run(...pages: string[]) {
  return detectItems([{ fileName: "rfq.pdf", pages }]);
}
const keys = (items: { key: string | null }[]) => items.map((i) => i.key).sort();

test("standard forms are detected with page and verbatim line", () => {
  const items = run("Cover page", "Offerors must complete blocks 12, 17a and 30 of the SF 1449 and return it.");
  const sf = items.find((i) => i.key === "form:sf-1449")!;
  assert.equal(sf.kind, "form");
  assert.equal(sf.federal, true);
  assert.equal(sf.page, 2);
  assert.equal(sf.source_file, "rfq.pdf");
  assert.equal(sf.quote, "Offerors must complete blocks 12, 17a and 30 of the SF 1449 and return it.");
  assert.equal(sf.suggested_owner, "client");
});

test("Standard Form spelled out and SF-33 / SF-1442 are detected", () => {
  assert.deepEqual(keys(run("Complete Standard Form 33.", "Use SF-1442 for construction.")), ["form:sf-1442", "form:sf-33"]);
});

test("square footage written as SF is not a form", () => {
  assert.deepEqual(run("Clean 10,000 SF 30 days after award.", "Area: 2,500 SF 18 rooms."), []);
});

test("amendments and addenda each get their own acknowledgment", () => {
  const items = run("Acknowledge Amendment 0001 and Amendment No. 0002 on SF-30.", "See Addendum No. 3.");
  assert.deepEqual(keys(items), ["addendum:3", "amendment:0001", "amendment:0002", "form:sf-30"]);
  assert.equal(items.find((i) => i.key === "amendment:0001")!.kind, "amendment");
});

test("a general 'acknowledge all addenda' rule is detected", () => {
  assert.deepEqual(keys(run("Bidders shall acknowledge receipt of all addenda on the bid form.")), ["addendum:ack-all"]);
});

test("a general 'acknowledge amendments' rule is detected too (real FA252126QB143 wording)", () => {
  assert.deepEqual(
    keys(run("(k) The offeror must acknowledge receipt of amendments to the solicitation, if applicable.")),
    ["addendum:ack-all"]
  );
});

test("wage determinations with and without revision", () => {
  const a = run("The Service Contract Act applies. WD 2015-4523 (Rev.-27) is attached.");
  assert.equal(a[0].key, "wd:2015-4523");
  assert.match(a[0].label, /2015-4523 \(Rev\. 27\)/);
  assert.equal(a[0].suggested_owner, "admin");
  const b = run("Wage Determination No. 2015-4523 applies.");
  assert.equal(b[0].key, "wd:2015-4523");
});

test("only FAR provisions that need bidder action are detected", () => {
  const items = run("52.212-3 Offeror Representations and Certifications. 52.212-4 Contract Terms. 52.204-26 applies.");
  assert.deepEqual(keys(items), ["far:52.204-26", "far:52.212-3"]);
  assert.ok(items.every((i) => i.federal && i.kind === "far_provision"));
});

test("Florida sworn statements are detected, once each", () => {
  const items = run(
    "Submit the Public Entity Crimes sworn statement.",
    "Drug-Free Workplace form required. Also the Drug Free Workplace certification."
  );
  assert.deepEqual(keys(items), ["sworn:drug-free-workplace", "sworn:public-entity-crimes"]);
  assert.ok(items.every((i) => i.kind === "sworn_statement" && !i.federal));
});

test("SAM registration requirement is detected", () => {
  const items = run("Offerors must be registered in the System for Award Management (SAM) at time of offer.");
  assert.equal(items[0].key, "sam:registration");
  assert.equal(items[0].suggested_owner, "admin");
});

test("unreadable files and empty input yield nothing", () => {
  assert.deepEqual(detectItems([{ fileName: "scan.pdf", pages: null }]), []);
  assert.deepEqual(detectItems([]), []);
});

test("identifierKey finds the same keys in free text", () => {
  assert.equal(identifierKey("Sign the SF-1449, block 30"), "form:sf-1449");
  assert.equal(identifierKey("Price per WD 2015-4523"), "wd:2015-4523");
  assert.equal(identifierKey("Complete FAR 52.212-3"), "far:52.212-3");
  assert.equal(identifierKey("Acknowledge Amendment 0002"), "amendment:0002");
  assert.equal(identifierKey("Provide a bid bond"), null);
});
