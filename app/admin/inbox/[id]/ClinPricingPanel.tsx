"use client";

import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/Toast";
import type { ClinLine } from "@/lib/clins/types";
import type { PricedLine } from "@/lib/clins/price";
import { isScanStale, needsRescan, type ScanState } from "@/lib/checklist/scan-state";
import { shareBoxLines } from "@/lib/clins/price";
import { useRouter } from "next/navigation";

// The solicitation's own price table (CLINs), read with verified quotes and
// priced from the wage worksheet's bid price, the client's yearly increase
// and the split (docs/superpowers/specs/2026-09-25-clin-pricing-design.md).
// Attention-first: only lines that need the admin are highlighted.

type Scan = {
  status: "running" | "done" | "failed";
  started_at?: string;
  files_fingerprint?: string;
  finished_at?: string;
  error?: string | null;
  excel_attachments?: string[];
  found?: number;
  ai_failed?: { file: string; message: string }[];
  unreadable?: { file: string; problem: string }[];
  partial_files?: { file: string; read: number; total: number }[];
} | null;
type View = {
  lines: ClinLine[];
  priced: { lines: PricedLine[]; total: number | null; missing: number; sharesProblem: string | null };
  shares: Record<string, number>;
  scan: Scan;
  bidPrice: number | null;
  increasePct: number | null;
  clientName: string;
  rateSheetStale: boolean;
  rateSheetSaved: boolean;
};

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const PERIODS = ["Base", "Option 1", "Option 2", "Option 3", "Option 4"];
const flag = "border-error bg-error-container/20";

// A text box that saves on leaving it, only when the value changed.
function Cell({ value, onSave, className, placeholder, label }: { value: string; onSave: (v: string) => void; className: string; placeholder?: string; label: string }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <input
      aria-label={label}
      className={`px-1.5 py-1 rounded border border-outline-variant ${className}`}
      value={text}
      placeholder={placeholder}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        if (text !== value) onSave(text);
      }}
    />
  );
}

