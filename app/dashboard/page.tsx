import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BidListFilter, type BidListItem } from "@/components/ui/BidListFilter";
import { CompleteBidFile } from "./CompleteBidFile";
import { SubmissionCard } from "./SubmissionCard";
import { signRfpDocumentUrls } from "@/lib/storage";
import { BidProcessNotices } from "@/components/ui/BidProcessNotices";
import { isKnownTrade } from "@/lib/compliance/known-trades";
import { computeProfileCompleteness } from "@/lib/compliance/profile-completeness";
import { getSamStatusMessage } from "@/lib/sam-gov/status-message";
import { RETAINER_PLACEHOLDER_AGENCY } from "@/lib/submissions";

// Reads cookies (via lib/supabase/server) which already opts this page out
// of static rendering — confirmed via `Cache-Control: no-store` on the
// actual response. Kept explicit anyway so a future refactor that drops
// the cookies() call can't silently reintroduce caching here.
export const dynamic = "force-dynamic";

// Converted per BUILD-ORDER-BIDPULSE.md Step 5: a read-only status view
// for a client — package info, pending-info checklist (status only, no
// editing — that's admin-only per schema.sql's RLS policies), the 5-stage
// pilot timeline, and deliverables once the submission reaches
// deliverables_ready or later.
//
// Layout matches the Stitch "Real Schema" contractor workspace reference:
// a real stat row and an always-visible "start a new bid" prompt sit above
// the feed; company profile and the certifications vault sit in a
// persistent sidebar (shown once, not per-submission). Every bid (draft,
// active, or closed) gets its own full card in one All/Needs Action/
// Completed-filterable feed (BidListFilter) instead of being split into
// separate sections -- each card collapses by default unless it has a
// pending checklist item or ready deliverables (see SubmissionCard.tsx),
// so a client with several bids isn't scrolling through full detail on
// every one just to see what's new.

// Same values CertificationsSection.tsx's own CERT_TYPES uses -- cert_type
// IS the display label already, except "Other" which stores its real name
// in other_label instead (see that component's own certLabel()).
function certLabel(cert: { cert_type: string; other_label: string | null }): string {
  return cert.cert_type === "Other" ? cert.other_label || "Other" : cert.cert_type;
}

// Exported for SubmissionCard.tsx, which renders these but doesn't fetch
// them -- keeping one shared definition rather than a duplicate that could
// drift from the actual query shape below.
export type Submission = {
  id: string;
  agency: string;
  solicitation_number: string | null;
  due_date: string | null;
  scope: string | null;
  stage: string;
  draft: boolean;
  is_test: boolean;
  package_id: string | null;
  estimated_value: number | null;
  mandatory_site_visit_concern: boolean | null;
  mandatory_site_visit_explanation: string | null;
};

