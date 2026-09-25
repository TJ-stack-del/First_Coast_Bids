// A client's usual pricing numbers (clients.pricing), entered once by the
// admin and reused on every bid for that client. First Coast Bids prepares
// the bid; the client sets the price -- so these are never our defaults and
// never guessed: a missing number is null (blank, highlighted, named).

export type ClientPricing = {
  suppliesMode: "percent" | "flat";
  suppliesValue: number | null;
  overheadPct: number | null;
  profitPct: number | null;
  productionRate: number | null;
};

// "12%", "$1,500", " 3500 " -> numbers; blank, negative or unreadable -> null.
function readAmount(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const t = typeof v === "number" ? String(v) : String(v).replace(/[,$%\s]/g, "");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function normalizeClientPricing(raw: unknown): ClientPricing {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const rate = readAmount(o.productionRate);
  return {
    suppliesMode: o.suppliesMode === "flat" ? "flat" : "percent",
    suppliesValue: readAmount(o.suppliesValue),
    overheadPct: readAmount(o.overheadPct),
    profitPct: readAmount(o.profitPct),
    productionRate: rate !== null && rate > 0 ? rate : null,
  };
}

export function hasAnyPricing(p: ClientPricing): boolean {
  return p.suppliesValue !== null || p.overheadPct !== null || p.profitPct !== null || p.productionRate !== null;
}

// The price numbers still to get from the client (production rate is named
// by the pre-fill guidance, since it only affects hours).
export function missingPricing(p: ClientPricing): string[] {
  const out: string[] = [];
  if (p.suppliesValue === null) out.push("supplies");
  if (p.overheadPct === null) out.push("overhead %");
  if (p.profitPct === null) out.push("profit %");
  return out;
}
