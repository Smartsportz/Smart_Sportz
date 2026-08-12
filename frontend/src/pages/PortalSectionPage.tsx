import { Link, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import type React from "react";
import { Download } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { DataTable, Page, PortalShell } from "../components/UI";
import { managementSidebar, sidebar, sportHomeVisibility, sports, tournaments, userSidebar, withRuntimeTournamentStatus } from "../data/platform";
import { DashboardGrid, InfoPanel, MatchControlTable } from "./shared";
import { RichTextToolbarPreview } from "./NewsPages";
import { AnnouncementManagerPanel, AdminNewsPage, GalleryManagerPanel } from "./AdminPage";
import { apiRequest, mediaUrl, uploadFile } from "../lib/api";
import { downloadRegistrationPassPdf } from "../lib/downloads";
import { SectionSkeleton } from "../lib/progressive";
import { useAuth } from "../auth/AuthContext";
import type { UserDashboardData } from "./UserDashboardPage";

const userContent = {
  profile: ["Identity verification", "Captain and player details", "Emergency contact", "Document upload"],
  registrations: ["Approved tournaments", "Pending review", "Payment required", "Waitlisted entries"],
  payments: ["Receipts", "Invoices", "Refunds", "Webhook status"],
  members: ["Registered roster", "Captain and sub-captain", "Player contacts", "Team-only details"],
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
  gallery: ["Gallery albums", "Single image uploads", "Publish controls", "Delete confirmation"],
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

type MoneyLine = { label: string; value: number };
type PrizeLine = { position: number; label: string; amount: number };
type TournamentFormState = {
  slug?: string;
  name: string;
  sport: string;
  newSportName: string;
  status: string;
  location: string;
  newCity: string;
  date: string;
  registrationStart: string;
  registrationEnd: string;
  teams: number;
  capacity: number;
  minTeamSize: number;
  maxTeamSize: number;
  image: string;
  accent: string;
  address: string;
  sportDescription: string;
  tournamentDescription: string;
  rulesPdf: string;
  rulesText: string;
  published: boolean;
  showOnHome: boolean;
  feeBreakdown: MoneyLine[];
  prizes: PrizeLine[];
  cities: string[];
};

const emptyTournamentForm: TournamentFormState = {
  name: "",
  sport: "Cricket",
  newSportName: "",
  status: "Upcoming",
  location: "Mumbai",
  newCity: "",
  date: "",
  registrationStart: "",
  registrationEnd: "",
  teams: 0,
  capacity: 32,
  minTeamSize: 2,
  maxTeamSize: 16,
  image: "/assets/cricket-stadium.png",
  accent: "emerald",
  address: "",
  sportDescription: "",
  tournamentDescription: "",
  rulesPdf: "",
  rulesText: "",
  published: true,
  showOnHome: true,
  feeBreakdown: [{ label: "Entry Fee", value: 5000 }],
  prizes: [
    { position: 1, label: "1st Prize", amount: 0 },
    { position: 2, label: "2nd Prize", amount: 0 },
    { position: 3, label: "3rd Prize", amount: 0 },
  ],
  cities: ["Mumbai"],
};

function formFromTournament(item?: Record<string, any>): TournamentFormState {
  if (!item) return emptyTournamentForm;
  const feeBreakdown = Array.isArray(item.fee_breakdown) && item.fee_breakdown.length
    ? item.fee_breakdown.map((line: any) => ({ label: line.label ?? "Fee", value: Number(line.value ?? 0) }))
    : [{ label: "Entry Fee", value: Number(String(item.prize ?? "0").replace(/\D/g, "")) || 0 }];
  const prizes = Array.isArray(item.prizes) && item.prizes.length
    ? item.prizes.map((line: any) => ({ position: Number(line.position), label: line.label, amount: Number(line.amount) }))
    : emptyTournamentForm.prizes;
  const cities = Array.isArray(item.cities) && item.cities.length ? item.cities : [item.location ?? "Mumbai"];
  return {
    slug: item.slug,
    name: item.name ?? "",
    sport: item.sport ?? "Cricket",
    newSportName: "",
    status: item.status ?? "Upcoming",
    location: item.location ?? cities[0] ?? "Mumbai",
    newCity: "",
    date: item.date ?? "",
    registrationStart: item.registration_start ?? item.registrationStart ?? "",
    registrationEnd: item.registration_end ?? item.registrationEnd ?? "",
    teams: Number(item.teams ?? 0),
    capacity: Number(item.capacity ?? 32),
    minTeamSize: Number(item.min_team_size ?? item.minTeamSize ?? 2),
    maxTeamSize: Number(item.max_team_size ?? item.maxTeamSize ?? item.team_size ?? 16),
    image: item.image ?? "/assets/cricket-stadium.png",
    accent: item.accent ?? "emerald",
    address: item.address ?? "",
    sportDescription: item.sport_description ?? item.sportDescription ?? "",
    tournamentDescription: item.tournament_description ?? item.tournamentDescription ?? "",
    rulesPdf: item.rules_pdf ?? item.rulesPdf ?? "",
    rulesText: item.rules_text ?? item.rulesText ?? "",
    published: Boolean(item.published ?? true),
    showOnHome: Boolean(item.show_on_home ?? item.showOnHome ?? true),
    feeBreakdown,
    prizes,
    cities,
  };
}

export function UserSectionPage({ section }: { section: keyof typeof userContent }) {
  const { token } = useAuth();
  const title = section.replace("-", " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const [downloadError, setDownloadError] = useState("");
  
  // State to track which tournament's members are being viewed
  const [activeMemberRegId, setActiveMemberRegId] = useState<string | null>(null);
  const userQuery = useQuery({
    queryKey: ["user", "portal-section", token],
    queryFn: () => apiRequest<UserDashboardData>("/user/dashboard", { silent: true }, token),
    enabled: Boolean(token),
  });
  const data = userQuery.data ?? null;

  useEffect(() => {
    if (data?.registrations.length && !activeMemberRegId) {
      setActiveMemberRegId(data.registrations[0].id);
    }
  }, [activeMemberRegId, data?.registrations]);

  const registrations = data?.registrations ?? [];
  const payments = data?.payments ?? [];
  const documents = data?.documents ?? [];
  const certificateRows = registrations.filter((item) => item.status === "approved" || item.status === "accepted");

  // Filtering members based on the selected tournament registration container
  const filteredMembers = (data?.members ?? []).filter(
    (m) => !activeMemberRegId || m.registration_id === activeMemberRegId
  );

  const rowsBySection: Record<keyof typeof userContent, Array<Array<React.ReactNode>>> = {
    profile: [[data?.profile.name ?? "Participant", data?.profile.email ?? "No email", data?.profile.role ?? "user"]],
    registrations: registrations.map((item) => [
      item.tournament_name,
      item.team_name,
      item.city,
      <span className={`status ${item.payment_status === "paid" ? "emerald" : "orange"}`}>{item.payment_status}</span>,
      <div className="table-action-row">
        <Link className="inline-link" to={`/tournaments/${item.tournament_slug}/registration-pass`}>View</Link>
        <button
          className="inline-link inline-button"
          type="button"
          onClick={() => {
            setDownloadError("");
            downloadRegistrationPassPdf(item.id, token).catch((caught) => setDownloadError(caught instanceof Error ? caught.message : "Unable to download registration PDF."));
          }}
        >
          <Download size={14} />PDF
        </button>
      </div>,
    ]),
    payments: payments.map((item) => [
      item.receipt_number,
      new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(item.amount / 100),
      item.method,
      <span className="status emerald">{item.status}</span>,
      <Link className="inline-link" to={`/payments/${item.id}/receipt`}>Receipt</Link>,
    ]),
    members: filteredMembers.map((item) => [
      item.name,
      item.role,
      item.contact || "-",
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
    members: ["Member", "Role", "Contact"],
    certificates: ["Tournament", "Team", "City", "Status", "Note"],
    schedules: ["Tournament", "Sport", "Schedule", "City"],
    documents: ["Document", "File", "Status"],
    settings: ["Account", "Preference", "Action"],
  };

  const sectionRows = rowsBySection[section];

  return (
    <Page>
      <PortalShell title={title} subtitle="Participant portal detail page connected from the user dashboard and sidebar." sidebar={userSidebar} action={<Link className="btn btn-primary" to="/user/dashboard">Dashboard</Link>}>
        {userQuery.isError && <div className="form-alert">Could not load user data.</div>}
        {downloadError && <div className="form-alert">{downloadError}</div>}
        {!data ? (
          <SectionSkeleton rows={4} />
        ) : sectionRows.length === 0 && section !== "members" ? (
          <section className="panel user-empty-state"><h2>No {title.toLowerCase()} records</h2><p>This page will populate after your tournament registration data is saved in the database.</p><Link className="btn btn-primary" to="/tournaments">Open tournaments</Link></section>
        ) : (
          <>
            {section === "members" && registrations.length > 0 && (
              <div className="tournament-selector-tabs">
                <p className="form-note">Select a tournament to view its specific roster:</p>
                <div className="tab-container">
                  {registrations.map((reg) => (
                    <button 
                      key={reg.id} 
                      className={`tab-btn ${activeMemberRegId === reg.id ? "active" : ""}`}
                      onClick={() => setActiveMemberRegId(reg.id)}
                    >
                      {reg.tournament_name} 
                      <small>{reg.team_name}</small>
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {section === "members" && filteredMembers.length === 0 ? (
               <section className="panel user-empty-state">
                 <h2>No members found</h2>
                 <p>No players are currently listed for the selected tournament registration.</p>
               </section>
            ) : (
              <DataTable columns={columnsBySection[section]} rows={sectionRows} />
            )}
          </>
        )}
      </PortalShell>
    </Page>
  );
}

export function ManagementSectionPage({ section }: { section: keyof typeof managementContent }) {
  const location = useLocation();
  const title = section.replace("-", " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const { token } = useAuth();
  const isAdminRoute = location.pathname.startsWith("/admin");
  const portalSidebar = isAdminRoute ? sidebar : managementSidebar;
  const dashboardPath = isAdminRoute ? "/admin/dashboard" : "/management/dashboard";
  const [managerDashboard, setManagerDashboard] = useState<ManagerDashboardData | null>(null);
  const [managerNews, setManagerNews] = useState<ManagerNewsData | null>(null);
  const [sectionRecords, setSectionRecords] = useState<Array<Record<string, any>>>([]);
  const activeTournamentOptions = tournaments.filter((item) => item.status !== "Completed");
  const [windowTournamentSlug, setWindowTournamentSlug] = useState(activeTournamentOptions[0]?.slug ?? "");
  const selectedWindowTournament = activeTournamentOptions.find((item) => item.slug === windowTournamentSlug) ?? activeTournamentOptions[0];
  const [registrationEnd, setRegistrationEnd] = useState(selectedWindowTournament?.registrationEnd ?? "");
  const [windowMessage, setWindowMessage] = useState("");
  const [managerMessage, setManagerMessage] = useState("");
  const [tournamentForm, setTournamentForm] = useState<TournamentFormState>(emptyTournamentForm);
  const [editingTournament, setEditingTournament] = useState<Record<string, any> | null>(null);
  const [showTournamentForm, setShowTournamentForm] = useState(false);
  const [quickFeatureMode, setQuickFeatureMode] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<Record<string, any> | null>(null);
  const [confirmNextStep, setConfirmNextStep] = useState<"news" | "announcements" | null>(null);

  useEffect(() => {
    setRegistrationEnd(selectedWindowTournament?.registrationEnd ?? "");
  }, [selectedWindowTournament?.slug]);

  const dashboardQuery = useQuery({
    queryKey: ["management", "section-dashboard", token],
    queryFn: () => apiRequest<ManagerDashboardData>("/management/dashboard", { silent: true }, token),
    enabled: Boolean(token),
    staleTime: 60_000,
  });
  const newsQuery = useQuery({
    queryKey: ["management", "section-news", token],
    queryFn: () => apiRequest<ManagerNewsData>("/management/news", { silent: true }, token),
    enabled: Boolean(token) && section === "news",
    staleTime: 60_000,
  });
  const recordsQuery = useQuery({
    queryKey: ["management", "section-records", section, token],
    queryFn: () => apiRequest<Array<Record<string, any>>>(`/management/${section}`, { silent: true }, token),
    enabled: Boolean(token) && ["tournaments", "matches", "players", "reports"].includes(section),
    staleTime: 60_000,
  });
  const managerLoading = dashboardQuery.isLoading || newsQuery.isLoading || recordsQuery.isLoading;
  const managerError = dashboardQuery.isError || newsQuery.isError || recordsQuery.isError
    ? "Could not load management records."
    : "";

  useEffect(() => {
    if (dashboardQuery.data) setManagerDashboard(dashboardQuery.data);
  }, [dashboardQuery.data]);

  useEffect(() => {
    if (newsQuery.data) setManagerNews(newsQuery.data);
  }, [newsQuery.data]);

  useEffect(() => {
    if (recordsQuery.data) setSectionRecords(recordsQuery.data);
  }, [recordsQuery.data]);

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

  function openTournamentForm(item?: Record<string, any>) {
    const nextForm = formFromTournament(item);
    if (item && (item.status === "Featured" || item.show_on_home === true)) {
      nextForm.status = "Upcoming";
      nextForm.showOnHome = false;
    }
    setEditingTournament(item ?? null);
    setTournamentForm(nextForm);
    setShowTournamentForm(true);
    setQuickFeatureMode(false);
    setManagerMessage("");
  }

  function openFeaturedTournamentForm() {
    setEditingTournament(null);
    setTournamentForm({
      ...emptyTournamentForm,
      name: "",
      status: "Featured",
      showOnHome: true,
      image: "/assets/poster.jpeg",
      tournamentDescription: "",
      sportDescription: "",
    });
    setShowTournamentForm(true);
    setQuickFeatureMode(true);
    setManagerMessage("");
  }

  function patchTournamentForm(patch: Partial<TournamentFormState>) {
    setTournamentForm((current) => ({ ...current, ...patch }));
  }

  function applyTournamentPlace(place: string) {
    if (place === "__new_city__") {
      patchTournamentForm({ location: "__new_city__" });
      return;
    }
    patchTournamentForm({ location: place, cities: Array.from(new Set([...tournamentForm.cities, place].filter(Boolean))) });
  }

  function saveTournamentPlace() {
    const place = tournamentForm.newCity.trim();
    if (!place) return;
    patchTournamentForm({ location: place, newCity: "", cities: Array.from(new Set([...tournamentForm.cities, place])) });
  }

  function setMoneyLine(index: number, patch: Partial<MoneyLine>) {
    patchTournamentForm({
      feeBreakdown: tournamentForm.feeBreakdown.map((line, i) => i === index ? { ...line, ...patch } : line),
    });
  }

  function setPrizeLine(index: number, patch: Partial<PrizeLine>) {
    patchTournamentForm({
      prizes: tournamentForm.prizes.map((line, i) => i === index ? { ...line, ...patch } : line),
    });
  }

  async function saveTournamentForm() {
    setManagerMessage("");
    const primaryPlace = tournamentForm.location === "__new_city__" ? tournamentForm.newCity.trim() : tournamentForm.location.trim();
    const selectedCities = Array.from(new Set([primaryPlace, ...tournamentForm.cities].map((city) => city.trim()).filter((city) => city && city !== "__new_city__")));
    const prizeTotal = tournamentForm.prizes.reduce((total, line) => total + Number(line.amount || 0), 0);
    const payload = {
      slug: tournamentForm.slug,
      name: tournamentForm.name,
      sport: tournamentForm.sport === "__new__" ? tournamentForm.newSportName : tournamentForm.sport,
      new_sport_name: tournamentForm.sport === "__new__" ? tournamentForm.newSportName : undefined,
      status: tournamentForm.status === "Featured" ? "Upcoming" : tournamentForm.status,
      location: primaryPlace || "Mumbai",
      date: tournamentForm.date || "TBA",
      registration_start: tournamentForm.registrationStart || "TBA",
      registration_end: tournamentForm.registrationEnd || "TBA",
      teams: tournamentForm.teams,
      capacity: tournamentForm.capacity,
      team_size: tournamentForm.maxTeamSize,
      min_team_size: tournamentForm.minTeamSize,
      max_team_size: tournamentForm.maxTeamSize,
      prize: `INR ${prizeTotal.toLocaleString("en-IN")}`,
      image: tournamentForm.image,
      accent: tournamentForm.accent,
      address: tournamentForm.address,
      sport_description: tournamentForm.sportDescription,
      tournament_description: tournamentForm.tournamentDescription,
      rules_pdf: tournamentForm.rulesPdf,
      rules_text: tournamentForm.rulesText,
      fee_breakdown: tournamentForm.feeBreakdown.filter((line) => line.label.trim()),
      prizes: tournamentForm.prizes,
      cities: selectedCities,
      published: tournamentForm.published,
      show_on_home: tournamentForm.showOnHome,
    };
    try {
      const saved = await apiRequest<Record<string, any>>(
        editingTournament ? `/management/tournaments/${editingTournament.slug}` : "/management/tournaments",
        { method: editingTournament ? "PATCH" : "POST", body: JSON.stringify(payload) },
        token,
      );
      setSectionRecords((current) => [saved, ...current.filter((item) => item.slug !== (editingTournament?.slug ?? saved.slug))]);
      void apiRequest<Array<Record<string, any>>>("/management/tournaments", {}, token).then(setSectionRecords).catch(() => undefined);
      setEditingTournament(saved);
      setTournamentForm(formFromTournament(saved));
      setManagerMessage(`${saved.name} saved. You can continue editing or confirm the next publishing step.`);
      setConfirmNextStep("news");
    } catch (error) {
      setManagerMessage(error instanceof Error ? error.message : "Unable to save tournament.");
    }
  }

  async function deleteTournament() {
    if (!deleteCandidate) return;
    try {
      await apiRequest(`/management/tournaments/${deleteCandidate.slug}`, { method: "DELETE" }, token);
      setSectionRecords((current) => current.filter((item) => item.slug !== deleteCandidate.slug));
      setManagerMessage(`${deleteCandidate.name} deleted.`);
      setDeleteCandidate(null);
    } catch (error) {
      setManagerMessage(error instanceof Error ? error.message : "Unable to delete tournament.");
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
  const managedTournamentGroups = useMemo(() => {
    const groups: Record<string, Array<Record<string, any>>> = {
      Featured: [],
      Upcoming: [],
      "Registration Open": [],
      Live: [],
      "Old / Completed": [],
    };
    assignedTournaments.forEach((entry) => {
      const status = String(entry.status ?? "");
      if (status === "Featured" || Boolean(entry.show_on_home)) groups.Featured.push(entry);
      else if (status === "Upcoming") groups.Upcoming.push(entry);
      else if (status === "Registration Open") groups["Registration Open"].push(entry);
      else if (status === "Live") groups.Live.push(entry);
      else groups["Old / Completed"].push(entry);
    });
    return groups;
  }, [assignedTournaments]);
  const sportOptions = Array.from(new Set([...sports.map((sport) => sport.name), ...assignedTournaments.map((item) => item.sport).filter(Boolean)]));
  const cityOptions = Array.from(new Set([...(assignedCities.length ? assignedCities : ["Mumbai", "Bengaluru", "Mysuru", "Delhi", "Chennai"]), ...tournamentForm.cities]));
  const imageOptions = ["/assets/cricket-stadium.png", "/assets/football-match.png", "/assets/basketball-match.png", "/assets/volleyball-match.png"];
  const feeTotal = tournamentForm.feeBreakdown.reduce((total, line) => total + Number(line.value || 0), 0);
  const prizeTotal = tournamentForm.prizes.reduce((total, line) => total + Number(line.amount || 0), 0);

  const primaryContent = managerLoading ? (
    <section className="panel"><SectionSkeleton rows={section === "tournaments" ? 3 : 2} /></section>
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
      <section className="panel user-empty-state">
        <h2>No assigned tournaments</h2>
        <p>Use the add button to create a tournament for an assigned city.</p>
        <button className="btn btn-primary" type="button" onClick={() => openTournamentForm()}>Add New Tournament</button>
      </section>
    ) : (
      <div className="manager-tournament-board">
        <div className="manager-board-head">
          <div>
            <h2>Assigned tournaments</h2>
            <p>Grouped by runtime status: upcoming, open registration, live, then old/completed.</p>
          </div>
          <div className="hero-actions">
            <button className="btn btn-secondary" type="button" onClick={() => openTournamentForm()}>Add New Tournament</button>
            <button className="btn btn-primary" type="button" onClick={openFeaturedTournamentForm}>Add Featured Tournament</button>
          </div>
        </div>
        {Object.entries(managedTournamentGroups).map(([group, items]) => (
          <section className="manager-tournament-group" key={group}>
            <div className="group-title-row"><h3>{group}</h3><span>{items.length} tournaments</span></div>
            {items.length ? (
              <div className="manager-tournament-row">
                {items.map((item) => (
                  <article className="manager-tournament-card" key={item.slug}>
                    <div className="manager-tournament-image">
                      {item.image && <img src={mediaUrl(item.image)} alt="" />}
                    </div>
                    <div>
                      <span className={`status ${item.accent ?? "emerald"}`}>{item.status}</span>
                      <h4>{item.name}</h4>
                      <p>{item.sport} - {item.location}</p>
                      <small>{item.registration_start || "-"} to {item.registration_end || "-"} - {item.min_team_size ?? 2}/{item.max_team_size ?? item.team_size ?? 16} players</small>
                    </div>
                    <div className="manager-card-actions">
                      <Link to={`/tournaments/${item.slug}`}>Open</Link>
                      <Link to={`/management/tournaments/${item.slug}/bracket`}>Rounds</Link>
                      <button type="button" onClick={() => openTournamentForm(item)}>{item.status === "Featured" ? "Update" : "Edit"}</button>
                      <button className="danger-link" type="button" onClick={() => setDeleteCandidate(item)}>Delete</button>
                    </div>
                  </article>
                ))}
              </div>
            ) : <p className="empty-line">No {group.toLowerCase()} tournaments.</p>}
          </section>
        ))}
      </div>
    )
  ) : section === "news" ? (
    <AdminNewsPage mode="news" />
  ) : false ? (
    <div className="manager-news-layout">
      <section className="panel news-editor-panel">
        <span className="status emerald">Manager News Editor</span>
        <h2>Create or edit news</h2>
        <p>Managers publish only for assigned cities. Rich sections are stored as structured blocks.</p>
        <RichTextToolbarPreview />
        <div className="form-grid">
          <label>Image<select>{newsRows.map((post) => <option key={post.slug}>{post.image}</option>)}</select></label>
          <label>Category<select><option>Winner Teams</option><option>Match Updates</option><option>Tournament Updates</option><option>Announcements</option></select></label>
          <label>Title<input placeholder="Winner team headline" /></label>
          <label>City<select>{(assignedCities.length ? assignedCities : ["Bengaluru", "Mysuru", "Mumbai"]).map((city) => <option key={city}>{city}</option>)}</select></label>
          <label>Sport<select>{sports.map((sport) => <option key={sport.slug}>{sport.name}</option>)}</select></label>
          <label>Tournament<select>{assignedTournaments.map((item) => <option key={item.slug}>{item.name}</option>)}</select></label>
        </div>
        <label className="visibility-row news-highlight-toggle">
          <span>
            <b>Display on highlight news</b>
            <small>Show this story in the top sliding news banner.</small>
          </span>
          <input type="checkbox" />
        </label>
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
        rows={newsRows.map((post) => [
          post.title,
          post.category,
          post.city,
          <span className="status emerald">{post.status}</span>,
          <span className="table-actions"><Link to={`/news/${post.slug}`}>Open</Link><button>Edit</button><button>Delete</button></span>,
        ])}
      />
    </div>
  ) : section === "players" ? (
    sectionRecords.length === 0 ? (
      <section className="panel user-empty-state"><h2>No players found</h2><p>Players appear after team registrations are accepted in assigned cities.</p></section>
    ) : (
      <DataTable columns={["Player", "Team", "Status"]} rows={sectionRecords.map((item) => [item.name, item.team, <span className="status emerald">{item.status}</span>])} />
    )
  ) : section === "announcements" ? (
    <AnnouncementManagerPanel role="manager" />
  ) : section === "gallery" ? (
    <GalleryManagerPanel />
  ) : section === "reports" ? (
    sectionRecords.length === 0 ? (
      <section className="panel user-empty-state"><h2>No reports available</h2><p>Reports will appear after registrations, payments, and live scoring generate records.</p></section>
    ) : (
      <DataTable columns={["Report", "Status"]} rows={sectionRecords.map((item) => [item.name, <span className="status blue">{item.status}</span>])} />
    )
  ) : <DashboardGrid />;

  return (
    <Page>
      <PortalShell title={title} subtitle="Management portal section for tournament-specific operations." sidebar={portalSidebar} action={<Link className="btn btn-primary" to={dashboardPath}>Dashboard</Link>}>
        {managerError && <div className="form-alert">{managerError}</div>}
        {managerMessage && <p className="form-note">{managerMessage}</p>}
        {primaryContent}
        {section !== "tournaments" && <div className="detail-grid">
          <InfoPanel title={`${title} Controls`} items={managementContent[section]} highlight />
          <InfoPanel title="Operational Links" items={["Tournament detail", "Live match center", "Bracket allocation", "Audit trail"]} to={section === "registrations" ? "/management/tournaments/bangalore-corporate-t20/bracket" : "/admin/logs"} />
        </div>}
        {section === "tournaments" && showTournamentForm && (
          <div className="modal-backdrop">
            <section className="manager-tournament-modal">
              <div className="modal-head">
                <div>
                  <p className="eyebrow">{quickFeatureMode ? "Featured Tournament" : editingTournament ? "Edit Tournament" : "New Tournament"}</p>
                  <h2>{quickFeatureMode ? "Create featured tournament" : editingTournament ? tournamentForm.name : "Create tournament"}</h2>
                </div>
                <button className="icon-btn" type="button" onClick={() => setShowTournamentForm(false)}>x</button>
              </div>
              {quickFeatureMode ? (
                <>
                  <div className="form-grid">
                    <label>Title<input value={tournamentForm.name} onChange={(event) => patchTournamentForm({ name: event.target.value })} placeholder="Featured tournament title" /></label>
                    <label>Image<input value={tournamentForm.image} onChange={(event) => patchTournamentForm({ image: event.target.value })} placeholder="/assets/poster.jpeg" /></label>
                    <label>Description<textarea value={tournamentForm.tournamentDescription} onChange={(event) => patchTournamentForm({ tournamentDescription: event.target.value })} placeholder="Short description for the featured card" /></label>
                  </div>
                  <div className="admin-flow-checks">
                    <label className="visibility-row"><span><b>Display on tournament page</b><small>Show this tournament on the public tournament page.</small></span><input type="checkbox" checked={tournamentForm.published} onChange={(event) => patchTournamentForm({ published: event.target.checked })} /></label>
                    <label className="visibility-row"><span><b>Display on home page</b><small>Show this tournament in the home upcoming tournament containers.</small></span><input type="checkbox" checked={tournamentForm.showOnHome} onChange={(event) => patchTournamentForm({ showOnHome: event.target.checked })} /></label>
                  </div>
                  <div className="registration-actions compact-actions">
                    <button className="btn btn-primary" type="button" onClick={saveTournamentForm}>Save featured tournament</button>
                    <button className="btn btn-secondary" type="button" onClick={() => setShowTournamentForm(false)}>Close</button>
                  </div>
                  <p className="form-note">This creates a featured card only. Use Update later to complete the full tournament setup.</p>
                </>
              ) : (
                <>
                  <div className="form-grid">
                    <label>Tournament name<input value={tournamentForm.name} onChange={(event) => patchTournamentForm({ name: event.target.value })} /></label>
                    <label>Sport
                      <select value={tournamentForm.sport} onChange={(event) => patchTournamentForm({ sport: event.target.value })}>
                        {sportOptions.map((sport) => <option key={sport}>{sport}</option>)}
                        <option value="__new__">Add new sport</option>
                      </select>
                    </label>
                    {tournamentForm.sport === "__new__" && <label>New sport name<input value={tournamentForm.newSportName} onChange={(event) => patchTournamentForm({ newSportName: event.target.value })} placeholder="e.g. Hockey" /></label>}
                    <label>Status<select value={tournamentForm.status} onChange={(event) => patchTournamentForm({ status: event.target.value })}><option>Featured</option><option>Upcoming</option><option>Registration Open</option><option>Registration Closed</option><option>Live</option><option>Completed</option></select></label>
                    <label>Primary place
                      <select value={tournamentForm.location} onChange={(event) => applyTournamentPlace(event.target.value)}>
                        {cityOptions.map((city) => <option key={city}>{city}</option>)}
                        <option value="__new_city__">Add new place</option>
                      </select>
                    </label>
                    {tournamentForm.location === "__new_city__" && <label>New place<input value={tournamentForm.newCity} onChange={(event) => patchTournamentForm({ newCity: event.target.value })} onBlur={saveTournamentPlace} /></label>}
                    <label>Tournament date<input value={tournamentForm.date} onChange={(event) => patchTournamentForm({ date: event.target.value })} placeholder="Aug 14 - Sep 02" /></label>
                    <label>Registration opens<input value={tournamentForm.registrationStart} onChange={(event) => patchTournamentForm({ registrationStart: event.target.value })} placeholder="Aug 01, 2026" /></label>
                    <label>Registration closes<input value={tournamentForm.registrationEnd} onChange={(event) => patchTournamentForm({ registrationEnd: event.target.value })} placeholder="Aug 10, 2026" /></label>
                    <label>Capacity<input type="number" value={tournamentForm.capacity} onChange={(event) => patchTournamentForm({ capacity: Number(event.target.value) })} /></label>
                    <label>Min members<input type="number" value={tournamentForm.minTeamSize} onChange={(event) => patchTournamentForm({ minTeamSize: Number(event.target.value) })} /></label>
                    <label>Max members<input type="number" value={tournamentForm.maxTeamSize} onChange={(event) => patchTournamentForm({ maxTeamSize: Number(event.target.value) })} /></label>
                    <label>Image
                      <select value={imageOptions.includes(tournamentForm.image) ? tournamentForm.image : "__custom__"} onChange={(event) => patchTournamentForm({ image: event.target.value === "__custom__" ? "" : event.target.value })}>
                        {imageOptions.map((image) => <option key={image} value={image}>{image.replace("/assets/", "")}</option>)}
                        <option value="__custom__">Custom text path</option>
                      </select>
                    </label>
                    <label>Tournament image<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadFile(file, token, { silent: true }).then((upload) => patchTournamentForm({ image: upload.url })).catch((caught) => setManagerMessage(caught instanceof Error ? caught.message : "Unable to upload tournament image.")); }} /></label>
                  </div>
                  <label>Full address<textarea value={tournamentForm.address} onChange={(event) => patchTournamentForm({ address: event.target.value })} placeholder="Ground name, street, city, state" /></label>
                  <div className="manager-form-split">
                    <section className="mini-table-card">
                      <div className="section-head-inline"><h3>Payment lines</h3><button type="button" onClick={() => patchTournamentForm({ feeBreakdown: [...tournamentForm.feeBreakdown, { label: "Fee", value: 0 }] })}>Add</button></div>
                      {tournamentForm.feeBreakdown.map((line, index) => (
                        <div className="money-row" key={index}>
                          <input value={line.label} onChange={(event) => setMoneyLine(index, { label: event.target.value })} />
                          <input type="number" value={line.value} onChange={(event) => setMoneyLine(index, { value: Number(event.target.value) })} />
                        </div>
                      ))}
                      <b>Total - {feeTotal.toLocaleString("en-IN")}</b>
                    </section>
                    <section className="mini-table-card">
                      <div className="section-head-inline"><h3>Prize money</h3><button type="button" onClick={() => patchTournamentForm({ prizes: [...tournamentForm.prizes, { position: tournamentForm.prizes.length + 1, label: `${tournamentForm.prizes.length + 1}th Prize`, amount: 0 }] })}>Add</button></div>
                      {tournamentForm.prizes.map((line, index) => (
                        <div className="money-row" key={index}>
                          <input type="number" value={line.position} onChange={(event) => setPrizeLine(index, { position: Number(event.target.value) })} />
                          <input value={line.label} onChange={(event) => setPrizeLine(index, { label: event.target.value })} />
                          <input type="number" value={line.amount} onChange={(event) => setPrizeLine(index, { amount: Number(event.target.value) })} />
                        </div>
                      ))}
                      <b>Total prize - {prizeTotal.toLocaleString("en-IN")}</b>
                    </section>
                  </div>
                  <div className="form-grid">
                    <label>Sport registration description<textarea value={tournamentForm.sportDescription} onChange={(event) => patchTournamentForm({ sportDescription: event.target.value })} /></label>
                    <label>Tournament rules description<textarea value={tournamentForm.tournamentDescription} onChange={(event) => patchTournamentForm({ tournamentDescription: event.target.value })} /></label>
                    <label>Rules PDF<input type="file" accept="application/pdf,.pdf" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadFile(file, token, { silent: true }).then((upload) => patchTournamentForm({ rulesPdf: upload.url })).catch((caught) => setManagerMessage(caught instanceof Error ? caught.message : "Unable to upload rules PDF.")); }} /></label>
                    <label>Rules acceptance text<textarea value={tournamentForm.rulesText} onChange={(event) => patchTournamentForm({ rulesText: event.target.value })} /></label>
                  </div>
                  <div className="admin-flow-checks">
                    <label className="visibility-row"><span><b>Display on tournament page</b><small>Show this tournament on the public tournament page.</small></span><input type="checkbox" checked={tournamentForm.published} onChange={(event) => patchTournamentForm({ published: event.target.checked })} /></label>
                    <label className="visibility-row"><span><b>Display on home page</b><small>Show this tournament in the home upcoming tournament containers.</small></span><input type="checkbox" checked={tournamentForm.showOnHome} onChange={(event) => patchTournamentForm({ showOnHome: event.target.checked })} /></label>
                  </div>
                  <div className="registration-actions compact-actions">
                    <button className="btn btn-primary" type="button" onClick={saveTournamentForm}>Save</button>
                    <button className="btn btn-secondary" type="button" onClick={() => setShowTournamentForm(false)}>Close</button>
                  </div>
                </>
              )}
            </section>
          </div>
        )}
        {deleteCandidate && (
          <div className="modal-backdrop">
            <section className="confirm-modal panel">
              <h2>Delete tournament?</h2>
              <p>{deleteCandidate.name} will be removed only if it has no registrations.</p>
              <div className="registration-actions compact-actions">
                <button className="btn btn-primary" type="button" onClick={deleteTournament}>Confirm delete</button>
                <button className="btn btn-secondary" type="button" onClick={() => setDeleteCandidate(null)}>Cancel</button>
              </div>
            </section>
          </div>
        )}
        {confirmNextStep && (
          <div className="modal-backdrop">
            <section className="confirm-modal panel">
              <h2>{confirmNextStep === "news" ? "Add this to news?" : "Add announcement?"}</h2>
              <p>{confirmNextStep === "news" ? "Open the news editor with this tournament detail as a starting point. It will not auto-save." : "Open announcements and draft a user-facing message."}</p>
              <div className="registration-actions compact-actions">
                <Link className="btn btn-primary" to={confirmNextStep === "news" ? "/management/news" : "/management/announcements"}>{confirmNextStep === "news" ? "Yes, open news" : "Yes, open announcements"}</Link>
                <button className="btn btn-secondary" type="button" onClick={() => setConfirmNextStep(confirmNextStep === "news" ? "announcements" : null)}>{confirmNextStep === "news" ? "No, ask announcement" : "No, dashboard"}</button>
              </div>
            </section>
          </div>
        )}
      </PortalShell>
    </Page>
  );
}
