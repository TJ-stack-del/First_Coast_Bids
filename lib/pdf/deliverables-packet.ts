import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Combines whatever deliverables have been prepared for a submission
// into one real, downloadable PDF — following actual capability
// statement conventions (short bullets and real tables, never long
// flowing paragraphs) instead of dumping everything as wrapped text.
//
// Visual identity matches the marketing site's palette exactly (same
// hex values as mockups-reference/bidpulse_homepage/code.html's :root
// block) so the deliverable a client hands to a contracting officer
// looks like it came from the same company as the site that sold them
// on the service. jsPDF only ships Helvetica/Times/Courier, so those
// stand in for Inter/Fraunces/IBM Plex Mono respectively — same
// typographic roles, closest available match.

type Deliverable = {
  deliverable_type: string;
  content: string | null;
  file_url: string | null;
};

type SubmissionInfo = {
  agency: string;
  solicitation_number: string | null;
  due_date: string | null;
  scope: string | null;
  clients: { company_name: string } | null;
};

const DELIVERABLE_LABELS: Record<string, string> = {
  capability_statement: "Capability Statement",
  compliance_matrix: "Compliance Matrix",
  technical_narrative: "Technical Narrative",
  rate_sheet: "Rate Sheet",
  executive_cover: "Executive Cover",
  certificate_of_insurance: "Certificate of Insurance",
};

const FULL_ORDER = ["capability_statement", "compliance_matrix", "technical_narrative"];
const LEAN_ORDER = ["rate_sheet", "executive_cover", "certificate_of_insurance"];

// Same hex values as :root in mockups-reference/bidpulse_homepage/code.html,
// converted to the RGB triplets jsPDF's color setters expect.
const COLOR = {
  navy: [27, 42, 74] as [number, number, number],
  navySoft: [46, 59, 78] as [number, number, number],
  orange: [239, 91, 37] as [number, number, number],
  orangeDark: [200, 72, 26] as [number, number, number],
  line: [201, 194, 180] as [number, number, number],
  paperDim: [239, 235, 226] as [number, number, number],
  green: [15, 122, 76] as [number, number, number],
};

// Thin orange top bar + "First Coast Bids — Page N" footer, stamped on every
// page including the cover. Keeps every page identifiably branded even
// if a page gets printed or forwarded on its own.
function stampChrome(doc: jsPDF) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFillColor(...COLOR.orange);
  doc.rect(0, 0, pageWidth, 2.5, "F");

  doc.setDrawColor(...COLOR.line);
  doc.setLineWidth(0.2);
  doc.line(20, pageHeight - 16, pageWidth - 20, pageHeight - 16);

  doc.setFont("courier", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLOR.navySoft);
  doc.text("First Coast Bids", 20, pageHeight - 10);
  doc.text(`Page ${doc.getNumberOfPages()}`, pageWidth - 20, pageHeight - 10, {
    align: "right",
  });
}

// A short orange rule under a section heading — same visual device as
// .section-bar on the marketing site.
function sectionBar(doc: jsPDF, marginX: number, y: number) {
  doc.setFillColor(...COLOR.orange);
  doc.rect(marginX, y, 16, 1.4, "F");
}

// Renders plain text as real bullets and properly spaced paragraphs,
// instead of one long wrapped block. Recognizes lines starting with
// "- " or "•" as bullet items; blank lines start a new paragraph.
// Bullets are drawn as small orange dots (matching .rate-feature on the
// site) rather than a printed "•" character, so they carry brand color.
function renderStructuredText(doc: jsPDF, text: string, marginX: number, startY: number): number {
  let y = startY;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const lines = (text || "—").split("\n");

  function checkPageBreak(needed: number) {
    if (y + needed > pageHeight - 26) {
      doc.addPage();
      stampChrome(doc);
      y = 20;
    }
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...COLOR.navySoft);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      y += 3.5; // paragraph gap
      continue;
    }

    const isBullet = line.startsWith("- ") || line.startsWith("• ");
    const text = isBullet ? line.replace(/^[-•]\s*/, "") : line;
    const indent = isBullet ? marginX + 6 : marginX;
    const wrapWidth = pageWidth - indent - marginX;

    const wrapped = doc.splitTextToSize(text, wrapWidth);
    for (let i = 0; i < wrapped.length; i++) {
      checkPageBreak(6.5);
      if (isBullet && i === 0) {
        doc.setFillColor(...COLOR.orange);
        doc.circle(marginX + 1.6, y - 1.3, 0.9, "F");
      }
      doc.text(wrapped[i], indent, y);
      y += 5.8;
    }
  }
  return y;
}