export type ChecklistItem = { id: string; submission_id: string; label: string; status: string; notes: string | null };
export type Deliverable = {
  id: string;
  submission_id: string;
  deliverable_type: string;
  file_url: string | null;
  content: string | null;
  created_at: string;
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: client } = await supabase
    .from("clients")
    .select(
      "id, org_id, company_name, contact_name, naics_codes, license_number, business_registration_number, years_in_business, insurance_provider, general_liability_coverage, workers_comp_coverage, business_address, business_phone, sam_uei, sam_registration_status, sam_registration_expires_at"
    )
    .eq("auth_user_id", user.id)
    .maybeSingle();

  // Not a client account (e.g. an admin landed here directly) — the root
  // page already knows how to route each account type correctly.
  if (!client) redirect("/");

  const { data: certifications } = await supabase
    .from("client_certifications")
    .select("id, cert_type, other_label, certification_number, expiration_date, verified")
    .eq("client_id", client.id)
    .order("created_at", { ascending: true });

  const completeness = computeProfileCompleteness({
    naicsCodes: client.naics_codes,
    licenseNumber: client.license_number,
    businessRegistrationNumber: client.business_registration_number,
    insuranceProvider: client.insurance_provider,
    generalLiabilityCoverage: client.general_liability_coverage,
    workersCompCoverage: client.workers_comp_coverage,
    businessAddress: client.business_address,
    businessPhone: client.business_phone,
    hasCertification: (certifications?.length ?? 0) > 0,
  });

  const samStatusMessage = getSamStatusMessage({
    sam_uei: client.sam_uei,
    sam_registration_status: client.sam_registration_status,
    sam_registration_expires_at: client.sam_registration_expires_at,
  });

  const { data: submissions, error: submissionsError } = await supabase
    .from("submissions")
    .select(
      "id, agency, solicitation_number, due_date, scope, stage, draft, is_test, package_id, created_at, updated_at, estimated_value, mandatory_site_visit_concern, mandatory_site_visit_explanation"
    )
    .eq("client_id", client.id)
    .order("updated_at", { ascending: false });

  // A failed query (e.g. a column that exists in code but not yet in the
  // live database — exactly what happened here once already) must never
  // look identical to "this client genuinely has zero bids." Discarding
  // `error` and falling through to the empty state on any failure is what
  // made that migration gap invisible instead of an obvious error.
  if (submissionsError) {
    console.error("[dashboard] failed to load submissions", {
      clientId: client.id,
      message: submissionsError.message,
      code: submissionsError.code,
      details: submissionsError.details,
      hint: submissionsError.hint,
    });
    return (
      <p className="text-body-md text-error mt-6">
        Something went wrong loading your bids. Please refresh, or contact us if this keeps happening.
      </p>
    );
  }

  if (!submissions || submissions.length === 0) {
    return (
      <>
        <h1 className="text-headline-lg text-primary mt-6 mb-1">Welcome, {client.company_name}.</h1>
        <p className="text-body-md text-on-surface-variant mb-4">You haven&apos;t started a bid yet.</p>
        <Link
          href="/intake"
          className="inline-block py-3 px-4 bg-primary-container text-on-primary-container rounded text-label-md font-semibold hover:opacity-90 hover:-translate-y-0.5 transition active:scale-[0.97] w-fit focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Start your first bid
        </Link>
      </>
    );
  }

  const draftSubmissions = submissions.filter((s) => s.draft);
  const activeSubmissions = submissions.filter((s) => !s.draft && s.stage !== "closed");
  const closedSubmissions = submissions.filter((s) => !s.draft && s.stage === "closed");

  const activeIds = activeSubmissions.map((s) => s.id);
  // Closed submissions now render as full (collapsed-by-default)
  // SubmissionCards too, under the "Completed" filter -- they need their
  // real deliverables fetched too, not just active ones, so a client can
  // still open a finished bid and see its files.
  const cardSubmissionIds = [...activeIds, ...closedSubmissions.map((s) => s.id)];

  const { data: checklistRaw } =
    cardSubmissionIds.length > 0
      ? await supabase
          .from("checklist_items")
          .select("id, submission_id, label, status, notes")
          .in("submission_id", cardSubmissionIds)
          .order("updated_at", { ascending: true })
      : { data: [] as ChecklistItem[] };

  const { data: deliverablesRaw } =
    cardSubmissionIds.length > 0
      ? await supabase
          .from("deliverables")
          .select("id, submission_id, deliverable_type, file_url, content, created_at")
          .in("submission_id", cardSubmissionIds)
      : { data: [] as Deliverable[] };
  const deliverablesSigned = await signRfpDocumentUrls(supabase, deliverablesRaw ?? []);

  const checklistBySubmission = new Map<string, ChecklistItem[]>();
  for (const item of (checklistRaw ?? []) as ChecklistItem[]) {
    const list = checklistBySubmission.get(item.submission_id) ?? [];
    list.push(item);
    checklistBySubmission.set(item.submission_id, list);
  }
  const deliverablesBySubmission = new Map<string, Deliverable[]>();
  for (const d of deliverablesSigned as Deliverable[]) {
    const list = deliverablesBySubmission.get(d.submission_id) ?? [];
    list.push(d);
    deliverablesBySubmission.set(d.submission_id, list);
  }

  const packageIds = Array.from(new Set(submissions.map((s) => s.package_id).filter((id): id is string => !!id)));
  const { data: packagesRaw } =
    packageIds.length > 0
      ? await supabase.from("packages").select("id, package_type, price_note").in("id", packageIds)
      : { data: [] as { id: string; package_type: string; price_note: string | null }[] };
  const packagesById = new Map((packagesRaw ?? []).map((p) => [p.id, p]));

  // Real, computed aggregates -- both about this client's own bids, not an
  // internal admin/ops metric (the Stitch reference's "Staff Estimator
  // Assigned" and "System Status: Live Dispatch" stats belong to the admin
  // console it was rendered with, not a client's own page, so those are
  // skipped entirely rather than adapted).
  const awaitingPreviewCount = activeSubmissions.filter((s) => s.stage === "deliverables_ready").length;

  // Unified All / Needs Action / Completed filter bar (BidListFilter):
  // drafts always need action (they're incomplete); an active bid needs
  // action once deliverables are ready or in client review, or it has a
  // pending checklist item; closed bids are the only "Completed" ones. An
  // active bid that's simply waiting on the First Coast Bids team (submitted/in
  // review, nothing pending) is neither -- it only shows under "All",
  // which is correct: not done, but nothing to act on yet either.
  const bidListItems: BidListItem[] = [
    // A Retainer placeholder (IntakeWizard.tsx's handleRetainerProfileNext)
    // is a real `submissions` row with no actual bid behind it -- rendering
    // it through the normal draft card would show "No solicitation #" next
    // to a "complete your bid file" prompt for an RFP that was never meant
    // to exist. A persona-test + onboarding-skill review both flagged the
    // alternative (nothing on the dashboard reflecting a Retainer signup at
    // all) as a real trust gap, so this needed *some* distinct card, not
    // just suppression -- reuses the same completeness score already
    // computed above rather than introducing a second one.
    ...draftSubmissions.map((sub) =>
      sub.agency === RETAINER_PLACEHOLDER_AGENCY
        ? {
            id: sub.id,
            needsAction: true,
            completed: false,
            node: (
              <div className="bg-surface-container-low rounded-xl shadow-md p-space-base flex flex-col gap-space-base">
                <div>
                  <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">Retainer</p>
                  <h3 className="text-title-lg font-headline text-on-surface font-bold">
                    Watching for a good fit
                  </h3>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <span
                    className={`inline-flex px-3 py-1 rounded-full text-label-md font-bold ${
                      completeness.percent === 100
                        ? "bg-secondary-container text-on-secondary-container"
                        : "bg-tertiary-container text-on-tertiary-container"
                    }`}
                  >
                    Profile {completeness.percent}% complete
                  </span>
                  {completeness.percent < 100 && (
                    <Link
                      href="/dashboard/profile"
                      className="text-label-md text-primary font-bold hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-sm"
                    >
                      Complete your profile →
                    </Link>
                  )}
                </div>
                <p className="text-body-md text-on-surface-variant">
                  We&apos;re watching for opportunities that fit and will reach out when we find one.
                </p>
              </div>
            ),
          }
        : {
            id: sub.id,
            needsAction: true,
            completed: false,
            node: (
              <div className="bg-surface-container-low rounded-xl shadow-md p-space-base flex flex-col gap-space-base">
                <div>
                  <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">
                    {sub.solicitation_number ?? "No solicitation #"}
                  </p>
                  <h3 className="text-title-lg font-headline text-on-surface font-bold">{sub.agency}</h3>
                </div>
                <CompleteBidFile submissionId={sub.id} clientId={client.id} />
                {sub.scope && <p className="text-body-md text-on-surface-variant">{sub.scope}</p>}
              </div>
            ),
          }
    ),
    ...activeSubmissions.map((sub) => {
      const checklist = checklistBySubmission.get(sub.id) ?? [];
      const pendingCount = checklist.filter((c) => c.status !== "done" && c.status !== "waived").length;
      const needsAction = sub.stage === "deliverables_ready" || sub.stage === "client_review" || pendingCount > 0;
      return {
        id: sub.id,
        needsAction,
        completed: false,
        node: (
          <SubmissionCard
            submission={sub as Submission}
            checklist={checklist}
            deliverables={deliverablesBySubmission.get(sub.id) ?? []}
            tradeKnown={isKnownTrade({ naicsCodes: client.naics_codes ?? [], scopeText: sub.scope ?? "" })}
            pkg={sub.package_id ? packagesById.get(sub.package_id) ?? null : null}
            companyName={client.company_name}
            orgId={client.org_id}
            clientId={client.id}
            senderName={client.contact_name ?? client.company_name}
            senderEmail={user.email ?? ""}
          />
        ),
      };
    }),
    ...closedSubmissions.map((sub) => ({
      id: sub.id,
      needsAction: false,
      completed: true,
      node: (
        <SubmissionCard
          submission={sub as Submission}
          checklist={checklistBySubmission.get(sub.id) ?? []}
          deliverables={deliverablesBySubmission.get(sub.id) ?? []}
          tradeKnown={isKnownTrade({ naicsCodes: client.naics_codes ?? [], scopeText: sub.scope ?? "" })}
          pkg={sub.package_id ? packagesById.get(sub.package_id) ?? null : null}
          companyName={client.company_name}
          orgId={client.org_id}
          clientId={client.id}
          senderName={client.contact_name ?? client.company_name}
          senderEmail={user.email ?? ""}
        />
      ),
    })),
  ];

  return (
    <>
      <div className="mt-6 mb-2">
        <h1 className="text-headline-lg text-primary mb-1">Welcome back, {client.company_name}.</h1>
        <p className="text-body-md text-on-surface-variant">Your active bids, in one place.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface-container-low rounded-xl shadow-sm p-space-base flex items-center gap-space-md">
          <span className="material-symbols-outlined text-primary text-[24px]">assignment</span>
          <div>
            <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">Active submissions</p>
            <p className="text-headline-sm text-on-surface font-bold font-code">
              {activeSubmissions.length + draftSubmissions.length}
            </p>
          </div>
        </div>
        <div className="bg-surface-container-low rounded-xl shadow-sm p-space-base flex items-center gap-space-md">
          <span className="material-symbols-outlined text-secondary text-[24px]">visibility</span>
          <div>
            <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">Awaiting your preview</p>
            <p className="text-headline-sm text-on-surface font-bold font-code">{awaitingPreviewCount}</p>
          </div>
        </div>
      </div>

      <Link
        href="/intake"
        className="bg-primary-container/10 hover:bg-primary-container/20 border border-primary-container/30 rounded-xl p-space-base flex items-center gap-space-md transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <span className="material-symbols-outlined text-primary text-[28px] shrink-0">add_circle</span>
        <div className="flex-1 min-w-0">
          <p className="text-body-lg text-on-surface font-bold">Start a new bid</p>
          <p className="text-body-sm text-on-surface-variant">Send us the RFP. We&apos;ll take it from there.</p>
        </div>
        <span className="material-symbols-outlined text-primary shrink-0">arrow_forward</span>
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">work</span>
            <h2 className="text-label-md text-on-surface font-bold uppercase tracking-wider">
              Active workstream · {activeSubmissions.length + draftSubmissions.length} in progress
            </h2>
          </div>

          <BidListFilter items={bidListItems} emptyMessage="Nothing in this view yet." />
        </div>

        {/* Sidebar — shown once, not per submission */}
        <div className="flex flex-col gap-6">
          <div className="bg-surface-container-low rounded-xl shadow-sm p-space-base">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h3 className="text-[16px] font-headline font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">domain</span>
                Company profile
              </h3>
              {/* Replaces the earlier fit_alignment "fit" badge entirely
                  (see BUILD-ORDER-BIDPULSE.md item #10) -- that concept
                  measured profile completeness while reading as a
                  competitive judgment ("Weak fit"). A percentage has
                  nothing alarming to soften: it's concrete and fixable,
                  and stays informational (never red) at every level. */}
              <span
                className={`shrink-0 inline-flex px-2 py-0.5 rounded text-label-sm font-bold uppercase tracking-wider ${
                  completeness.percent === 100
                    ? "bg-secondary-container text-on-secondary-container"
                    : "bg-tertiary-container text-on-tertiary-container"
                }`}
              >
                {completeness.percent}% complete
              </span>
            </div>
            <div className="flex flex-col gap-space-sm text-body-md">
              <p className="text-on-surface font-semibold">{client.company_name}</p>
              {samStatusMessage && <p className="text-body-sm text-error mt-1">{samStatusMessage}</p>}
              {client.business_address && <p className="text-on-surface-variant">{client.business_address}</p>}
              {client.years_in_business != null && (
                <p className="text-on-surface-variant">{client.years_in_business} years in business</p>
              )}
              {client.license_number && <p className="text-on-surface-variant">License #{client.license_number}</p>}
              {(client.insurance_provider || client.general_liability_coverage || client.workers_comp_coverage) && (
                <div className="pt-space-xs border-t border-outline-variant mt-space-xs">
                  <p className="text-label-sm text-on-surface-variant uppercase tracking-wider mb-1">
                    Insurance &amp; bonding
                  </p>
                  {client.insurance_provider && (
                    <p className="text-on-surface-variant">Carrier: {client.insurance_provider}</p>
                  )}
                  {client.general_liability_coverage && (
                    <p className="text-on-surface-variant">General liability: {client.general_liability_coverage}</p>
                  )}
                  {client.workers_comp_coverage && (
                    <p className="text-on-surface-variant">Workers&apos; comp: {client.workers_comp_coverage}</p>
                  )}
                </div>
              )}
              <Link
                href="/dashboard/profile"
                className="text-primary text-label-sm font-bold hover:underline mt-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-sm"
              >
                Edit your profile →
              </Link>
            </div>
          </div>

          <div className="bg-surface-container-low rounded-xl shadow-sm overflow-hidden">
            <div className="px-space-base py-space-sm bg-surface-container-high flex items-center justify-between">
              <h3 className="text-[16px] font-headline font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">verified</span>
                Credentials
              </h3>
              {certifications && certifications.length > 0 && (
                <span className="text-label-sm text-on-surface-variant font-code">
                  {certifications.filter((c) => c.verified).length} of {certifications.length} verified
                </span>
              )}
            </div>
            {certifications && certifications.length > 0 ? (
              <div className="flex flex-col divide-y divide-outline-variant">
                {certifications.map((cert) => (
                  <div key={cert.id} className="px-space-base py-space-sm flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-body-md text-on-surface font-semibold truncate">{certLabel(cert)}</p>
                      {cert.certification_number && (
                        <p className="text-label-sm text-on-surface-variant">Cert #{cert.certification_number}</p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 inline-flex px-2 py-0.5 rounded text-label-sm font-bold uppercase tracking-wider ${
                        cert.verified
                          ? "bg-secondary-container text-on-secondary-container"
                          : "bg-tertiary-container text-on-tertiary-container"
                      }`}
                    >
                      {cert.verified ? "Verified" : "Pending"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-body-md text-on-surface-variant px-space-base py-4">
                No certifications on file yet.{" "}
                <Link
                  href="/dashboard/profile"
                  className="text-primary font-bold hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-sm"
                >
                  Add one
                </Link>
              </p>
            )}
          </div>

          <div className="bg-surface-container-low rounded-xl shadow-sm p-space-base">
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-primary text-[18px]">balance</span>
              <h3 className="text-label-sm text-on-surface font-bold uppercase tracking-wider">
                Bid process reminders
              </h3>
            </div>
            <BidProcessNotices />
          </div>
        </div>
      </div>
    </>
  );
}

