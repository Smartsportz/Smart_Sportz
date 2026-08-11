import { AlertTriangle, CheckCircle2, X, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import type React from "react";
import { subscribeToToasts, type ToastRecord } from "../lib/toast";

const icons: Record<ToastRecord["type"], React.ReactNode> = {
  error: <XCircle size={20} />,
  warning: <AlertTriangle size={20} />,
  success: <CheckCircle2 size={20} />,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  useEffect(() => {
    return subscribeToToasts((toast) => {
      setToasts((current) => [toast, ...current].slice(0, 5));
      window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== toast.id));
      }, toast.duration);
    });
  }, []);

  function closeToast(id: string) {
    setToasts((current) => current.filter((item) => item.id !== id));
  }

  return (
    <>
      {children}
      <div className="toast-stack" aria-live="polite" aria-relevant="additions removals">
        {toasts.map((toast) => (
          <article className={`toast-card toast-${toast.type}`} key={toast.id} style={{ "--toast-duration": `${toast.duration}ms` } as React.CSSProperties}>
            <div className="toast-icon" aria-hidden="true">{icons[toast.type]}</div>
            <div className="toast-copy">
              <strong>{toast.title}</strong>
              <p>{toast.message}</p>
            </div>
            <button className="toast-close" type="button" aria-label="Close notification" onClick={() => closeToast(toast.id)}>
              <X size={16} />
            </button>
            <span className="toast-neon-line" aria-hidden="true" />
          </article>
        ))}
      </div>
    </>
  );
}

