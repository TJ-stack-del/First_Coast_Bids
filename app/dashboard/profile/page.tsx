import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CompanyProfileClient } from "./CompanyProfileClient";

// Same cookies()-forces-dynamic reasoning as app/dashboard/page.tsx.
export const dynamic = "force-dynamic";

// Trimmed to just Company Info per explicit user direction -- Certifications,
// Insurance & Bonding, Document Library, and Past Performance moved to
// app/dashboard/compliance/page.tsx (the "Compliance Vault" tab in the
// target mockup), which had gotten crowded here after landing all of it on
// this one page across Phases 1-3 of that build.
export default async function CompanyProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: client } = await supabase
    .from("clients")
    .select(
      "id, company_name, contact_name, email, phone, license_number, business_registration_number, years_in_business, business_address, business_phone, insurance_provider, insurance_policy_number, general_liability_coverage, workers_comp_coverage, commercial_auto_coverage, differentiators, naics_codes, small_business_statuses, set_asides, sam_uei"
    )
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!client) redirect("/");

  return (
    <>
      <div className="mt-6">
        <h1 className="text-headline-lg text-primary mb-1">Company Profile</h1>
        <p className="text-body-md text-on-surface-variant">{client.company_name}</p>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 mt-4">
        <h2 className="text-title-lg text-primary mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[20px]">business</span>
          Company Info
        </h2>
        <p className="text-body-md text-on-surface-variant mb-4">
          Fill this in once. We reuse it as real facts in every capability statement and readiness check we
          prepare for you, so you don&apos;t have to re-enter it on every bid.
        </p>
        <CompanyProfileClient
          clientId={client.id}
          initialInfo={{
            license_number: client.license_number,
            business_registration_number: client.business_registration_number,
            years_in_business: client.years_in_business,
            business_address: client.business_address,
            business_phone: client.business_phone,
            insurance_provider: client.insurance_provider,
            insurance_policy_number: client.insurance_policy_number,
            general_liability_coverage: client.general_liability_coverage,
            workers_comp_coverage: client.workers_comp_coverage,
            commercial_auto_coverage: client.commercial_auto_coverage,
            differentiators: client.differentiators,
            naics_codes: client.naics_codes ?? [],
            small_business_statuses: client.small_business_statuses ?? [],
            set_asides: client.set_asides ?? [],
            sam_uei: client.sam_uei,
          }}
        />
      </div>
    </>
  );
}
