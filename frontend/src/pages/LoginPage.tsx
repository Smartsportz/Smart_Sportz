import { Lock } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth, type OtpChallenge } from "../auth/AuthContext";
import { Page } from "../components/UI";
import { assets } from "../data/platform";
import { apiRequest } from "../lib/api";
import { showToast } from "../lib/toast";

type IconProps = {
  size?: number;
  className?: string;
};

function Eye({ size = 20, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M2.1 12a10 10 0 0 1 19.8 0 10 10 0 0 1-19.8 0" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOff({ size = 20, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6A2 2 0 0 0 12 16a2 2 0 0 0 1.4-.6" />
      <path d="M9.9 4.2A10.4 10.4 0 0 1 12 4c5.5 0 9.5 4.8 10.7 8-0.4 1.1-1.2 2.6-2.5 4.1" />
      <path d="M6.1 6.1C3.8 7.7 2.6 10 1.3 12c1.4 2.1 5.4 7 10.7 7 .9 0 1.8-.1 2.6-.3" />
    </svg>
  );
}

const GOOGLE_CLIENT_ID = "1052442707513-ht85fnn4ag34pvna47vv6cnorv4bto7c.apps.googleusercontent.com";

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (options: { client_id: string; callback: (response: { credential?: string }) => void; ux_mode?: "popup" | "redirect"; use_fedcm_for_prompt?: boolean }) => void;
          renderButton: (element: HTMLElement, options: Record<string, string | number | boolean>) => void;
        };
      };
    };
    smartSportzGoogleClientId?: string;
  }
}

