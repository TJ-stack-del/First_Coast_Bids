"use client";

import { useId, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/Spinner";
import { uploadAndInsertRecord, deleteRecordAndFile } from "@/lib/storage";
import { AddTriggerButton } from "@/components/ui/AddTriggerButton";
import s from "@/components/marketing/press.module.css";

type ClientDocument = {
  id: string;
  doc_type: string;
  label: string | null;
  file_url: string | null;
  file_name: string | null;
  created_at: string;
};

const DOC_TYPES: { value: string; label: string }[] = [
  { value: "w9", label: "W-9" },
  { value: "non_collusion_affidavit", label: "Non-Collusion Affidavit" },
  { value: "capability_statement", label: "Capability Statement" },
  { value: "custom_rider", label: "Custom RFP rider" },
  { value: "other", label: "Other" },
];

// `doc.label` is only ever set for custom_rider/other (see handleAdd's
// `needsLabel` gate below) -- every other doc_type has label: null, so
// this single fallback chain covers both cases without a separate branch.
function docLabel(doc: Pick<ClientDocument, "doc_type" | "label">) {
  return doc.label || DOC_TYPES.find((d) => d.value === doc.doc_type)?.label || doc.doc_type;
}

// Reusable RFP boilerplate a client keeps current themselves -- no verify
// workflow here (client_documents has no verified column at all, unlike
// certifications/insurance/bonding), a row's presence with a file IS
// "synced" for the UI's purposes. Every upload/list/remove call goes
// through the same rfp-documents bucket and the shared lib/storage.ts
// helpers as every other document feature in the app.
export function DocumentLibrarySection({
  clientId,
  initialDocuments,
}: {
  clientId: string;
  initialDocuments: ClientDocument[];
}) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [showForm, setShowForm] = useState(initialDocuments.length === 0);
  const [docType, setDocType] = useState(DOC_TYPES[0].value);
  const [label, setLabel] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();
  const idPrefix = useId();

  const needsLabel = docType === "custom_rider" || docType === "other";

  function resetForm() {
    setDocType(DOC_TYPES[0].value);
    setLabel("");
    setFile(null);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!file) {
      setError("Choose a document to upload.");
      return;
    }
    if (needsLabel && !label.trim()) {
      setError("Enter a name for this document (e.g. \"Prevailing Wage Rider\").");
      return;
    }

    setSubmitting(true);

    const result = await uploadAndInsertRecord<ClientDocument>(supabase, {
      path: `${clientId}/documents/${docType}/${Date.now()}-${file.name}`,
      file,
      table: "client_documents",
      genericErrorMessage: "Couldn't record the document.",
      payload: {
        client_id: clientId,
        doc_type: docType,
        label: needsLabel ? label.trim() : null,
      },
    });

    if (result.error) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    setDocuments((d) => [{ ...result.row, file_url: result.signedUrl }, ...d]);
    resetForm();
    setSubmitting(false);
  }

  async function handleRemove(id: string) {
    setRemovingId(id);
    const { error: deleteError } = await deleteRecordAndFile(supabase, "client_documents", id);
    if (!deleteError) {
      setDocuments((d) => d.filter((doc) => doc.id !== id));
    }
    setRemovingId(null);
  }

  return (
    <div className="flex flex-col gap-6">
      {showForm ? (
      <form onSubmit={handleAdd} className="border border-outline-variant rounded-xl p-4 flex flex-col md:flex-row gap-3 items-start md:items-end flex-wrap">
        <div>
          <label htmlFor={`${idPrefix}-doc-type`} className="text-label-md text-on-surface-variant block mb-1">Category</label>
          <select
            id={`${idPrefix}-doc-type`}
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
          >
            {DOC_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {needsLabel && (
          <div>
            <label htmlFor={`${idPrefix}-label`} className="text-label-md text-on-surface-variant block mb-1">Name</label>
            <input
              id={`${idPrefix}-label`}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Prevailing Wage Rider"
              className="px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
            />
          </div>
        )}

        <div className="flex-1 min-w-[160px]">
          <label htmlFor={`${idPrefix}-file`} className="text-label-md text-on-surface-variant block mb-1">File</label>
          <label htmlFor={`${idPrefix}-file`} className="px-4 py-2 rounded border border-primary text-primary text-label-md font-bold hover:bg-surface-container-low transition cursor-pointer inline-block focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
            {file ? file.name : "Choose file"}
            <input id={`${idPrefix}-file`} type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="sr-only" />
          </label>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="py-2 px-4 bg-primary-container text-on-primary-container rounded text-label-md font-semibold hover:opacity-90 hover:-translate-y-0.5 transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {submitting && <Spinner />}
            {submitting ? "Uploading…" : "Add document"}
          </button>
          {documents.length > 0 && (
            <button type="button" onClick={() => setShowForm(false)} className="text-label-md text-on-surface-variant hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-sm">
              Cancel
            </button>
          )}
        </div>
      </form>
      ) : (
        <div>
          <AddTriggerButton label="Add document" onClick={() => setShowForm(true)} />
        </div>
      )}

      {error && <p className="text-body-md text-error">{error}</p>}

      {documents.length === 0 ? (
        !showForm && <p className="text-body-md text-on-surface-variant">No documents added yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between gap-3 px-4 py-3 rounded border border-outline-variant bg-surface flex-wrap">
              <div>
                <p className="text-body-md text-on-surface font-bold">{docLabel(doc)}</p>
                {doc.file_url && (
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-label-md text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-sm">
                    {doc.file_name ?? "View document"}
                  </a>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] px-2 py-0.5 rounded border font-bold uppercase bg-secondary-container text-on-secondary-container border-primary/20">
                  Synced
                </span>
                <button
                  type="button"
                  onClick={() => handleRemove(doc.id)}
                  disabled={removingId === doc.id}
                  className={`${s.btn} ${s.btnQuiet} ${s.btnSmall}`}
                >
                  {removingId === doc.id && <Spinner />}
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
