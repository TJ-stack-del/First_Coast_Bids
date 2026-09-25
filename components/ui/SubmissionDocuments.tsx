"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { signRfpDocumentUrl, signRfpDocumentUrls } from "@/lib/storage";

type Doc = {
  id: string;
  document_type: string;
  file_name: string;
  file_url: string | null;
  created_at: string;
};

const DOC_TYPES = [
  { value: "rfp_file", label: "The agency's RFP file" },
  { value: "other", label: "Other" },
];

// Storage keys must be safe path segments — strip anything Supabase Storage
// rejects (spaces, em dashes, etc.) while the real name stays in
// submission_documents.file_name for display.
function sanitizeForStorageKey(fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".");
  const base = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
  const ext = dotIndex > 0 ? fileName.slice(dotIndex + 1) : "";

  const safeBase =
    base
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "file";
  const safeExt = ext.replace(/[^a-zA-Z0-9]+/g, "");

  return safeExt ? `${safeBase}.${safeExt}` : safeBase;
}

// Replaces the old BidDocuments.tsx — same idea, but works against
// submissions/submission_documents instead of the old bids/bid_documents
// tables, which no longer exist after the schema reset.
export function SubmissionDocuments({ submissionId }: { submissionId: string }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [docType, setDocType] = useState("rfp_file");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase
      .from("submission_documents")
      .select("id, document_type, file_name, file_url, created_at")
      .eq("submission_id", submissionId)
      .order("created_at", { ascending: false })
      .then(async ({ data }) => setDocs(await signRfpDocumentUrls(supabase, data ?? [])));
  }, [submissionId]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);

    const path = `${submissionId}/${Date.now()}-${sanitizeForStorageKey(file.name)}`;

    const { error: uploadError } = await supabase.storage
      .from("rfp-documents")
      .upload(path, file);

    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }

    // The bucket is private — the DB stores the bare path, and every read
    // site (including this one, right after upload) generates its own
    // signed URL rather than persisting one, since a signed URL expires.
    const { data: newDoc, error: insertError } = await supabase
      .from("submission_documents")
      .insert({
        submission_id: submissionId,
        document_type: docType,
        file_name: file.name,
        file_url: path,
      })
      .select()
      .single();

    if (insertError || !newDoc) {
      setError(insertError?.message ?? "Upload saved, but couldn't record it.");
      setUploading(false);
      return;
    }

    // Read the new solicitation for checklist suggestions. Not awaited:
    // the upload is done; the admin panel shows the reading's progress.
    if (docType === "rfp_file") {
      fetch("/api/checklist-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId }),
      }).catch(() => {});
    }

    const signedUrl = await signRfpDocumentUrl(supabase, path);
    setDocs((d) => [{ ...newDoc, file_url: signedUrl }, ...d]);
    setUploading(false);
    e.target.value = "";
  }

  async function handleDelete(id: string) {
    await supabase.from("submission_documents").delete().eq("id", id);
    setDocs((d) => d.filter((doc) => doc.id !== id));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
        <select
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
        <label className="px-4 py-2 rounded border border-primary text-primary text-label-md font-bold hover:bg-surface-container-low transition cursor-pointer focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
          {uploading ? "Uploading…" : "Choose file"}
          <input type="file" onChange={handleUpload} disabled={uploading} className="sr-only" />
        </label>
      </div>

      {error && <p className="text-body-md text-error">{error}</p>}

      {docs.length === 0 ? (
        <p className="text-body-md text-on-surface-variant">No files attached yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {docs.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center justify-between px-3 py-2 rounded border border-outline-variant bg-surface"
            >
              {doc.file_url ? (
                <a
                  href={doc.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-body-md text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-sm"
                >
                  {doc.file_name}
                </a>
              ) : (
                <span className="text-body-md text-on-surface-variant">{doc.file_name}</span>
              )}
              <button
                type="button"
                onClick={() => handleDelete(doc.id)}
                className="text-error text-label-md hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error rounded-sm"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