export function LoginPage({ recovery = false }: { recovery?: boolean }) {
  const { login, loginWithGoogle, startSignup, verifyLoginOtp, verifySignup } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const googleCallbackRef = useRef<(response: { credential?: string }) => void>(() => undefined);
  const from = (location.state as { from?: string } | null)?.from;
  const registerFlow = Boolean(from?.includes("/register"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginPreset, setLoginPreset] = useState<"super_admin" | "management" | "participant" | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("+916374409006");
  const [channel] = useState<"whatsapp">("whatsapp");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID;
  /* const emailPlaceholder = loginPreset === "management"
    ? "manager@smartsportz.in"
    : loginPreset === "participant"
      ? "user@smartsportz.in"
      : "admin@smartsportz.in";
  const passwordPlaceholder = loginPreset === "management"
    ? "manager123"
    : loginPreset === "participant"
      ? "user123"
      : "admin123";
  */
  function applyLoginPreset(preset: "super_admin" | "management" | "participant") {
    setLoginPreset(preset);
    setEmail("");
    setPassword("");
    setError("");
  }

  useEffect(() => {
    googleCallbackRef.current = async (response) => {
      if (!response.credential) {
        setError("Google did not return a login credential.");
        showToast("warning", "Google Login", "Google did not return a login credential.");
        return;
      }
      setLoading(true);
      setError("");
      try {
        const user = await loginWithGoogle(response.credential);
        navigate(from || user.homePath, { replace: true });
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Google login failed");
      } finally {
        setLoading(false);
      }
    };
  }, [from, loginWithGoogle, navigate]);

  useEffect(() => {
    if (recovery || challenge || !googleClientId || !googleButtonRef.current) return;
    const scriptId = "google-identity-script";
    function renderGoogleButton() {
      if (!window.google?.accounts?.id || !googleButtonRef.current) return;
      if (window.smartSportzGoogleClientId !== googleClientId) {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: (response) => googleCallbackRef.current(response),
          ux_mode: "popup",
          use_fedcm_for_prompt: false,
        });
        window.smartSportzGoogleClientId = googleClientId;
      }
      googleButtonRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "large",
        shape: "pill",
        text: "continue_with",
        width: 310,
      });
    }
    if (!document.getElementById(scriptId)) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = renderGoogleButton;
      document.head.appendChild(script);
    } else {
      renderGoogleButton();
    }
  }, [challenge, googleClientId, recovery]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (recovery) {
      setLoading(true);
      setError("");
      try {
        if (challenge) {
          await apiRequest("/auth/forgot-password/reset", {
            method: "POST",
            body: JSON.stringify({ challenge_id: challenge.challengeId, code: otp, password: newPassword }),
          });
          showToast("success", "Password Reset", "Your password was reset successfully.");
          setChallenge(null);
          setOtp("");
          setNewPassword("");
          navigate("/login", { replace: true });
          return;
        }
        const resetChallenge = await apiRequest<OtpChallenge>("/auth/forgot-password/start", {
          method: "POST",
          body: JSON.stringify({ email }),
        });
        setChallenge(resetChallenge);
        setOtp("");
        showToast("success", "OTP Sent", "Password reset OTP is ready.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Password reset failed");
      } finally {
        setLoading(false);
      }
      return;
    }
    setLoading(true);
    setError("");
    try {
      if (challenge) {
        const user = mode === "signup"
          ? await verifySignup(challenge.challengeId, otp)
          : await verifyLoginOtp(challenge.challengeId, otp);
        navigate(from || user.homePath, { replace: true });
        return;
      }
      if (mode === "signup") {
        const otpChallenge = await startSignup({ name, email, phone, password, channel });
        setChallenge(otpChallenge);
        setOtp("");
        return;
      }
      const result = await login(email, password);
      if ("otpRequired" in result) {
        setChallenge(result);
        setOtp("");
        return;
      }
      const user = result;
      navigate(from || user.homePath, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Page className="auth-page">
      <div className="auth-card">
        <div className="auth-visual">
          <img src={assets.cricket} alt="" />
          <h2>SmartSportz.in</h2>
          <p>Secure tournament operations for teams, athletes, managers, and admins.</p>
        </div>
        <form onSubmit={handleSubmit}>
          <Lock size={28} />
          <h1>{recovery ? "Forgot Password?" : mode === "signup" ? "Create Account" : "Welcome Back"}</h1>
          <p>
            {challenge
              ? challenge.deliveryMessage?.startsWith("Local OTP:")
                ? "Enter the OTP shown below. WhatsApp delivery is inactive in this build."
                : `Enter the OTP sent by WhatsApp to ${challenge.target}.`
              : recovery
                ? "Enter your email and verify the account by WhatsApp OTP."
                : mode === "signup"
                  ? "Create a participant account and verify it by WhatsApp before opening your dashboard."
                  : "Please enter your credentials to access your dashboard."}
          </p>
          {!challenge && mode === "signup" && <label>Full name<input placeholder="Team captain name" value={name} onChange={(event) => setName(event.target.value)} /></label>}
          {!challenge && <label>Email address<input placeholder='example@gmail.com' value={email} onChange={(event) => setEmail(event.target.value)} /></label>}   {/* removed the placeholder of emailPlaceholder */}
          {!challenge && mode === "signup" && <label>Phone number<input placeholder="+916374409006" value={phone} onChange={(event) => setPhone(event.target.value)} /></label>}
          {!challenge && !recovery && (
            <label className="password-field">
              Password
              <div className="password-input-wrap">
                <input
                  placeholder="*****"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  type="button"
                  className="password-toggle"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </label>
          )}
          {!challenge && !recovery && mode === "login" && (
            <div className="google-login-wrap">
              {googleClientId ? (
                <div ref={googleButtonRef} className="google-identity-button" />
              ) : (
                <button className="google-login-button" type="button" onClick={() => setError("Google login could not initialize. Refresh the page and confirm this domain is allowed in Google Cloud OAuth origins.")}>
                  <span className="google-mark" aria-hidden="true">G</span>
                  Login with Google
                </button>
              )}
            </div>
          )}
          {!challenge && mode === "signup" && <div className="otp-channel-group"><button type="button" className="active">Verify by WhatsApp</button></div>}
          {challenge && <label>OTP code<input placeholder="4 digit code" value={otp} onChange={(event) => setOtp(event.target.value)} maxLength={8} /></label>}
          {challenge && recovery && <label>New password<input placeholder="New secure password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>}
          {challenge?.deliveryMessage?.startsWith("Local OTP:") && <div className="otp-local-box">{challenge.deliveryMessage}</div>}
          {error && <div className="form-alert">{error}</div>}
          <button type="submit" className="btn btn-primary wide" disabled={loading}>
            {loading ? "Please wait..." : challenge ? "Verify OTP" : recovery ? "Send OTP" : mode === "signup" ? "Create and verify account" : "Sign in"}
          </button>
          {/*
          {!recovery && !challenge && mode === "login" && (
            <div className="login-help">
              <button type="button" onClick={() => applyLoginPreset("super_admin")}>Super Admin</button>
              <button type="button" onClick={() => applyLoginPreset("management")}>Management</button>
              <button type="button" onClick={() => applyLoginPreset("participant")}>Participant</button>
            </div>
          )} 
            */}
          {!recovery && !challenge && (
            <button className="auth-switch" type="button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}>
              {mode === "login" ? "I do not have an account already" : "I already have an account"}
            </button>
          )}
          {challenge && <button className="auth-switch" type="button" onClick={() => { setChallenge(null); setOtp(""); }}>Change details</button>}
          {recovery && <Link to="/login">Back to login</Link>}
          {!recovery && mode === "login" && <Link to="/forgot-password">Forgot password?</Link>}
        </form>
      </div>
    </Page>
  );
}
