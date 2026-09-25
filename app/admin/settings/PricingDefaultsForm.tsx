"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/Toast";
import type { PricingDefaults } from "@/lib/wage/prefill";
import { sanitizeNumber } from "@/lib/wage/prefill";

// Set once; every wage worksheet opens with these (one person, 48-hour
// turnaround -- nothing is re-typed per bid).
export function PricingDefaultsForm({ orgId, initial }: { orgId: string; initial: PricingDefaults }) {
  const supabase = createClient();
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [v, setV] = useState({
    suppliesMode: initial.suppliesMode ?? "percent",
    suppliesValue: String(initial.suppliesValue ?? ""),
    overheadPct: String(initial.overheadPct ?? ""),
    profitPct: String(initial.profitPct ?? ""),
    includeVacation: initial.includeVacation ?? true,
    serviceDaysPerWeek: String(initial.serviceDaysPerWeek ?? 5),
  });
  const input =
    "w-full px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const pricing_defaults: PricingDefaults = {
      suppliesMode: v.suppliesMode as "percent" | "flat",
      suppliesValue: sanitizeNumber(v.suppliesValue, 0),
      overheadPct: sanitizeNumber(v.overheadPct, 0),
      profitPct: sanitizeNumber(v.profitPct, 0),
      includeVacation: v.includeVacation,
      serviceDaysPerWeek: Math.min(7, sanitizeNumber(v.serviceDaysPerWeek, 5)),
    };
    const { error } = await supabase.from("organizations").update({ pricing_defaults }).eq("id", orgId);
    setSaving(false);
    showToast(error ? error.message : "Pricing defaults saved.", error ? "error" : "success");
  }

  return (
    <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1">
        <span className="text-label-md font-bold">Supplies</span>
        <div className="flex gap-2">
          <input value={v.suppliesValue} onChange={(e) => setV({ ...v, suppliesValue: e.target.value })} className={input} inputMode="decimal" />
          <select value={v.suppliesMode} onChange={(e) => setV({ ...v, suppliesMode: e.target.value as "percent" | "flat" })} className={input}>
            <option value="percent">% of labor</option>
            <option value="flat">$ per year</option>
          </select>
        </div>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-label-md font-bold">Overhead %</span>
        <input value={v.overheadPct} onChange={(e) => setV({ ...v, overheadPct: e.target.value })} className={input} inputMode="decimal" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-label-md font-bold">Profit %</span>
        <input value={v.profitPct} onChange={(e) => setV({ ...v, profitPct: e.target.value })} className={input} inputMode="decimal" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-label-md font-bold">Default service days per week</span>
        <input value={v.serviceDaysPerWeek} onChange={(e) => setV({ ...v, serviceDaysPerWeek: e.target.value })} className={input} inputMode="numeric" />
      </label>
      <label className="flex items-center gap-2 sm:col-span-2">
        <input type="checkbox" checked={v.includeVacation} onChange={(e) => setV({ ...v, includeVacation: e.target.checked })} />
        <span className="text-body-md">Include vacation in the labor floor (safer on successor contracts)</span>
      </label>
      <button type="submit" disabled={saving} className="sm:col-span-2 justify-self-start px-4 py-2 rounded-lg bg-primary text-on-primary text-label-md font-bold flex items-center gap-2 disabled:opacity-40">
        {saving && <Spinner />} Save pricing defaults
      </button>
    </form>
  );
}
