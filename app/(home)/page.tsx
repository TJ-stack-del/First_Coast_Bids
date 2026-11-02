import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DeskHome } from "@/components/marketing/desk/DeskHome";

// Its own route group (not (marketing)) since 2026-11-02: the desk homepage
// carries its own nav and footer, so it skips MarketingShell and the press
// theme that the inner marketing pages still use.
export const metadata: Metadata = {
  description: "Your bid, complete and in on time. We do the paperwork for city, county and school bids in Northeast Florida.",
};

// Also the one place that decides where a signed-in user actually lands —
// see MIGRATION-TO-BIDPULSE.md: admin (team_members) and client (clients)
// are two completely separate account types now, so routing has to branch
// on which row exists rather than sending everyone to the same dashboard.
// An anonymous visitor gets the public marketing homepage instead (Step 3).
export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return <DeskHome />;

  const { data: member } = await supabase
    .from("team_members")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (member) redirect("/admin/inbox");

  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (client) redirect("/dashboard");

  return (
    <main className="min-h-screen flex items-center justify-center bg-surface px-margin-mobile py-12 text-center">
      <p className="text-body-md text-error">No account found for this login. Contact support.</p>
    </main>
  );
}
