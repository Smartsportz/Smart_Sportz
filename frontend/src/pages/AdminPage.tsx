import { Bell, CheckCircle2, ImagePlus, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { DataTable, Page, PortalShell } from "../components/UI";
import { cmsSections, logRows, managerUsers, paymentRows, reports, sidebar, teams, tournaments } from "../data/platform";
import type { TournamentNotice } from "../data/platform";
import { apiRequest } from "../lib/api";
import { AdminOverview, AthleteProfile, CatalogPage, DashboardGrid, ListPanel, TeamCard } from "./shared";

const noticeStorageKey = "smart-sportz-tournament-notices";

export function NoticeBuilder({ role = "admin" }: { role?: "admin" | "manager" }) {
  const [selectedSlug, setSelectedSlug] = useState(tournaments[0]?.slug ?? "");
  const selected = tournaments.find((item) => item.slug === selectedSlug) ?? tournaments[0];
  const [title, setTitle] = useState(selected ? `${selected.name} notice` : "");
  const [image, setImage] = useState(selected?.image ?? "");
  const [description, setDescription] = useState("");
  const [saved, setSaved] = useState("");

  function chooseTournament(slug: string) {
    const next = tournaments.find((item) => item.slug === slug) ?? tournaments[0];
    setSelectedSlug(next.slug);
    setTitle(`${next.name} notice`);
    setImage(next.image);
    setSaved("");
  }

  function saveNotice() {
    const notice: TournamentNotice = {
      id: `notice_${selectedSlug}_${Date.now()}`,
      tournamentSlug: selectedSlug,
      title: title.trim() || `${selected.name} notice`,
      description: description.trim() || "Tournament notice published by SmartSportz operations.",
      image: image.trim() || selected.image,
      published: true,
      updatedBy: role,
    };
    let current: TournamentNotice[] = [];
    try {
      current = JSON.parse(localStorage.getItem(noticeStorageKey) || "[]") as TournamentNotice[];
    } catch {
      current = [];
    }
    localStorage.setItem(noticeStorageKey, JSON.stringify([notice, ...current.filter((item) => item.tournamentSlug !== selectedSlug)]));
    sessionStorage.removeItem(`smart-sportz-notice-dismissed:${notice.id}`);
    setSaved(`Notice published for ${selected.name}. It will appear on the home page when the website opens fresh.`);
  }

  return (
    <section className="panel tournament-notice-builder">
      <div>
        <span className="status emerald"><Bell size={14} />Add Notice</span>
        <h2>Tournament website notice</h2>
        <p>Create a tournament-specific popup for the home page. It does not display across every site page.</p>
      </div>
      {saved && <div className="form-alert success-alert">{saved}</div>}
      <div className="form-grid">
        <label>Tournament<select value={selectedSlug} onChange={(event) => chooseTournament(event.target.value)}>{tournaments.map((tournament) => <option value={tournament.slug} key={tournament.slug}>{tournament.name}</option>)}</select></label>
        <label>Notice title<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Registration notice title" /></label>
        <label>Image URL or asset path<input value={image} onChange={(event) => setImage(event.target.value)} placeholder="/assets/cricket-stadium.png" /></label>
        <label>Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Write the notice shown to website visitors." /></label>
      </div>
      <div className="registration-actions compact-actions">
        <button className="btn btn-secondary" type="button" onClick={() => setImage(selected.image)}><ImagePlus size={16} />Use tournament image</button>
        <button className="btn btn-primary" type="button" onClick={saveNotice}><CheckCircle2 size={16} />Publish notice</button>
      </div>
    </section>
  );
}

type ManagerRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  cities: string[];
  created_at?: string;
};

