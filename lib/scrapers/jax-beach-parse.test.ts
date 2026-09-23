import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseJaxBeachDetail,
  isPlaceholderListing,
  extractSolicitation,
  extractDeadline,
  isClosedToProposals,
} from "./jax-beach-parse.ts";

// Flattened text of real detail pages, captured 2026-09-23.
const JANITORIAL =
  "HomeBid Postings Print Bid Number: OpenGov Bid Title: OpenGov Procurement Platform Category: RFP's Status: Open " +
  "Description: REQUEST FOR PROPOSALSRFP-2026-002-Citywide Janitorial ServicesThe City of Jacksonville Beach will " +
  "receive electronic proposals through the City’s OpenGov Procurement portal until (September 16, 2026 2:00 p.m.). " +
  "Interested firms may obtain the complete solicitation through the City’s OpenGov Procurement Portal. " +
  "Publication Date/Time: 8/12/2026 10:00 AM Closing Date/Time: Open Until Contracted Return To Main Bid Postings Page";

const ENGINEERING =
  "Bid Number: 03-2526 Bid Title: Continuing Professional Engineering Services Category: RFQ's Status: Open " +
  "Additional Status Information: Pending Council Award Bid Recipient: Public Works Description: The City of " +
  "Jacksonville Beach is seeking submittal of qualifications from Engineering firms. Publication Date/Time: " +
  "7/22/2026 7:30 AM Publication Information: The Financial News & Daily Record / City Website Closing Date/Time: " +
  "Open Until Contracted Submittal Information: Response to be delivered to 1460C Shetter Avenue";

test("reads the labelled fields of a detail page", () => {
  const d = parseJaxBeachDetail(ENGINEERING);
  assert.equal(d.title, "Continuing Professional Engineering Services");
  assert.equal(d.bidNumber, "03-2526");
  assert.equal(d.additionalStatus, "Pending Council Award");
  assert.equal(d.closing, "Open Until Contracted");
  assert.match(d.description ?? "", /^The City of Jacksonville Beach is seeking/);
});

test("a page with no Additional Status field doesn't borrow the next field's text", () => {
  const d = parseJaxBeachDetail(JANITORIAL);
  assert.equal(d.additionalStatus, null);
  assert.equal(d.title, "OpenGov Procurement Platform");
});

test("recognises a portal-placeholder listing, not real titles", () => {
  assert.equal(isPlaceholderListing("OpenGov Procurement Platform", "OpenGov"), true);
  assert.equal(isPlaceholderListing("Continuing Professional Engineering Services", "03-2526"), false);
});

test("recovers the real solicitation number and title from the description", () => {
  const d = parseJaxBeachDetail(JANITORIAL);
  assert.deepEqual(extractSolicitation(d.description), {
    number: "RFP-2026-002",
    title: "Citywide Janitorial Services",
  });
  assert.equal(extractSolicitation("No solicitation number here."), null);
});

test("finds the deadline in the description when Closing says Open Until Contracted", () => {
  const d = parseJaxBeachDetail(JANITORIAL);
  assert.equal(extractDeadline(d), "2026-09-16T14:00:00.000Z");
});

test("prefers a real Closing Date/Time when the city fills one in", () => {
  assert.equal(
    extractDeadline({ closing: "10/7/2026 2:00 PM", description: "until (September 16, 2026 2:00 p.m.)" }),
    "2026-10-07T14:00:00.000Z"
  );
});

test("never guesses a deadline", () => {
  assert.equal(extractDeadline({ closing: "Open Until Contracted", description: "No date here." }), null);
  assert.equal(extractDeadline({ closing: null, description: "until (Smarch 3, 2026)" }), null);
  assert.equal(extractDeadline({ closing: "2/31/2026", description: null }), null);
});

test("Pending Council Award and similar mean proposals are closed", () => {
  assert.equal(isClosedToProposals("Pending Council Award"), true);
  assert.equal(isClosedToProposals("Awarded"), true);
  assert.equal(isClosedToProposals("Cancelled"), true);
  assert.equal(isClosedToProposals(null), false);
  assert.equal(isClosedToProposals("Addendum 2 issued"), false);
});
