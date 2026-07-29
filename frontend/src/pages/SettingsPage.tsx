import { ShieldCheck, Sun } from "lucide-react";
import { Page } from "../components/UI";
import { PageHero } from "./shared";

export function SettingsPage() {
  return (
    <Page>
      <PageHero title="Profile Settings" text="Smart Sportz uses the normal light theme on every device." />
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
    </Page>
  );
}
