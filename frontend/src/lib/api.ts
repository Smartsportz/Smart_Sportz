import { beginGlobalLoading, endGlobalLoading } from "../loading/loadingBus";

const LOCAL_API_BASE_URL = "http://127.0.0.1:8000/api/v1";
const PRODUCTION_API_BASE_URL = "https://smart-sportz-backend.onrender.com/api/v1";

function resolveApiBaseUrl() {
  const configuredUrl = import.meta.env.VITE_API_BASE_URL;
  if (configuredUrl) return configuredUrl;
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "127.0.0.1" || host === "localhost") {
      return LOCAL_API_BASE_URL;
    }
  }
  return PRODUCTION_API_BASE_URL;
}

const API_BASE_URL = resolveApiBaseUrl();

export type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
  error?: { code: string; details?: unknown };
  detail?: unknown;
};

function errorMessageFromPayload(payload: ApiEnvelope<unknown>) {
  if (payload.message) return payload.message;
  if (typeof payload.detail === "string") return payload.detail;
  if (Array.isArray(payload.detail)) {
    const messages = payload.detail.map((item) => {
        if (item && typeof item === "object" && "msg" in item) {
          const location = "loc" in item && Array.isArray(item.loc) ? item.loc.join(".") : "";
          return `${location ? `${location}: ` : ""}${String(item.msg)}`;
        }
        return String(item);
      });
    const playerNameErrors = messages.filter((message) => message.includes("body.members.") && message.includes(".name"));
    if (playerNameErrors.length) {
      const numbers = playerNameErrors
        .map((message) => message.match(/body\.members\.(\d+)\.name/)?.[1])
        .filter(Boolean)
        .map((value) => Number(value) + 1);
      return `Please complete player names with at least 2 characters for player ${numbers.join(", ")}.`;
    }
    return messages.join(" ");
  }
  if (payload.error?.details) return String(payload.error.details);
  return "Request failed";
}

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
      throw new Error(errorMessageFromPayload(payload as ApiEnvelope<unknown>));
    }
    return payload.data;
  } finally {
    endGlobalLoading();
  }
}