export function ClinPricingPanel({
  submissionId,
  rfpDocumentUrls,
  currentFingerprint,
  serverScanKey,
}: {
  submissionId: string;
  rfpDocumentUrls: Record<string, string>;
  currentFingerprint: string | null;
  // The reading's state as the page last rendered it: when an upload (or a
  // reading finishing) refreshes the page, this changes and the panel
  // refetches -- found in the dev run, where the lines never appeared.
  serverScanKey: string;
}) {
  const { showToast } = useToast();
  const router = useRouter();
  const [view, setView] = useState<View | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  async function refresh() {
    const res = await fetch(`/api/clin-lines?submissionId=${submissionId}`);
    if (res.ok) setView(await res.json());
  }
  useEffect(() => {
    refresh();
  }, [submissionId, serverScanKey, currentFingerprint]);
  // The worksheet's bid price or the client's yearly increase changed.
  useEffect(() => {
    const on = () => void refresh();
    window.addEventListener("pricing-changed", on);
    return () => window.removeEventListener("pricing-changed", on);
  }, [submissionId]);
  // Files added while a reading ran (a solicitation and its amendment
  // uploaded back to back) are read automatically, once per set of files --
  // the same rule as the checklist panel.
  const [autoStartedFor, setAutoStartedFor] = useState<string | null>(null);
  useEffect(() => {
    if (!view || !currentFingerprint || autoStartedFor === currentFingerprint) return;
    if (!needsRescan(view.scan as ScanState | null, currentFingerprint, new Date())) return;
    setAutoStartedFor(currentFingerprint);
    void read(false);
  }, [view, currentFingerprint, autoStartedFor]);

  // Poll while the price table is being read.
  useEffect(() => {
    // A reading Vercel stopped at 60 s stays "running": stop polling and
    // offer Read again (final review I-4).
    if (view?.scan?.status !== "running" || isScanStale(view.scan as ScanState, new Date())) return;
    const t = setTimeout(refresh, 3000);
    return () => clearTimeout(t);
  }, [view]);

  async function send(method: string, body: Record<string, unknown>) {
    const res = await fetch("/api/clin-lines", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ submissionId, ...body }) });
    const out = await res.json().catch(() => null);
    if (!res.ok) {
      showToast(out?.error ?? `That didn't save (HTTP ${res.status}).`, "error");
      return null;
    }
    if (out?.lines) setView(out);
    return out;
  }

  async function read(force: boolean) {
    setView((v) => (v ? { ...v, scan: { status: "running" } } : v));
    const res = await fetch("/api/clin-scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ submissionId, force }) });
    const out = await res.json().catch(() => null);
    if (out?.status === "not_federal") showToast("This bid isn't marked federal, so its price table isn't read.", "error");
    await refresh();
  }

  async function writeRateSheet(confirmed: boolean) {
    setBusy(true);
    const out = await send("POST", { action: "rate_sheet", confirm: confirmed });
    setBusy(false);
    if (out?.needsConfirm) return setConfirm(true);
    if (out?.written) {
      showToast("Rate sheet updated. Review it under Deliverables.", "success");
      // Show the new Rate sheet in Deliverables, and move the bid on if the
      // package is now complete (final review I-7).
      router.refresh();
      void fetch("/api/advance-if-deliverables-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId }),
      })
        .catch(() => {})
        .finally(() => router.refresh());
      await refresh();
    }
  }

  const box = "mt-6 bg-surface-container-lowest border border-outline-variant rounded-xl p-6";
  if (!view)
    return (
      <section className={box}>
        <p className="flex items-center gap-2"><Spinner /> Loading the price table…</p>
      </section>
    );

  const { lines, priced, scan } = view;
  const timedOut = scan?.status === "running" && isScanStale(scan as ScanState, new Date());
  const running = scan?.status === "running" && !timedOut;
  const boxes = shareBoxLines(lines);
  const counts = new Map<number, number>();
  for (const l of lines) if (l.period_index !== null) counts.set(l.period_index, (counts.get(l.period_index) ?? 0) + 1);
  const splitHere = (l: ClinLine) => l.period_index !== null && (counts.get(l.period_index) ?? 0) > 1;
  const problems = new Set(priced.lines.map((p) => p.problem));
  const byHand = priced.lines.filter((p) => p.problem === "unit").length;
  const guidance = [
    problems.has("no_bid") && "Enter a bid price on the wage worksheet to price these lines.",
    problems.has("no_increase") && `Enter ${view.clientName}'s yearly increase % (in ${view.clientName}'s numbers above) to price the option years.`,
    priced.sharesProblem,
    problems.has("no_period") && "Pick the period (Base or Option) for the lines marked “?”.",
    byHand > 0 && `${byHand} line${byHand === 1 ? " needs a unit price" : "s need a unit price"} typed (not priced per month, per year or as a whole period).`,
  ].filter(Boolean) as string[];

  return (
    <section className={box} aria-labelledby="clin-pricing">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="clin-pricing" className="text-title-lg text-primary">CLIN pricing</h2>
        <span className="text-body-sm text-on-surface-variant flex items-center gap-2">
          {running && (<><Spinner /> Reading the price table…</>)}
          {!running && scan?.status === "done" && scan.finished_at && <>Read {new Date(scan.finished_at).toLocaleString()}</>}
          {!running && scan && (
            <button type="button" onClick={() => read(true)} className="text-primary font-bold underline">Read again</button>
          )}
        </span>
      </div>
      {!scan && !lines.length && (
        <p className="mt-2 text-body-md">
          <button type="button" onClick={() => read(false)} className="px-3 py-1.5 rounded-lg bg-primary text-on-primary text-label-md font-bold">Read the price table</button>
        </p>
      )}
      {scan?.status === "failed" && <p role="alert" className="mt-2 text-error">{scan.error}</p>}
      {timedOut && <p role="alert" className="mt-2 text-error">The reading timed out. Use Read again.</p>}
      {!running && [
        ...(scan?.unreadable ?? []).map((u) => `${u.file} ${u.problem}, so its CLINs weren't read.`),
        ...(scan?.ai_failed ?? []).map((f) => `Part of ${f.file} couldn't be read (${f.message}).`),
        ...(scan?.partial_files ?? []).map((p) => `Only pages 1–${p.read} of ${p.total} of ${p.file} were read.`),
      ].map((m) => (
        <p key={m} role="alert" className="mt-1 text-body-sm text-error">{m} Lines found earlier were kept; check the table against the document.</p>
      ))}
      {view.rateSheetStale && (
        <p role="alert" className="mt-2 text-body-md font-bold text-error">The Rate sheet is out of date. Use Update the Rate sheet.</p>
      )}
      {scan?.status === "done" && !lines.length && <p className="mt-2 text-body-md text-on-surface-variant">No price table found in the uploaded files.</p>}
      {!!scan?.excel_attachments?.length && (
        <p className="mt-2 text-body-sm text-on-surface-variant">
          A price schedule may be in {scan.excel_attachments.join(", ")}, which can&apos;t be read here. Add those lines by hand.
        </p>
      )}
      {guidance.map((g) => (
        <p key={g} className="mt-1 text-body-sm text-error">{g}</p>
      ))}

      {lines.length > 0 && (
        <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[44rem] text-body-sm">
          <thead>
            <tr className="text-left text-on-surface-variant">
              <th>CLIN</th><th>Description</th><th>Qty</th><th>Unit</th><th>Period</th><th>Split&nbsp;%</th><th className="text-right">Unit price</th><th className="text-right">Amount</th><th className="relative"><span className="sr-only">Remove</span></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const p = priced.lines[i];
              const docUrl = l.source_file ? rfpDocumentUrls[l.source_file] : undefined;
              const lump = l.unit_kind === "lump";
              return (
                <tr key={l.id} className="border-t border-outline-variant align-top">
                  <td className="py-2"><Cell label={`CLIN number, line ${i + 1}`} className="w-16 font-code" value={l.clin} onSave={(v) => send("PATCH", { id: l.id, clin: v })} /></td>
                  <td className="py-2">
                    <Cell label={`Description, CLIN ${l.clin}`} className="w-full min-w-36" value={l.description} onSave={(v) => send("PATCH", { id: l.id, description: v })} />
                    <span className="block mt-1 text-on-surface-variant">
                      {l.quote && <i>“{l.quote}”</i>}
                      {docUrl && l.page && (
                        <a href={`${docUrl}#page=${l.page}`} target="_blank" rel="noreferrer" className="ml-2 text-primary font-bold underline">p. {l.page}</a>
                      )}{" "}
                      <span className={l.quote_status === "not_found" || l.quote_status === "unreadable" ? "text-error font-bold" : ""}>
                        {{ verified: "Quote verified", not_found: "Quote not found", unreadable: "Couldn't verify: scanned document", admin: "Added by you" }[l.quote_status]}
                      </span>
                      {l.revised_by && <> · Revised by {l.revised_by}</>}
                      {lump && l.period_months && <> · Whole period, {l.period_months} months</>}
                      {!lump && l.unit === null && l.quantity === null && (l.period_months ?? 0) > 12.5 && (
                        <span className="text-error font-bold"> · The dates read span {l.period_months} months (the whole contract?). Check the period and type a price.</span>
                      )}
                    </span>
                  </td>
                  <td className="py-2">
                    {lump ? "1" : <Cell label={`Quantity, CLIN ${l.clin}`} className={`w-12 text-right ${p.problem === "no_quantity" ? flag : ""}`} value={l.quantity?.toString() ?? ""} onSave={(v) => send("PATCH", { id: l.id, quantity: v })} />}
                  </td>
                  <td className="py-2">
                    {lump ? "Lump sum" : <Cell label={`Unit, CLIN ${l.clin}`} className={`w-14 ${p.problem === "unit" ? flag : ""}`} value={l.unit ?? ""} onSave={(v) => send("PATCH", { id: l.id, unit: v })} />}
                  </td>
                  <td className="py-2">
                    <select
                      aria-label={`Period, CLIN ${l.clin}`}
                      value={l.period_index === null ? "" : String(l.period_index)}
                      onChange={(e) => send("PATCH", { id: l.id, period_index: e.target.value })}
                      className={`w-24 px-1 py-1 rounded border border-outline-variant ${l.period_index === null ? flag : ""}`}
                    >
                      <option value="">?</option>
                      {PERIODS.map((name, k) => <option key={k} value={k}>{name}</option>)}
                    </select>
                  </td>
                  <td className="py-2">
                    {boxes.has(l.clin) ? (
                      <Cell
                        label={`Split percent, CLIN ${l.clin}`}
                        className={`w-12 text-right ${p.problem === "no_share" ? flag : ""}`}
                        value={view.shares[String(l.position)]?.toString() ?? ""}
                        onSave={(v) => send("PUT", { shares: { ...view.shares, [String(l.position)]: v } })}
                      />
                    ) : splitHere(l) ? (
                      <span className="text-on-surface-variant">{view.shares[String(l.position)] ?? "–"}</span>
                    ) : null}
                  </td>
                  <td className="py-2 text-right">
                    <Cell
                      label={`Unit price, CLIN ${l.clin}`}
                      className={`w-24 text-right ${p.unitPrice === null ? flag : ""}`}
                      value={l.unit_price_override !== null ? String(l.unit_price_override) : ""}
                      placeholder={p.unitPrice !== null && !p.typed ? money(p.unitPrice) : ""}
                      onSave={(v) => send("PATCH", { id: l.id, unit_price_override: v })}
                    />
                    {p.typed && <span className="block text-on-surface-variant">typed</span>}
                  </td>
                  <td className="py-2 text-right font-code">{p.amount === null ? "—" : money(p.amount)}</td>
                  <td className="py-2 pl-2">
                    <button type="button" onClick={() => send("DELETE", { id: l.id })} className="text-error text-label-sm">Remove</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      )}

      {lines.length > 0 && (
        <p className="mt-3 text-body-md font-bold">
          {priced.total === null
            ? `Total: ${priced.missing} line${priced.missing === 1 ? "" : "s"} not priced yet`
            : `Total (base + all option years): ${money(priced.total)}`}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-3">
        <button type="button" onClick={() => send("POST", { action: "add" })} className="text-primary font-bold underline text-body-sm">+ Add a line</button>
        {lines.length > 0 && (
          <button type="button" onClick={() => writeRateSheet(false)} disabled={busy} className="px-3 py-1.5 rounded-lg bg-primary text-on-primary text-label-md font-bold flex items-center gap-2 disabled:opacity-40">
            {busy && <Spinner />} Update the Rate sheet
          </button>
        )}
      </div>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          writeRateSheet(true);
        }}
        title="Update the Rate sheet?"
        description="The client can already see this package. Update the Rate sheet anyway?"
        confirmLabel="Update"
      />
    </section>
  );
}
