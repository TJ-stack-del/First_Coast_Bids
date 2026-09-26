import { lineKind } from "./parse.ts";
import type { ClinLine } from "./types.ts";

// Cleaning an admin's edit to one CLIN line (PATCH /api/clin-lines): only
// the fields sent, trimmed and read; an unreadable value refuses the whole
// edit (null) rather than being saved as something else.

function amount(v: unknown): number | null | undefined {
  if (v === null || v === undefined) return null;
  const t = String(v).replace(/[,$%\s]/g, "");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export function lineEdit(
  raw: Record<string, unknown>,
  current: { quantity: number | null; unit: string | null; period_months: number | null }
): Partial<ClinLine> | null {
  const out: Partial<ClinLine> = {};
  if ("clin" in raw) {
    const clin = String(raw.clin ?? "").trim();
    if (!clin) return null;
    out.clin = clin;
  }
  if ("description" in raw) out.description = String(raw.description ?? "").trim();
  if ("quantity" in raw) {
    const q = amount(raw.quantity);
    if (q === undefined) return null;
    out.quantity = q;
  }
  if ("unit" in raw) out.unit = String(raw.unit ?? "").trim() || null;
  if ("quantity" in raw || "unit" in raw) {
    out.unit_kind = lineKind(out.unit !== undefined ? out.unit : current.unit, out.quantity !== undefined ? out.quantity : current.quantity, current.period_months);
  }
  if ("period_index" in raw) {
    const p = raw.period_index === "" || raw.period_index === null ? null : Number(raw.period_index);
    if (p !== null && !(Number.isInteger(p) && p >= 0 && p <= 9)) return null;
    out.period_index = p;
  }
  if ("unit_price_override" in raw) {
    const u = amount(raw.unit_price_override);
    if (u === undefined) return null;
    out.unit_price_override = u;
  }
  return out;
}

// The split, keyed by position: {"1": 40, "2": 60}.
export function sharesEdit(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^\d+$/.test(k)) continue;
    const n = amount(v);
    if (typeof n === "number") out[k] = n;
  }
  return out;
}
