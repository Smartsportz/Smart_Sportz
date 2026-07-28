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
const USER_KEY = "smart-sportz-user";
const TOKEN_KEY = "smart-sportz-token";
const REFRESH_KEY = "smart-sportz-refresh-token";
const SESSION_REFRESHED_EVENT = "smart-sportz-session-refreshed";

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

async function parseEnvelope<T>(response: Response) {
  return (await response.json()) as ApiEnvelope<T>;
}

async function refreshSession() {
  if (typeof localStorage === "undefined") return null;
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return null;
  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  const payload = await parseEnvelope<{
    accessToken: string;
    refreshToken: string;
    user: unknown;
  }>(response);
  if (!response.ok || !payload.success) return null;
  localStorage.setItem(USER_KEY, JSON.stringify(payload.data.user));
  localStorage.setItem(TOKEN_KEY, payload.data.accessToken);
  localStorage.setItem(REFRESH_KEY, payload.data.refreshToken);
  window.dispatchEvent(new CustomEvent(SESSION_REFRESHED_EVENT, { detail: payload.data }));
  return payload.data.accessToken;
}

function clearStoredSession() {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  window.dispatchEvent(new CustomEvent(SESSION_REFRESHED_EVENT, { detail: null }));
}

async function sendRequest(path: string, options: RequestInit, token?: string | null) {
  return fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
}

export async function apiRequest<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  beginGlobalLoading();
  try {
    let response = await sendRequest(path, options, token);
    let payload = await parseEnvelope<T>(response);
    const shouldRefresh = response.status === 401 && token && !path.startsWith("/auth/");
    if (shouldRefresh) {
      const refreshedToken = await refreshSession();
      if (refreshedToken) {
        response = await sendRequest(path, options, refreshedToken);
        payload = await parseEnvelope<T>(response);
      } else {
        clearStoredSession();
      }
    }
    if (!response.ok || !payload.success) {
      throw new Error(errorMessageFromPayload(payload as ApiEnvelope<unknown>));
    }
    return payload.data;
  } finally {
    endGlobalLoading();
  }
}
