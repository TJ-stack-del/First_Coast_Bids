"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/Spinner";
import { FadeMessage } from "@/components/ui/FadeMessage";
import { useToast } from "@/components/Toast";

export function ThresholdSettingsForm({ orgId, initialThreshold }: { orgId: string; initialThreshold: number }) {
  const [value, setValue] = useState(String(initialThreshold));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const supabase = createClient();
  const { showToast } = useToast();

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      showToast("Enter a valid dollar amount.", "error");
      return;
    }

    setSaving(true);
    const { error: updateError } = await supabase
      .from("organizations")
      .update({ lean_package_threshold: parsed })
      .eq("id", orgId);
    setSaving(false);

    if (updateError) {
      showToast(updateError.message, "error");
      return;
    }
    setSaved(true);
  }

  return (
    <form onSubmit={handleSave} className="flex items-end gap-3 flex-wrap">
      <div>
        <label htmlFor="lean-threshold-threshold-usd" className="text-label-md text-on-surface-variant block mb-1">Threshold (USD)</label>
        <input id="lean-threshold-threshold-usd"
          type="number"
          min="0"
          step="1000"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary w-40"
        />
      </div>
      <button
        type="submit"
        disabled={saving}
        className="py-2 px-4 bg-primary-container text-on-primary-container rounded text-label-md font-semibold hover:opacity-90 hover:-translate-y-0.5 transition active:scale-[0.97] disabled:opacity-40 flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {saving && <Spinner />}
        {saving ? "Saving…" : "Save"}
      </button>
      <FadeMessage show={saved} className="text-body-md text-primary">
        Saved
      </FadeMessage>
    </form>
  );
}
