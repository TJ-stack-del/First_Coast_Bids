"use client";

import { useRouter } from "next/navigation";
import { BidFileStep } from "@/components/ui/BidFileStep";

// Shown instead of the normal status/checklist view whenever the active
// submission is still a draft — most commonly one an admin created from a
// matched opportunity (agency/scope/due date already on file) rather than
// something the client typed in themselves. Only the bid file is still
// missing, so that's all this asks for.
export function CompleteBidFile({ submissionId, clientId }: { submissionId: string; clientId: string }) {
  const router = useRouter();

  return (
    <div className="bg-surface-container-lowest border-2 border-primary rounded-xl p-6">
      <h2 className="text-title-lg text-primary mb-2 flex items-center gap-2">
        <span className="material-symbols-outlined text-primary text-[20px]">upload_file</span>
        Your bid file
      </h2>
      <p className="text-body-md text-on-surface-variant mb-4">
        We already have the agency and job details for this one. Add the bid file, if you have it, and send it
        our way, or save it for later.
      </p>
      <BidFileStep submissionId={submissionId} clientId={clientId} onSubmitted={() => router.refresh()} />
    </div>
  );
}
