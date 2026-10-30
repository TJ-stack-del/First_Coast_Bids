import { test } from "node:test";
import assert from "node:assert/strict";
import { readBid, quoteAt } from "./read.ts";
import { SAMPLE_BID_PAGES } from "./sample-bid.ts";

const keys = (pages: string[]) => readBid(pages).items.map((i) => i.key);

test("the sample bid reads as a full checklist, deal-breakers first", () => {
  const { items, pagesRead } = readBid(SAMPLE_BID_PAGES);
  assert.equal(pagesRead, 3);
  assert.deepEqual(
    items.map((i) => i.key),
    [
      "deal:deadline",
      "deal:site-visit",
      "ref:bid-bond",
      "sworn:public-entity-crimes",
      "sworn:drug-free-workplace",
      "sworn:e-verify",
      "addendum:ack-all",
      "addendum:1",
      "ref:performance-payment-bond",
      "ins:general-liability",
      "ins:workers-comp",
      "ref:background-check",
    ]
  );
  assert.ok(items.slice(0, 3).every((i) => i.group === "deal_breaker" && i.why));
});

test("every quote is the bid's own words, on the page it cites", () => {
  for (const item of readBid(SAMPLE_BID_PAGES).items) {
    const text = SAMPLE_BID_PAGES[item.page - 1].replace(/\s+/g, " ");
    assert.ok(text.includes(item.quote.replace(/^…|…$/g, "")), `${item.key}: "${item.quote}" not on page ${item.page}`);
  }
});

test("deadline takes the date in the deadline sentence, not the site-visit date", () => {
  const deadline = readBid(SAMPLE_BID_PAGES).items.find((i) => i.key === "deal:deadline")!;
  assert.equal(deadline.label, "Deadline: November 18, 2026");
  assert.equal(deadline.page, 1);
});

test("the deadline is the bid's due date, not the questions deadline listed above it", () => {
  const cover = "Questions Deadline   Sept 22, 2026, 5:00 PM\nProposal Due Date   Oct 6, 2026, 3:00 PM local time\n";
  const deadline = readBid([cover]).items.find((i) => i.key === "deal:deadline")!;
  assert.equal(deadline.label, "Deadline: Oct 6, 2026");
  assert.equal(deadline.quote, "Proposal Due Date Oct 6, 2026, 3:00 PM local time");
});

test("no deadline beats a wrong one", () => {
  assert.deepEqual(keys(["Questions are due by October 1, 2026.", "Pre-bid conference on 10/02/2026, attendance optional."]), []);
});

test("workers' comp at statutory limits counts as a stated minimum", () => {
  const [wc] = readBid(["• Current Workers' Compensation coverage at Florida statutory limits"]).items;
  assert.equal(wc.label, "Workers' compensation insurance: statutory limits");
});

test("an employer's-liability figure is not the workers' comp amount", () => {
  const items = readBid(SAMPLE_BID_PAGES).items;
  assert.equal(items.find((i) => i.key === "ins:workers-comp")!.label, "Workers' compensation insurance: statutory limits");
  assert.equal(items.find((i) => i.key === "ins:general-liability")!.label, "General liability insurance: $1,000,000");
});

test("insurance needs a stated amount in the same sentence", () => {
  assert.deepEqual(keys(["The contractor shall carry general liability insurance acceptable to the County."]), []);
  const [gl] = readBid(["Commercial general liability of not less than $2,000,000 per occurrence is required."]).items;
  assert.equal(gl.label, "General liability insurance: $2,000,000");
});

test("an optional walkthrough is not a mandatory site visit", () => {
  assert.deepEqual(keys(["An optional site walkthrough is available on request."]), []);
});

test("wage language shows once, and not when a wage determination number already does", () => {
  assert.deepEqual(keys(["Prevailing wage rates apply.", "Davis-Bacon applies."]), ["money:wage"]);
  assert.deepEqual(keys(["Wage Determination No. 2015-4523 (Rev. 24) applies. Service Contract Act applies."]), ["wd:2015-4523:r24"]);
});

test("loose trade words don't become requirements", () => {
  assert.deepEqual(keys(["Do not unplug electrical equipment. Lawn care near the clinic entrance is by others."]), []);
});

test("a blank bid reads as nothing found", () => {
  assert.deepEqual(readBid(["", "   "]).items, []);
});

test("quoteAt keeps the sentence and trims a run-on page around the match", () => {
  assert.equal(quoteAt("First. The bid bond is 5%. Last.", 11, 8), "The bid bond is 5%.");
  const runOn = "word ".repeat(200) + "MATCH " + "word ".repeat(200);
  const q = quoteAt(runOn, runOn.indexOf("MATCH"), 5);
  assert.ok(q.length <= 242 && q.includes("MATCH") && q.startsWith("…") && q.endsWith("…"));
});
