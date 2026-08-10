import { ShieldCheck, Sun } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { Page } from "../components/UI";
import { apiRequest } from "../lib/api";
import { PageHero } from "./shared";

export function SettingsPage() {
  const { token, user } = useAuth();
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
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not change password.");
    }
  }

  return (
    <Page>
      <PageHero title="Profile Settings" text="Smart Sportz uses the normal light theme on every device." />
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
