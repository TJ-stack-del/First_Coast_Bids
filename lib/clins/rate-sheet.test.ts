import { test } from "node:test";
import assert from "node:assert/strict";
import { rateSheetText } from "./rate-sheet.ts";
import { priceLines } from "./price.ts";
import { hasUnresolvedPlaceholders } from "../pdf/placeholder-check.ts";

const L = (clin: string, period_index: number, description: string, extra = {}) => ({
  clin, description, quantity: 12, unit: "MO", unit_kind: "month" as const, period_index, position: 1,
  quote: null, page: null, source_file: null, quote_status: "verified" as const, revised_by: null, unit_price_override: null, sort: period_index, ...extra,
});

test("a fully priced table: one row per CLIN and the total; no placeholders", () => {
  const lines = [L("0001", 0, "Custodial Services for JDMTA"), L("1001", 1, "Option Year 1 Custodial Services for JDMTA")];
  const text = rateSheetText({ agency: "DEPT OF THE AIR FORCE", solicitationNumber: "FA252126QB143", lines, priced: priceLines({ lines, bidPrice: 90000, increasePct: 3, shares: {} }) });
  assert.equal(text, [
    "RATE SHEET — DEPT OF THE AIR FORCE — Solicitation FA252126QB143",
    "",
    "CLIN | Description | Qty | Unit | Unit price | Amount",
    "0001 | Custodial Services for JDMTA | 12 | MO | $7,500.00 | $90,000.00",
    "1001 | Option Year 1 Custodial Services for JDMTA | 12 | MO | $7,725.00 | $92,700.00",
    "",
    "Total (base + all option years): $182,700.00",
  ].join("\n"));
  assert.equal(hasUnresolvedPlaceholders(text), false);
});

test("blanks become bracketed placeholders, so the client's download is blocked", () => {
  const lines = [L("0001", 0, "Custodial"), L("1001", 1, "Option Year 1 Custodial")];
  const text = rateSheetText({ agency: "X", solicitationNumber: null, lines, priced: priceLines({ lines, bidPrice: 90000, increasePct: null, shares: {} }) });
  assert.match(text, /1001 \| Option Year 1 Custodial \| 12 \| MO \| \[unit price — CLIN 1001\] \| \[amount — CLIN 1001\]/);
  assert.match(text, /Total \(base \+ all option years\): \[total — 1 line not priced yet\]/);
  assert.equal(hasUnresolvedPlaceholders(text), true);
});
