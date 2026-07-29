import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import type React from "react";
import { DataTable, Page, PortalShell } from "../components/UI";
import { managementSidebar, newsPosts, sportHomeVisibility, sports, tournaments, userSidebar, withRuntimeTournamentStatus } from "../data/platform";
import { DashboardGrid, InfoPanel, MatchControlTable } from "./shared";
import { RichTextToolbarPreview } from "./NewsPages";
import { apiRequest } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import type { UserDashboardData } from "./UserDashboardPage";

const userContent = {
  profile: ["Identity verification", "Captain and player details", "Emergency contact", "Document upload"],
  registrations: ["Approved tournaments", "Pending review", "Payment required", "Waitlisted entries"],
  payments: ["Receipts", "Invoices", "Refunds", "Webhook status"],
  certificates: ["Participation certificates", "Winner certificates", "MVP awards", "Download history"],
  schedules: ["Upcoming fixtures", "Venue reporting time", "Match reminders", "Calendar export"],
  documents: ["Identity documents", "Team roster files", "Medical forms", "Private downloads"],
  settings: ["Theme preference", "Notification channels", "Password policy", "Session devices"],
};

const managementContent = {
  tournaments: ["Assigned tournament setup", "Fixture builder", "Venue allocation", "Official assignments"],
  registrations: ["Team approval queue", "Document review", "Payment checks", "Roster validation"],
  matches: ["Live score control", "Timeline events", "Score correction", "Match closure"],
  players: ["Roster management", "Eligibility status", "Player documents", "Captain updates"],
  announcements: ["Tournament notices", "Team broadcast", "Schedule change alert", "Delivery status"],
  news: ["Create winner-team news", "Upload match update image", "Format article sections", "Publish city-scoped updates"],
  reports: ["Revenue reports", "Registration funnel", "Live score audit", "Export center"],
};

type ManagerDashboardData = {
  assignedCities: string[];
  assignedTournaments: Array<Record<string, any>>;
  pendingRegistrations: Array<Record<string, any>>;
  liveMatches: Array<Record<string, any>>;
};

type ManagerNewsData = {
  assignedCities: string[];
  posts: Array<Record<string, any>>;
  sports: Array<Record<string, any>>;
};

export function UserSectionPage({ section }: { section: keyof typeof userContent }) {
  const { token } = useAuth();
  const title = section.replace("-", " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const [data, setData] = useState<UserDashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setError("");
    apiRequest<UserDashboardData>("/user/dashboard", {}, token)
      .then((payload) => {
        if (alive) setData(payload);
      })
      .catch((caught) => {
        if (alive) setError(caught instanceof Error ? caught.message : "Could not load user data.");
      });
    return () => {
      alive = false;
    };
  }, [token]);

  const registrations = data?.registrations ?? [];
  const payments = data?.payments ?? [];
  const documents = data?.documents ?? [];
  const certificateRows = registrations.filter((item) => item.status === "approved" || item.status === "accepted");
  const rowsBySection: Record<keyof typeof userContent, Array<Array<React.ReactNode>>> = {
    profile: [[data?.profile.name ?? "Participant", data?.profile.email ?? "No email", data?.profile.role ?? "user"]],
    registrations: registrations.map((item) => [
      item.tournament_name,
      item.team_name,
      item.city,
      <span className={`status ${item.payment_status === "paid" ? "emerald" : "orange"}`}>{item.payment_status}</span>,
      <Link className="inline-link" to={`/tournaments/${item.tournament_slug}/registration-pass`}>View</Link>,
    ]),
    payments: payments.map((item) => [
      item.receipt_number,
      new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(item.amount / 100),
      item.method,
      <span className="status emerald">{item.status}</span>,
      <Link className="inline-link" to={`/payments/${item.id}/receipt`}>Receipt</Link>,
    ]),
    certificates: certificateRows.map((item) => [
      item.tournament_name,
      item.team_name,
      item.city,
      <span className="status emerald">Eligible</span>,
      "Available after organizer publish",
    ]),
    schedules: registrations.map((item) => [item.tournament_name, item.sport, item.date, item.city]),
    documents: documents.map((item) => [
      item.document_type,
      item.file_name,
      <span className={`status ${item.status === "uploaded" ? "emerald" : "orange"}`}>{item.status}</span>,
    ]),
    settings: [[data?.profile.email ?? "No email", "Theme and session settings", <Link className="inline-link" to="/user/settings">Open settings</Link>]],
  };
  const columnsBySection: Record<keyof typeof userContent, string[]> = {
    profile: ["Name", "Email", "Role"],
    registrations: ["Tournament", "Team", "City", "Payment", "Action"],
    payments: ["Receipt", "Amount", "Method", "Status", "Action"],
    certificates: ["Tournament", "Team", "City", "Status", "Note"],
    schedules: ["Tournament", "Sport", "Schedule", "City"],
    documents: ["Document", "File", "Status"],
    settings: ["Account", "Preference", "Action"],
  };
  const sectionRows = rowsBySection[section];

  return (
    <Page>
      <PortalShell title={title} subtitle="Participant portal detail page connected from the user dashboard and sidebar." sidebar={userSidebar} action={<Link className="btn btn-primary" to="/user/dashboard">Dashboard</Link>}>
        {error && <div className="form-alert">{error}</div>}
        {!data ? (
          <section className="panel user-empty-state"><h2>Loading {title}</h2><p>Fetching your records from the database.</p></section>
        ) : sectionRows.length === 0 ? (
          <section className="panel user-empty-state"><h2>No {title.toLowerCase()} records</h2><p>This page will populate after your tournament registration data is saved in the database.</p><Link className="btn btn-primary" to="/tournaments">Open tournaments</Link></section>
        ) : (
          <DataTable columns={columnsBySection[section]} rows={sectionRows} />
        )}
      </PortalShell>
    </Page>
  );
}

