import { test } from "node:test";
import assert from "node:assert/strict";
import {
  escapeHtml,
  getChecklistItemsEmail,
  getContactMessageEmail,
  getDailyDigestEmail,
  getInfoRequestEmail,
  getMatchWithdrawnEmail,
  getMatchedOpportunityEmail,
  getNewMessageEmail,
  getStageChangeEmail,
  SITE,
} from "./templates.ts";

const EVIL = `<img src=x onerror="alert(1)">`;

test("every client email is the branded layout with one button back to the dashboard", () => {
  const emails = [
    getStageChangeEmail("deliverables_ready", "City of Sampleton", "Sample Co"),
    getInfoRequestEmail("Your license number, please.", "City of Sampleton", "Sample Co"),
    getNewMessageEmail("City of Sampleton", "Sample Co"),
    getMatchedOpportunityEmail("City of Sampleton", "Sample Co"),
    getChecklistItemsEmail("City of Sampleton", "Sample Co", [{ label: "Sign the bid form", detail: "p. 4" }]),
  ];
  for (const e of emails) {
    assert.ok(e, "template returned null");
    assert.match(e!.html, /FIRST COAST <span[^>]*>BIDS<\/span>/);
    assert.equal((e!.html.match(new RegExp(`href="${SITE}/dashboard"`, "g")) ?? []).length, 1);
    assert.match(e!.html, /We never submit for you/);
  }
  // A withdrawn match needs nothing from the client: no button.
  assert.doesNotMatch(getMatchWithdrawnEmail("City of Sampleton", "Sample Co", "ITB-1").html, /href=/);
});

test("stage emails show the dashboard's track at the right step", () => {
  const ready = getStageChangeEmail("deliverables_ready", "A", "B")!.html;
  assert.match(ready, /Your package is ready to preview\./);
  assert.match(ready, /font:700 11px[^>]*>Ready to preview</);
  const review = getStageChangeEmail("client_review", "A", "B")!.html;
  assert.match(review, /font:700 11px[^>]*>Your review</);
  assert.equal(getStageChangeEmail("not_a_stage", "A", "B"), null);
});

test("anything a person typed is escaped, in every template", () => {
  const all = [
    getStageChangeEmail("submitted", EVIL, EVIL)!.html,
    getInfoRequestEmail(EVIL, EVIL, EVIL).html,
    getNewMessageEmail(EVIL, EVIL).html,
    getMatchedOpportunityEmail(EVIL, EVIL).html,
    getMatchWithdrawnEmail(EVIL, EVIL, EVIL).html,
    getChecklistItemsEmail(EVIL, EVIL, [{ label: EVIL, detail: EVIL }]).html,
    getContactMessageEmail(EVIL, EVIL, EVIL).html,
    getDailyDigestEmail(
      [{ companyName: EVIL, agency: EVIL, stage: "in_review", daysSinceUpdate: 3, daysUntilDue: 2, breachedTurnaround: false }],
      [{ companyName: EVIL, contactName: EVIL, email: EVIL, phone: null, requestedPackage: null, daysSinceSignup: 1 }]
    ).html,
  ];
  for (const html of all) {
    assert.doesNotMatch(html, /<img src=x/);
    assert.match(html, /&lt;img src=x/);
  }
});

test("line breaks in an admin's message survive escaping", () => {
  assert.match(getInfoRequestEmail("Line one\nLine two", "A", "B").html, /Line one<br>Line two/);
  assert.equal(escapeHtml(`a&b<c>"d'`), "a&amp;b&lt;c&gt;&quot;d&#39;");
});
