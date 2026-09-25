import { test } from "node:test";
import assert from "node:assert/strict";
import { jsPDF } from "jspdf";
import { extractFileText } from "./extract-text.ts";

test("a PDF with text returns one string per page", async () => {
  const doc = new jsPDF();
  doc.text("Complete the SF 1449 blocks 12 and 30.", 10, 10);
  doc.addPage();
  doc.text("Acknowledge Amendment 0001.", 10, 10);
  const buffer = Buffer.from(doc.output("arraybuffer"));
  const out = await extractFileText("rfq.pdf", buffer);
  assert.equal(out.totalPages, 2);
  assert.match(out.pages![0], /SF 1449/);
  assert.match(out.pages![1], /Amendment 0001/);
});

test("a PDF with no text is unreadable", async () => {
  const doc = new jsPDF();
  doc.rect(10, 10, 50, 50);
  const out = await extractFileText("scan.pdf", Buffer.from(doc.output("arraybuffer")));
  assert.equal(out.pages, null);
  assert.equal(out.totalPages, 1);
});

test("plain text files are one page", async () => {
  const out = await extractFileText("notes.txt", Buffer.from("Bid bond of 5 percent required."));
  assert.deepEqual(out.pages, ["Bid bond of 5 percent required."]);
});
