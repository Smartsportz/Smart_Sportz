import { beginGlobalLoading, endGlobalLoading } from "../loading/loadingBus";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";

export type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
  error?: { code: string; details?: unknown };
};

export async function apiRequest<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  beginGlobalLoading();
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
    const payload = (await response.json()) as ApiEnvelope<T>;
    if (!response.ok || !payload.success) {
      throw new Error(payload.message || "Request failed");
    }
    return payload.data;
  } finally {
    endGlobalLoading();
  }
}
