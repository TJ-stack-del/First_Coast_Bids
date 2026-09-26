"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/Toast";

type ExistingPackage = {
  id: string;
  package_type: string;
  price_note: string | null;
  paid: boolean;
  paid_at: string | null;
  created_at: string;
};

const PACKAGE_TYPE_LABELS: Record<string, string> = {
  one_off: "One-off",
  retainer: "Retainer",
  pilot: "Pilot",
  test: "Test",
};

// Payment gate for deliverable downloads: toggles packages.paid for the
// submission's linked package_id. A submission with no package_id yet has
// nothing to toggle — the client dashboard already treats that as unpaid.
export function PaymentStatus({
  submissionId,
  orgId,
  actorId,
  clientId,
  packageId,
  packageType,
  packagePriceNote,
  initialPaid,
  initialPaidAt,
  existingPackages,
}: {
  submissionId: string;
  orgId: string;
  actorId: string;
  clientId: string;
  packageId: string | null;
  packageType: string | null;
  packagePriceNote: string | null;
  initialPaid: boolean;
  initialPaidAt: string | null;
  existingPackages: ExistingPackage[];
}) {
  const router = useRouter();
  const [paid, setPaid] = useState(initialPaid);
  const [paidAt, setPaidAt] = useState(initialPaidAt);
  const [saving, setSaving] = useState(false);
  const [linking, setLinking] = useState(false);
  const [mode, setMode] = useState<"new" | "existing">(existingPackages.length > 0 ? "existing" : "new");
  const [newType, setNewType] = useState("one_off");
  const [newPriceNote, setNewPriceNote] = useState("");
  const [selectedExistingId, setSelectedExistingId] = useState(existingPackages[0]?.id ?? "");
  const supabase = createClient();
  const { showToast } = useToast();

  // Pilot packages are never paywalled ("on us to prove the process") — the
  // client dashboard unlocks their downloads regardless of this flag. Kept
  // in sync with the isPaid check in dashboard/page.tsx.
  const isPilot = packageType === "pilot";

  async function linkPackage(newPackageId: string) {
    const { error: updateError } = await supabase
      .from("submissions")
      .update({ package_id: newPackageId })
      .eq("id", submissionId);

    if (updateError) {
      showToast(updateError.message, "error");
      return false;
    }

    await supabase.from("audit_log").insert({
      submission_id: submissionId,
      org_id: orgId,
      actor_id: actorId,
      event_type: "package_linked",
      event_detail: { package_id: newPackageId },
    });

    return true;
  }

  async function handleLinkNew() {
    setLinking(true);

    const { data: newPkg, error: insertError } = await supabase
      .from("packages")
      .insert({
        client_id: clientId,
        package_type: newType,
        price_note: newPriceNote.trim() || null,
      })
      .select()
      .single();

    if (insertError || !newPkg) {
      showToast(insertError?.message ?? "Couldn't create the package.", "error");
      setLinking(false);
      return;
    }

    const linked = await linkPackage(newPkg.id);
    setLinking(false);
    if (linked) router.refresh();
  }

  async function handleLinkExisting() {
    if (!selectedExistingId) {
      showToast("Pick a package to link first.", "error");
      return;
    }
    setLinking(true);
    const linked = await linkPackage(selectedExistingId);
    setLinking(false);
    if (linked) router.refresh();
  }

  async function handleToggle() {
    if (!packageId) return;
    setSaving(true);

    const nextPaid = !paid;
    const nextPaidAt = nextPaid ? new Date().toISOString() : null;

    const { error: updateError } = await supabase
      .from("packages")
      .update({ paid: nextPaid, paid_at: nextPaidAt })
      .eq("id", packageId);

    if (updateError) {
      showToast(updateError.message, "error");
      setSaving(false);
      return;
    }

    await supabase.from("audit_log").insert({
      submission_id: submissionId,
      org_id: orgId,
      actor_id: actorId,
      event_type: nextPaid ? "payment_marked_paid" : "payment_marked_unpaid",
      event_detail: { package_id: packageId },
    });

    setPaid(nextPaid);
    setPaidAt(nextPaidAt);
    setSaving(false);
  }

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
      <h2 className="text-title-lg text-primary mb-4 flex items-center gap-2">
        <span className="material-symbols-outlined text-primary text-[20px]">payments</span>
        Payment
      </h2>

      {!packageId ? (
        <div className="flex flex-col gap-4">
          <p className="text-body-md text-on-surface-variant">
            No package linked to this submission yet. Link one before payment can be tracked.
            Deliverable downloads stay locked for the client until then.
          </p>

          {existingPackages.length > 0 && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode("existing")}
                className={`px-3 py-1.5 rounded text-label-md font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  mode === "existing"
                    ? "bg-primary-container text-on-primary-container"
                    : "border border-outline-variant text-on-surface hover:bg-surface-container-high"
                }`}
              >
                Use existing package
              </button>
              <button
                type="button"
                onClick={() => setMode("new")}
                className={`px-3 py-1.5 rounded text-label-md font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  mode === "new"
                    ? "bg-primary-container text-on-primary-container"
                    : "border border-outline-variant text-on-surface hover:bg-surface-container-high"
                }`}
              >
                Create new package
              </button>
            </div>
          )}

          {mode === "existing" && existingPackages.length > 0 ? (
            <div className="flex flex-col gap-3">
              <select
                aria-label="Package already on file for this client"
                value={selectedExistingId}
                onChange={(e) => setSelectedExistingId(e.target.value)}
                className="px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
              >
                {existingPackages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {PACKAGE_TYPE_LABELS[p.package_type] ?? p.package_type}
                    {p.price_note ? ` · ${p.price_note}` : ""} ({p.paid ? "paid" : "unpaid"})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleLinkExisting}
                disabled={linking}
                className="self-start px-4 py-2 bg-primary-container text-on-primary-container rounded text-label-md font-bold hover:opacity-90 hover:-translate-y-0.5 transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {linking && <Spinner />}
                {linking ? "Linking…" : "Link this package"}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div>
                <label htmlFor="payment-package-type" className="text-label-md text-on-surface-variant block mb-1">Package type</label>
                <select id="payment-package-type"
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  className="px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
                >
                  <option value="one_off">One-off</option>
                  <option value="retainer">Retainer</option>
                  <option value="pilot">Pilot</option>
                  <option value="test">Test</option>
                </select>
              </div>
              <div>
                <label htmlFor="payment-price-note-manual-invoicing" className="text-label-md text-on-surface-variant block mb-1">Price note (manual invoicing)</label>
                <input id="payment-price-note-manual-invoicing"
                  type="text"
                  value={newPriceNote}
                  onChange={(e) => setNewPriceNote(e.target.value)}
                  placeholder="e.g. $450 flat, invoiced separately"
                  className="w-full px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
                />
              </div>
              <button
                type="button"
                onClick={handleLinkNew}
                disabled={linking}
                className="self-start px-4 py-2 bg-primary-container text-on-primary-container rounded text-label-md font-bold hover:opacity-90 hover:-translate-y-0.5 transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {linking && <Spinner />}
                {linking ? "Linking…" : "Create and link package"}
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          <p className="text-label-md text-on-surface-variant uppercase tracking-wider font-bold mb-1">
            {PACKAGE_TYPE_LABELS[packageType ?? ""] ?? packageType}
            {packagePriceNote ? ` · ${packagePriceNote}` : ""}
          </p>
          {isPilot && (
            <p className="text-label-md text-primary mb-2 uppercase tracking-wider font-bold">
              Pilot package: downloads are unlocked for the client regardless of this flag
            </p>
          )}
          <p className="text-body-md text-on-surface-variant mb-3">
            {paid ? (
              <>
                Paid{paidAt ? ` ${new Date(paidAt).toLocaleString()}` : ""}. Deliverable
                downloads are unlocked for the client.
              </>
            ) : isPilot ? (
              "Not marked paid. Downloads are still unlocked since this is a pilot package."
            ) : (
              "Not paid yet. Deliverable downloads stay locked for the client until marked paid."
            )}
          </p>
          <button
            type="button"
            onClick={handleToggle}
            disabled={saving}
            className={`px-4 py-2 rounded text-label-md font-bold transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
              paid
                ? "border border-outline-variant text-on-surface hover:bg-surface-container-high"
                : "bg-primary-container text-on-primary-container hover:opacity-90"
            }`}
          >
            {saving && <Spinner />}
            {saving ? "Saving…" : paid ? "Mark as unpaid" : "Mark as paid"}
          </button>
        </>
      )}
    </div>
  );
}
