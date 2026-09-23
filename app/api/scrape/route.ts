import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { scrapeJaa, type ScrapedOpportunity } from "@/lib/scrapers/jaa";
import { scrapeCoj } from "@/lib/scrapers/coj";
import { scrapeCojForecast } from "@/lib/scrapers/coj-forecast";
import { scrapeSamGov, scrapeSamGovBackfill } from "@/lib/scrapers/sam-gov";
import { SAM_NAICS_CODES } from "@/lib/scrapers/sam-gov-query";
import { scrapeJaxBeach } from "@/lib/scrapers/jax-beach";
import { findBestMatchingClient } from "@/lib/sam-gov/match-scoring";
import { expiryCutoff } from "@/lib/matches/rules";

// coj.ts no longer needs a real browser (see that file's own comment —
// the "JS-rendered" table turned out to be a plain Oracle ADF loopback
// redirect, replayable with plain fetch()), so neither the Node.js
// runtime nor a long timeout is strictly required by it anymore. Left
// as-is rather than narrowed to Edge/a shorter timeout: this route still
// makes several sequential external requests per scraper per run, and
// 60s matches this project's existing ceiling for every other
// external-network-dependent route (extract-from-document,
// inbound-bid-email) — a real infra change, not just cleanup, so left
// for a deliberate decision rather than done as a drive-by here.
export const runtime = "nodejs";
export const maxDuration = 60;

// BUILD-ORDER-BIDPULSE.md Step 8: runs the scrapers and inserts whatever
// they find into matched_opportunities with assigned_client_id left null,
// so they show up unassigned in app/admin/matches/ for manual review —
// nothing here auto-assigns a client.
//
// JEA (jea.com) is deliberately not included: every URL on that domain,
// including the root, returns a CAPTCHA challenge page (confirmed against
// two independent fetch methods) — a server-side scraper can never get
// past that. Revisit if JEA ever offers a real feed/API.
const SCRAPERS: { name: string; run: () => Promise<ScrapedOpportunity[]> }[] = [
  { name: "jaa", run: scrapeJaa },
  { name: "coj", run: scrapeCoj },
  { name: "coj-forecast", run: scrapeCojForecast },
  { name: "sam-gov", run: scrapeSamGov },
  { name: "jax-beach", run: scrapeJaxBeach },
];

function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return request.headers.get("authorization") === `Bearer ${expected}`;
}

