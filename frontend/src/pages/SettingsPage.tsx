import { Moon, Settings, ShieldCheck, Sun } from "lucide-react";
import { Page } from "../components/UI";
import { PageHero } from "./shared";

type ThemePreference = "system" | "light" | "dark";

export function SettingsPage({
  darkMode,
  themePreference,
  setThemePreference,
}: {
  darkMode: boolean;
  themePreference: ThemePreference;
  setThemePreference: (value: ThemePreference) => void;
}) {
  return (
    <Page>
      <PageHero title="Profile Settings" text="Smart Sportz follows your device theme by default. You can override appearance here anytime." />
      <div className="panel settings-panel">
        <ShieldCheck size={28} />
        <h2>Appearance</h2>
        <p>Default mode: use device setting automatically. Current active theme: <b>{darkMode ? "Dark" : "Light"}</b>.</p>
        <div className="theme-choice-grid" role="group" aria-label="Theme preference">
          <button className={themePreference === "system" ? "active" : ""} type="button" onClick={() => setThemePreference("system")}>
            <Settings size={18} />
            <span>Device mode</span>
            <small>Automatically follows system light or dark mode.</small>
          </button>
          <button className={themePreference === "light" ? "active" : ""} type="button" onClick={() => setThemePreference("light")}>
            <Sun size={18} />
            <span>Light</span>
            <small>Always use the clean white Smart Sportz theme.</small>
          </button>
          <button className={themePreference === "dark" ? "active" : ""} type="button" onClick={() => setThemePreference("dark")}>
            <Moon size={18} />
            <span>Dark</span>
            <small>Always use the high-focus dark operation theme.</small>
          </button>
        </div>
      </div>
    </Page>
  );
}
