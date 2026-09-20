"use client";

import { useEffect, useState, createContext, useContext, useCallback } from "react";

type ToastVariant = "error" | "success" | "info";

type ToastMessage = {
  id: number;
  message: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  showToast: (message: string, variant?: ToastVariant) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

// Drop <ToastProvider> once near the root of the admin layout
// (e.g. app/admin/layout.tsx), then call useToast().showToast(...)
// from any client component underneath it instead of local
// useState + inline <p className="text-error"> blocks.
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, variant: ToastVariant = "error") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, variant }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 6000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const styles: Record<ToastVariant, string> = {
    error: "bg-surface-container-lowest border-error text-error",
    success: "bg-surface-container-lowest border-primary text-primary",
    info: "bg-surface-container-lowest border-primary text-on-surface",
  };

  return (
    <div
      className={`pointer-events-auto rounded-lg border px-4 py-3 shadow-lg text-body-md flex items-start gap-3 ${styles[toast.variant]}`}
      role="alert"
    >
      <p className="flex-1 whitespace-pre-wrap">{toast.message}</p>
      <button
        onClick={onDismiss}
        className="text-on-surface-variant hover:text-on-surface font-bold shrink-0"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
