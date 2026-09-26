// Shared skeleton for route-level loading.tsx fallbacks. Deliberately
// subtle (Tailwind's own animate-pulse, no custom shimmer/spinner) so it
// reads as "this content is loading," not as its own attention-grabbing
// animation -- it only needs to hold the layout's shape for the brief gap
// while a page's async Server Component data resolves, now that AppShell
// itself persists across navigation (app/dashboard/layout.tsx,
// app/admin/layout.tsx) and never needs its own loading state.
function Block({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-surface-container-high ${className}`} />;
}

export function PageSkeleton() {
  return (
    <div className="mt-6 flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Block className="h-7 w-64" />
        <Block className="h-4 w-96 max-w-full" />
      </div>
      <Block className="h-32 w-full" />
      <Block className="h-48 w-full" />
      <Block className="h-48 w-full" />
    </div>
  );
}

// The client area's shape (app/dashboard/*, press theme): a page head, then
// a ledger of hairline rows under a heavy rule -- so the skeleton doesn't
// flash the old stacked-card look before the page arrives.
export function LedgerSkeleton() {
  return (
    <div className="mt-4 flex flex-col gap-10" role="status" aria-label="Loading">
      <div className="flex flex-col gap-3">
        <Block className="h-10 w-56" />
        <Block className="h-5 w-96 max-w-full" />
      </div>
      <div className="border-t-2 border-on-surface">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="py-5 border-b border-outline-variant flex flex-col gap-2">
            <Block className="h-5 w-2/3" />
            <Block className="h-3 w-1/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