function ManagerManagementPanel() {
  const { token } = useAuth();
  const [managers, setManagers] = useState<ManagerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "manager123",
    cities: "",
  });

  async function loadManagers() {
    setLoading(true);
    setError("");
    try {
      const rows = await apiRequest<ManagerRow[]>("/admin/managers", {}, token);
      setManagers(rows);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load manager records.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadManagers();
  }, [token]);

  async function createManager(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    const cities = form.cities.split(",").map((city) => city.trim()).filter(Boolean);
    if (!form.name.trim() || !form.email.trim() || !form.password.trim() || cities.length === 0) {
      setError("Please fill manager name, email, password, and at least one city.");
      return;
    }
    try {
      const created = await apiRequest<ManagerRow>("/admin/managers", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          cities,
        }),
      }, token);
      setManagers((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      setForm({ name: "", email: "", password: "manager123", cities: "" });
      setMessage(`${created.name} created with ${created.cities.length} city assignment${created.cities.length === 1 ? "" : "s"}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create manager.");
    }
  }

  const tableRows = managers.length
    ? managers.map((manager) => [
        manager.name,
        manager.email,
        manager.cities.join(", ") || "No city assigned",
        manager.created_at ? new Date(manager.created_at).toLocaleDateString() : "Created",
      ])
    : managerUsers.map((manager) => [manager.name, manager.email, manager.cities.join(", "), manager.status]);

  return (
    <div className="admin-manager-grid">
      <section className="panel tournament-create-panel">
        <div>
          <span className="status emerald">Manager Management</span>
          <h2>Create city-scoped managers</h2>
          <p>Managers can access only the cities allocated here. Admin keeps full platform access.</p>
        </div>
        {message && <div className="form-alert success-alert">{message}</div>}
        {error && <div className="form-alert">{error}</div>}
        <form className="form-grid" onSubmit={createManager}>
          <label>Manager name<input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="North Zone Manager" /></label>
          <label>Email<input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="north.manager@smartsportz.in" /></label>
          <label>Temporary password<input value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} placeholder="manager123" /></label>
          <label>Allocated cities<input value={form.cities} onChange={(event) => setForm((current) => ({ ...current, cities: event.target.value }))} placeholder="Delhi, Noida, Gurugram" /></label>
          <button className="btn btn-primary" type="submit">Create manager</button>
          <button className="btn btn-secondary" type="button" onClick={loadManagers}>Refresh from DB</button>
        </form>
      </section>
      <DataTable
        columns={["Manager", "Email", "Allocated Cities", "Created"]}
        rows={loading ? [["Loading managers...", "", "", ""]] : tableRows}
      />
    </div>
  );
}

export function AdminPage({ section = "dashboard" }: { section?: string }) {
  const title = section === "dashboard" ? "Executive Dashboard" : section.replace("-", " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <Page>
      <PortalShell title={title} subtitle="Platform-wide control for Smart Sportz operations." sidebar={sidebar} action={<span className="status emerald">System optimal</span>}>
        {section === "dashboard" && <><DashboardGrid /><AdminOverview /></>}
        {section === "tournaments" && (
          <>
            <NoticeBuilder role="admin" />
            <section className="panel tournament-create-panel">
              <div>
                <span className="status emerald">Create Tournament</span>
                <h2>Tournament roster settings</h2>
                <p>Set the team member count once. Registration will ask exactly this many names, including captain and sub-captain.</p>
              </div>
              <div className="form-grid">
                <label>Tournament name<input placeholder="City Premier Cup" /></label>
                <label>Sport<select><option>Cricket</option><option>Football</option><option>Basketball</option><option>Volleyball</option></select></label>
                <label>Team capacity<input type="number" min="2" placeholder="32" /></label>
                <label>Members per team<input type="number" min="2" placeholder="16" /></label>
                <label>Registration status<select><option>Upcoming</option><option>Registration Open</option><option>Live</option><option>Completed</option></select></label>
                <label>Registration window<input placeholder="Jul 24, 2026 - Aug 10, 2026" /></label>
                <label>Allowed cities<input placeholder="Mumbai, Navi Mumbai, Thane" /></label>
              </div>
            </section>
            <DataTable
              columns={["Tournament", "Status", "Teams", "Team Size", "Cities", "Registration Window", "Prize", "Notice"]}
              rows={tournaments.map((t) => [t.name, <span className={`status ${t.accent}`}>{t.status}</span>, `${t.teams}/${t.capacity}`, `${t.teamSize} members`, t.cities.join(", "), `${t.registrationStart} - ${t.registrationEnd}`, t.prize, <span className="status emerald">Add notice</span>])}
            />
          </>
        )}
        {section === "users" && (
          <>
            <section className="panel tournament-create-panel">
              <div>
                <span className="status emerald">Manager Allocation</span>
                <h2>Create city-scoped managers</h2>
                <p>Super admins can add multiple managers and allocate one or more cities. Managers see only those city records.</p>
              </div>
              <div className="form-grid">
                <label>Manager name<input placeholder="North Zone Manager" /></label>
                <label>Email<input placeholder="manager@smartsportz.in" /></label>
                <label>Temporary password<input placeholder="manager123" /></label>
                <label>Allocated cities<input placeholder="Delhi, Noida, Gurugram" /></label>
              </div>
            </section>
            <DataTable
              columns={["User", "Role", "Allocated Places", "Status"]}
              rows={[
                ["Smart Sportz Admin", <span className="status blue">Super Admin</span>, "All platform programs", "Active"],
                ...managerUsers.map((manager) => [manager.name, <span className="status emerald">Management</span>, manager.cities.join(", "), manager.status]),
                ["Aryan Player", <span className="status orange">Participant</span>, "Own records only", "Active"],
              ]}
            />
          </>
        )}
        {section === "managers" && <ManagerManagementPanel />}
        {section === "roles" && (
          <DataTable
            columns={["Role", "Programs", "Core Permissions", "Security Rule"]}
            rows={[
              ["Super Admin", "8", "Users, roles, payments, CMS, reports, logs", "Full platform audit"],
              ["Management User", "7", "Assigned tournament operations", "Tournament scoped"],
              ["Team / Participant", "7", "Own registration, payments, documents", "Own data only"],
            ]}
          />
        )}
        {section === "teams" && <div className="team-grid">{teams.map((team) => <TeamCard key={team.name} team={team} />)}</div>}
        {section === "players" && <AthleteProfile />}
        {section === "payments" && <ListPanel title="Payment Operations" items={paymentRows} to="/admin/payments/operations" />}
        {section === "cms" && <CatalogPage embedded title="CMS Builder" items={cmsSections.map((title) => ({ title, text: "Editable CMS section", icon: FileText, path: `/admin/cms/${title.toLowerCase().replace(/\s+/g, "-")}` }))} />}
        {section === "reports" && <ListPanel title="Reports Center" items={reports} to="/admin/reports/detail" />}
        {section === "logs" && <ListPanel title="Audit and Event Logs" items={logRows} to="/admin/logs/detail" />}
        {section === "settings" && <ListPanel title="System Settings" items={["RBAC policy", "Password policy", "Local storage", "Audit retention"]} to="/settings" />}
      </PortalShell>
    </Page>
  );
}
