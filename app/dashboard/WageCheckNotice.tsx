import { wageCheckLines, type WageCheck } from "@/lib/wage/wage-check";

// Read-only: the client does nothing here. Shown once we've set a price.
export function WageCheckNotice({ check }: { check: WageCheck }) {
  const { main, warning } = wageCheckLines(check);
  return (
    <div className={`rounded-xl p-space-base border ${warning ? "bg-error-container/10 border-error/30" : "bg-surface-container-lowest border-outline-variant"}`}>
      <p className="text-label-sm text-on-surface-variant font-bold uppercase tracking-wider mb-1">Wage law check</p>
      <p className="text-body-md text-on-surface">{main}</p>
      {warning && <p className="mt-1 text-body-md text-error font-bold">{warning}</p>}
    </div>
  );
}
