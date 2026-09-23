import type { Trade } from "./types.ts";

// NAICS checkboxes for the client forms (intake wizard, Company Profile)
// and trade labels for clients, both from the admin-managed trade list.

export type NaicsOption = { value: string; label: string };

export function offeredNaicsOptions(trades: Trade[]): NaicsOption[] {
  const seen = new Set<string>();
  const options: NaicsOption[] = [];
  for (const t of trades.filter((t) => t.active).sort((a, b) => a.sortOrder - b.sortOrder)) {
    for (const n of t.naics) {
      if (seen.has(n.code)) continue;
      seen.add(n.code);
      options.push({ value: n.code, label: `${n.code}: ${n.label}` });
    }
  }
  return options;
}

// A client keeps a code they already chose even if that trade was switched
// off: it stays a checked option (code alone as its label) rather than
// being dropped or pushed into the free-text "Other" box.
export function naicsOptionsWithSelected(offered: NaicsOption[], selected: string[]): NaicsOption[] {
  const offeredCodes = new Set(offered.map((o) => o.value));
  const extra = [...new Set(selected)].filter((c) => !offeredCodes.has(c)).map((c) => ({ value: c, label: c }));
  return [...offered, ...extra];
}

// "Janitorial, Electrical" for the admin assign picker. Switched-off trades
// still name a client's codes; unknown codes show as the raw code.
export function clientTradeLabel(naicsCodes: string[] | null | undefined, trades: Trade[]): string | null {
  if (!naicsCodes || naicsCodes.length === 0) return null;
  const labels = naicsCodes.map((code) => trades.find((t) => t.naics.some((n) => n.code === code))?.label ?? code);
  return [...new Set(labels)].join(", ");
}

export function clientTradeIds(naicsCodes: string[] | null | undefined, trades: Trade[]): string[] {
  if (!naicsCodes) return [];
  const ids: string[] = [];
  for (const code of naicsCodes) {
    const t = trades.find((t) => t.naics.some((n) => n.code === code));
    if (t && !ids.includes(t.id)) ids.push(t.id);
  }
  return ids;
}
