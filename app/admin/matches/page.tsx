import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MatchesPanel } from "./MatchesPanel";
import { loadTrades } from "@/lib/trades/server";
import type { Trade } from "@/lib/trades/types";
import {
  parseMatchFilters,
  MATCH_STATUSES,
  MATCHES_PAGE_SIZE,
  SAM_HOST_FRAGMENT,
  LOCAL_HOST_FRAGMENTS,
  type MatchFilters,
} from "@/lib/matches/rules";

const DAY_MS = 24 * 60 * 60 * 1000;

// BUILD-ORDER-BIDPULSE.md Step 8: "adapt the existing scrapers
// (lib/scrapers/*)" — that directory doesn't exist anywhere in this repo,
// so there's nothing to adapt. What's built here is the other half that
// stands on its own: an admin screen to review matched_opportunities and
// assign one to a client, which seeds a real submission for them. Until a
// scraper exists, opportunities get logged manually from this same screen.

export default async function AdminMatchesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseMatchFilters(await searchParams);
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: member } = await supabase
    .from("team_members")
    .select("id, org_id, full_name")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!member) redirect("/");

  // Filtering, counting and paging all happen here in the query, not in
  // the browser: once the SAM.gov scraper runs daily, this table grows by
  // hundreds of rows a month, and loading every row ever logged (what this
  // page used to do) stops being workable. Filters come from the URL
  // (parseMatchFilters whitelists every value), so a filtered view survives
  // a reload and can be bookmarked.
  const now = new Date();
  const columns =
    "id, source_title, source_agency, source_url, scope, solicitation_number, due_date, match_score, status, assigned_client_id, naics_code, trade_id, suggested_client_id, created_at";

  // One builder for both the page query and the per-tab counts, so the
  // counts always describe exactly what each tab would show.
  function filtered(
    select: string,
    options: { count?: "exact"; head?: boolean },
    status: MatchFilters["status"],
    view: MatchFilters["view"] = filters.view
  ) {
    let q = supabase.from("matched_opportunities").select(select, options).eq("org_id", member!.org_id);
    if (status !== "all") q = q.eq("status", status);
    q = view === "trades" ? q.not("trade_id", "is", null) : q.is("trade_id", null);

    if (filters.deadline === "7" || filters.deadline === "30") {
      const days = Number(filters.deadline);
      q = q.gte("due_date", now.toISOString()).lte("due_date", new Date(now.getTime() + days * DAY_MS).toISOString());
    } else if (filters.deadline === "none") {
      q = q.is("due_date", null);
    }

    // Same host fragments lib/matches/rules.ts's matchSource() classifies
    // by, applied as substring matches on the stored link.
    if (filters.source === "sam") {
      q = q.ilike("source_url", `%${SAM_HOST_FRAGMENT}%`);
    } else if (filters.source === "local") {
      q = q.or(LOCAL_HOST_FRAGMENTS.map((f) => `source_url.ilike.*${f}*`).join(","));
    } else if (filters.source === "other") {
      const notKnown = [SAM_HOST_FRAGMENT, ...LOCAL_HOST_FRAGMENTS].map((f) => `source_url.not.ilike.*${f}*`).join(",");
      q = q.or(`source_url.is.null,and(${notKnown})`);
    }

    if (filters.suggested) q = q.not("suggested_client_id", "is", null);

    if (filters.q) {
      // filters.q is already stripped of PostgREST or() syntax characters
      // (sanitizeSearch), so it can't break out of this filter string.
      q = q.or(
        `source_title.ilike.*${filters.q}*,source_agency.ilike.*${filters.q}*,solicitation_number.ilike.*${filters.q}*`
      );
    }
    return q;
  }

  let pageQuery = filtered(columns, { count: "exact" }, filters.status);
  if (filters.sort === "deadline") {
    pageQuery = pageQuery.order("due_date", { ascending: true, nullsFirst: false });
  } else if (filters.sort === "score") {
    pageQuery = pageQuery.order("match_score", { ascending: false, nullsFirst: false });
  }
  pageQuery = pageQuery.order("created_at", { ascending: false });

  const from = (filters.page - 1) * MATCHES_PAGE_SIZE;
  const tabs = [...MATCH_STATUSES, "all"] as const;

  const [pageResult, tradesViewCount, otherViewCount, ...countResults] = await Promise.all([
    pageQuery.range(from, from + MATCHES_PAGE_SIZE - 1),
    filtered("id", { count: "exact", head: true }, filters.status, "trades"),
    filtered("id", { count: "exact", head: true }, filters.status, "other"),
    ...tabs.map((status) => filtered("id", { count: "exact", head: true }, status)),
  ]);
  const viewCounts = { trades: tradesViewCount.count ?? 0, other: otherViewCount.count ?? 0 };

  if (pageResult.error) {
    console.error("[admin/matches] failed to load matches", { message: pageResult.error.message });
  }

  const matches = (pageResult.data ?? []) as unknown as Parameters<typeof MatchesPanel>[0]["initialMatches"];
  const totalForView = pageResult.count ?? 0;
  const counts = Object.fromEntries(tabs.map((status, i) => [status, countResults[i].count ?? 0])) as Record<
    (typeof tabs)[number],
    number
  >;

  const { data: clientsRaw } = await supabase
    .from("clients")
    .select("id, company_name, naics_codes, created_at")
    .eq("org_id", member.org_id)
    .order("created_at", { ascending: false });

  // The same business can end up with more than one row here (duplicate
  // test signups being the common real case an admin actually hit) --
  // keep only the most recently created row per distinct name (trimmed,
  // case-insensitive, so " Coastal Clean..." and "Coastal Clean... "
  // don't count as different names either) so the assign dropdown doesn't
  // show indistinguishable repeats. Nothing is deleted -- an older
  // duplicate's own data (its dashboard, any submissions already tied to
  // its own id) is untouched; it just isn't offered a second time here.
  const seenClientNames = new Set<string>();
  const clients = (clientsRaw ?? [])
    .filter((c) => {
      const key = c.company_name.trim().toLowerCase();
      if (seenClientNames.has(key)) return false;
      seenClientNames.add(key);
      return true;
    })
    .sort((a, b) => a.company_name.trim().localeCompare(b.company_name.trim()))
    .map((c) => ({ id: c.id, company_name: c.company_name, naics_codes: c.naics_codes ?? [] }));

  let trades: Trade[] = [];
  try {
    trades = await loadTrades(supabase, member.org_id);
  } catch (err) {
    console.error("[admin/matches] failed to load trades", { message: err instanceof Error ? err.message : err });
  }

  return (
    <>
      <div className="mt-6">
        <h1 className="text-headline-lg text-primary mb-1">Matched Opportunities</h1>
        <p className="text-body-md text-on-surface-variant">
          Review new matches and assign each one to a client.
        </p>
      </div>

      <MatchesPanel
        // Remount on every filter/page change so row-level UI state (pending
        // assign selections, bulk selection) never leaks into a different
        // set of rows.
        key={JSON.stringify(filters)}
        orgId={member.org_id}
        actorId={member.id}
        initialMatches={matches}
        clients={clients}
        trades={trades}
        viewCounts={viewCounts}
        filters={filters}
        counts={counts}
        totalForView={totalForView}
        pageSize={MATCHES_PAGE_SIZE}
        loadError={pageResult.error ? "Couldn't load matches. Try reloading the page." : null}
      />
    </>
  );
}
