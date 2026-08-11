import { beginGlobalLoading, endGlobalLoading } from "../loading/loadingBus";
import { showToast, type ToastType } from "./toast";

const LOCAL_API_BASE_URL = "/api/v1";
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

export const API_BASE_URL = resolveApiBaseUrl();
const API_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 45000);

export function mediaUrl(path?: string) {
  if (!path) return "";
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  if (path.startsWith(import.meta.env.BASE_URL)) return path;
  if (path.startsWith("/api/v1/")) return `${API_BASE_URL}${path.slice("/api/v1".length)}`;
  if (path.startsWith("/storage/")) return `${API_BASE_URL}${path}`;
  if (/^\/(assets|media)\//.test(path)) return `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
  return path;
}

export function websocketUrl(path: string) {
  const base = API_BASE_URL.startsWith("http")
    ? API_BASE_URL.replace(/^http/, "ws")
    : `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}${API_BASE_URL}`;
  return `${base}${path}`;
}
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

type FriendlyError = {
  title: string;
  message: string;
  type: ToastType;
  status?: number;
};

export class ApiError extends Error {
  title: string;
  type: ToastType;
  status?: number;

  constructor(error: FriendlyError) {
    super(error.message);
    this.name = "ApiError";
    this.title = error.title;
    this.type = error.type;
    this.status = error.status;
  }
}

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

function friendlyError(status: number, payload?: ApiEnvelope<unknown>): FriendlyError {
  if (status === 400 || status === 422) {
    return { status, type: "warning", title: "Validation Error", message: errorMessageFromPayload(payload ?? {} as ApiEnvelope<unknown>) || "Please check the form and try again." };
  }
  if (status === 401) {
    return { status, type: "error", title: "Session Expired", message: "Your session has expired. Please sign in again." };
  }
  if (status === 403) {
    return { status, type: "error", title: "Permission Denied", message: "You do not have permission to perform this action." };
  }
  if (status === 404) {
    return { status, type: "warning", title: "Not Found", message: "The requested resource could not be found." };
  }
  if (status === 408 || status === 504) {
    return { status, type: "warning", title: "Request Timeout", message: "The request took too long. Please try again." };
  }
  if (status === 409) {
    return { status, type: "warning", title: "Action Needed", message: errorMessageFromPayload(payload ?? {} as ApiEnvelope<unknown>) || "This action could not be completed." };
  }
  if (status >= 500) {
    return { status, type: "error", title: "Server Error", message: "Server error. Please try again later." };
  }
  return { status, type: "error", title: "Request Failed", message: "Something went wrong. Please try again." };
}

function errorFromCaught(caught: unknown): FriendlyError {
  if (caught instanceof ApiError) {
    return { status: caught.status, type: caught.type, title: caught.title, message: caught.message };
  }
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { type: "error", title: "Network Error", message: "Unable to connect to the server. Check your internet connection." };
  }
  if (caught instanceof DOMException && caught.name === "AbortError") {
    return { type: "warning", title: "Request Timeout", message: "The request took too long. Please try again." };
  }
  return { type: "error", title: "Network Error", message: "Unable to connect to the server. Check your internet connection." };
}

function notify(error: FriendlyError, enabled = true) {
  if (!enabled) return;
  showToast(error.type, error.title, error.message);
}

async function parseEnvelope<T>(response: Response) {
  try {
    return (await response.json()) as ApiEnvelope<T>;
  } catch {
    return { success: false, message: "", data: null as T } as ApiEnvelope<T>;
  }
}

async function refreshSession() {
  if (typeof localStorage === "undefined") return null;
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return null;
  try {
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
    if (!response.ok || !payload.success) {
      clearStoredSession();
      return null;
    }
    localStorage.setItem(USER_KEY, JSON.stringify(payload.data.user));
    localStorage.setItem(TOKEN_KEY, payload.data.accessToken);
    localStorage.setItem(REFRESH_KEY, payload.data.refreshToken);
    window.dispatchEvent(new CustomEvent(SESSION_REFRESHED_EVENT, { detail: payload.data }));
    return payload.data.accessToken;
  } catch {
    clearStoredSession();
    return null;
  }
}

