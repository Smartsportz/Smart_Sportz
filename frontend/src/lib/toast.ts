export type ToastType = "error" | "warning" | "success";

export type ToastRecord = {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  duration: number;
};

const TOAST_EVENT = "smart-sportz-toast";

export function showToast(type: ToastType, title: string, message: string, duration = 5000) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ToastRecord>(TOAST_EVENT, {
    detail: {
      id: `toast_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      type,
      title,
      message,
      duration,
    },
  }));
}

export function subscribeToToasts(callback: (toast: ToastRecord) => void) {
  if (typeof window === "undefined") return () => undefined;
  const handler = (event: Event) => callback((event as CustomEvent<ToastRecord>).detail);
  window.addEventListener(TOAST_EVENT, handler);
  return () => window.removeEventListener(TOAST_EVENT, handler);
}

