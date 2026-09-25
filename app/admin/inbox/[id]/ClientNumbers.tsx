"use client";

import { useState } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { readOptionalNumberText } from "@/lib/wage/prefill";
import type { ClientPricing } from "@/lib/wage/client-pricing";

// The client's usual numbers, entered once (from the pricing conversation
// the admin already has) and used for every bid of theirs. Blank = not
// given yet, highlighted -- never guessed.
export function ClientNumbers({
  submissionId,
  clientName,
  initial,
  onSaved,
}: {
  submissionId: string;
  clientName: string;
  initial: ClientPricing;
  onSaved: (applied: boolean) => void;
}) {
  const [p, setP] = useState(initial);
  const [text, setText] = useState({
    suppliesValue: initial.suppliesValue?.toString() ?? "",
    overheadPct: initial.overheadPct?.toString() ?? "",
    profitPct: initial.profitPct?.toString() ?? "",
    productionRate: initial.productionRate?.toString() ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function edit(key: keyof typeof text, value: string) {
    setText({ ...text, [key]: value });
    setSaved(false);
    const n = readOptionalNumberText(value);
    if (n !== undefined) setP({ ...p, [key]: n });
  }

  async function save() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/wage-worksheet/client-pricing", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId, pricing: p }),
    });
    const body = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) return setError(body?.error ?? `Not saved (HTTP ${res.status}).`);
    setSaved(true);
    onSaved(body.applied === true);
  }

  // Blank or unreadable ("12 percent") is highlighted; unreadable blocks
  // Save, so nothing typed is ever silently dropped (final review I1).
  const unreadable = Object.values(text).some((v) => readOptionalNumberText(v) === undefined);
  const box = (v: string) =>
    `px-2 py-1 rounded border w-24 text-right ${
      readOptionalNumberText(v) == null ? "border-error bg-error-container/20" : "border-outline-variant"
    }`;
  return (
    <fieldset className="mt-4 rounded-lg border border-outline-variant p-3">
      <legend className="px-1 text-label-md font-bold">{clientName}&apos;s numbers</legend>
      <p className="text-body-sm text-on-surface-variant">Used for all {clientName}&apos;s bids. Enter them once.</p>
      <div className="mt-2 flex flex-wrap items-end gap-3 text-body-sm">
        <label className="flex flex-col gap-1">
          Supplies
          <span className="flex items-center gap-1">
            <input className={box(text.suppliesValue)} inputMode="decimal" value={text.suppliesValue} onChange={(e) => edit("suppliesValue", e.target.value)} />
            <select
              value={p.suppliesMode}
              onChange={(e) => {
                setP({ ...p, suppliesMode: e.target.value as "percent" | "flat" });
                setSaved(false);
              }}
              className="px-1 py-1 rounded border border-outline-variant"
            >
              <option value="percent">% of labor</option>
              <option value="flat">$ per year</option>
            </select>
          </span>
        </label>
        <label className="flex flex-col gap-1">Overhead %<input className={box(text.overheadPct)} inputMode="decimal" value={text.overheadPct} onChange={(e) => edit("overheadPct", e.target.value)} /></label>
        <label className="flex flex-col gap-1">Profit %<input className={box(text.profitPct)} inputMode="decimal" value={text.profitPct} onChange={(e) => edit("profitPct", e.target.value)} /></label>
        <label className="flex flex-col gap-1">Sq ft per hour<input className={box(text.productionRate)} inputMode="decimal" value={text.productionRate} onChange={(e) => edit("productionRate", e.target.value)} /></label>
        <button type="button" onClick={save} disabled={busy || unreadable} className="px-3 py-1.5 rounded-lg bg-primary text-on-primary text-label-md font-bold flex items-center gap-2 disabled:opacity-40">
          {busy && <Spinner />} Save for {clientName}
        </button>
        {saved && <span className="text-on-surface-variant">Saved</span>}
      </div>
      {unreadable && <p role="alert" className="mt-2 text-error">Use plain numbers, like 12 or 1,500.</p>}
      {error && <p role="alert" className="mt-2 text-error">{error}</p>}
    </fieldset>
  );
}