export function generateDeliverablesPacket(
  submission: SubmissionInfo,
  deliverables: Deliverable[]
): jsPDF {
  const doc = new jsPDF();
  const marginX = 20;
  let y = 30;

  stampChrome(doc);

  function sectionHeading(text: string) {
    doc.setFont("times", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...COLOR.navy);
    doc.text(text, marginX, y);
    y += 4;
    sectionBar(doc, marginX, y);
    y += 10;
  }

  // ---------- Cover ----------
  doc.setFont("courier", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLOR.orangeDark);
  doc.text("BID PACKAGE", marginX, y);
  y += 10;

  doc.setFont("times", "bold");
  doc.setFontSize(24);
  doc.setTextColor(...COLOR.navy);
  doc.text(submission.clients?.company_name ?? "Client", marginX, y);
  y += 14;

  doc.setDrawColor(...COLOR.line);
  doc.setLineWidth(0.3);
  doc.line(marginX, y, doc.internal.pageSize.getWidth() - marginX, y);
  y += 16;

  sectionHeading("Bid Details");

  // Label/value rows, matching the .rate-row label-then-value pattern
  // on the site rather than plain "Agency: X" lines.
  function detailRow(label: string, value: string) {
    doc.setFont("courier", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...COLOR.navySoft);
    doc.text(label.toUpperCase(), marginX, y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(...COLOR.navy);
    doc.text(value, marginX + 42, y);
    y += 8;
  }

  detailRow("Agency", submission.agency);
  detailRow("Solicitation #", submission.solicitation_number ?? "—");
  detailRow(
    "Due date",
    submission.due_date ? new Date(submission.due_date).toLocaleDateString() : "—"
  );
  y += 6;

  sectionHeading("Scope of Work");
  y = renderStructuredText(doc, submission.scope ?? "—", marginX, y);

  // Lean and full deliverable sets are mutually exclusive for a given
  // submission (DeliverablesPanel only ever shows one set at a time) — pick
  // whichever one actually has rows, so a lean-package submission doesn't
  // also get three "Not yet prepared" pages for the full-set types it never
  // used.
  const isLean = deliverables.some((d) => LEAN_ORDER.includes(d.deliverable_type));
  const order = isLean ? LEAN_ORDER : FULL_ORDER;

  for (const type of order) {
    const deliverable = deliverables.find((d) => d.deliverable_type === type);
    doc.addPage();
    stampChrome(doc);
    y = 30;
    sectionHeading(DELIVERABLE_LABELS[type]);

    if (!deliverable?.content) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(10.5);
      doc.setTextColor(...COLOR.navySoft);
      doc.text(deliverable?.file_url ? "(Attached as a separate file)" : "Not yet prepared.", marginX, y);
      continue;
    }

    if (type === "compliance_matrix" && deliverable.content.includes("|")) {
      // Real content mixes plain prose (the admin disclaimer, the client-facing
      // trade-coverage note when it applies, the trailing scope reference) with
      // pipe-delimited rows (Requirement | Status | Methodology). Walk the
      // content in its own original order, rendering each contiguous run of
      // table rows as a real autoTable and each contiguous run of prose as
      // regular text — a prior version of this only ever rendered the table
      // and silently dropped every surrounding prose line, which would have
      // dropped the client-facing trade-coverage note from the actual
      // downloaded PDF (it would still show in the in-app preview, since that
      // renders deliverable.content as plain text with no such filtering).
      const lines = deliverable.content.split("\n");
      let i = 0;
      let renderedAnyTable = false;
      while (i < lines.length) {
        const isTableRow = (line: string) => line.includes("|") && !line.startsWith("[");
        if (isTableRow(lines[i].trim())) {
          const rows: string[][] = [];
          while (i < lines.length && isTableRow(lines[i].trim())) {
            rows.push(lines[i].trim().split("|").map((cell) => cell.trim()));
            i++;
          }
          autoTable(doc, {
            startY: y,
            head: [["Requirement", "Status", "Methodology & Verification"]],
            body: rows,
            styles: {
              fontSize: 9,
              cellPadding: 4,
              textColor: COLOR.navySoft,
              lineColor: COLOR.line,
              lineWidth: 0.2,
            },
            headStyles: {
              fillColor: COLOR.navy,
              textColor: [247, 245, 240],
              fontStyle: "bold",
            },
            alternateRowStyles: { fillColor: COLOR.paperDim },
            margin: { left: marginX, right: marginX, bottom: 24 },
            didDrawPage: () => stampChrome(doc),
            // A hand-verified row (an admin replaced "NEEDS VERIFICATION"
            // with "VERIFIED" -- see DeliverablesPanel.tsx's "Mark verified"
            // button) used to render identically to an unverified
            // placeholder in the actual downloaded PDF -- the one document
            // this whole checklist exists to produce. Real, visible
            // distinction for the Status column only.
            didParseCell: (data) => {
              if (data.section === "body" && data.column.index === 1) {
                const status = String(data.cell.raw ?? "").trim().toUpperCase();
                if (status === "VERIFIED") {
                  data.cell.styles.textColor = COLOR.green;
                  data.cell.styles.fontStyle = "bold";
                }
              }
            },
          });
          renderedAnyTable = true;
          // jspdf-autotable attaches this at runtime; not in the plugin's
          // own type declarations, hence the cast.
          y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
        } else {
          const proseLines: string[] = [];
          while (i < lines.length && !isTableRow(lines[i].trim())) {
            proseLines.push(lines[i]);
            i++;
          }
          y = renderStructuredText(doc, proseLines.join("\n"), marginX, y);
        }
      }
      if (renderedAnyTable) continue;
    }

    renderStructuredText(doc, deliverable.content, marginX, y);
  }

  return doc;
}
