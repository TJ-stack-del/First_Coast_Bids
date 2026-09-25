import type { NaicsEntry, Trade, TradeInput } from "./types.ts";

// Normalising and checking a trade before it's saved. Used by the Trades
// form (instant feedback) and again by the save route (the real gate).
// Bad codes are rejected with the exact value named, never auto-corrected.

const NAICS_RE = /^\d{6}$/;
const NIGP_RE = /^\d{3}-\d{2}$/;

function strings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export function normalizeTradeInput(raw: unknown): TradeInput {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const naics: NaicsEntry[] = Array.isArray(obj.naics)
    ? obj.naics
        .map((n) => {
          const e = (n && typeof n === "object" ? n : {}) as Record<string, unknown>;
          return {
            code: typeof e.code === "string" ? e.code.trim() : "",
            label: typeof e.label === "string" ? e.label.trim().replace(/\s+/g, " ") : "",
          };
        })
        .filter((n) => n.code || n.label)
    : [];
  return {
    id: typeof obj.id === "string" && obj.id ? obj.id : undefined,
    label: typeof obj.label === "string" ? obj.label.trim().replace(/\s+/g, " ") : "",
    naics,
    nigpCodes: unique(strings(obj.nigpCodes).map((c) => c.trim()).filter(Boolean)),
    keywords: unique(
      strings(obj.keywords)
        .map((k) => k.trim().toLowerCase().replace(/\s+/g, " "))
        .filter(Boolean)
    ),
    active: obj.active === false ? false : true,
    wdPositionCode:
      typeof obj.wdPositionCode === "string" && obj.wdPositionCode.trim() ? obj.wdPositionCode.trim() : null,
  };
}

// Always carries `errors` (empty when ok): this repo compiles with
// strict: false, where a {ok: true} | {ok: false; errors} union can't be
// narrowed by checking `ok`.
export function validateTrade(input: TradeInput, allTrades: Trade[]): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const others = allTrades.filter((t) => t.id !== input.id);

  if (!input.label) errors.push("Give the trade a name.");
  else if (input.label.length > 60) errors.push("Keep the trade name under 60 characters.");
  else if (others.some((t) => t.label.toLowerCase() === input.label.toLowerCase())) {
    errors.push(`A trade called "${input.label}" already exists.`);
  }

  const seenNaics = new Set<string>();
  for (const n of input.naics) {
    if (!NAICS_RE.test(n.code)) {
      errors.push(`NAICS code "${n.code}" must be exactly 6 digits.`);
      continue;
    }
    if (!n.label) errors.push(`NAICS code ${n.code} needs a label.`);
    if (seenNaics.has(n.code)) errors.push(`NAICS code ${n.code} is listed twice.`);
    seenNaics.add(n.code);
    const owner = others.find((t) => t.naics.some((o) => o.code === n.code));
    if (owner) errors.push(`NAICS code ${n.code} is already in ${owner.label}.`);
  }

  for (const c of input.nigpCodes) {
    if (!NIGP_RE.test(c)) {
      errors.push(`NIGP code "${c}" must look like 910-39.`);
      continue;
    }
    const owner = others.find((t) => t.nigpCodes.includes(c));
    if (owner) errors.push(`NIGP code ${c} is already in ${owner.label}.`);
  }

  for (const k of input.keywords) {
    if (k.length < 3) errors.push(`Keyword "${k}" is too short. Use at least 3 characters.`);
  }

  if (input.naics.length === 0 && input.nigpCodes.length === 0 && input.keywords.length === 0) {
    errors.push("Add at least one NAICS code, NIGP code or keyword, or this trade can't match any bid.");
  }

  if (input.wdPositionCode && !/^\d{5}$/.test(input.wdPositionCode)) {
    errors.push(`Position code "${input.wdPositionCode}" must be 5 digits, like 11150.`);
  }

  return { ok: errors.length === 0, errors };
}
