import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LifecycleStepper, stageNumber } from "@/components/ui/LifecycleStepper";
import { AdminSubmissionActions } from "./AdminSubmissionActions";
import { DeliverablesPanel } from "./DeliverablesPanel";
import { PaymentStatus } from "./PaymentStatus";
import { ClientCertifications } from "./ClientCertifications";
import { AdminInsuranceBonding } from "./AdminInsuranceBonding";
import { signRfpDocumentUrl, signRfpDocumentUrls } from "@/lib/storage";
import { EstimatedValueInput } from "./EstimatedValueInput";
import { RequestInfoForm } from "./RequestInfoForm";
import { buildClientInfoRequestDraft } from "@/lib/client-info-request";
import { DeleteSubmissionButton } from "./DeleteSubmissionButton";
import { IsTestToggle } from "./IsTestToggle";
import { SubmissionMessages } from "@/components/ui/SubmissionMessages";
import { SubmissionDocuments } from "@/components/ui/SubmissionDocuments";
import { ChecklistSuggestionsPanel } from "./ChecklistSuggestionsPanel";
import { WageWorksheet } from "./WageWorksheet";
import { ClinPricingPanel } from "./ClinPricingPanel";
import { isFederalAgency } from "@/lib/federal-agency";
import { filesFingerprint } from "@/lib/checklist/scan-state";
import { pickWdSuggestion } from "@/lib/wage/prefill";
import { isKnownTrade } from "@/lib/compliance/known-trades";
import { computePreflightSummary } from "@/lib/compliance/preflight-summary";
import { AdminFirstViewTransition } from "./AdminFirstViewTransition";

// The actual review workspace: full intake info, stage editing, internal
// notes, checklist, deliverables. This is where the "admin does the real
// work" part of the done-for-you model happens.

