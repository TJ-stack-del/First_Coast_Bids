import Link from "next/link";
import type { WageCheck } from "@/lib/wage/wage-check";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BidLedger, type BidRow } from "./BidLedger";
import { clientTasks, standingLabel } from "@/lib/dashboard/client-tasks";
import { wageCheckLines } from "@/lib/wage/wage-check";
import { displayAgency } from "@/lib/agency-display";
import { formatDue } from "@/lib/dashboard/format-due";
import s from "@/components/marketing/press.module.css";
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
// Layout (docs/superpowers/specs/2026-09-26-client-area-redesign-design.md):
// "Needs you" first, then every bid as a one-line row that opens to its
// details (BidLedger.tsx), then a one-line summary of the client's file
// (profile completeness, credentials) and the bid process reminders.

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
  wage_check: WageCheck | null;
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
      "id, agency, solicitation_number, due_date, scope, stage, draft, is_test, package_id, created_at, updated_at, estimated_value, mandatory_site_visit_concern, mandatory_site_visit_explanation, wage_check"
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
      <header className={`${s.pageHead} mt-4`}>
        <h1 className="text-headline-lg">Your bids</h1>
        <p className="text-body-md text-error">
          Something went wrong loading your bids. Please refresh, or contact us if this keeps happening.
        </p>
      </header>
    );
  }

  if (!submissions || submissions.length === 0) {
    return (
      <header className={`${s.pageHead} mt-4`}>
        <h1 className="text-headline-lg">Your bids</h1>
        <p className={s.lede}>Welcome, {client.company_name}. You haven&apos;t started a bid yet.</p>
        <Link href="/intake" className={`${s.btn} ${s.btnPrimary} w-fit mt-2`}>
          Start your first bid
        </Link>
      </header>
    );
  }

  const draftSubmissions = submissions.filter((sub) => sub.draft);
  const activeSubmissions = submissions.filter((sub) => !sub.draft && sub.stage !== "closed");
  const closedSubmissions = submissions.filter((sub) => !sub.draft && sub.stage === "closed");

  const activeIds = activeSubmissions.map((sub) => sub.id);
  // Closed submissions now render as full (collapsed-by-default)
  // SubmissionCards too, under the "Completed" filter -- they need their
  // real deliverables fetched too, not just active ones, so a client can
  // still open a finished bid and see its files.
  const cardSubmissionIds = [...activeIds, ...closedSubmissions.map((sub) => sub.id)];

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

  const packageIds = Array.from(new Set(submissions.map((sub) => sub.package_id).filter((id): id is string => !!id)));
  const { data: packagesRaw } =
    packageIds.length > 0
      ? await supabase.from("packages").select("id, package_type, price_note").in("id", packageIds)
      : { data: [] as { id: string; package_type: string; price_note: string | null }[] };
  const packagesById = new Map((packagesRaw ?? []).map((p) => [p.id, p]));

  const tradeKnownFor = (scope: string | null) =>
    isKnownTrade({ naicsCodes: client.naics_codes ?? [], scopeText: scope ?? "" });
  const pendingCountFor = (id: string) =>
    (checklistBySubmission.get(id) ?? []).filter((c) => c.status !== "done" && c.status !== "waived").length;
  const isPlaceholder = (sub: { agency: string }) => sub.agency === RETAINER_PLACEHOLDER_AGENCY;

  // "Needs you" (lib/dashboard/client-tasks.ts): one task per waiting bid,
  // from signals the app already has -- a draft without its bid file, open
  // checklist items, a package ready to review.
  const tasks = clientTasks(
    submissions.map((sub) => ({
      id: sub.id,
      draft: sub.draft,
      stage: sub.stage,
      isRetainerPlaceholder: isPlaceholder(sub),
      pendingCount: pendingCountFor(sub.id),
    })),
    completeness.percent
  );
  const taskBidIds = new Set(tasks.map((t) => t.bidId));

  // Drafts first (they're waiting on the client), then bids in progress,
  // then closed ones -- each group newest-updated first, as queried.
  const rows: BidRow[] = [...draftSubmissions, ...activeSubmissions, ...closedSubmissions].map((sub) => {
    const placeholder = isPlaceholder(sub);
    const flags: string[] = [];
    if (sub.wage_check && wageCheckLines(sub.wage_check).warning) flags.push("Below the wage-law floor");
    if (sub.mandatory_site_visit_concern) flags.push("Mandatory site visit");

    let detail: React.ReactNode;
    if (placeholder) {
      // A Retainer placeholder (IntakeWizard.tsx's handleRetainerProfileNext)
      // is a real `submissions` row with no actual bid behind it -- it gets
      // its own row so a Retainer signup shows on the dashboard at all,
      // without a "complete your bid file" prompt for an RFP that was never
      // meant to exist.
      detail = (
        <div className="flex flex-col gap-3">
          <p className="text-body-md text-on-surface-variant">
            We&apos;re watching for opportunities that fit and will reach out when we find one.
          </p>
          <p className="text-body-md text-on-surface">
            Your company profile is <span className="font-code">{completeness.percent}%</span> complete.{" "}
            {completeness.percent < 100 && (
              <Link href="/dashboard/profile" className={s.inlineLink}>
                Complete your profile
              </Link>
            )}
          </p>
        </div>
      );
    } else if (sub.draft) {
      detail = (
        <div className="flex flex-col gap-space-base">
          <CompleteBidFile submissionId={sub.id} clientId={client.id} />
          {sub.scope && <p className="text-body-md text-on-surface-variant">{sub.scope}</p>}
        </div>
      );
    } else {
      detail = (
        <SubmissionCard
          submission={sub as Submission}
          checklist={checklistBySubmission.get(sub.id) ?? []}
          deliverables={deliverablesBySubmission.get(sub.id) ?? []}
          tradeKnown={tradeKnownFor(sub.scope)}
          pkg={sub.package_id ? packagesById.get(sub.package_id) ?? null : null}
          orgId={client.org_id}
          clientId={client.id}
          senderName={client.contact_name ?? client.company_name}
          senderEmail={user.email ?? ""}
        />
      );
    }

    return {
      id: sub.id,
      title: placeholder ? "Retainer" : displayAgency(sub.agency),
      solicitation: placeholder ? null : sub.solicitation_number,
      due: placeholder ? null : formatDue(sub.due_date),
      standing: standingLabel({ draft: sub.draft, stage: sub.stage, isRetainerPlaceholder: placeholder }),
      needsAction: taskBidIds.has(sub.id),
      completed: !sub.draft && sub.stage === "closed",
      isTest: sub.is_test,
      flags,
      detail,
    };
  });

  const verifiedCount = (certifications ?? []).filter((c) => c.verified).length;
  const certCount = certifications?.length ?? 0;

  return (
    <>
      <header className="mt-4 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
        <div className={s.pageHead}>
          <h1 className="text-headline-lg">Your bids</h1>
          <p className={s.lede}>Here&apos;s what needs you, and where everything else stands.</p>
        </div>
        <Link href="/intake" className={`${s.btn} ${s.btnPrimary} self-start md:self-auto shrink-0`}>
          Start a new bid
        </Link>
      </header>

      <BidLedger rows={rows} tasks={tasks} />

      <section aria-labelledby="your-file" className="flex flex-col gap-3 border-t-2 border-on-surface pt-6">
        <h2 id="your-file" className="text-headline-md">
          Your file
        </h2>
        <p className="text-body-md text-on-surface flex flex-wrap gap-x-3 gap-y-1">
          <Link href="/dashboard/profile" className={s.inlineLink}>
            Company profile <span className="font-code">{completeness.percent}%</span> complete
          </Link>
          <span aria-hidden="true" className="text-on-surface-variant">
            ·
          </span>
          {certCount > 0 ? (
            <Link href="/dashboard/compliance" className={s.inlineLink}>
              Credentials <span className="font-code">{verifiedCount}</span> of{" "}
              <span className="font-code">{certCount}</span> verified
            </Link>
          ) : (
            <span>
              No credentials on file yet.{" "}
              <Link href="/dashboard/compliance" className={s.inlineLink}>
                Add one
              </Link>
            </span>
          )}
        </p>
        {samStatusMessage && <p className="text-body-md text-error">{samStatusMessage}</p>}
      </section>

      {/* Reference reading, not something that needs the client today --
          closed by default so the page stays about their bids. */}
      <details className="group border-t-2 border-on-surface pt-4">
        <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer min-h-[48px] flex items-center justify-between gap-4 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
          <h2 className="text-headline-md">Bid process reminders</h2>
          <span
            className="material-symbols-outlined text-on-surface-variant transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
            aria-hidden="true"
          >
            expand_more
          </span>
        </summary>
        <div className="pt-3">
          <BidProcessNotices />
        </div>
      </details>
    </>
  );
}
