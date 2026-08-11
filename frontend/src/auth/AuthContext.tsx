import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type React from "react";
import { apiRequest } from "../lib/api";
import { showToast } from "../lib/toast";

export type Role = "super_admin" | "management" | "user";

export type RoleProgram = {
  label: string;
  path: string;
  permission: string;
};

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  roleLabel: string;
  homePath: string;
  permissions: string[];
  programs: RoleProgram[];
  avatarUrl?: string;
  googleLogin?: boolean;
};

type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

export type OtpChallenge = {
  otpRequired: true;
  challengeId: string;
  channel: "whatsapp";
  target: string;
  deliveryMessage: string;
};

export type SignupPayload = {
  name: string;
  email: string;
  phone: string;
  password: string;
  channel: "whatsapp";
};

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<AuthUser | OtpChallenge>;
  loginWithGoogle: (credential: string) => Promise<AuthUser>;
  verifyLoginOtp: (challengeId: string, code: string) => Promise<AuthUser>;
  startSignup: (payload: SignupPayload) => Promise<OtpChallenge>;
  verifySignup: (challengeId: string, code: string) => Promise<AuthUser>;
  logout: () => void;
  canAccessRole: (roles: Role[]) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const USER_KEY = "smart-sportz-user";
const TOKEN_KEY = "smart-sportz-token";
const REFRESH_KEY = "smart-sportz-refresh-token";
const SESSION_REFRESHED_EVENT = "smart-sportz-session-refreshed";

function readStoredUser(): AuthUser | null {
  const stored = localStorage.getItem(USER_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as AuthUser;
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

function isOtpChallenge(value: LoginResponse | OtpChallenge): value is OtpChallenge {
  return "otpRequired" in value && value.otpRequired;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => readStoredUser());
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));

  useEffect(() => {
    function handleSessionRefreshed(event: Event) {
      const detail = (event as CustomEvent<LoginResponse | null>).detail;
      if (!detail) {
        setUser(null);
        setToken(null);
        return;
      }
      setUser(detail.user);
      setToken(detail.accessToken);
    }
    window.addEventListener(SESSION_REFRESHED_EVENT, handleSessionRefreshed);
    return () => window.removeEventListener(SESSION_REFRESHED_EVENT, handleSessionRefreshed);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    token,
    isAuthenticated: Boolean(user && token),
    async login(email: string, password: string) {
      const data = await apiRequest<LoginResponse | OtpChallenge>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (isOtpChallenge(data)) return data;
      if (!data || typeof data !== "object" || !("user" in data) || !("accessToken" in data) || !("refreshToken" in data)) {
        throw new Error("Login response was invalid.");
      }
      const loginData = data as LoginResponse;
      localStorage.setItem(USER_KEY, JSON.stringify(loginData.user));
      localStorage.setItem(TOKEN_KEY, loginData.accessToken);
      localStorage.setItem(REFRESH_KEY, loginData.refreshToken);
      setUser(loginData.user);
      setToken(loginData.accessToken);
      showToast("success", "Signed In", "Welcome back to Smart Sportz.");
      return loginData.user;
    },
    async loginWithGoogle(credential: string) {
      const data = await apiRequest<LoginResponse>("/auth/google", {
        method: "POST",
        body: JSON.stringify({ credential }),
      });
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      localStorage.setItem(TOKEN_KEY, data.accessToken);
      localStorage.setItem(REFRESH_KEY, data.refreshToken);
      setUser(data.user);
      setToken(data.accessToken);
      showToast("success", "Signed In", "Google login completed successfully.");
      return data.user;
    },
    async verifyLoginOtp(challengeId: string, code: string) {
      const data = await apiRequest<LoginResponse>("/auth/login/verify", {
        method: "POST",
        body: JSON.stringify({ challenge_id: challengeId, code }),
      });
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      localStorage.setItem(TOKEN_KEY, data.accessToken);
      localStorage.setItem(REFRESH_KEY, data.refreshToken);
      setUser(data.user);
      setToken(data.accessToken);
      showToast("success", "Signed In", "OTP verified successfully.");
      return data.user;
    },
    async startSignup(payload: SignupPayload) {
      return apiRequest<OtpChallenge>("/auth/signup/start", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    async verifySignup(challengeId: string, code: string) {
      const data = await apiRequest<LoginResponse>("/auth/signup/verify", {
        method: "POST",
        body: JSON.stringify({ challenge_id: challengeId, code }),
      });
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      localStorage.setItem(TOKEN_KEY, data.accessToken);
      localStorage.setItem(REFRESH_KEY, data.refreshToken);
      setUser(data.user);
      setToken(data.accessToken);
      showToast("success", "Account Created", "Your participant account is ready.");
      return data.user;
    },
    logout() {
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
      setUser(null);
      setToken(null);
      showToast("success", "Signed Out", "You have been signed out.");
    },
    canAccessRole(roles: Role[]) {
      return Boolean(user && roles.includes(user.role));
    },
  }), [user, token]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
