import { ShieldCheck, Sun } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Page, PortalShell } from "../components/UI";
import { managementSidebar, sidebar, userSidebar } from "../data/platform";
import { apiRequest } from "../lib/api";
import { showToast } from "../lib/toast";

export function SettingsPage() {
  const { token, user } = useAuth();
  const location = useLocation();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changeOpen, setChangeOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function openChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    if (!currentPassword) {
      setError("Enter your current password first.");
      showToast("warning", "Current Password Required", "Enter your current password first.");
      return;
    }
    setChangeOpen(true);
  }

  async function submitChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    if (newPassword !== confirmPassword) {
      setError("New password and confirm password must match.");
      showToast("warning", "Password Mismatch", "New password and confirm password must match.");
      return;
    }
    try {
      await apiRequest("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      }, token);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setChangeOpen(false);
      setMessage("Password changed successfully.");
      showToast("success", "Password Changed", "Your password was updated successfully.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not change password.");
    }
  }

  const portalSidebar = location.pathname.startsWith("/admin")
    ? sidebar
    : location.pathname.startsWith("/management")
      ? managementSidebar
      : userSidebar;
  const dashboardPath = user?.role === "super_admin"
    ? "/admin/dashboard"
    : user?.role === "management"
      ? "/management/dashboard"
      : "/user/dashboard";

  return (
    <Page>
      <PortalShell title="Profile Settings" subtitle="Account security and Smart Sportz appearance controls." sidebar={portalSidebar} action={<Link className="btn btn-primary" to={dashboardPath}>Dashboard</Link>}>
        {message && <div className="form-alert success-alert">{message}</div>}
        {error && <div className="form-alert">{error}</div>}
        <form className="panel settings-panel" onSubmit={openChangePassword}>
          <ShieldCheck size={28} />
          <h2>Change Password</h2>
          <p>{user?.email ? `Signed in as ${user.email}.` : "Update your account password."}</p>
          <label>Current password<input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
          <button className="btn btn-primary" type="submit">Continue</button>
        </form>
        <div className="panel settings-panel">
          <ShieldCheck size={28} />
          <h2>Appearance</h2>
          <p>Theme is fixed to the clean Smart Sportz light mode, even when the device is using dark mode.</p>
          <div className="theme-choice-grid light-only-theme" role="group" aria-label="Theme mode">
            <button className="active" type="button">
              <Sun size={18} />
              <span>Light mode</span>
              <small>Default and only active appearance for the platform.</small>
            </button>
          </div>
        </div>
      </PortalShell>
      {changeOpen && (
        <div className="modal-backdrop">
          <section className="confirm-modal panel">
            <form className="settings-password-modal" onSubmit={submitChangePassword}>
              <h2>New password</h2>
              <label>New password<input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
              <label>Confirm password<input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
              <div className="registration-actions compact-actions">
                <button className="btn btn-primary" type="submit">Change Password</button>
                <button className="btn btn-secondary" type="button" onClick={() => setChangeOpen(false)}>Cancel</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </Page>
  );
}
