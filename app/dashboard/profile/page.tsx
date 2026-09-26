import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CompanyProfileClient } from "./CompanyProfileClient";
import { loadActiveTrades } from "@/lib/trades/server";
import { offeredNaicsOptions, type NaicsOption } from "@/lib/trades/naics-options";
import s from "@/components/marketing/press.module.css";

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

  let offeredNaics: NaicsOption[] = [];
  try {
    offeredNaics = offeredNaicsOptions(await loadActiveTrades(supabase));
  } catch (err) {
    console.error("[profile] failed to load trades", { message: err instanceof Error ? err.message : err });
  }

  if (!client) redirect("/");

  return (
    <>
      <header className={`${s.pageHead} mt-4`}>
        <h1 className="text-headline-lg">Company profile</h1>
        <p className={s.lede}>{client.company_name}</p>
      </header>

      <section className="border-t-2 border-on-surface pt-6 flex flex-col gap-4">
        <h2 className="text-headline-md">Company info</h2>
        <p className="text-body-md text-on-surface-variant max-w-[44em]">
          Fill this in once. We reuse it as real facts in every capability statement and readiness check we
          prepare for you, so you don&apos;t have to re-enter it on every bid.
        </p>
        <div className="bg-surface-container-lowest border border-outline-variant p-4 md:p-6">
          <CompanyProfileClient
            clientId={client.id}
            offeredNaics={offeredNaics}
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
      </section>
    </>
  );
}
