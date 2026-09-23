"use client";

import { useState } from "react";
import { Spinner } from "@/components/ui/Spinner";
import s from "@/components/marketing/press.module.css";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Couldn't send your message. Please try again.");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send your message. Please try again.");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="text-center flex flex-col items-center gap-3 py-6">
        {/* Genuine success-state icon (a real "message sent" confirmation) —
            deliberately secondary/emerald, matching the design system's
            compliance/success signal color, not the brand-accent amber
            every other icon on this page uses. */}
        <span className="material-symbols-outlined text-secondary text-[40px]">check_circle</span>
        <h2 className={s.rowTitle}>Message sent</h2>
        <p className={s.muted}>
          Thanks, {name.split(" ")[0] || "there"}. We&apos;ll get back to you at {email} soon.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className={s.field}>
        <label htmlFor="name" className={s.fieldLabel}>
          Name
        </label>
        <input
          id="name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={s.input}
        />
      </div>

      <div className={s.field}>
        <label htmlFor="email" className={s.fieldLabel}>
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={s.input}
        />
      </div>

      <div className={s.field}>
        <label htmlFor="message" className={s.fieldLabel}>
          Message
        </label>
        <textarea
          id="message"
          required
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className={`${s.input} resize-y`}
        />
      </div>

      {error && <p role="alert" className="text-body-md text-error">{error}</p>}

      <button
        type="submit"
        disabled={sending}
        className={`${s.btn} ${s.btnPrimary} self-start`}
      >
        {sending && <Spinner />}
        Send message
      </button>
    </form>
  );
}