// Uses the service_role key, not the publishable/anon key from
// lib/supabase/*: this route is called by Vercel's cron, not a browser, so
// there's no user session for RLS's is_admin() to check against.
// service_role bypasses RLS entirely and must only ever be used
// server-side, in a route like this one — never in client.ts.
function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = serviceClient();

  const { data: org, error: orgError } = await supabase.from("organizations").select("id").limit(1).single();

  if (orgError || !org) {
    return NextResponse.json({ error: "No organization set up yet." }, { status: 500 });
  }

  // Fetched once per run, not once per opportunity -- reused across every
  // inserted row below.
  //
  // DEPLOYMENT SEQUENCING (corrected 2026-09-21 -- an earlier version of
  // this comment claimed a missing column here would crash the whole
  // cron run; verified that's wrong, see below): sam_registration_status
  // does not exist in this branch's schema. It's added by the separate,
  // still-unmerged SAM registration-monitoring PR's migration
  // (20260920120000_add_sam_registration_fields_to_clients.sql). Do not
  // deploy this PR to an environment before that PR's migration has
  // actually been applied to the same database (merging the git PR is
  // not sufficient by itself). The real failure mode if you do: this
  // query returns {data: null, error}, supabase-js v2 does not throw by
  // default, and the error is checked and logged below specifically so
  // this doesn't silently degrade to "every suggestion is null" with zero
  // visibility -- matching this app's existing scraper convention of
  // failing loudly rather than looking identical to "ran fine, found
  // nothing." Once the column exists for real: every client legitimately
  // has sam_registration_status null/not-yet-checked until the
  // registration-monitoring cron's first run, at which point
  // findBestMatchingClient's active-status gate correctly finds zero
  // eligible clients until a real registration check completes -- that
  // part matches the original plan's own stated expectation.
  // Ordered by created_at ascending so findBestMatchingClient's documented
  // "first-registered-in-the-list wins" tie-break is actually true --
  // without an explicit order, Postgres/PostgREST may return rows in any
  // order, letting the winner of a tie between two equally-matching
  // clients silently flip between cron runs.
  const { data: clientsForMatching, error: clientsForMatchingError } = await supabase
    .from("clients")
    .select("id, naics_codes, sam_registration_status")
    .eq("org_id", org.id)
    .order("created_at", { ascending: true });

  if (clientsForMatchingError) {
    console.error("[scrape] failed to load clients for match scoring -- every suggestion this run will be null", {
      message: clientsForMatchingError.message,
    });
  }

  const results: Record<
    string,
    { found: number; inserted: number; skipped: number; errors?: string[] }
  > = {};

  // Manual one-time SAM.gov catch-up: ?samBackfill=<NAICS code> runs only
  // that code's 12-month Florida backfill (one request) instead of the
  // daily scrapers, so the backlog can be spread across days within the
  // API key's small daily quota. Same CRON_SECRET auth as the cron itself.
  const backfillCode = request.nextUrl.searchParams.get("samBackfill");
  if (backfillCode !== null && !(SAM_NAICS_CODES as readonly string[]).includes(backfillCode)) {
    return NextResponse.json(
      { error: `samBackfill must be one of: ${SAM_NAICS_CODES.join(", ")}` },
      { status: 400 }
    );
  }
  const scrapers = backfillCode
    ? [{ name: `sam-gov-backfill-${backfillCode}`, run: () => scrapeSamGovBackfill(backfillCode) }]
    : SCRAPERS;

  for (const scraper of scrapers) {
    try {
      const found = await scraper.run();
      let inserted = 0;
      let skipped = 0;
      const insertErrors: string[] = [];

      for (const item of found) {
        // Re-running daily shouldn't create duplicate rows for a listing
        // that's still posted — skip anything already logged with the same
        // title + agency for this org.
        const { data: existing } = await supabase
          .from("matched_opportunities")
          .select("id")
          .eq("org_id", org.id)
          .eq("source_title", item.source_title)
          .eq("source_agency", item.source_agency)
          .maybeSingle();

        if (existing) {
          skipped++;
          continue;
        }

        const suggestion = item.naics_code
          ? findBestMatchingClient(item.naics_code, clientsForMatching ?? [])
          : null;

        const { error: insertError } = await supabase.from("matched_opportunities").insert({
          org_id: org.id,
          assigned_client_id: null,
          source_title: item.source_title,
          source_agency: item.source_agency,
          source_url: item.source_url,
          due_date: item.due_date,
          solicitation_number: item.solicitation_number ?? null,
          scope: item.scope ?? null,
          status: "new",
          naics_code: item.naics_code ?? null,
          suggested_client_id: suggestion?.clientId ?? null,
          match_score: suggestion?.score ?? null,
        });

        // Previously discarded silently on failure — a bad insert (e.g. a
        // missing column) looked identical to "nothing new found" in the
        // response, which is exactly what let this go unnoticed.
        if (insertError) {
          insertErrors.push(`${item.source_title}: ${insertError.message}`);
        } else {
          inserted++;
        }
      }

      results[scraper.name] = {
        found: found.length,
        inserted,
        skipped,
        ...(insertErrors.length > 0 ? { errors: insertErrors } : {}),
      };
    } catch (err) {
      results[scraper.name] = {
        found: 0,
        inserted: 0,
        skipped: 0,
        errors: [err instanceof Error ? err.message : "Unknown error"],
      };
    }
  }

  // Expire untouched matches whose deadline has passed, so the admin
  // queue's default "New" view only holds live leads. Only ever
  // status = 'new' -> 'expired': assigned and dismissed rows are never
  // touched, nothing is deleted, and an admin can Restore an expired match
  // from the Matches page. The 24h grace in expiryCutoff keeps date-only
  // deadlines (stored as midnight UTC) from expiring the evening before
  // they're due. Runs even if every scraper above failed -- it doesn't
  // depend on them. Every run that changes anything leaves one audit_log
  // row with the exact count and ids.
  const expiry = await expireStaleMatches(supabase, org.id);

  return NextResponse.json({ ok: true, results, expiry });
}

async function expireStaleMatches(
  supabase: ReturnType<typeof serviceClient>,
  orgId: string
): Promise<{ expired: number; error?: string }> {
  const { data, error } = await supabase
    .from("matched_opportunities")
    .update({ status: "expired" })
    .eq("org_id", orgId)
    .eq("status", "new")
    .not("due_date", "is", null)
    .lt("due_date", expiryCutoff(new Date()))
    .select("id, source_title");

  if (error) {
    console.error("[scrape] failed to expire stale matches", { message: error.message });
    return { expired: 0, error: error.message };
  }

  const expired = data ?? [];
  if (expired.length > 0) {
    const { error: auditError } = await supabase.from("audit_log").insert({
      org_id: orgId,
      actor_id: null,
      event_type: "matched_opportunities_expired",
      event_detail: {
        count: expired.length,
        matched_opportunity_ids: expired.map((m) => m.id),
      },
    });
    if (auditError) {
      console.error("[scrape] expired matches but failed to write the audit entry", {
        count: expired.length,
        message: auditError.message,
      });
    }
  }

  return { expired: expired.length };
}
