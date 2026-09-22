"use client";

import { useRef, useState } from "react";
import { Spinner } from "./Spinner";

export type ExtractedBidFields = {
  agency: string | null;
  solicitationNumber: string | null;
  dueDate: string | null;
  scope: string | null;
};

// Mirrors CompanyProfileUpload.tsx's pattern exactly — same upload
// affordance, same error handling (including the non-JSON/timeout case) —
// calling extract-from-document/route.ts instead. That route already
// existed (built for this exact purpose) but had no UI caller until this
// component; see BUILD-ORDER-BIDPULSE.md item #2.
export function RfpDocumentUpload({ onExtracted }: { onExtracted: (data: ExtractedBidFields, file: File) => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/extract-from-document", { method: "POST", body: formData });

      let data: { error?: string };
      try {
        data = await res.json();
      } catch {
        setError(
          res.status === 504
            ? "That document took too long to process. Try a smaller or simpler file."
            : `Something went wrong reading that document (server error ${res.status}). Try again in a moment.`
        );
        return;
      }

      if (!res.ok) {
        setError(data.error ?? "Couldn't read that document.");
        return;
      }

      onExtracted(data as ExtractedBidFields, file);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-lg p-4 flex flex-col gap-2">
      <p className="text-body-md text-on-surface">
        Have the RFP or solicitation document from the agency? Upload it and we&apos;ll fill in what we can
        find below. Review it before continuing, especially the due date.
      </p>
      <div className="flex items-center gap-3">
        <label className="w-full min-h-[52px] bg-primary-fixed hover:bg-primary-fixed-dim text-on-primary-fixed font-headline text-[16px] font-bold uppercase tracking-wider rounded-xl shadow-lg cursor-pointer active:scale-[0.99] transition-[background-color,opacity,transform] flex items-center justify-center gap-2 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
          {uploading && <Spinner />}
          {uploading ? "Reading document…" : "Upload RFP / Solicitation"}
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
            disabled={uploading}
            className="sr-only"
          />
        </label>
      </div>
      {error && <p className="text-body-md text-error">{error}</p>}
    </div>
  );
}
