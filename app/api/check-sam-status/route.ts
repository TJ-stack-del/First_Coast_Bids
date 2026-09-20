import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkEntityRegistration } from "@/lib/sam-gov/entity-client";

export const runtime = "nodejs";
export const maxDuration = 60;

// Daily cron -- SAM registrations change annually, so daily freshness is
// far more than sufficient. Independent of app/api/scrape's cron: this
// route only ever reads clients.sam_uei and writes the four
// sam_registration_* columns, it never touches matched_opportunities.
// See docs/superpowers/specs/2026-09-20-sam-gov-adoption-design.md.
function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return request.headers.get("authorization") === `Bearer ${expected}`;
}

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = serviceClient();

  const { data: clients, error: fetchError } = await supabase
    .from("clients")
    .select("id, sam_uei")
    .not("sam_uei", "is", null);

  if (fetchError) {
    console.error("[check-sam-status] failed to load clients", { message: fetchError.message });
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  let checked = 0;
  const errors: { clientId: string; error: string }[] = [];

  for (const client of clients ?? []) {
    try {
      const result = await checkEntityRegistration(client.sam_uei!);

      const update = result.found
        ? {
            sam_registration_status: result.status,
            sam_registration_expires_at: result.expiresAt,
            sam_status_checked_at: new Date().toISOString(),
          }
        : {
            sam_registration_status: "not_registered",
            sam_registration_expires_at: null,
            sam_status_checked_at: new Date().toISOString(),
          };

      const { error: updateError } = await supabase.from("clients").update(update).eq("id", client.id);
      if (updateError) {
        console.error("[check-sam-status] failed to update client", {
          clientId: client.id,
          message: updateError.message,
        });
        errors.push({ clientId: client.id, error: updateError.message });
        continue;
      }
      checked++;
    } catch (e) {
      // One client's failed lookup (bad UEI, transient API error) must
      // not block the rest of the batch, and must not overwrite that
      // client's last-known status with a wrong "unknown" -- leaving
      // sam_status_checked_at stale is the honest signal that this
      // client's status is unverified, not "verified as unknown."
      const message = e instanceof Error ? e.message : String(e);
      console.error("[check-sam-status] failed to check client registration", {
        clientId: client.id,
        message,
      });
      errors.push({ clientId: client.id, error: message });
    }
  }

  return NextResponse.json({ checked, total: clients?.length ?? 0, errors });
}
