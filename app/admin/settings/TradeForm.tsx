"use client";

import { useState } from "react";
import type { Trade, TradeInput } from "@/lib/trades/types";
import { normalizeTradeInput, validateTrade } from "@/lib/trades/validate";

// Add/edit form for one trade. Validation here is for instant feedback;
// the save route runs the same checks again.
export function TradeForm({
  initial,
  allTrades,
  busy,
  onSubmit,
  onCancel,
}: {
  initial: Trade | null;
  allTrades: Trade[];
  busy: boolean;
  onSubmit: (input: TradeInput) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [naics, setNaics] = useState(initial?.naics.length ? initial.naics : [{ code: "", label: "" }]);
  const [nigp, setNigp] = useState((initial?.nigpCodes ?? []).join(", "));
  const [keywords, setKeywords] = useState((initial?.keywords ?? []).join(", "));
  const [errors, setErrors] = useState<string[]>([]);

  const inputClass =
    "w-full px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const input = normalizeTradeInput({
      id: initial?.id,
      label,
      naics,
      nigpCodes: nigp.split(/[,\n]/),
      keywords: keywords.split(/[,\n]/),
      active: initial?.active ?? true,
    });
    const result = validateTrade(input, allTrades);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors([]);
    onSubmit(input);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 border border-outline-variant rounded-lg p-4 bg-surface">
      <label className="flex flex-col gap-1">
        <span className="text-label-md font-bold text-on-surface">Trade name</span>
        <input value={label} onChange={(e) => setLabel(e.target.value)} className={inputClass} placeholder="Pressure washing" />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-label-md font-bold text-on-surface mb-1">NAICS codes</legend>
        <p className="text-body-sm text-on-surface-variant">
          6 digits each. The label is what clients see next to the checkbox.
        </p>
        {naics.map((n, i) => (
          <div key={i} className="flex gap-2">
            <input
              aria-label={`NAICS code ${i + 1}`}
              value={n.code}
              onChange={(e) => setNaics(naics.map((x, j) => (j === i ? { ...x, code: e.target.value } : x)))}
              className={`${inputClass} w-32 font-code`}
              placeholder="561790"
              inputMode="numeric"
            />
            <input
              aria-label={`NAICS label ${i + 1}`}
              value={n.label}
              onChange={(e) => setNaics(naics.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
              className={inputClass}
              placeholder="Other Services to Buildings and Dwellings"
            />
            <button
              type="button"
              onClick={() => setNaics(naics.filter((_, j) => j !== i))}
              className="px-2 text-error text-label-sm font-bold"
              aria-label={`Remove NAICS code ${i + 1}`}
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setNaics([...naics, { code: "", label: "" }])}
          className="self-start text-primary text-label-md font-bold"
        >
          + Add a NAICS code
        </button>
      </fieldset>

      <label className="flex flex-col gap-1">
        <span className="text-label-md font-bold text-on-surface">NIGP codes</span>
        <span className="text-body-sm text-on-surface-variant">Class-item, comma separated, like 910-39.</span>
        <input value={nigp} onChange={(e) => setNigp(e.target.value)} className={`${inputClass} font-code`} />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-label-md font-bold text-on-surface">Title keywords</span>
        <span className="text-body-sm text-on-surface-variant">
          Comma separated. Matched against bid titles, at the start of a word: &quot;landscap&quot; matches
          &quot;landscaping&quot;.
        </span>
        <textarea value={keywords} onChange={(e) => setKeywords(e.target.value)} rows={3} className={inputClass} />
      </label>

      {errors.length > 0 && (
        <ul role="alert" className="list-disc pl-5 text-body-sm text-error">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={busy}
          className="px-4 py-2 rounded-lg bg-primary text-on-primary text-label-md font-bold disabled:opacity-40"
        >
          Review changes
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg text-on-surface text-label-md font-bold">
          Cancel
        </button>
      </div>
    </form>
  );
}
