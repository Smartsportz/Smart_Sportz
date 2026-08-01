import { Lock } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth, type OtpChallenge } from "../auth/AuthContext";
import { Page } from "../components/UI";
import { assets } from "../data/platform";
import { apiRequest } from "../lib/api";

const GOOGLE_CLIENT_ID = "1052442707513-ht85fnn4ag34pvna47vv6cnorv4bto7c.apps.googleusercontent.com";

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (options: { client_id: string; callback: (response: { credential?: string }) => void }) => void;
          renderButton: (element: HTMLElement, options: Record<string, string | number | boolean>) => void;
        };
      };
    };
  }
}

export function LoginPage({ recovery = false }: { recovery?: boolean }) {
  const { login, loginWithGoogle, startSignup, verifyLoginOtp, verifySignup } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const from = (location.state as { from?: string } | null)?.from;
  const registerFlow = Boolean(from?.includes("/register"));
  const [email, setEmail] = useState(registerFlow ? "user@smartsportz.in" : "admin@smartsportz.in");
  const [password, setPassword] = useState(registerFlow ? "user123" : "admin123");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("+916374409006");
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (recovery || challenge || !googleClientId || !googleButtonRef.current) return;
    const scriptId = "google-identity-script";
    function renderGoogleButton() {
      if (!window.google?.accounts?.id || !googleButtonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response) => {
          if (!response.credential) {
            setError("Google did not return a login credential.");
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
        },
      });
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
  }, [challenge, from, googleClientId, loginWithGoogle, navigate, recovery]);

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
                ? "Enter the OTP shown below. Admin and manager login uses local on-screen verification in this build."
                : `Enter the OTP sent by ${challenge.channel.toUpperCase()} to ${challenge.target}.`
              : recovery
                ? "Enter your email and we will send an OTP for password recovery."
                : mode === "signup"
                  ? "Create a participant account and verify it by email or SMS before opening your dashboard."
                  : "Please enter your credentials to access your dashboard."}
          </p>
          {!challenge && mode === "signup" && <label>Full name<input placeholder="Team captain name" value={name} onChange={(event) => setName(event.target.value)} /></label>}
          {!challenge && <label>Email address<input placeholder="coach@smartsportz.in" value={email} onChange={(event) => setEmail(event.target.value)} /></label>}
          {!challenge && mode === "signup" && <label>Phone number<input placeholder="+916374409006" value={phone} onChange={(event) => setPhone(event.target.value)} /></label>}
          {!challenge && !recovery && <label>Password<input placeholder="********" type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>}
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
          {!challenge && mode === "signup" && (
            <div className="otp-channel-group" role="radiogroup" aria-label="Verification method">
              <button type="button" className={channel === "email" ? "active" : ""} onClick={() => setChannel("email")}>Verify by Email</button>
              <button type="button" className={channel === "sms" ? "active" : ""} onClick={() => setChannel("sms")}>Verify by SMS</button>
            </div>
          )}
          {challenge && <label>OTP code<input placeholder="4 digit code" value={otp} onChange={(event) => setOtp(event.target.value)} maxLength={8} /></label>}
          {challenge && recovery && <label>New password<input placeholder="New secure password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>}
          {challenge?.deliveryMessage?.startsWith("Local OTP:") && !recovery && <div className="otp-local-box">{challenge.deliveryMessage}</div>}
          {error && <div className="form-alert">{error}</div>}
          <button type="submit" className="btn btn-primary wide" disabled={loading}>
            {loading ? "Please wait..." : challenge ? "Verify OTP" : recovery ? "Send OTP" : mode === "signup" ? "Create and verify account" : "Sign in"}
          </button>
          {!recovery && !challenge && mode === "login" && (
            <div className="login-help">
              <button type="button" onClick={() => { setEmail("admin@smartsportz.in"); setPassword("admin123"); }}>Super Admin</button>
              <button type="button" onClick={() => { setEmail("manager@smartsportz.in"); setPassword("manager123"); }}>Management</button>
              <button type="button" onClick={() => { setEmail("user@smartsportz.in"); setPassword("user123"); }}>Participant</button>
            </div>
          )}
          {!recovery && !challenge && (
            <button className="auth-switch" type="button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}>
              {mode === "login" ? "I do not have an account already" : "I already have an account"}
            </button>
          )}
          {challenge && <button className="auth-switch" type="button" onClick={() => { setChallenge(null); setOtp(""); }}>Change details</button>}
          <Link to={recovery ? "/login" : "/forgot-password"}>{recovery ? "Back to login" : "Forgot password?"}</Link>
        </form>
      </div>
    </Page>
  );
}
