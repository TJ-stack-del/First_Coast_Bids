"use client";

import { useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { computeFloor, computePrice, belowFloor, roundCents, type WorksheetLine } from "@/lib/wage/floor";
import type { ParsedWd } from "@/lib/wage/parse-wd";
import { shouldAutoLoad, readNumberText, readOptionalNumberText } from "@/lib/wage/prefill";
import type { ClientPricing } from "@/lib/wage/client-pricing";
import { ClientNumbers } from "./ClientNumbers";
import { createSaver, type SaveStatus } from "@/lib/wage/saver";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

// A number box that keeps exactly what's typed (so "35." keeps its point
// while "35.5" is entered) and passes the math the value it reads. Shows the
// saved value again when you leave the box.
function NumberField({ value, onChange, className }: { value: number; onChange: (n: number) => void; className: string }) {
  const [text, setText] = useState(String(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(String(value));
  }, [value]);
  return (
    <input
      className={className}
      inputMode="decimal"
      value={text}
      onFocus={() => (focused.current = true)}
      onBlur={() => {
        focused.current = false;
        setText(String(value));
      }}
      onChange={(e) => {
        setText(e.target.value);
        const n = readNumberText(e.target.value);
        if (n !== null) onChange(n);
      }}
    />
  );
}

// The same for a box where blank means "not given yet" (the client's
// numbers): shows blank and highlighted when missing, never 0.
function OptionalNumberField({ value, onChange, className }: { value: number | null; onChange: (n: number | null) => void; className: string }) {
  const [text, setText] = useState(value === null ? "" : String(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(value === null ? "" : String(value));
  }, [value]);
  return (
    <input
      className={`${className} ${value === null ? "border-error bg-error-container/20" : ""}`}
      inputMode="decimal"
      value={text}
      onFocus={() => (focused.current = true)}
      onBlur={() => {
        focused.current = false;
        setText(value === null ? "" : String(value));
      }}
      onChange={(e) => {
        setText(e.target.value);
        const n = readOptionalNumberText(e.target.value);
        if (n !== undefined) onChange(n);
      }}
    />
  );
}

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

type Loaded = {
  worksheet: {
    wd_number: string;
    wd_revision: number;
    wd_revision_source: "solicitation" | "latest" | "manual";
    lines: WorksheetLine[];
    options: { includeVacation: boolean; eo13658: boolean };
    supplies_mode: "percent" | "flat";
    supplies_value: number | null;
    overhead_pct: number | null;
    profit_pct: number | null;
    bid_price: number | null;
  };
  parsed: ParsedWd;
  // What's missing (the client's numbers, or the trade's position code),
  // and whether the solicitation's WD differs from this worksheet's (e.g. an
  // amendment).
  guidance: string[];
  wdChanged: { number: string; revision: number | null } | null;
  client: { name: string; pricing: ClientPricing };
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
  const [pricing, setPricing] = useState<{
    suppliesMode: "percent" | "flat";
    suppliesValue: number | null;
    overheadPct: number | null;
    profitPct: number | null;
  }>({ suppliesMode: "percent", suppliesValue: null, overheadPct: null, profitPct: null });
  const [bidPrice, setBidPrice] = useState<string>("");
  const [saveState, setSaveState] = useState<SaveStatus>("idle");
  const [changeWd, setChangeWd] = useState("");
  const [confirmRefill, setConfirmRefill] = useState(false);
  const loadedOnce = useRef(false);

  // One save at a time, newest values win, failures shown (final review I3).
  const saver = useRef(
    createSaver<Record<string, unknown>>({
      delay: 800,
      onStatus: setSaveState,
      send: async (payload) => {
        const res = await fetch("/api/wage-worksheet", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          keepalive: true,
        });
        return res.ok;
      },
    })
  );
  // Leaving the page within the debounce still saves the last edit.
  useEffect(() => {
    const flush = () => void saver.current.flush();
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  async function load(opts?: { wdNumber?: string; refill?: boolean }) {
    await saver.current.flush();
    setState("loading");
    const res = await fetch("/api/wage-worksheet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId, ...(opts?.wdNumber ? { wdNumber: opts.wdNumber } : {}), ...(opts?.refill ? { refill: true } : {}) }),
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
      suppliesValue: d.worksheet.supplies_value === null ? null : Number(d.worksheet.supplies_value),
      overheadPct: d.worksheet.overhead_pct === null ? null : Number(d.worksheet.overhead_pct),
      profitPct: d.worksheet.profit_pct === null ? null : Number(d.worksheet.profit_pct),
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

  // "$90,000" and "90,000" are read, never silently dropped (final review I2).
  const bidParsed = bidPrice.trim() === "" ? null : readNumberText(bidPrice);
  const bidInvalid = bidPrice.trim() !== "" && bidParsed === null;

  // Autosave the latest values after each change.
  useEffect(() => {
    if (state !== "ready") return;
    if (!loadedOnce.current) {
      loadedOnce.current = true;
      return;
    }
    if (bidInvalid) return;
    saver.current.schedule({ submissionId, lines, options: opts, ...pricing, bidPrice: bidParsed });
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
        <form onSubmit={(e) => { e.preventDefault(); load({ wdNumber: wdInput }); }} className="mt-3 flex gap-2">
          <input value={wdInput} onChange={(e) => setWdInput(e.target.value)} placeholder="2015-4539 (Rev. 32)" className="px-3 py-2 rounded border border-outline-variant font-code" />
          <button type="submit" className="px-4 py-2 rounded-lg bg-primary text-on-primary text-label-md font-bold">Fetch</button>
        </form>
      </section>
    );

  const wd = data!.parsed;
  const { lines: per, total } = computeFloor(lines, wd, opts);
  const priceReady = pricing.suppliesValue !== null && pricing.overheadPct !== null && pricing.profitPct !== null;
  const { supplies, price } = computePrice(total.floor, {
    suppliesMode: pricing.suppliesMode,
    suppliesValue: pricing.suppliesValue ?? 0,
    overheadPct: pricing.overheadPct ?? 0,
    profitPct: pricing.profitPct ?? 0,
  });
  const short = belowFloor(bidParsed, total.floor);
  const cell = "px-2 py-1 rounded border border-outline-variant w-24 text-right";

  return (
    <section className={box} aria-labelledby="wage-worksheet">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="wage-worksheet" className="text-title-lg text-primary">Wage worksheet</h2>
        <span className="text-body-sm text-on-surface-variant">
          {saveState === "saving" && "Saving…"}
          {saveState === "saved" && "Saved"}
          {saveState === "error" && (
            <span className="text-error font-bold">
              Not saved.{" "}
              <button type="button" onClick={() => void saver.current.retry()} className="underline">Retry</button>
            </span>
          )}
        </span>
      </div>
      <p className="mt-1 text-body-sm text-on-surface-variant">
        WD {wd.number} Rev. {wd.revision} · {wd.area ?? wd.state} · check this area matches the place of performance.
      </p>
      {data!.worksheet.wd_revision_source === "latest" && (
        <p className="mt-1 text-body-sm text-error">The solicitation didn&apos;t name a revision; this is the latest. Confirm it with the solicitation.</p>
      )}
      {data!.wdChanged && (
        <p role="alert" className="mt-2 text-body-md text-error font-bold">
          The solicitation now names WD {data!.wdChanged.number}
          {data!.wdChanged.revision !== null ? ` Rev. ${data!.wdChanged.revision}` : ""}; this worksheet uses Rev. {wd.revision}.{" "}
          <button
            type="button"
            onClick={() => load({ wdNumber: `${data!.wdChanged!.number}${data!.wdChanged!.revision !== null ? ` (Rev. ${data!.wdChanged!.revision})` : ""}` })}
            className="underline"
          >
            Update the worksheet
          </button>
        </p>
      )}
      {data!.guidance.map((g) => (
        <p key={g} className="mt-1 text-body-sm text-error">{g}</p>
      ))}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-body-sm">
        <form onSubmit={(e) => { e.preventDefault(); if (changeWd.trim()) load({ wdNumber: changeWd }); }} className="flex items-center gap-2">
          <input value={changeWd} onChange={(e) => setChangeWd(e.target.value)} placeholder="Change WD, e.g. 2015-4539 Rev 33" className="px-2 py-1 rounded border border-outline-variant font-code w-64" />
          <button type="submit" className="text-primary font-bold underline">Use this WD</button>
        </form>
        <button type="button" onClick={() => setConfirmRefill(true)} className="text-primary font-bold underline">Re-fill from {data!.client.name}&apos;s numbers</button>
      </div>

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
              <td><NumberField className={cell} value={l.workers} onChange={(n) => setLines(lines.map((x, j) => (j === i ? { ...x, workers: n } : x)))} /></td>
              <td>
                <NumberField
                  className={`${cell} ${l.hoursPerWeek === 0 ? "border-error bg-error-container/20" : ""}`}
                  value={l.hoursPerWeek}
                  onChange={(n) => setLines(lines.map((x, j) => (j === i ? { ...x, hoursPerWeek: n, hoursSource: null } : x)))}
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
        <dt>Health &amp; welfare ({money(total.hwRate)}/h{wd.paidSickLeave && wd.hwEo13706PerHour !== null ? ", the WD's EO 13706 rate" : ""}, up to 40 h/wk)</dt><dd className="text-right font-code">{money(roundCents(total.hw))}</dd>
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

      <ClientNumbers
        key={JSON.stringify(data!.client.pricing)}
        submissionId={submissionId}
        clientName={data!.client.name}
        initial={data!.client.pricing}
        onSaved={(applied) => {
          if (applied) load();
        }}
      />

      <p className="mt-4 text-label-md font-bold">This bid</p>
      <div className="mt-1 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl text-body-sm">
        <label>
          Supplies <OptionalNumberField className={cell} value={pricing.suppliesValue} onChange={(n) => setPricing({ ...pricing, suppliesValue: n })} />{" "}
          <select
            value={pricing.suppliesMode}
            onChange={(e) => setPricing({ ...pricing, suppliesMode: e.target.value as "percent" | "flat" })}
            className="px-1 py-1 rounded border border-outline-variant"
          >
            <option value="percent">% of labor</option>
            <option value="flat">$ per year</option>
          </select>
        </label>
        <label>Overhead % <OptionalNumberField className={cell} value={pricing.overheadPct} onChange={(n) => setPricing({ ...pricing, overheadPct: n })} /></label>
        <label>Profit % <OptionalNumberField className={cell} value={pricing.profitPct} onChange={(n) => setPricing({ ...pricing, profitPct: n })} /></label>
      </div>
      {priceReady ? (
        <p className="mt-3 text-body-md">Supplies {money(roundCents(supplies))} · <strong>Resulting price {money(roundCents(price))}/year</strong></p>
      ) : (
        <p className="mt-3 text-body-md text-error font-bold">Enter {data!.client.name}&apos;s numbers to see a price.</p>
      )}

      <label className="mt-3 flex items-center gap-2 text-body-md">
        Bid price ($/year) <input className={`${cell} w-36`} inputMode="decimal" value={bidPrice} onChange={(e) => setBidPrice(e.target.value)} />
      </label>
      {bidInvalid && <p role="alert" className="mt-2 text-body-md font-bold text-error">The bid price isn&apos;t a number, so it can&apos;t be checked against the floor.</p>}
      {short !== null && (
        <p role="alert" className="mt-2 text-body-md font-bold text-error">Below the labor-cost floor by {money(short)}/year.</p>
      )}
      <ConfirmDialog
        open={confirmRefill}
        onClose={() => setConfirmRefill(false)}
        onConfirm={() => {
          setConfirmRefill(false);
          load({ refill: true });
        }}
        title={`Re-fill from ${data!.client.name}'s numbers?`}
        description={`This replaces the positions, hours, supplies, overhead and profit with ${data!.client.name}'s saved numbers. The bid price is kept.`}
        confirmLabel="Re-fill"
      />
    </section>
  );
}