export function ManagementSectionPage({ section }: { section: keyof typeof managementContent }) {
  const title = section.replace("-", " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const { token } = useAuth();
  const [managerDashboard, setManagerDashboard] = useState<ManagerDashboardData | null>(null);
  const [managerNews, setManagerNews] = useState<ManagerNewsData | null>(null);
  const [sectionRecords, setSectionRecords] = useState<Array<Record<string, any>>>([]);
  const [managerError, setManagerError] = useState("");
  const [managerLoading, setManagerLoading] = useState(true);
  const activeTournamentOptions = tournaments.filter((item) => item.status !== "Completed");
  const [windowTournamentSlug, setWindowTournamentSlug] = useState(activeTournamentOptions[0]?.slug ?? "");
  const selectedWindowTournament = activeTournamentOptions.find((item) => item.slug === windowTournamentSlug) ?? activeTournamentOptions[0];
  const [registrationEnd, setRegistrationEnd] = useState(selectedWindowTournament?.registrationEnd ?? "");
  const [windowMessage, setWindowMessage] = useState("");
  const [managerMessage, setManagerMessage] = useState("");

  useEffect(() => {
    setRegistrationEnd(selectedWindowTournament?.registrationEnd ?? "");
  }, [selectedWindowTournament?.slug]);

  useEffect(() => {
    let alive = true;
    setManagerLoading(true);
    setManagerError("");

    const load = async () => {
      const dashboard = await apiRequest<ManagerDashboardData>("/management/dashboard", {}, token);
      if (!alive) return;
      setManagerDashboard(dashboard);

      if (section === "news") {
        const news = await apiRequest<ManagerNewsData>("/management/news", {}, token);
        if (alive) setManagerNews(news);
        return;
      }

      if (["tournaments", "matches", "players", "reports"].includes(section)) {
        const records = await apiRequest<Array<Record<string, any>>>(`/management/${section}`, {}, token);
        if (alive) setSectionRecords(records);
      }
    };

    load()
      .catch((caught) => {
        if (alive) setManagerError(caught instanceof Error ? caught.message : "Could not load management records.");
      })
      .finally(() => {
        if (alive) setManagerLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [section, token]);

  async function updateRegistrationStatus(id: string, action: "approve" | "reject") {
    setManagerMessage("");
    try {
      await apiRequest(`/management/registrations/${id}/${action}`, { method: "POST" }, token);
      const dashboard = await apiRequest<ManagerDashboardData>("/management/dashboard", {}, token);
      setManagerDashboard(dashboard);
      setManagerMessage(`Registration ${action === "approve" ? "accepted" : "rejected"} successfully.`);
    } catch (error) {
      setManagerMessage(error instanceof Error ? error.message : "Unable to update registration.");
    }
  }

  async function extendRegistrationWindow() {
    if (!selectedWindowTournament) return;
    setWindowMessage("");
    try {
      const updated = await apiRequest<any>(`/management/tournaments/${selectedWindowTournament.slug}/registration-window`, {
        method: "PATCH",
        body: JSON.stringify({
          status: selectedWindowTournament.status,
          registration_start: selectedWindowTournament.registrationStart,
          registration_end: registrationEnd,
        }),
      }, token);
      setWindowMessage(`Updated ${updated.name ?? selectedWindowTournament.name}: registration closes ${updated.registration_end ?? registrationEnd}.`);
    } catch (error) {
      setWindowMessage(error instanceof Error ? error.message : "Unable to update registration window.");
    }
  }
  const pendingRegistrations = managerDashboard?.pendingRegistrations ?? [];
  const assignedTournaments = sectionRecords.length ? sectionRecords : (managerDashboard?.assignedTournaments ?? []);
  const assignedCities = managerDashboard?.assignedCities ?? [];
  const liveMatches = section === "matches" ? sectionRecords : (managerDashboard?.liveMatches ?? []);
  const newsRows = managerNews?.posts ?? [];
  const newsSports = managerNews?.sports ?? sportHomeVisibility.map((item) => {
    const sport = sports.find((entry) => entry.slug === item.sportSlug);
    return { slug: item.sportSlug, name: sport?.name, show_on_home: item.showOnHome, sort_order: item.sortOrder };
  });

  const primaryContent = managerLoading ? (
    <section className="panel user-empty-state"><h2>Loading {title}</h2><p>Fetching manager records from the backend database.</p></section>
  ) : section === "matches" ? (
    liveMatches.length === 0 ? (
      <section className="panel user-empty-state"><h2>No live matches</h2><p>Assigned live match records will appear here after fixtures are started.</p></section>
    ) : (
      <DataTable
        columns={["Match", "Tournament", "Teams", "Score", "Status", "Action"]}
        rows={liveMatches.map((item) => [
          item.id,
          item.tournament_slug ?? item.tournament ?? "Assigned tournament",
          `${item.team_a ?? item.home_team ?? item.home ?? "Team A"} vs ${item.team_b ?? item.away_team ?? item.away ?? "Team B"}`,
          item.away_score ? `${item.score ?? "0"} - ${item.away_score}` : item.score ?? item.current_score ?? "Not started",
          <span className="status emerald">{item.status ?? "Live"}</span>,
          <Link to={`/management/matches/${item.id}/control`}>Control</Link>,
        ])}
      />
    )
  ) : section === "registrations" ? (
    pendingRegistrations.length === 0 ? (
      <section className="panel user-empty-state"><h2>No pending registrations</h2><p>Registration approvals are filtered by your assigned cities and will appear here from the database.</p></section>
    ) : (
      <DataTable
        columns={["Team", "Captain", "City", "Payment", "Status", "Action"]}
        rows={pendingRegistrations.map((item) => [
          item.team_name,
          item.captain_name,
          item.city,
          item.payment_status,
          <span className="status orange">{item.status}</span>,
          <span className="table-actions">
            <button type="button" onClick={() => updateRegistrationStatus(item.id, "approve")}>Accept</button>
            <button type="button" onClick={() => updateRegistrationStatus(item.id, "reject")}>Reject</button>
            <Link to={`/management/tournaments/${item.tournament_slug}/bracket`}>Allocate</Link>
          </span>,
        ])}
      />
    )
  ) : section === "tournaments" ? (
    assignedTournaments.length === 0 ? (
      <section className="panel user-empty-state"><h2>No assigned tournaments</h2><p>Super admin must assign this manager to a city before tournaments appear.</p></section>
    ) : (
      <DataTable
        columns={["Tournament", "Status", "City", "Registration Window", "Team Size", "Action"]}
        rows={assignedTournaments.map((entry) => {
          const local = tournaments.find((item) => item.slug === entry.slug);
          const item = (local ? withRuntimeTournamentStatus(local) : entry) as Record<string, any>;
          return [
          item.name,
          <span className={`status ${item.accent ?? "emerald"}`}>{item.status}</span>,
          item.location ?? item.city ?? item.cities?.join(", ") ?? "Assigned city",
          `${item.registration_start ?? item.registrationStart ?? "-"} - ${item.registration_end ?? item.registrationEnd ?? "-"}`,
          `${item.team_size ?? item.teamSize ?? "-"} members`,
          <span className="table-actions"><Link to={`/tournaments/${item.slug}`}>Open</Link><Link to={`/management/tournaments/${item.slug}/bracket`}>Bracket</Link></span>,
          ];
        })}
      />
    )
  ) : section === "news" ? (
    <div className="manager-news-layout">
      <section className="panel news-editor-panel">
        <span className="status emerald">Manager News Editor</span>
        <h2>Create or edit news</h2>
        <p>Managers publish only for assigned cities. Rich sections are stored as structured blocks.</p>
        <RichTextToolbarPreview />
        <div className="form-grid">
          <label>Image<select>{(newsRows.length ? newsRows : newsPosts).map((post) => <option key={post.slug}>{post.image}</option>)}</select></label>
          <label>Category<select><option>Winner Teams</option><option>Match Updates</option><option>Tournament Updates</option><option>Announcements</option></select></label>
          <label>Title<input placeholder="Winner team headline" /></label>
          <label>City<select>{(assignedCities.length ? assignedCities : ["Bengaluru", "Mysuru", "Mumbai"]).map((city) => <option key={city}>{city}</option>)}</select></label>
          <label>Sport<select>{sports.map((sport) => <option key={sport.slug}>{sport.name}</option>)}</select></label>
          <label>Tournament<select>{assignedTournaments.map((item) => <option key={item.slug}>{item.name}</option>)}</select></label>
        </div>
        <label>Short description<textarea placeholder="Summary shown on news cards" /></label>
        <label>Article section<textarea placeholder="Add heading, paragraph, quote, list, or image block content" /></label>
        <div className="hero-actions"><button className="btn btn-primary">Save Draft</button><button className="btn btn-secondary">Publish</button></div>
      </section>
      <section className="panel">
        <h2>Homepage sport containers</h2>
        <p>Managers choose which sport cards display in the Explore Your Sport section.</p>
        <div className="visibility-list">
          {newsSports.map((record) => {
            const item = record as Record<string, any>;
            const sport = sports.find((entry) => entry.slug === (item.sportSlug ?? item.slug));
            return (
              <label className="visibility-row" key={item.sportSlug ?? item.slug}>
                <span>{sport?.name ?? item.name}</span>
                <input type="checkbox" defaultChecked={Boolean(item.showOnHome ?? item.show_on_home)} />
              </label>
            );
          })}
        </div>
      </section>
      <DataTable
        columns={["News", "Category", "City", "Status", "Action"]}
        rows={(newsRows.length ? newsRows : newsPosts).map((post) => [
          post.title,
          post.category,
          post.city,
          <span className="status emerald">{post.status}</span>,
          <span className="table-actions"><Link to={`/news/${post.slug}`}>Open</Link><button>Edit</button></span>,
        ])}
      />
    </div>
  ) : section === "players" ? (
    sectionRecords.length === 0 ? (
      <section className="panel user-empty-state"><h2>No players found</h2><p>Players appear after team registrations are accepted in assigned cities.</p></section>
    ) : (
      <DataTable columns={["Player", "Team", "Status"]} rows={sectionRecords.map((item) => [item.name, item.team, <span className="status emerald">{item.status}</span>])} />
    )
  ) : section === "reports" ? (
    sectionRecords.length === 0 ? (
      <section className="panel user-empty-state"><h2>No reports available</h2><p>Reports will appear after registrations, payments, and live scoring generate records.</p></section>
    ) : (
      <DataTable columns={["Report", "Status"]} rows={sectionRecords.map((item) => [item.name, <span className="status blue">{item.status}</span>])} />
    )
  ) : <DashboardGrid />;

  return (
    <Page>
      <PortalShell title={title} subtitle="Management portal section for tournament-specific operations." sidebar={managementSidebar} action={<Link className="btn btn-primary" to="/management/dashboard">Dashboard</Link>}>
        {managerError && <div className="form-alert">{managerError}</div>}
        {managerMessage && <p className="form-note">{managerMessage}</p>}
        {section === "tournaments" && (
          <section className="panel tournament-create-panel">
            <div>
              <span className="status emerald">Tournament City Setup</span>
              <h2>Allowed registration cities</h2>
              <p>Set one or more cities per assigned tournament. Registration city dropdowns use only the selected tournament city list.</p>
            </div>
            <div className="form-grid">
              <label>Tournament<select>{activeTournamentOptions.map((item) => <option key={item.slug}>{item.name}</option>)}</select></label>
              <label>Cities<input placeholder="Bengaluru, Mysuru" /></label>
            </div>
            <div className="window-extension-card">
              <span className="status blue">Registration Close Date</span>
              <h3>Extend registration access</h3>
              <p>Managers can extend the close date when extra teams need access. The tournament card status updates from the registration window automatically.</p>
              <div className="form-grid">
                <label>Tournament
                  <select value={windowTournamentSlug} onChange={(event) => setWindowTournamentSlug(event.target.value)}>
                    {activeTournamentOptions.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}
                  </select>
                </label>
                <label>Registration closes
                  <input value={registrationEnd} onChange={(event) => setRegistrationEnd(event.target.value)} placeholder="Aug 10, 2026" />
                </label>
              </div>
              <div className="hero-actions">
                <button className="btn btn-primary" type="button" onClick={extendRegistrationWindow}>Update close date</button>
                <span className="status slate">{selectedWindowTournament ? withRuntimeTournamentStatus(selectedWindowTournament).status : "No tournament"}</span>
              </div>
              {windowMessage && <p className="form-note">{windowMessage}</p>}
            </div>
          </section>
        )}
        {primaryContent}
        <div className="detail-grid">
          <InfoPanel title={`${title} Controls`} items={managementContent[section]} highlight />
          <InfoPanel title="Operational Links" items={["Tournament detail", "Live match center", "Bracket allocation", "Audit trail"]} to={section === "registrations" ? "/management/tournaments/bangalore-corporate-t20/bracket" : "/admin/logs"} />
        </div>
      </PortalShell>
    </Page>
  );
}
