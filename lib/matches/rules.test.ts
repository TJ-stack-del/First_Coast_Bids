import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isBiddableSamNoticeType,
  isPastDeadline,
  shouldKeepSamNotice,
  expiryCutoff,
  matchSource,
  parseMatchFilters,
  sanitizeSearch,
  SAM_BIDDABLE_PTYPES,
} from "./rules.ts";

const NOW = new Date("2026-09-22T15:00:00Z");

test("SAM ptype codes are exactly solicitation, combined, presolicitation, sources sought", () => {
  assert.deepEqual([...SAM_BIDDABLE_PTYPES].sort(), ["k", "o", "p", "r"]);
});

test("isBiddableSamNoticeType keeps the four biddable types (exact SAM.gov strings)", () => {
  for (const t of ["Solicitation", "Combined Synopsis/Solicitation", "Presolicitation", "Sources Sought"]) {
    assert.equal(isBiddableSamNoticeType(t), true, t);
  }
});

test("isBiddableSamNoticeType rejects award notices, justifications, and missing types", () => {
  for (const t of ["Award Notice", "Justification", "Sale of Surplus Property", "Special Notice", "Intent to Bundle Requirements (DoD-Funded)", "", undefined, null]) {
    assert.equal(isBiddableSamNoticeType(t), false, String(t));
  }
});

test("isPastDeadline compares real instants, honoring the timezone offset", () => {
  // 10:00 in UTC-5 is 15:00Z: exactly now, so not yet past
  assert.equal(isPastDeadline("2026-09-22T10:00:00-05:00", NOW), false);
  assert.equal(isPastDeadline("2026-09-22T09:59:00-05:00", NOW), true);
  assert.equal(isPastDeadline("2026-10-01T12:00:00-04:00", NOW), false);
});

test("isPastDeadline treats a missing or unparseable deadline as not past", () => {
  assert.equal(isPastDeadline(null, NOW), false);
  assert.equal(isPastDeadline(undefined, NOW), false);
  assert.equal(isPastDeadline("", NOW), false);
  assert.equal(isPastDeadline("not a date", NOW), false);
});

test("shouldKeepSamNotice keeps a biddable notice with a future or missing deadline", () => {
  assert.equal(shouldKeepSamNotice({ type: "Solicitation", responseDeadLine: "2026-10-01T12:00:00-04:00" }, NOW), true);
  assert.equal(shouldKeepSamNotice({ type: "Presolicitation", responseDeadLine: null }, NOW), true);
});

test("shouldKeepSamNotice drops non-biddable types even with a future deadline", () => {
  assert.equal(shouldKeepSamNotice({ type: "Award Notice", responseDeadLine: "2026-10-01T12:00:00-04:00" }, NOW), false);
});

test("shouldKeepSamNotice drops a biddable notice whose deadline already passed", () => {
  assert.equal(shouldKeepSamNotice({ type: "Solicitation", responseDeadLine: "2026-09-01T12:00:00-04:00" }, NOW), false);
});

test("expiryCutoff is 24 hours before now, so a date-only deadline never expires early", () => {
  assert.equal(expiryCutoff(NOW), "2026-09-21T15:00:00.000Z");
  // A bid due "Sept 22" stored as midnight UTC is still live all day on the 22nd (US time):
  const dateOnlyDue = new Date("2026-09-22T00:00:00Z");
  assert.ok(dateOnlyDue.toISOString() > expiryCutoff(NOW), "must not be expired yet");
});

test("matchSource classifies SAM.gov, local Jacksonville sources, and everything else", () => {
  assert.equal(matchSource("https://sam.gov/opp/abc123/view"), "sam");
  assert.equal(matchSource("https://www.flyjacksonville.com/content.aspx?id=1"), "local");
  assert.equal(matchSource("https://www.jacksonville.gov/getContentAsset/x.pdf"), "local");
  assert.equal(matchSource("https://eims.fa.us2.oraclecloud.com/fscmUI/faces/NegotiationAbstracts"), "local");
  assert.equal(matchSource("https://example.com/bid"), "other");
  assert.equal(matchSource(null), "other");
  assert.equal(matchSource("not a url"), "other");
});

test("parseMatchFilters defaults to live matches, soonest deadline first, page 1", () => {
  assert.deepEqual(parseMatchFilters({}), {
    view: "trades",
    status: "new",
    deadline: "any",
    source: "all",
    suggested: false,
    q: "",
    sort: "deadline",
    page: 1,
  });
});

test("parseMatchFilters accepts valid values and ignores unknown ones", () => {
  assert.deepEqual(
    parseMatchFilters({ status: "expired", deadline: "7", source: "sam", suggested: "1", q: " hvac ", sort: "score", page: "3" }),
    { view: "trades", status: "expired", deadline: "7", source: "sam", suggested: true, q: "hvac", sort: "score", page: 3 }
  );
  const junk = parseMatchFilters({ status: "deleted", deadline: "999", source: "ftp", sort: "random", page: "-4" });
  assert.equal(junk.status, "new");
  assert.equal(junk.deadline, "any");
  assert.equal(junk.source, "all");
  assert.equal(junk.sort, "deadline");
  assert.equal(junk.page, 1);
});

test("parseMatchFilters takes the first value when a param repeats", () => {
  assert.equal(parseMatchFilters({ status: ["dismissed", "new"] }).status, "dismissed");
});

test("sanitizeSearch strips characters that would break a PostgREST or() filter", () => {
  assert.equal(sanitizeSearch("hvac, (roof)*\\ repair"), "hvac roof repair");
  assert.equal(sanitizeSearch("  "), "");
  assert.equal(sanitizeSearch("a".repeat(300)).length, 100);
});
test("view defaults to trades and only accepts trades or other", () => {
  assert.equal(parseMatchFilters({}).view, "trades");
  assert.equal(parseMatchFilters({ view: "other" }).view, "other");
  assert.equal(parseMatchFilters({ view: "drop table" }).view, "trades");
});
