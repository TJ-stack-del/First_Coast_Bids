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

// Final review, Important 4: one bad file must not sink the whole reading,
// and unsupported types must never be sent to the AI as garbled text.
test("a corrupt PDF is reported as unreadable instead of throwing", async () => {
  const out = await extractFileText("broken.pdf", Buffer.from("this is not a pdf at all"));
  assert.equal(out.pages, null);
  assert.equal(out.problem, "unreadable_file");
});

test("unsupported types (legacy .doc, spreadsheets, images) are not read as text", async () => {
  const out = await extractFileText("bid-forms.doc", Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0x00, 0x01]));
  assert.equal(out.pages, null);
  assert.equal(out.problem, "unsupported_type");
});

test("a readable PDF has no problem; a PDF without text is 'no_text'", async () => {
  const doc = new jsPDF();
  doc.text("Bid bond of five percent is required with the bid.", 10, 10);
  assert.equal((await extractFileText("ok.pdf", Buffer.from(doc.output("arraybuffer")))).problem, null);
  const blank = new jsPDF();
  blank.rect(10, 10, 50, 50);
  assert.equal((await extractFileText("scan.pdf", Buffer.from(blank.output("arraybuffer")))).problem, "no_text");
});
