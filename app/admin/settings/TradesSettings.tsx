"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Trade, TradeInput } from "@/lib/trades/types";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/Toast";
import { TradeForm } from "./TradeForm";

type Pending = { trade: TradeInput | null; moves: number; message: string; title: string };

// The trades First Coast Bids offers. Every change is previewed (how many
// open matches would change trade), then confirmed. See
// docs/superpowers/specs/2026-09-23-trade-list-design.md.
export function TradesSettings({ trades }: { trades: Trade[] }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [editing, setEditing] = useState<Trade | "new" | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);

  const sorted = [...trades].sort((a, b) => a.sortOrder - b.sortOrder);

  async function preview(trade: TradeInput | null, title: string) {
    setBusy(true);
    const res = await fetch("/api/admin/trades/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trade }),
    });
    const body = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      showToast(body?.errors?.join(" ") ?? body?.error ?? `Preview failed (HTTP ${res.status}).`, "error");
      return;
    }
    setPending({ trade, moves: body.moves, message: body.message, title });
  }

  async function confirm() {
    if (!pending) return;
    const current = pending;
    setPending(null);
    setBusy(true);
    const res = await fetch("/api/admin/trades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trade: current.trade, expectedMoves: current.moves }),
    });
    const body = await res.json().catch(() => null);
    setBusy(false);
    if (res.status === 409 && body) {
      // Matches changed since the preview: show the new count, ask again.
      setPending({ ...current, moves: body.moves, message: `${body.error} ${body.message}` });
      return;
    }
    if (!res.ok) {
      showToast(body?.errors?.join(" ") ?? body?.error ?? `Save failed (HTTP ${res.status}).`, "error");
      return;
    }
    showToast(body.message, body.failed > 0 ? "error" : "success");
    setEditing(null);
    router.refresh();
  }

  function toggle(t: Trade) {
    const input: TradeInput = { id: t.id, label: t.label, naics: t.naics, nigpCodes: t.nigpCodes, keywords: t.keywords, active: !t.active };
    preview(input, t.active ? `Switch off ${t.label}?` : `Switch on ${t.label}?`);
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="divide-y divide-outline-variant border border-outline-variant rounded-lg">
        {sorted.length === 0 && <li className="p-4 text-body-md text-on-surface-variant">No trades yet.</li>}
        {sorted.map((t) => (
          <li key={t.id} className="p-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="min-w-0 flex-1">
              <p className="text-body-md font-bold text-on-surface">
                {t.label}{" "}
                {!t.active && <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">(off)</span>}
              </p>
              <p className="text-body-sm text-on-surface-variant font-code">
                {t.naics.length} NAICS · {t.nigpCodes.length} NIGP · {t.keywords.length} keywords
              </p>
            </div>
            <button type="button" onClick={() => setEditing(t)} disabled={busy} className="text-primary text-label-md font-bold disabled:opacity-40">
              Edit
            </button>
            <button type="button" onClick={() => toggle(t)} disabled={busy} className="text-on-surface text-label-md font-bold disabled:opacity-40">
              {t.active ? "Switch off" : "Switch on"}
            </button>
          </li>
        ))}
      </ul>

      {editing ? (
        <TradeForm
          key={editing === "new" ? "new" : editing.id}
          initial={editing === "new" ? null : editing}
          allTrades={trades}
          busy={busy}
          onCancel={() => setEditing(null)}
          onSubmit={(input) => preview(input, input.id ? `Save changes to ${input.label}?` : `Add ${input.label}?`)}
        />
      ) : (
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => setEditing("new")} disabled={busy} className="px-4 py-2 rounded-lg bg-primary text-on-primary text-label-md font-bold disabled:opacity-40">
            Add a trade
          </button>
          <button
            type="button"
            onClick={() => preview(null, "Re-sort open matches?")}
            disabled={busy}
            className="px-4 py-2 rounded-lg border border-outline-variant text-on-surface text-label-md font-bold flex items-center gap-2 disabled:opacity-40"
          >
            {busy && <Spinner />}
            Re-sort open matches
          </button>
        </div>
      )}

      <ConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={confirm}
        title={pending?.title ?? ""}
        description={pending?.message ?? ""}
        confirmLabel={pending?.trade ? "Save" : "Re-sort"}
      />
    </div>
  );
}
