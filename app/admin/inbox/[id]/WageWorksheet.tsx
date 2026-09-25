"use client";

import { useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { computeFloor, computePrice, belowFloor, roundCents, type WorksheetLine } from "@/lib/wage/floor";
import type { ParsedWd } from "@/lib/wage/parse-wd";
import { shouldAutoLoad } from "@/lib/wage/prefill";

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

type Loaded = {
  worksheet: {
    wd_number: string;
    wd_revision: number;
    wd_revision_source: "solicitation" | "latest" | "manual";
    lines: WorksheetLine[];
    options: { includeVacation: boolean; eo13658: boolean };
    supplies_mode: "percent" | "flat";
    supplies_value: number;
    overhead_pct: number;
    profit_pct: number;
    bid_price: number | null;
  };
  parsed: ParsedWd;
  missingCode: string | null;
  hoursNeeded: boolean;
};

// Opens pre-filled; the admin checks the highlighted numbers and adjusts.
// Recomputes live with plain code; autosaves ~0.8 s after the last change,
// always sending the latest values.
export function WageWorksheet({ submissionId, wdRef }: { submissionId: string; wdRef: string | null }) {
  const [state, setState] = useState<"loading" | "no_wd" | "error" | "ready">("loading");
  const [error, setError] = useState<string | null>(null);
  const [wdInput, setWdInput] = useState("");
  const [data, setData] = useState<Loaded | null>(null);
  const [lines, setLines] = useState<WorksheetLine[]>([]);
  const [opts, setOpts] = useState({ includeVacation: true, eo13658: false });
  const [pricing, setPricing] = useState({ suppliesMode: "percent" as "percent" | "flat", suppliesValue: 0, overheadPct: 0, profitPct: 0 });
  const [bidPrice, setBidPrice] = useState<string>("");
  const [saveState, setSaveState] = useState<"saved" | "saving" | "idle">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedOnce = useRef(false);

  async function load(wdNumber?: string) {
    setState("loading");
    const res = await fetch("/api/wage-worksheet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId, ...(wdNumber ? { wdNumber } : {}) }),
    });
    const body = await res.json().catch(() => null);
    if (res.status === 404 && body?.error === "no_wd") return setState("no_wd");
    if (!res.ok) {
      setError(body?.missing ? `${body.error} Missing: ${body.missing.join(", ")}.` : body?.error ?? `HTTP ${res.status}`);
      return setState("error");
    }
    const d = body as Loaded;
    setData(d);
    setLines(d.worksheet.lines);
    setOpts(d.worksheet.options);
    setPricing({
      suppliesMode: d.worksheet.supplies_mode,
      suppliesValue: Number(d.worksheet.supplies_value),
      overheadPct: Number(d.worksheet.overhead_pct),
      profitPct: Number(d.worksheet.profit_pct),
    });
    setBidPrice(d.worksheet.bid_price === null ? "" : String(d.worksheet.bid_price));
    loadedOnce.current = false;
    setState("ready");
  }

  useEffect(() => {
    load();
  }, [submissionId]);

  // The checklist found the WD after this was first shown: fill in now.
  const lastRef = useRef<string | null>(wdRef);
  useEffect(() => {
    if (shouldAutoLoad(state, lastRef.current, wdRef)) load();
    lastRef.current = wdRef;
  }, [wdRef, state]);

  // Autosave: every change restarts the timer; the save sends current state.
  useEffect(() => {
    if (state !== "ready") return;
    if (!loadedOnce.current) {
      loadedOnce.current = true;
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    setSaveState("saving");
    timer.current = setTimeout(async () => {
      await fetch("/api/wage-worksheet", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId, lines, options: opts, ...pricing, bidPrice: bidPrice === "" ? null : Number(bidPrice) }),
      });
      setSaveState("saved");
    }, 800);
  }, [lines, opts, pricing, bidPrice]);

  const box = "mt-6 bg-surface-container-lowest border border-outline-variant rounded-xl p-6";
  if (state === "loading")
    return (
      <section className={box}>
        <p className="flex items-center gap-2"><Spinner /> Preparing the wage worksheet…</p>
      </section>
    );
  if (state === "no_wd" || state === "error")
    return (
      <section className={box} aria-labelledby="wage-worksheet">
        <h2 id="wage-worksheet" className="text-title-lg text-primary">Wage worksheet</h2>
        {state === "error" && <p className="mt-2 text-error">{error}</p>}
        <p className="mt-2 text-body-md text-on-surface-variant">Enter the wage determination from the solicitation (e.g. 2015-4539 (Rev. 32)).</p>
        <form onSubmit={(e) => { e.preventDefault(); load(wdInput); }} className="mt-3 flex gap-2">
          <input value={wdInput} onChange={(e) => setWdInput(e.target.value)} placeholder="2015-4539 (Rev. 32)" className="px-3 py-2 rounded border border-outline-variant font-code" />
          <button type="submit" className="px-4 py-2 rounded-lg bg-primary text-on-primary text-label-md font-bold">Fetch</button>
        </form>
      </section>
    );

  const wd = data!.parsed;
  const { lines: per, total } = computeFloor(lines, wd, opts);
  const { supplies, price } = computePrice(total.floor, pricing);
  const bid = bidPrice === "" ? null : Number(bidPrice);
  const short = belowFloor(bid !== null && Number.isFinite(bid) ? bid : null, total.floor);
  const num = (v: string) => (v === "" ? 0 : Number(v));
  const cell = "px-2 py-1 rounded border border-outline-variant w-24 text-right";

  return (
    <section className={box} aria-labelledby="wage-worksheet">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="wage-worksheet" className="text-title-lg text-primary">Wage worksheet</h2>
        <span className="text-body-sm text-on-surface-variant">{saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : ""}</span>
      </div>
      <p className="mt-1 text-body-sm text-on-surface-variant">
        WD {wd.number} Rev. {wd.revision} · {wd.area ?? wd.state} · check this area matches the place of performance.
      </p>
      {data!.worksheet.wd_revision_source === "latest" && (
        <p className="mt-1 text-body-sm text-error">The solicitation didn&apos;t name a revision; this is the latest. Confirm it with the solicitation.</p>
      )}
      {data!.missingCode && (
        <p className="mt-1 text-body-sm text-error">Position {data!.missingCode} (your trade&apos;s default) isn&apos;t in this WD. Add a position below.</p>
      )}

      <table className="mt-4 w-full text-body-sm">
        <thead>
          <tr className="text-left text-on-surface-variant">
            <th>Position</th><th>Rate</th><th>Workers</th><th>Hours/week each</th><th className="text-right">Floor/year</th><th />
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} className="border-t border-outline-variant">
              <td className="py-2">{l.code} {l.title}{l.hoursSource && <span className="block text-on-surface-variant">{l.hoursSource}</span>}</td>
              <td>{money(per[i].wage)}</td>
              <td><input className={cell} inputMode="decimal" value={l.workers} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, workers: num(e.target.value) } : x)))} /></td>
              <td>
                <input
                  className={`${cell} ${l.hoursPerWeek === 0 ? "border-error bg-error-container/20" : ""}`}
                  inputMode="decimal"
                  value={l.hoursPerWeek}
                  onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, hoursPerWeek: num(e.target.value), hoursSource: null } : x)))}
                />
              </td>
              <td className="text-right font-code">{money(roundCents(per[i].floor))}</td>
              <td><button type="button" onClick={() => setLines(lines.filter((_, j) => j !== i))} className="text-error text-label-sm">Remove</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <select
        className="mt-2 px-2 py-1 rounded border border-outline-variant text-body-sm"
        value=""
        onChange={(e) => {
          const p = wd.positions.find((x) => x.code === e.target.value);
          if (p) setLines([...lines, { code: p.code, title: p.title, rate: p.rate, workers: 1, hoursPerWeek: 0, hoursSource: null }]);
        }}
      >
        <option value="">+ Add a position from this WD…</option>
        {wd.positions.map((p) => <option key={p.code} value={p.code}>{p.code} {p.title} ({money(p.rate)})</option>)}
      </select>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-body-sm max-w-lg">
        <dt>Wages</dt><dd className="text-right font-code">{money(roundCents(total.wages))}</dd>
        <dt>Health &amp; welfare ({money(wd.hwPerHour)}/h, up to 40 h/wk)</dt><dd className="text-right font-code">{money(roundCents(total.hw))}</dd>
        <dt>Holidays ({wd.holidays ?? 0})</dt><dd className="text-right font-code">{money(roundCents(total.holidays))}</dd>
        <dt><label className="flex items-center gap-2"><input type="checkbox" checked={opts.includeVacation} onChange={(e) => setOpts({ ...opts, includeVacation: e.target.checked })} /> Vacation ({wd.vacationWeeks ?? 0} wks)</label></dt><dd className="text-right font-code">{money(roundCents(total.vacation))}</dd>
        <dt>Paid sick leave (EO 13706)</dt><dd className="text-right font-code">{money(roundCents(total.sick))}</dd>
        <dt>Employer FICA (7.65%)</dt><dd className="text-right font-code">{money(roundCents(total.fica))}</dd>
        <dt className="font-bold">Labor-cost floor</dt><dd className="text-right font-code font-bold">{money(roundCents(total.floor))}</dd>
      </dl>
      {wd.eo13658Min !== null && (
        <label className="mt-2 flex items-center gap-2 text-body-sm">
          <input type="checkbox" checked={opts.eo13658} onChange={(e) => setOpts({ ...opts, eo13658: e.target.checked })} />
          Contract covered by EO 13658 (awarded 2015–2022, not renewed since): minimum {money(wd.eo13658Min)}/h
        </label>
      )}

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl text-body-sm">
        <label>Supplies <input className={cell} inputMode="decimal" value={pricing.suppliesValue} onChange={(e) => setPricing({ ...pricing, suppliesValue: num(e.target.value) })} /> {pricing.suppliesMode === "percent" ? "%" : "$"}</label>
        <label>Overhead % <input className={cell} inputMode="decimal" value={pricing.overheadPct} onChange={(e) => setPricing({ ...pricing, overheadPct: num(e.target.value) })} /></label>
        <label>Profit % <input className={cell} inputMode="decimal" value={pricing.profitPct} onChange={(e) => setPricing({ ...pricing, profitPct: num(e.target.value) })} /></label>
      </div>
      <p className="mt-3 text-body-md">Supplies {money(roundCents(supplies))} · <strong>Resulting price {money(roundCents(price))}/year</strong></p>

      <label className="mt-3 flex items-center gap-2 text-body-md">
        Bid price ($/year) <input className={`${cell} w-36`} inputMode="decimal" value={bidPrice} onChange={(e) => setBidPrice(e.target.value)} />
      </label>
      {short !== null && (
        <p role="alert" className="mt-2 text-body-md font-bold text-error">Below the labor-cost floor by {money(short)}/year.</p>
      )}
    </section>
  );
}
