import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MatchesPanel } from "./MatchesPanel";

// BUILD-ORDER-BIDPULSE.md Step 8: "adapt the existing scrapers
// (lib/scrapers/*)" — that directory doesn't exist anywhere in this repo,
// so there's nothing to adapt. What's built here is the other half that
// stands on its own: an admin screen to review matched_opportunities and
// assign one to a client, which seeds a real submission for them. Until a
// scraper exists, opportunities get logged manually from this same screen.

export default async function AdminMatchesPage() {
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

  const { data: matches } = await supabase
    .from("matched_opportunities")
    .select(
      "id, source_title, source_agency, source_url, scope, solicitation_number, due_date, match_score, status, assigned_client_id, naics_code, suggested_client_id, created_at"
    )
    .eq("org_id", member.org_id)
    // Scored (SAM.gov-sourced) rows first, highest match_score first;
    // unscored JAA/COJ rows (match_score null) sort after all scored rows
    // via nullsFirst: false, then fall back to the existing recency order.
    .order("match_score", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

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

  return (
    <>
      <div className="mt-6">
        <h1 className="text-headline-lg text-primary mb-1">Matched Opportunities</h1>
        <p className="text-body-md text-on-surface-variant">
          Review new matches and assign each one to a client.
        </p>
      </div>

      <MatchesPanel
        orgId={member.org_id}
        actorId={member.id}
        initialMatches={matches ?? []}
        clients={clients}
      />
    </>
  );
}
