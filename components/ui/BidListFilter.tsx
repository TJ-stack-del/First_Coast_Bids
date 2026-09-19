"use client";

import { useState, type ReactNode } from "react";

type FilterKey = "all" | "needs_action" | "completed";

export type BidListItem = {
  id: string;
  needsAction: boolean;
  completed: boolean;
  node: ReactNode;
};

// Client dashboard's bid-list filter bar. An item can be neither
// needsAction nor completed (an active bid currently waiting on the
// First Coast Bids team, nothing pending from the client) -- it only shows up
// under "All" in that case, which is correct: it isn't done, but there's
// also nothing to act on yet.
export function BidListFilter({ items, emptyMessage }: { items: BidListItem[]; emptyMessage: string }) {
  const [filter, setFilter] = useState<FilterKey>("all");

  const needsActionCount = items.filter((i) => i.needsAction).length;
  const completedCount = items.filter((i) => i.completed).length;
  const visible =
    filter === "all" ? items : items.filter((i) => (filter === "needs_action" ? i.needsAction : i.completed));

  const tabs: { key: FilterKey; label: string }[] = [
    { key: "all", label: `All (${items.length})` },
    { key: "needs_action", label: `Needs Action (${needsActionCount})` },
    { key: "completed", label: `Completed (${completedCount})` },
  ];

  return (
    <div className="flex flex-col gap-space-base">
      <div className="flex items-center gap-2 flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key)}
            className={`px-3.5 py-1.5 rounded-full text-label-md font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
              filter === tab.key
                ? "bg-primary-container text-on-primary-container"
                : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {visible.length > 0 ? (
        visible.map((item) => <div key={item.id}>{item.node}</div>)
      ) : (
        <p className="text-body-md text-on-surface-variant bg-surface-container-low rounded-xl p-space-base">
          {emptyMessage}
        </p>
      )}
    </div>
  );
}
