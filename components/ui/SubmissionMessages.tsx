"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "./Spinner";

type Message = {
  id: string;
  message: string;
  sent_by_admin_id: string | null;
  name: string;
  created_at: string;
};

// Mounted on both the admin submission detail page and the client
// dashboard's submission view — a genuine two-way thread, kept separate
// from "Request info from client" (that stays a formal one-way request
// with a checklist item attached, not a conversation). No real-time
// subscription for v1: refresh-on-load is enough for how often either
// side actually checks back.
export function SubmissionMessages({
  submissionId,
  orgId,
  clientId,
  viewerRole,
  senderName,
  senderEmail,
  adminId,
}: {
  submissionId: string;
  orgId: string;
  clientId: string;
  viewerRole: "admin" | "client";
  senderName: string;
  senderEmail: string;
  adminId?: string;
}) {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("support_messages")
      .select("id, message, sent_by_admin_id, name, created_at")
      .eq("submission_id", submissionId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (!cancelled) setMessages(data ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [submissionId, supabase]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setSending(true);
    setError(null);

    const { data: newMessage, error: insertError } = await supabase
      .from("support_messages")
      .insert({
        org_id: orgId,
        client_id: clientId,
        submission_id: submissionId,
        sent_by_admin_id: viewerRole === "admin" ? adminId : null,
        name: senderName,
        email: senderEmail,
        message: draft.trim(),
      })
      .select("id, message, sent_by_admin_id, name, created_at")
      .single();

    if (insertError || !newMessage) {
      setError(insertError?.message ?? "Couldn't send that message.");
      setSending(false);
      return;
    }

    setMessages((m) => [...(m ?? []), newMessage]);
    setDraft("");
    setSending(false);

    if (viewerRole === "admin") {
      fetch("/api/notify-new-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId }),
      }).catch(() => {});
    }
  }

  return (
    <div className="bg-surface-container-lowest dark:bg-surface-container-low border border-outline-variant rounded-xl p-6">
      <h2 className="text-title-lg text-primary mb-4 flex items-center gap-2">
        <span className="material-symbols-outlined text-primary text-[20px]">chat</span>
        Messages
      </h2>

      {messages === null ? (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      ) : messages.length === 0 ? (
        <p className="text-body-md text-on-surface-variant mb-4">No messages yet.</p>
      ) : (
        <div className="flex flex-col gap-3 mb-4 max-h-96 overflow-y-auto">
          {messages.map((m) => {
            const isAdmin = !!m.sent_by_admin_id;
            const isOwnMessage = isAdmin === (viewerRole === "admin");
            return (
              <div key={m.id} className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    isAdmin
                      ? "bg-secondary-container text-on-secondary-container"
                      : "bg-surface-container-high text-on-surface"
                  }`}
                >
                  <p className="text-label-sm font-bold uppercase tracking-wide mb-1 opacity-70">
                    {isAdmin ? "First Coast Bids" : m.name}
                  </p>
                  <p className="text-body-md whitespace-pre-wrap break-words">{m.message}</p>
                  <p className="text-label-sm opacity-60 mt-1">{new Date(m.created_at).toLocaleString()}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {error && <p className="text-body-md text-error mb-2">{error}</p>}

      <form onSubmit={handleSend} className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a message…"
          className="flex-1 px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="px-4 py-2 bg-primary-container text-on-primary-container rounded text-label-md font-semibold hover:opacity-90 transition active:scale-[0.97] disabled:opacity-40 flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {sending && <Spinner />}
          {sending ? "Sending…" : "Send"}
        </button>
      </form>
    </div>
  );
}
