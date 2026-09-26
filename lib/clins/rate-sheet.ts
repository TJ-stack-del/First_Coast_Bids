import type { ClinLine } from "./types.ts";
import type { priceLines } from "./price.ts";

// The client's Rate sheet: the agency's CLINs, in the agency's numbering,
// priced. A blank is a [bracketed placeholder] so hasUnresolvedPlaceholders
// blocks the client's download until it's filled (never a guessed number).

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const qty = (n: number | null) => (n === null ? "[qty]" : n.toLocaleString("en-US", { maximumFractionDigits: 2 }));

export function rateSheetText(i: {
  agency: string;
  solicitationNumber: string | null;
  lines: ClinLine[];
  priced: ReturnType<typeof priceLines>;
}): string {
  const rows = i.lines.map((l, k) => {
    const p = i.priced.lines[k];
    const unitPrice = p.unitPrice === null ? `[unit price — CLIN ${l.clin}]` : money(p.unitPrice);
    const amount = p.amount === null ? `[amount — CLIN ${l.clin}]` : money(p.amount);
    return `${l.clin} | ${l.description} | ${qty(l.quantity)} | ${l.unit ?? "[unit]"} | ${unitPrice} | ${amount}`;
  });
  const m = i.priced.missing;
  const total = i.priced.total === null ? `[total — ${m} line${m === 1 ? "" : "s"} not priced yet]` : money(i.priced.total);
  return [
    `RATE SHEET — ${i.agency}${i.solicitationNumber ? ` — Solicitation ${i.solicitationNumber}` : ""}`,
    "",
    "CLIN | Description | Qty | Unit | Unit price | Amount",
    ...rows,
    "",
    `Total (base + all option years): ${total}`,
  ].join("\n");
}
