"use client";

import { useId, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/Spinner";
import { uploadAndInsertRecord, deleteRecordAndFile } from "@/lib/storage";
import { VerifiedBadge, DocLink } from "@/components/ui/DocumentBadges";
import { AddTriggerButton } from "@/components/ui/AddTriggerButton";
import s from "@/components/marketing/press.module.css";

type RecordType = "trade_license" | "small_business_cert" | "field_certification";

type Certification = {
  id: string;
  cert_type: string;
  other_label: string | null;
  certification_number: string | null;
  expiration_date: string | null;
  file_url: string | null;
  file_name: string | null;
  verified: boolean;
  created_at: string;
  record_type: RecordType;
  jurisdiction_state: string | null;
  licensing_board: string | null;
};

const CERT_TYPES = ["8(a)", "WOSB", "EDWOSB", "HUBZone", "SDVOSB", "VOSB", "JSEB", "DBE/SDB", "Other"];

// Trade licenses (a Master Electrician license, a Low Voltage Contractor
// license) and field certifications (OSHA 30, EPA Section 608) don't have a
// fixed federal/local program list the way small-business certs do -- their
// "type" is whatever the license/certification is actually called, so those
// two record types take a free-text name instead of the CERT_TYPES select.
const RECORD_TYPES: { value: RecordType; label: string; sectionTitle: string }[] = [
  { value: "trade_license", label: "Trade license", sectionTitle: "State Licensing & Trade Boards" },
  { value: "small_business_cert", label: "Small business / socioeconomic cert", sectionTitle: "Small Business & Socioeconomic Certifications" },
  { value: "field_certification", label: "Field certification", sectionTitle: "Field Certifications" },
];

function certLabel(cert: Pick<Certification, "cert_type" | "other_label" | "record_type">) {
  if (cert.record_type === "small_business_cert" && cert.cert_type === "Other") return cert.other_label || "Other";
  return cert.cert_type;
}

// Upload mechanics (bucket, path convention, upload -> save row) mirror
// components/ui/SubmissionDocuments.tsx — same storage bucket, just a
// client-scoped path instead of a submission-scoped one.
export function CertificationsSection({
  clientId,
  initialCertifications,
}: {
  clientId: string;
  initialCertifications: Certification[];
}) {
  const [certifications, setCertifications] = useState(initialCertifications);
  const [showForm, setShowForm] = useState(initialCertifications.length === 0);
  const [recordType, setRecordType] = useState<RecordType>("small_business_cert");
  const [certType, setCertType] = useState(CERT_TYPES[0]);
  const [licenseName, setLicenseName] = useState("");
  const [otherLabel, setOtherLabel] = useState("");
  const [certNumber, setCertNumber] = useState("");
  const [jurisdictionState, setJurisdictionState] = useState("");
  const [licensingBoard, setLicensingBoard] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();
  const idPrefix = useId();

  function resetForm() {
    setCertType(CERT_TYPES[0]);
    setLicenseName("");
    setOtherLabel("");
    setCertNumber("");
    setJurisdictionState("");
    setLicensingBoard("");
    setExpirationDate("");
    setFile(null);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const isSmallBusinessCert = recordType === "small_business_cert";
    if (isSmallBusinessCert && certType === "Other" && !otherLabel.trim()) {
      setError("Enter the certification name (e.g. MBE, DBE) for \"Other\".");
      return;
    }
    if (!isSmallBusinessCert && !licenseName.trim()) {
      setError(recordType === "trade_license" ? "Enter the license name (e.g. Master Electrician License)." : "Enter the certification name (e.g. OSHA 30).");
      return;
    }

    setSubmitting(true);

    // Document is optional at save time — a certification with no file sits
    // as "Not yet reviewed" indefinitely until one's attached. The document
    // only becomes required later, at the point an admin marks it Verified
    // (ClientCertifications.tsx's toggle enforces that, backed by a DB
    // constraint) — that's the actual gate on being treated as fact
    // anywhere generated paperwork reads client_certifications.
    const result = await uploadAndInsertRecord<Certification>(supabase, {
      path: file ? `${clientId}/certifications/${Date.now()}-${file.name}` : "",
      file,
      table: "client_certifications",
      genericErrorMessage: "Couldn't record the certification.",
      payload: {
        client_id: clientId,
        record_type: recordType,
        cert_type: isSmallBusinessCert ? certType : licenseName.trim(),
        other_label: isSmallBusinessCert && certType === "Other" ? otherLabel.trim() : null,
        certification_number: certNumber.trim() || null,
        jurisdiction_state: recordType === "trade_license" ? jurisdictionState.trim() || null : null,
        licensing_board: recordType === "trade_license" ? licensingBoard.trim() || null : null,
        expiration_date: expirationDate || null,
      },
    });

    if (result.error) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    setCertifications((c) => [{ ...result.row, file_url: result.signedUrl }, ...c]);
    resetForm();
    setSubmitting(false);
  }

  async function handleRemove(id: string) {
    setRemovingId(id);
    const { error: deleteError } = await deleteRecordAndFile(supabase, "client_certifications", id);
    if (!deleteError) {
      setCertifications((c) => c.filter((cert) => cert.id !== id));
    }
    setRemovingId(null);
  }

  return (
    <div className="flex flex-col gap-6">
      {showForm ? (
      <form
        onSubmit={handleAdd}
        className="border border-outline-variant rounded-xl p-4 flex flex-col md:flex-row gap-3 items-start md:items-end flex-wrap"
      >
        <div>
          <label htmlFor={`${idPrefix}-record-type`} className="text-label-md text-on-surface-variant block mb-1">Category</label>
          <select
            id={`${idPrefix}-record-type`}
            value={recordType}
            onChange={(e) => setRecordType(e.target.value as RecordType)}
            className="px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
          >
            {RECORD_TYPES.map((rt) => (
              <option key={rt.value} value={rt.value}>
                {rt.label}
              </option>
            ))}
          </select>
        </div>

        {recordType === "small_business_cert" ? (
          <div>
            <label htmlFor={`${idPrefix}-cert-type`} className="text-label-md text-on-surface-variant block mb-1">Certification type</label>
            <select
              id={`${idPrefix}-cert-type`}
              value={certType}
              onChange={(e) => setCertType(e.target.value)}
              className="px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
            >
              {CERT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label htmlFor={`${idPrefix}-license-name`} className="text-label-md text-on-surface-variant block mb-1">
              {recordType === "trade_license" ? "License name" : "Certification name"}
            </label>
            <input
              id={`${idPrefix}-license-name`}
              value={licenseName}
              onChange={(e) => setLicenseName(e.target.value)}
              placeholder={recordType === "trade_license" ? "e.g. Master Electrician License" : "e.g. OSHA 30"}
              className="px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
            />
          </div>
        )}

        {recordType === "small_business_cert" && certType === "Other" && (
          <div>
            <label htmlFor={`${idPrefix}-other-label`} className="text-label-md text-on-surface-variant block mb-1">Certification name</label>
            <input
              id={`${idPrefix}-other-label`}
              value={otherLabel}
              onChange={(e) => setOtherLabel(e.target.value)}
              placeholder="e.g. MBE, DBE"
              className="px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
            />
          </div>
        )}

        {recordType === "trade_license" && (
          <>
            <div>
              <label htmlFor={`${idPrefix}-state`} className="text-label-md text-on-surface-variant block mb-1">State</label>
              <input
                id={`${idPrefix}-state`}
                value={jurisdictionState}
                onChange={(e) => setJurisdictionState(e.target.value)}
                placeholder="e.g. FL"
                className="px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary w-20"
              />
            </div>
            <div>
              <label htmlFor={`${idPrefix}-board`} className="text-label-md text-on-surface-variant block mb-1">Issuing board (optional)</label>
              <input
                id={`${idPrefix}-board`}
                value={licensingBoard}
                onChange={(e) => setLicensingBoard(e.target.value)}
                placeholder="e.g. State DBPR Div. 4"
                className="px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
              />
            </div>
          </>
        )}

        <div>
          <label htmlFor={`${idPrefix}-cert-number`} className="text-label-md text-on-surface-variant block mb-1">Certification # (optional)</label>
          <input
            id={`${idPrefix}-cert-number`}
            value={certNumber}
            onChange={(e) => setCertNumber(e.target.value)}
            className="px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
          />
        </div>

        <div>
          <label htmlFor={`${idPrefix}-expires`} className="text-label-md text-on-surface-variant block mb-1">Expires (optional)</label>
          <input
            id={`${idPrefix}-expires`}
            type="date"
            value={expirationDate}
            onChange={(e) => setExpirationDate(e.target.value)}
            className="px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
          />
        </div>

        <div className="flex-1 min-w-[160px]">
          <label htmlFor={`${idPrefix}-file`} className="text-label-md text-on-surface-variant block mb-1">Certificate document (optional)</label>
          <label htmlFor={`${idPrefix}-file`} className="px-4 py-2 rounded border border-primary text-primary text-label-md font-bold hover:bg-surface-container-low transition cursor-pointer inline-block focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
            {file ? file.name : "Choose file"}
            <input
              id={`${idPrefix}-file`}
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="sr-only"
            />
          </label>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="py-2 px-4 bg-primary-container text-on-primary-container rounded text-label-md font-semibold hover:opacity-90 hover:-translate-y-0.5 transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {submitting && <Spinner />}
            {submitting ? "Adding…" : "Add certification"}
          </button>
          {certifications.length > 0 && (
            <button type="button" onClick={() => setShowForm(false)} className="text-label-md text-on-surface-variant hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-sm">
              Cancel
            </button>
          )}
        </div>
      </form>
      ) : (
        <div>
          <AddTriggerButton label="Add certification" onClick={() => setShowForm(true)} />
        </div>
      )}

      {error && <p className="text-body-md text-error">{error}</p>}

      {certifications.length === 0 ? (
        !showForm && <p className="text-body-md text-on-surface-variant">No certifications added yet.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {RECORD_TYPES.map((rt) => {
            const rows = certifications.filter((c) => c.record_type === rt.value);
            if (rows.length === 0) return null;
            return (
              <div key={rt.value}>
                <h3 className="text-label-md font-bold text-on-surface-variant uppercase tracking-wider mb-2">
                  {rt.sectionTitle}
                </h3>
                <ul className="flex flex-col gap-2">
                  {rows.map((cert) => (
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
                            cert.expiration_date
                              ? `Expires ${new Date(cert.expiration_date).toLocaleDateString()}`
                              : "No expiration on file",
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                          <DocLink url={cert.file_url} name={cert.file_name} />
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <VerifiedBadge verified={cert.verified} />
                        <button
                          type="button"
                          onClick={() => handleRemove(cert.id)}
                          disabled={removingId === cert.id}
                          className={`${s.btn} ${s.btnQuiet} ${s.btnSmall}`}
                        >
                          {removingId === cert.id && <Spinner />}
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
