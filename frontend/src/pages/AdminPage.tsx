import { FileText } from "lucide-react";
import { DataTable, Page, PortalShell } from "../components/UI";
import { cmsSections, logRows, paymentRows, reports, sidebar, teams, tournaments } from "../data/platform";
import { AdminOverview, AthleteProfile, CatalogPage, DashboardGrid, ListPanel, TeamCard } from "./shared";

export function AdminPage({ section = "dashboard" }: { section?: string }) {
  const title = section === "dashboard" ? "Executive Dashboard" : section.replace("-", " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <Page>
      <PortalShell title={title} subtitle="Platform-wide control for Smart Sportz operations." sidebar={sidebar} action={<span className="status emerald">System optimal</span>}>
        {section === "dashboard" && <><DashboardGrid /><AdminOverview /></>}
        {section === "tournaments" && (
          <>
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
              columns={["Tournament", "Status", "Teams", "Team Size", "Cities", "Registration Window", "Prize"]}
              rows={tournaments.map((t) => [t.name, <span className={`status ${t.accent}`}>{t.status}</span>, `${t.teams}/${t.capacity}`, `${t.teamSize} members`, t.cities.join(", "), `${t.registrationStart} - ${t.registrationEnd}`, t.prize])}
            />
          </>
        )}
        {section === "users" && (
          <DataTable
            columns={["User", "Role", "Access", "Status"]}
            rows={[
              ["Smart Sportz Admin", <span className="status blue">Super Admin</span>, "All platform programs", "Active"],
              ["Tournament Manager", <span className="status emerald">Management</span>, "Assigned tournaments", "Active"],
              ["Aryan Player", <span className="status orange">Participant</span>, "Own records only", "Active"],
            ]}
          />
        )}
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
