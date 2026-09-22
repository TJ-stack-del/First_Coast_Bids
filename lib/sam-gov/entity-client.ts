import type { SamRegistrationStatus } from "./registration-status";

// SAM.gov Entity Management API (production v3) -- real REST API, not
// scraping. Response shape under entityData[].entityRegistration:
// registrationStatus ("Active" when active, otherwise some other
// string), registrationExpirationDate ("YYYY-MM-DD"). Confirmed against
// GSA's own published API documentation (open.gsa.gov/api/entity-api),
// not guessed from memory.
const ENTITY_API_BASE = "https://api.sam.gov/entity-information/v3/entities";

// found:true only ever carries "active"/"inactive" -- those are the two
// states the Entity API itself distinguishes. The caller (app/api/
// check-sam-status/route.ts) is what maps found:false onto the third real
// database value, "not_registered" -- see lib/sam-gov/registration-status.ts
// for the full set of values this app's clients.sam_registration_status
// column can actually hold, which is wider than what this API result type
// alone represents.
export type EntityRegistrationResult =
  | { found: true; status: Extract<SamRegistrationStatus, "active" | "inactive">; expiresAt: string | null }
  | { found: false };

type RawEntityApiResponse = {
  entityData?: {
    entityRegistration?: {
      registrationStatus?: string;
      registrationExpirationDate?: string;
    };
  }[];
};

export function parseEntityRegistrationResponse(raw: RawEntityApiResponse): EntityRegistrationResult {
  const entity = raw.entityData?.[0];
  if (!entity) return { found: false };

  const reg = entity.entityRegistration;
  const status: "active" | "inactive" = reg?.registrationStatus === "Active" ? "active" : "inactive";
  return { found: true, status, expiresAt: reg?.registrationExpirationDate ?? null };
}

// Fails loudly rather than returning a default "unknown" — same
// convention as lib/scrapers/coj.ts: a missing API key or a broken
// response shape must surface as a real error in the caller's
// per-item try/catch, not get silently swallowed into a status that
// looks like a legitimate "not registered."
export async function checkEntityRegistration(uei: string): Promise<EntityRegistrationResult> {
  const apiKey = process.env.SAM_GOV_API_KEY;
  if (!apiKey) {
    throw new Error("checkEntityRegistration: SAM_GOV_API_KEY is not set.");
  }

  const url = `${ENTITY_API_BASE}?ueiSAM=${encodeURIComponent(uei)}&api_key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`SAM.gov Entity API request failed: ${res.status} ${res.statusText}`);
  }

  const raw = (await res.json()) as RawEntityApiResponse;
  return parseEntityRegistrationResponse(raw);
}
