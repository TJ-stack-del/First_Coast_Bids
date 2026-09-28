"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/Toast";
import { CERT_REVIEWED_TOOLTIP } from "@/lib/brand";

type Certification = {
  id: string;
  cert_type: string;
  other_label: string | null;
  certification_number: string | null;
  expiration_date: string | null;
  file_url: string | null;
  file_name: string | null;
  verified: boolean;
  record_type: "trade_license" | "small_business_cert" | "field_certification";
  jurisdiction_state: string | null;
  licensing_board: string | null;
};

function certLabel(cert: Pick<Certification, "cert_type" | "other_label" | "record_type">) {
  if (cert.record_type === "small_business_cert" && cert.cert_type === "Other") return cert.other_label || "Other";
  return cert.cert_type;
}

// Admin's half of the certifications feature: the client uploads the
// document (app/dashboard/profile), an admin actually opens it and flips
// this toggle after looking — never automatic. Only a "verified" cert
// counts as fact anywhere else in the app (auto-draft, the final PDF).
export function ClientCertifications({
  orgId,
  actorId,
  certifications: initialCertifications,
}: {
  orgId: string;
  actorId: string;
  certifications: Certification[];
}) {
  const [certifications, setCertifications] = useState(initialCertifications);
  const [saving, setSaving] = useState<string | null>(null);
  const supabase = createClient();
  const { showToast } = useToast();

  async function handleToggle(cert: Certification) {
    const nextVerified = !cert.verified;

    // Document upload is optional at logging time (CertificationsSection.tsx),
    // but a cert can never be marked Verified without one -- that's the
    // actual gate on being treated as fact anywhere generated paperwork
    // reads client_certifications. Also enforced at the DB level (see the
    // client_certifications_verified_requires_file constraint) as a
    // backstop; this check just gives a clear message instead of a raw
    // constraint-violation error.
    if (nextVerified && !cert.file_url) {
      showToast("Can't mark reviewed without a certificate document on file.", "error");
      return;
    }

    setSaving(cert.id);
    const nowIso = new Date().toISOString();

    const { error } = await supabase
      .from("client_certifications")
      .update({
        verified: nextVerified,
        verified_at: nextVerified ? nowIso : null,
        verified_by: nextVerified ? actorId : null,
      })
      .eq("id", cert.id);

    if (!error) {
      await supabase.from("audit_log").insert({
        org_id: orgId,
        actor_id: actorId,
        event_type: nextVerified ? "certification_verified" : "certification_unverified",
        event_detail: { certification_id: cert.id, cert_type: certLabel(cert) },
      });
      setCertifications((certs) => certs.map((c) => (c.id === cert.id ? { ...c, verified: nextVerified } : c)));
    } else {
      showToast(error.message, "error");
    }
    setSaving(null);
  }

  if (certifications.length === 0) {
    return <p className="text-body-md text-on-surface-variant">No certifications on file yet.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
    <p className="text-body-sm text-on-surface-variant">
      Reviewing means opening the certificate and checking that the name, number and expiry date match what the client
      entered, and that it hasn&apos;t expired. It doesn&apos;t confirm standing with the issuing agency.
    </p>
    <ul className="flex flex-col gap-2">
      {certifications.map((cert) => (
        <li
          key={cert.id}
          className="flex items-center justify-between gap-3 px-4 py-3 rounded border border-outline-variant bg-surface flex-wrap"
        >
          <div>
            <p className="text-body-md text-on-surface font-bold">
              {certLabel(cert)}
              {cert.certification_number ? ` (#${cert.certification_number})` : ""}
            </p>
            <p className="text-label-md text-on-surface-variant">
              {[
                cert.jurisdiction_state || cert.licensing_board
                  ? [cert.jurisdiction_state, cert.licensing_board].filter(Boolean).join(" / ")
                  : null,
                cert.expiration_date ? `Expires ${new Date(cert.expiration_date).toLocaleDateString()}` : "No expiration on file",
              ]
                .filter(Boolean)
                .join(" · ")}
              {cert.file_url && (
                <>
                  {" · "}
                  <a href={cert.file_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-sm">
                    {cert.file_name ?? "View document"}
                  </a>
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleToggle(cert)}
            disabled={saving === cert.id || (!cert.verified && !cert.file_url)}
            title={
              !cert.verified && !cert.file_url
                ? "Can't mark reviewed without a certificate document on file"
                : cert.verified
                ? CERT_REVIEWED_TOOLTIP
                : undefined
            }
            className={`px-3 py-1.5 rounded text-label-md font-bold transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 disabled:cursor-not-allowed flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
              cert.verified
                ? "border border-outline-variant text-on-surface hover:bg-surface-container-high"
                : "bg-primary-container text-on-primary-container hover:opacity-90"
            }`}
          >
            {saving === cert.id && <Spinner />}
            {cert.verified ? "Document Reviewed: mark unreviewed" : "Not yet reviewed: mark reviewed"}
          </button>
        </li>
      ))}
    </ul>
    </div>
  );
}