function clearStoredSession() {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  window.dispatchEvent(new CustomEvent(SESSION_REFRESHED_EVENT, { detail: null }));
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}) {
  if (init.signal || API_TIMEOUT_MS <= 0) {
    return fetch(input, init);
  }
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

async function sendRequest(path: string, options: RequestInit, token?: string | null) {
  return fetchWithTimeout(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
}

async function optimizeImageForUpload(file: File) {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") {
    return file;
  }
  const imageUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = imageUrl;
    });
    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return file;
    context.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
    if (!blob || blob.size >= file.size) return file;
    const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${baseName}.webp`, { type: "image/webp", lastModified: Date.now() });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

type ApiRequestOptions = RequestInit & { silent?: boolean; toast?: boolean; successToast?: string | boolean };

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}, token?: string | null): Promise<T> {
  const { silent, toast = true, successToast = false, ...requestOptions } = options;
  if (!silent) beginGlobalLoading();
  try {
    const storedToken = typeof localStorage !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
    const requestToken = token ?? storedToken;
    let response = await sendRequest(path, requestOptions, requestToken);
    let payload = await parseEnvelope<T>(response);
    const shouldRefresh = response.status === 401 && requestToken && !path.startsWith("/auth/");
    if (shouldRefresh) {
      const refreshedToken = await refreshSession();
      if (refreshedToken) {
        response = await sendRequest(path, requestOptions, refreshedToken);
        payload = await parseEnvelope<T>(response);
      } else {
        throw new ApiError(friendlyError(401, payload as ApiEnvelope<unknown>));
      }
    }
    if (!response.ok || !payload.success) {
      throw new ApiError(friendlyError(response.status, payload as ApiEnvelope<unknown>));
    }
    if (successToast) {
      showToast("success", "Success", successToast === true ? payload.message || "Action completed successfully." : successToast);
    }
    return payload.data;
  } catch (caught) {
    const error = errorFromCaught(caught);
    notify(error, toast);
    throw new ApiError(error);
  } finally {
    if (!silent) endGlobalLoading();
  }
}

export async function uploadFile(file: File, token?: string | null, options: { silent?: boolean; toast?: boolean; successToast?: string | boolean } = {}): Promise<{ filename: string; originalName?: string; size: number; url: string }> {
  if (!options.silent) beginGlobalLoading();
  try {
    const storedToken = typeof localStorage !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
    const requestToken = token ?? storedToken;
    const formData = new FormData();
    const upload = await optimizeImageForUpload(file);
    formData.append("file", upload);
    const response = await fetchWithTimeout(`${API_BASE_URL}/storage/upload`, {
      method: "POST",
      headers: requestToken ? { Authorization: `Bearer ${requestToken}` } : undefined,
      body: formData,
    });
    const payload = await parseEnvelope<{ filename: string; originalName?: string; size: number; url: string }>(response);
    if (!response.ok || !payload.success) {
      throw new ApiError(friendlyError(response.status, payload as ApiEnvelope<unknown>));
    }
    const url = /^https?:\/\//i.test(payload.data.url) ? payload.data.url : `${API_BASE_URL}${payload.data.url.replace(/^\/api\/v1/, "")}`;
    if (options.successToast) {
      showToast("success", "Upload Complete", options.successToast === true ? "File uploaded successfully." : options.successToast);
    }
    return { ...payload.data, originalName: payload.data.originalName || upload.name, url };
  } catch (caught) {
    const error = errorFromCaught(caught);
    notify(error, options.toast !== false);
    throw new ApiError(error);
  } finally {
    if (!options.silent) endGlobalLoading();
  }
}