export default async function AdminSubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // org_id/actor_id are needed for correct audit_log writes below (see
  // AdminSubmissionActions/DeliverablesPanel) — RLS only lets this resolve
  // for an actual admin's own org, same as the rest of /admin/inbox.
  const { data: member } = await supabase
    .from("team_members")
    .select("id, org_id, full_name")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!member) redirect("/");

  const { data: submission } = await supabase
    .from("submissions")
    .select(
      "*, clients!submissions_client_id_fkey(company_name, contact_name, email, phone, naics_codes, license_number, years_in_business, business_address, business_phone, insurance_provider, insurance_policy_number, general_liability_coverage, workers_comp_coverage, differentiators)"
    )
    .eq("id", id)
    .single();

  if (!submission) {
    return <p className="text-body-md text-error mt-6">Submission not found.</p>;
  }

  const { data: notes } = await supabase
    .from("admin_notes")
    .select("id, note, created_at")
    .eq("submission_id", id)
    .order("created_at", { ascending: false });

  const { data: checklist } = await supabase
    .from("checklist_items")
    .select("id, label, status, notes, owner, client_notified_at")
    .eq("submission_id", id);

  const { data: deliverablesRaw } = await supabase
    .from("deliverables")
    .select("id, deliverable_type, file_url, content, created_at")
    .eq("submission_id", id);
  const deliverables = await signRfpDocumentUrls(supabase, deliverablesRaw ?? []);

  const { data: certificationsRaw } = await supabase
    .from("client_certifications")
    .select(
      "id, cert_type, other_label, certification_number, expiration_date, file_url, file_name, verified, record_type, jurisdiction_state, licensing_board"
    )
    .eq("client_id", submission.client_id)
    .order("created_at", { ascending: false });
  const certifications = await signRfpDocumentUrls(supabase, certificationsRaw ?? []);

  const { data: insurancePoliciesRaw } = await supabase
    .from("client_insurance_policies")
    .select("id, policy_type, carrier_name, policy_number, per_occurrence_limit, aggregate_limit, expiration_date, file_url, file_name, verified")
    .eq("client_id", submission.client_id)
    .order("created_at", { ascending: false });
  const insurancePolicies = await signRfpDocumentUrls(supabase, insurancePoliciesRaw ?? []);

  const { data: bondingRaw } = await supabase
    .from("client_bonding_capacity")
    .select("id, surety_name, bond_number, aggregate_bonding_capacity, single_project_bonding_capacity, expiration_date, file_url, file_name, verified")
    .eq("client_id", submission.client_id)
    .order("created_at", { ascending: false });
  const bondingRecords = await signRfpDocumentUrls(supabase, bondingRaw ?? []);

  const preflightChecks = computePreflightSummary({ deliverables, certifications });

  const { data: pkg } = submission.package_id
    ? await supabase
        .from("packages")
        .select("id, package_type, price_note, paid, paid_at")
        .eq("id", submission.package_id)
        .maybeSingle()
    : { data: null };

  // Packages are 1:many with submissions (no unique constraint ties a
  // package to one submission, and packages has no submission_id column at
  // all) — a retainer can cover several bids for the same client, so the
  // Payment card offers reusing one of these instead of always creating new.
  const { data: clientPackages } = await supabase
    .from("packages")
    .select("id, package_type, price_note, paid, paid_at, created_at")
    .eq("client_id", submission.client_id)
    .order("created_at", { ascending: false });

  const { data: org } = await supabase
    .from("organizations")
    .select("lean_package_threshold")
    .eq("id", member.org_id)
    .single();

  // For the compliance matrix's "View in RFP" links: each extracted
  // requirement (lib/rfp-requirements.ts) names the source file it came
  // from, but only as a bare filename -- the bucket is private, so turning
  // that into something clickable needs the same signed-URL treatment as
  // every other file on this page.
  const { data: rfpDocs } = await supabase
    .from("submission_documents")
    .select("file_name, file_url, created_at")
    .eq("submission_id", id)
    .eq("document_type", "rfp_file");
  const rfpDocumentUrls: Record<string, string> = {};
  for (const doc of rfpDocs ?? []) {
    const signed = await signRfpDocumentUrl(supabase, doc.file_url);
    if (signed) rfpDocumentUrls[doc.file_name] = signed;
  }

  const { data: suggestions } = await supabase
    .from("checklist_suggestions")
    .select("id, kind, federal, label, detail, quote, page, source_file, quote_status, found_by, suggested_owner, status, dedupe_key, created_at")
    .eq("submission_id", id)
    .order("created_at", { ascending: true });
  // Same rule as /api/send-checklist-items: client items not yet emailed and not finished.
  const unsentClientItems = (checklist ?? []).filter(
    (c: any) => c.owner === "client" && !c.client_notified_at && c.status !== "done" && c.status !== "waived"
  ).length;

  const { data: auditLog } = await supabase
    .from("audit_log")
    .select("id, event_type, event_detail, created_at, team_members(full_name)")
    .eq("submission_id", id)
    .order("created_at", { ascending: false });

  const client = submission.clients as any;

  // Safety net: is this bid's trade one First Coast Bids has real compliance
  // coverage for at all (lib/compliance/known-trades.ts)? If not, the
  // compliance matrix can look complete without being complete — flag it
  // here with the same visual weight as the mandatory-site-visit warning
  // below, not just in the deliverable content itself.
  const tradeKnown = isKnownTrade({ naicsCodes: client?.naics_codes ?? [], scopeText: submission.scope ?? "" });

  // Second-person, client-facing draft built straight from the same
  // underlying facts the Fit Check panel uses — not from fit_explanation
  // itself, which is third-person prose written for admin's own reading
  // and was never meant to be sent to the client it's about.
  const clientInfoRequestDraft = buildClientInfoRequestDraft({
    naicsCodes: client?.naics_codes ?? [],
    scope: submission.scope,
    hasLicense: !!client?.license_number,
    hasInsurance: !!(client?.insurance_provider || client?.general_liability_coverage),
    hasVerifiedCertification: certifications.some((cert) => cert.verified),
  });

  const STAGE_LABELS: Record<string, string> = {
    submitted: "Submitted",
    in_review: "In review",
    deliverables_ready: "Deliverables ready",
    client_review: "Client review",
    closed: "Closed",
  };

  // Same labels/framing as the client's own confirmation screen — a
  // readiness read for our own prep process, never a chance-of-winning claim.
  const FIT_LABELS: Record<string, string> = {
    strong: "Strong fit",
    moderate: "Moderate fit",
    weak: "Worth a second look",
  };
  const FIT_STYLE: Record<string, string> = {
    strong: "bg-secondary-container text-on-secondary-container",
    moderate: "bg-surface-container-highest text-on-surface-variant",
    weak: "bg-surface-container-highest text-on-surface-variant",
  };

  const AUDIT_EVENT_LABELS: Record<string, string> = {
    stage_change: "Stage changed",
    deliverable_prepared: "Deliverable prepared",
    confirmation_email_sent: "Confirmation email sent",
    submission_locked: "Submitted by client",
    no_guarantee_acknowledged: "Client acknowledged no guarantee of winning",
    info_requested: "Requested info from client",
    submission_created_from_match: "Created from matched opportunity",
    payment_marked_paid: "Marked as paid",
    payment_marked_unpaid: "Marked as unpaid",
    package_linked: "Package linked",
    stage_change_email_sent: "Client notified by email",
    message_email_sent: "Client notified of new message",
    stage_auto_advanced: "Stage auto-advanced",
    client_viewed_packet: "Client viewed packet",
    client_downloaded_packet: "Client downloaded packet",
    certification_verified: "Certification verified",
    certification_unverified: "Certification marked unverified",
    submission_deleted: "Submission deleted",
    matched_opportunity_deleted: "Matched opportunity deleted",
    // Logged by IntakeWizard.tsx when the client arrived via a
    // ?package=... pricing-tier link -- see that file's own comment for
    // why this exists (an admin following up needs to know which tier was
    // actually clicked, since package_type itself isn't set until the
    // admin assigns it manually via PaymentStatus.tsx below).
    requested_pilot_package: "Clicked \"Get started\" from the Pilot pricing tier",
    requested_one_off_package: "Clicked \"Get started\" from the One-off pricing tier",
    requested_retainer_package: "Clicked \"Get started\" from the Retainer pricing tier",
  };

  // Most recent of either type — a download implies a view, so either one
  // answers "has the client actually looked at this." auditLog is already
  // ordered created_at desc, so the first match is the most recent.
  const lastPacketView =
    (auditLog ?? []).find(
      (e) => e.event_type === "client_viewed_packet" || e.event_type === "client_downloaded_packet"
    ) ?? null;

  return (
    <>
      {!submission.draft && (
        <AdminFirstViewTransition
          submissionId={submission.id}
          initialStage={submission.stage}
        />
      )}
      {!tradeKnown && (
        <div className="mt-6 bg-error-container/20 border border-error/30 rounded-xl p-4 flex gap-3">
          <span className="material-symbols-outlined text-error text-[20px] shrink-0">warning</span>
          <div>
            <p className="text-label-md text-error font-bold uppercase tracking-wide mb-1">
              No trade-specific compliance rules on file for this industry
            </p>
            <p className="text-body-md text-on-surface">
              Verify requirements manually before relying on this checklist.
            </p>
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-label-md text-on-surface-variant uppercase tracking-wider mb-1">
            {client?.company_name}
            {submission.solicitation_number && (
              <span className="font-code text-primary"> · {submission.solicitation_number}</span>
            )}
          </p>
          <h1 className="text-headline-lg text-primary">{submission.agency}</h1>
        </div>
        <span className="inline-flex px-3 py-1 rounded-full text-label-md font-bold uppercase tracking-wider bg-secondary-container text-on-secondary-container">
          {STAGE_LABELS[submission.stage] ?? submission.stage}
        </span>
      </div>

      <LifecycleStepper currentStage={stageNumber(submission.stage)} />

      {/* Mechanical pre-flight checks -- never an LLM judgment call, same
          reasoning as every other compliance detector in this codebase.
          Surfaces what the software already knows (deliverable content
          present, certification verified status, leftover bracketed
          placeholders) so review attention goes straight to what's
          actually ambiguous, per Admin-Review-Rubric.md. */}
      <div className="mt-4 flex flex-wrap gap-2">
        {preflightChecks.map((check) => (
          <span
            key={check.key}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded text-label-sm font-bold uppercase tracking-wider ${
              check.ok
                ? "bg-secondary-container text-on-secondary-container"
                : "bg-tertiary-container text-on-tertiary-container"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">{check.ok ? "check_circle" : "warning"}</span>
            {check.label}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
            <h2 className="text-title-lg text-primary mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">info</span>
              Bid details
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-body-md">
              <div>
                <span className="text-label-md text-on-surface-variant block">Solicitation #</span>
                {submission.solicitation_number ?? "—"}
              </div>
              <div>
                <span className="text-label-md text-on-surface-variant block">Due date</span>
                {submission.due_date ? new Date(submission.due_date).toLocaleDateString() : "—"}
              </div>
              <div>
                <EstimatedValueInput submissionId={submission.id} initialValue={submission.estimated_value} />
              </div>
              <div className="col-span-2">
                <span className="text-label-md text-on-surface-variant block">Scope</span>
                {submission.scope ?? "—"}
              </div>
            </div>

            {/* The RFP-specific compliance matrix rows (wage determination,
                addenda acknowledgment, the agency's own bid form, reference
                format) can only be confirmed against the actual solicitation
                document -- this is the client's real uploaded copy of it,
                not a summary. Without this, an admin working the compliance
                matrix had no way to open it from here at all. */}
            <h3 className="text-label-md text-on-surface-variant uppercase tracking-wider mt-6 mb-2">
              RFP documents
            </h3>
            <SubmissionDocuments submissionId={submission.id} />
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
            <h2 className="text-title-lg text-primary mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">person</span>
              Client info
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-body-md">
              <div>
                <span className="text-label-md text-on-surface-variant block">Contact</span>
                {client?.contact_name}
              </div>
              <div>
                <span className="text-label-md text-on-surface-variant block">Email</span>
                {client?.email}
              </div>
              <div>
                <span className="text-label-md text-on-surface-variant block">Phone</span>
                {/* client.phone is the account's login/SMS-auth number --
                    only ever set if the client signed up with a phone
                    number instead of email, and extraction deliberately
                    never writes to it (see CompanyProfileClient.tsx). This
                    is a display-only fallback to business_phone, not a
                    data change -- recurring admin complaint that no phone
                    number showed at all for the (common) email-signup
                    case, when a business phone was in fact on file. */}
                {client?.phone ?? client?.business_phone ?? "—"}
                {!client?.phone && client?.business_phone && (
                  <span className="text-label-sm text-on-surface-variant"> (business)</span>
                )}
              </div>
              <div>
                <span className="text-label-md text-on-surface-variant block">NAICS codes</span>
                {(client?.naics_codes ?? []).join(", ") || "—"}
              </div>
              <div>
                <span className="text-label-md text-on-surface-variant block">License #</span>
                {client?.license_number ?? "—"}
              </div>
              <div>
                <span className="text-label-md text-on-surface-variant block">Years in business</span>
                {client?.years_in_business ?? "—"}
              </div>
              <div>
                <span className="text-label-md text-on-surface-variant block">Business address</span>
                {client?.business_address ?? "—"}
              </div>
              <div>
                <span className="text-label-md text-on-surface-variant block">Business phone</span>
                {client?.business_phone ?? "—"}
              </div>
              <div>
                <span className="text-label-md text-on-surface-variant block">Insurance</span>
                {client?.insurance_provider
                  ? `${client.insurance_provider}${client.insurance_policy_number ? ` (#${client.insurance_policy_number})` : ""}`
                  : "—"}
              </div>
              <div>
                <span className="text-label-md text-on-surface-variant block">GL / Workers' Comp</span>
                {[client?.general_liability_coverage, client?.workers_comp_coverage].filter(Boolean).join(" | ") || "—"}
              </div>
              <div className="col-span-2">
                <span className="text-label-md text-on-surface-variant block">Differentiators</span>
                {client?.differentiators ?? "—"}
              </div>
            </div>

            <h3 className="text-label-md text-on-surface-variant uppercase tracking-wider mt-6 mb-2">
              Certifications
            </h3>
            <ClientCertifications
              orgId={member.org_id}
              actorId={member.id}
              certifications={certifications}
            />

            <h3 className="text-label-md text-on-surface-variant uppercase tracking-wider mt-6 mb-2">
              Insurance & Bonding
            </h3>
            <AdminInsuranceBonding
              orgId={member.org_id}
              actorId={member.id}
              insurancePolicies={insurancePolicies}
              bondingRecords={bondingRecords}
            />
          </div>

          <ChecklistSuggestionsPanel
            submissionId={submission.id}
            initialScan={(submission.checklist_scan ?? null) as any}
            initialSuggestions={(suggestions ?? []) as any}
            rfpDocumentUrls={rfpDocumentUrls}
            hasRfpFiles={(rfpDocs ?? []).length > 0}
            currentFingerprint={(rfpDocs ?? []).length > 0 ? filesFingerprint(rfpDocs ?? []) : null}
            unsentClientItems={unsentClientItems}
          />
          {(isFederalAgency(submission.agency) || (suggestions ?? []).some((s: any) => s.kind === "wage_determination")) && (
            <WageWorksheet
              submissionId={submission.id}
              wdRef={(() => {
                const wd = pickWdSuggestion((suggestions ?? []) as any);
                return wd ? `${wd.number}|${wd.revision ?? ""}` : null;
              })()}
            />
          )}
          {(isFederalAgency(submission.agency) || (suggestions ?? []).some((s: any) => s.federal)) && (
            <ClinPricingPanel submissionId={submission.id} rfpDocumentUrls={rfpDocumentUrls} />
          )}
          <AdminSubmissionActions
            submissionId={submission.id}
            actorId={member.id}
            currentStage={submission.stage}
            checklist={checklist ?? []}
            notes={notes ?? []}
          />

          <PaymentStatus
            submissionId={submission.id}
            orgId={member.org_id}
            actorId={member.id}
            clientId={submission.client_id}
            packageId={pkg?.id ?? null}
            packageType={pkg?.package_type ?? null}
            packagePriceNote={pkg?.price_note ?? null}
            initialPaid={pkg?.paid ?? false}
            initialPaidAt={pkg?.paid_at ?? null}
            existingPackages={(clientPackages ?? []).filter((p) => p.id !== pkg?.id)}
          />

          <DeliverablesPanel
            submissionId={submission.id}
            orgId={member.org_id}
            actorId={member.id}
            initialDeliverables={deliverables}
            lastPacketView={lastPacketView}
            estimatedValue={submission.estimated_value}
            leanPackageThreshold={org?.lean_package_threshold ?? 35000}
            rfpRequirements={submission.rfp_requirements ?? []}
            rfpDocumentUrls={rfpDocumentUrls}
          />
        </div>

        <div className="flex flex-col gap-6">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
            <h3 className="text-title-lg text-primary mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">admin_panel_settings</span>
              Status
            </h3>
            <p className="text-body-md text-on-surface-variant">
              Stage: <span className="font-bold text-on-surface">{STAGE_LABELS[submission.stage] ?? submission.stage}</span>
            </p>
            <IsTestToggle submissionId={submission.id} initialValue={submission.is_test} />
            <div className="mt-4 pt-4 border-t border-outline-variant">
              <DeleteSubmissionButton
                submissionId={submission.id}
                orgId={member.org_id}
                actorId={member.id}
                agency={submission.agency}
                companyName={client?.company_name ?? "this client"}
              />
            </div>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
            <h3 className="text-title-lg text-primary mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">travel_explore</span>
              Fit check
            </h3>
            {submission.fit_alignment ? (
              <>
                <span
                  className={`inline-flex px-3 py-1 rounded-full text-label-md font-bold ${
                    FIT_STYLE[submission.fit_alignment] ?? "bg-surface-container-highest text-on-surface-variant"
                  }`}
                >
                  {FIT_LABELS[submission.fit_alignment] ?? submission.fit_alignment}
                </span>
                <p className="text-body-md text-on-surface-variant mt-2">{submission.fit_explanation}</p>
              </>
            ) : (
              <p className="text-body-md text-on-surface-variant">
                Not run yet. This only runs automatically right after a client submits via the intake wizard.
              </p>
            )}

            {submission.mandatory_site_visit_concern && (
              <div className="mt-4 bg-error-container/20 border border-error/30 rounded-lg p-4 flex gap-3">
                <span className="material-symbols-outlined text-error text-[20px] shrink-0">warning</span>
                <div>
                  <p className="text-label-md text-error font-bold uppercase tracking-wide mb-1">
                    Mandatory site visit
                  </p>
                  <p className="text-body-md text-on-surface">{submission.mandatory_site_visit_explanation}</p>
                </div>
              </div>
            )}

            {submission.wage_risk_concern && (
              <div className="mt-4 bg-surface-container-highest border border-outline-variant rounded-lg p-4 flex gap-3">
                <span className="material-symbols-outlined text-on-surface-variant text-[20px] shrink-0">payments</span>
                <div>
                  <p className="text-label-md text-on-surface font-bold uppercase tracking-wide mb-1">
                    Wage pricing risk
                  </p>
                  <p className="text-body-md text-on-surface-variant">{submission.wage_risk_explanation}</p>
                </div>
              </div>
            )}

            {submission.fit_eligibility_concern && (
              <div className="mt-4 bg-surface-container-highest border border-outline-variant rounded-lg p-4 flex gap-3">
                <span className="material-symbols-outlined text-on-surface-variant text-[20px] shrink-0">fact_check</span>
                <div>
                  <p className="text-label-md text-on-surface font-bold uppercase tracking-wide mb-1">
                    Eligibility to check
                  </p>
                  <p className="text-body-md text-on-surface-variant">{submission.fit_eligibility_explanation}</p>
                </div>
              </div>
            )}
          </div>

          <RequestInfoForm
            submissionId={submission.id}
            prefillText={clientInfoRequestDraft}
            checklist={(checklist ?? []).map((item) => ({ id: item.id, label: item.label, status: item.status }))}
          />

          <SubmissionMessages
            submissionId={submission.id}
            orgId={member.org_id}
            clientId={submission.client_id}
            viewerRole="admin"
            senderName={member.full_name}
            senderEmail={user.email ?? ""}
            adminId={member.id}
          />
        </div>
      </div>

      <section className="mt-6">
        <h2 className="text-title-lg text-primary mb-4 flex items-center gap-2 border-b border-outline-variant pb-2">
          <span className="material-symbols-outlined text-on-surface-variant text-[20px]">history</span>
          Audit log
        </h2>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-x-auto">
          <table className="w-full text-left border-collapse text-body-sm">
            <thead className="bg-surface-container-low border-b border-outline-variant">
              <tr>
                <th className="py-3 px-4 text-label-sm text-on-surface-variant uppercase tracking-wider">Timestamp</th>
                <th className="py-3 px-4 text-label-sm text-on-surface-variant uppercase tracking-wider">By</th>
                <th className="py-3 px-4 text-label-sm text-on-surface-variant uppercase tracking-wider">Event</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {(auditLog ?? []).map((entry: any) => (
                <tr key={entry.id}>
                  <td className="py-3 px-4 text-on-surface whitespace-nowrap">
                    {new Date(entry.created_at).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-on-surface">{entry.team_members?.full_name ?? "System"}</td>
                  <td className="py-3 px-4 text-on-surface-variant">
                    {AUDIT_EVENT_LABELS[entry.event_type] ?? entry.event_type}
                  </td>
                </tr>
              ))}
              {(!auditLog || auditLog.length === 0) && (
                <tr>
                  <td colSpan={3} className="py-6 px-4 text-center text-on-surface-variant">
                    No activity recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
