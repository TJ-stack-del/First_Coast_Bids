"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Message = {
  id: string;
  name: string;
  email: string;
  message: string;
  read: boolean;
  created_at: string;
};

export function SupportMessagesList({ messages }: { messages: Message[] }) {
  const [items, setItems] = useState(messages);
  const [pendingIds, setPendingIds] = useState<Record<string, boolean>>({});
  const supabase = createClient();

  async function toggleRead(id: string, read: boolean) {
    setPendingIds((p) => ({ ...p, [id]: true }));
    const { error } = await supabase.from("support_messages").update({ read }).eq("id", id);
    if (!error) {
      setItems((current) => current.map((m) => (m.id === id ? { ...m, read } : m)));
    }
    setPendingIds((p) => ({ ...p, [id]: false }));
  }

  if (items.length === 0) {
    return (
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl mt-4 px-4 py-6 text-center text-on-surface-variant">
        No support messages yet.
      </div>
    );
  }

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl mt-4 divide-y divide-outline-variant">
      {items.map((m) => (
        <div key={m.id} className="flex flex-col gap-2 px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-on-surface break-words">{m.name}</p>
                {!m.read && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-primary-container text-on-primary-container font-bold uppercase">
                    New
                  </span>
                )}
              </div>
              <a
                href={`mailto:${m.email}`}
                className="text-label-md text-primary hover:underline break-words focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary rounded-sm"
              >
                {m.email}
              </a>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <span className="text-label-md text-on-surface-variant whitespace-nowrap">
                {new Date(m.created_at).toLocaleString()}
              </span>
              <button
                type="button"
                onClick={() => toggleRead(m.id, !m.read)}
                disabled={!!pendingIds[m.id]}
                className="px-3 py-1.5 rounded border border-outline-variant text-label-md font-semibold hover:bg-surface-container-high transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {m.read ? "Mark unread" : "Mark read"}
              </button>
            </div>
          </div>
          <p className="text-body-md text-on-surface whitespace-pre-wrap">{m.message}</p>
        </div>
      ))}
    </div>
  );
}
