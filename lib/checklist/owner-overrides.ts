import type { Owner } from "./types.ts";

// The Me/Client choices an admin made on screen, keyed by suggestion id, as
// sent with "Approve all verified". Only "admin"/"client" values are kept.
export function parseOwnerOverrides(raw: unknown): Record<string, Owner> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, Owner> = {};
  for (const [id, owner] of Object.entries(raw as Record<string, unknown>)) {
    if (owner === "admin" || owner === "client") out[id] = owner;
  }
  return out;
}
