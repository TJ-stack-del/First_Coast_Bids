import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ThresholdSettingsForm } from "./ThresholdSettingsForm";

export default async function AdminSettingsPage() {
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

  const { data: org } = await supabase
    .from("organizations")
    .select("id, lean_package_threshold")
    .eq("id", member.org_id)
    .single();

  return (
    <>
      <div className="mt-6">
        <h1 className="text-headline-lg text-primary mb-1">Settings</h1>
        <p className="text-body-md text-on-surface-variant">Business-wide settings for how First Coast Bids works.</p>
      </div>

      <div className="mt-6 bg-surface-container-lowest dark:bg-surface-container-low border border-outline-variant rounded-xl p-6 max-w-xl">
        <h2 className="text-title-lg text-primary mb-2 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[20px]">payments</span>
          Lean package threshold
        </h2>
        <p className="text-body-md text-on-surface-variant mb-4">
          For informal quotes below this dollar value, the deliverables panel will suggest a lean package
          (Rate Sheet + Executive Cover + Certificate of Insurance) instead of the full set. The default,
          $35,000, is the <strong>state</strong> threshold under FL Statute 287.017 Category Two. Local bodies
          (JEA, JAA, City of Jacksonville, Duval Schools) may set their own, so adjust this to match what
          you&apos;re actually seeing in practice.
        </p>
        {org ? (
          <ThresholdSettingsForm orgId={org.id} initialThreshold={org.lean_package_threshold} />
        ) : (
          <p className="text-body-md text-error">Couldn&apos;t load organization settings.</p>
        )}
      </div>
    </>
  );
}
