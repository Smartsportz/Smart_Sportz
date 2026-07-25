import { Lock } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Page } from "../components/UI";
import { assets } from "../data/platform";

export function LoginPage({ recovery = false }: { recovery?: boolean }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const registerFlow = Boolean(from?.includes("/register"));
  const [email, setEmail] = useState(registerFlow ? "user@smartsportz.in" : "admin@smartsportz.in");
  const [password, setPassword] = useState(registerFlow ? "user123" : "admin123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (recovery) {
      setError("OTP and password recovery are planned, but not connected in the local backend yet.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const user = await login(email, password);
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
          <h1>{recovery ? "Forgot Password?" : "Welcome Back"}</h1>
          <p>{recovery ? "Enter your email and we will send an OTP for password recovery." : "Please enter your credentials to access your dashboard."}</p>
          <label>Email address<input placeholder="coach@smartsportz.in" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          {!recovery && <label>Password<input placeholder="********" type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>}
          {error && <div className="form-alert">{error}</div>}
          <button type="submit" className="btn btn-primary wide" disabled={loading}>{loading ? "Signing in..." : recovery ? "Send OTP" : "Sign in"}</button>
          {!recovery && (
            <div className="login-help">
              <button type="button" onClick={() => { setEmail("admin@smartsportz.in"); setPassword("admin123"); }}>Super Admin</button>
              <button type="button" onClick={() => { setEmail("manager@smartsportz.in"); setPassword("manager123"); }}>Management</button>
              <button type="button" onClick={() => { setEmail("user@smartsportz.in"); setPassword("user123"); }}>Participant</button>
            </div>
          )}
          <Link to={recovery ? "/login" : "/forgot-password"}>{recovery ? "Back to login" : "Forgot password?"}</Link>
        </form>
      </div>
    </Page>
  );
}
