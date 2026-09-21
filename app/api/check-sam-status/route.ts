import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkEntityRegistration } from "@/lib/sam-gov/entity-client";
import { runWithConcurrency } from "@/lib/concurrency";

export const runtime = "nodejs";
export const maxDuration = 60;

// Bounded concurrency, not full sequential -- each client's check+update is
// fully independent of every other's, so running them one at a time made
// wall-clock time scale linearly with client count. At a realistic 300-500ms
// per SAM.gov round-trip, a fully sequential run could only get through
// roughly 60-100 clients before this route's own 60s maxDuration killed the
// invocation mid-loop, with no record of who was missed. 8 concurrent
// in-flight checks raises that ceiling by roughly the same factor without
// risking an unbounded number of simultaneous outbound requests.
const CONCURRENCY = 8;
// Leaves ~10s of margin under maxDuration for the last in-flight requests to
// finish and the response to be written -- runWithConcurrency stops
// *starting* new work at this point but never aborts a request already in
// flight.
const TIME_BUDGET_MS = 50_000;

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
  const deadline = Date.now() + TIME_BUDGET_MS;

  const { data: clients, error: fetchError } = await supabase
    .from("clients")
    .select("id, sam_uei")
    .not("sam_uei", "is", null)
    // Least-recently-checked (and never-checked) first. This is what turns
    // a client cut off by the concurrency/time limit into "processed early
    // next run" instead of "permanently stuck at the end of a fixed order" --
    // a skipped client's sam_status_checked_at stays old, so it naturally
    // sorts back to the front of tomorrow's query.
    .order("sam_status_checked_at", { ascending: true, nullsFirst: true });

  if (fetchError) {
    console.error("[check-sam-status] failed to load clients", { message: fetchError.message });
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const errors: { clientId: string; error: string }[] = [];

  const { skipped } = await runWithConcurrency(clients ?? [], CONCURRENCY, deadline, async (client) => {
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
      }
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
  });

  if (skipped.length > 0) {
    // A real, observable signal instead of the old behavior (the whole
    // invocation just terminating once the platform timeout hit, with no
    // record anywhere of who was missed). These clients' sam_status_checked_at
    // is untouched, so the ordering above puts them first in tomorrow's run.
    console.warn("[check-sam-status] time budget exceeded, deferring remaining clients to the next run", {
      skippedCount: skipped.length,
      skippedClientIds: skipped.map((c) => c.id),
    });
  }

  const total = clients?.length ?? 0;
  const checked = total - skipped.length - errors.length;

  // A systemic failure (e.g. SAM_GOV_API_KEY missing or revoked, so every
  // single client throws) must not look like a healthy run to Vercel
  // Cron's own status monitoring, which keys off the HTTP status code, not
  // response body content. A per-item failure (a bad UEI, one transient
  // API error) stays a 200 with the detail in errors[] -- that's the
  // existing, intentional "one client's failure doesn't block the rest"
  // design -- but "every attempted client failed" is a different signal
  // entirely and needs to surface as a real error, not a quiet body field
  // nobody's tailing the logs to see.
  const totalFailure = total > 0 && checked === 0 && errors.length === total - skipped.length;
  const status = totalFailure ? 500 : 200;

  return NextResponse.json({ checked, total, errors, skipped: skipped.length }, { status });
}
