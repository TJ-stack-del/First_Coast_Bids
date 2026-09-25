import { test } from "node:test";
import assert from "node:assert/strict";
import { extractWdDocument } from "./fetch-wd.ts";

test("the WD text is taken from SAM.gov's JSON, with control characters and wrapping quotes handled", () => {
  const raw = '{"fullReferenceNumber":"2015-4539","revisionNumber":32,"document":"\\"\\n\\nREGISTER OF WAGE DETERMINATIONS\\n11150 - Janitor   17.04\\n\\""}';
  const out = extractWdDocument(raw);
  assert.equal(out.number, "2015-4539");
  assert.equal(out.revision, 32);
  assert.match(out.text, /^REGISTER OF WAGE DETERMINATIONS\n11150 - Janitor/);
});

test("raw control characters inside the document string don't break it", () => {
  const raw = '{"fullReferenceNumber":"2015-4539","revisionNumber":32,"document":"line one\nline two"}';
  assert.equal(extractWdDocument(raw).text, "line one\nline two");
});

test("non-WD JSON throws", () => {
  assert.throws(() => extractWdDocument('{"title":"Not Found","status":404}'));
  assert.throws(() => extractWdDocument("not json"));
});
