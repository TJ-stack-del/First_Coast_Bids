import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { COLOR, stampChrome } from "./deliverables-packet";
import { ownerFor } from "@/lib/bid-read/owners";
import { ALWAYS_MANDATORY } from "@/lib/compliance/requirements-reference";
import type { ReadItem } from "@/lib/bid-read/read";
import type { CarriedFields } from "@/lib/bid-read/fields";

// The homepage bid read as a downloadable first-draft compliance matrix, in
// the packet's own brand chrome, built in the visitor's browser. Same rules
// as the real deliverable: every row found in the bid cites its page and
// the bid's own words, anything unknown stays a [bracketed] blank, and the
// page says plainly that this is a quick read, not the team's review.

// Standard paperwork the bid read doesn't look for, and which read items
// already cover it (so a stated insurance minimum isn't listed twice).
const COVERED_BY: Record<string, string> = {
  "general-liability-insurance": "ins:general-liability",
  "workers-comp-insurance": "ins:workers-comp",
  "addenda-acknowledgment": "addendum:ack-all",
};

export function standardRows(items: Pick<ReadItem, "key">[]) {
  const keys = new Set(items.map((i) => i.key));
  return ALWAYS_MANDATORY.filter((req) => !(COVERED_BY[req.id] && keys.has(COVERED_BY[req.id])));
}

export function generateReadMatrix(input: {
  fileName: string;
  pagesRead: number;
  fields: CarriedFields;
  items: ReadItem[];
  sample: boolean;
}): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 20;
  let y = 30;
  stampChrome(doc);

  doc.setFont("courier", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLOR.brass);
  doc.text(input.sample ? "COMPLIANCE MATRIX · FIRST DRAFT · SYNTHETIC SAMPLE" : "COMPLIANCE MATRIX · FIRST DRAFT", marginX, y);
  y += 10;

  doc.setFont("times", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...COLOR.navy);
  const title = doc.splitTextToSize(input.fields.agency ?? "[Agency name]", pageWidth - marginX * 2);
  doc.text(title, marginX, y);
  y += title.length * 8 + 4;

  const detail = (label: string, value: string) => {
    doc.setFont("courier", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...COLOR.navySoft);
    doc.text(label.toUpperCase(), marginX, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(...COLOR.navy);
    doc.text(doc.splitTextToSize(value, pageWidth - marginX * 2 - 42), marginX + 42, y);
    y += 7;
  };
  detail("Solicitation #", input.fields.solicitationNumber ?? "[Solicitation number]");
  detail("Due date", input.fields.dueDate ? new Date(`${input.fields.dueDate}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "[Due date and time]");
  detail("Read from", `${input.fileName} (${input.pagesRead} page${input.pagesRead === 1 ? "" : "s"})`);
  detail("Bidder", "[Your company name]");
  y += 3;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(...COLOR.navySoft);
  const note = doc.splitTextToSize(
    "Drafted from a quick plain-code read of the bid file on firstcoastbids.com, in your browser. Rows found in the bid cite its page and its own words. Anything we couldn't confirm is in [brackets]. Not yet reviewed by our team: check every row against the bid itself.",
    pageWidth - marginX * 2
  );
  doc.text(note, marginX, y);
  y += note.length * 4.4 + 4;

  const found = input.items.map((item) => {
    const owner = ownerFor(item);
    return [item.label, `p. ${item.page}: "${item.quote}"`, `${owner.who === "we" ? "We" : "You"}: ${owner.task}`, "FOUND IN BID"];
  });
  const standard = standardRows(input.items).map((req) => [
    req.label,
    "[Check the bid's instructions for this]",
    "We prepare it; you supply the document",
    "USUALLY REQUIRED",
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Requirement", "The bid says", "Who handles it", "Status"]],
    body: [...found, ...standard],
    columnStyles: { 0: { cellWidth: 42 }, 1: { cellWidth: 68 }, 2: { cellWidth: 38 }, 3: { cellWidth: 22 } },
    styles: { fontSize: 8.5, cellPadding: 3.2, textColor: COLOR.navySoft, lineColor: COLOR.line, lineWidth: 0.2, valign: "top" },
    headStyles: { fillColor: COLOR.navy, textColor: [247, 245, 240], fontStyle: "bold" },
    alternateRowStyles: { fillColor: COLOR.paperDim },
    margin: { left: marginX, right: marginX, bottom: 24, top: 20 },
    didDrawPage: () => {
      if (doc.getNumberOfPages() > 1) stampChrome(doc);
    },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const raw = String(data.cell.raw ?? "");
      if (data.column.index === 3) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fontSize = 7;
        if (raw === "FOUND IN BID") data.cell.styles.textColor = COLOR.navy;
      }
      if (data.column.index === 1 && raw.startsWith("[")) data.cell.styles.textColor = [186, 26, 26];
    },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  // The closing box (30mm) breaks to a new page only when it can't fit
  // above the footer.
  if (y + 30 > doc.internal.pageSize.getHeight() - 22) {
    doc.addPage();
    stampChrome(doc);
    y = 30;
  }
  doc.setFillColor(...COLOR.navy);
  doc.rect(marginX, y, pageWidth - marginX * 2, 30, "F");
  doc.setFont("times", "bold");
  doc.setFontSize(13);
  doc.setTextColor(247, 245, 240);
  doc.text("Want it finished?", marginX + 6, y + 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text(
    doc.splitTextToSize(
      "Our team reads every page, fills in your company's details, and prepares the capability statement, compliance matrix and technical narrative. You review, sign and send. Start at firstcoastbids.com.",
      pageWidth - marginX * 2 - 12
    ),
    marginX + 6,
    y + 16
  );

  return doc;
}
