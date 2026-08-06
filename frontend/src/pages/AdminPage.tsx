import { Bell, CheckCircle2, ImagePlus, Plus, X, FileText, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import type React from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { DataTable, Page, PortalShell } from "../components/UI";
import { logRows, paymentRows, reports, sidebar, sports, teams, tournaments } from "../data/platform";
import type { TournamentNotice } from "../data/platform";
import { apiRequest } from "../lib/api";
import { AthleteProfile, ListPanel, Metric } from "./shared";
import { RichTextToolbarPreview } from "./NewsPages";

const noticeStorageKey = "smart-sportz-tournament-notices";
const announcementStorageKey = "smart-sportz-announcements";

type AnnouncementRecord = {
  id: string;
  title: string;
  description: string;
  image: string;
  dateFrom?: string;
  dateTo?: string;
  published: boolean;
  updatedBy?: string;
  updatedAt?: string;
};

function readAnnouncements(): AnnouncementRecord[] {
  if (typeof localStorage === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(announcementStorageKey) || "[]") as AnnouncementRecord[];
  } catch {
    return [];
  }
}

function writeAnnouncements(records: AnnouncementRecord[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(announcementStorageKey, JSON.stringify(records));
}

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
        <label>Notice image<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) setImage(`/assets/${file.name}`);
        }} /></label>
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

type AdminDashboardData = {
  tournaments: number;
  teams: number;
  registrations: number;
  payments: number;
  liveMatches: number;
};

type AdminTournamentForm = {
  slug?: string;
  name: string;
  sport: string;
  newSportName: string;
  status: string;
  location: string;
  date: string;
  registrationStart: string;
  registrationEnd: string;
  teams: number;
  capacity: number;
  minTeamSize: number;
  maxTeamSize: number;
  minAge: number;
  maxAge: number;
  image: string;
  poster: string;
  accent: string;
  address: string;
  sportDescription: string;
  tournamentDescription: string;
  showOnHome: boolean;
  blockRepeatRegistration: boolean;
  feeBreakdown: Array<{ label: string; value: number }>;
  prizes: Array<{ position: number; label: string; amount: number }>;
  cities: string[];
  assignedManagerIds: string[];
};

const emptyAdminTournamentForm: AdminTournamentForm = {
  name: "",
  sport: "Cricket",
  newSportName: "",
  status: "Upcoming",
  location: "Mumbai",
  date: "",
  registrationStart: "",
  registrationEnd: "",
  teams: 0,
  capacity: 32,
  minTeamSize: 2,
  maxTeamSize: 16,
  minAge: 18,
  maxAge: 45,
  image: "/assets/cricket-stadium.png",
  poster: "/assets/poster.jpeg",
  accent: "emerald",
  address: "",
  sportDescription: "",
  tournamentDescription: "",
  showOnHome: false,
  blockRepeatRegistration: false,
  feeBreakdown: [{ label: "Entry Fee", value: 5000 }],
  prizes: [
    { position: 1, label: "1st Prize", amount: 0 },
    { position: 2, label: "2nd Prize", amount: 0 },
    { position: 3, label: "3rd Prize", amount: 0 },
  ],
  cities: ["Mumbai"],
  assignedManagerIds: [],
};

function formatDateInput(value?: string) {
  if (!value) return "";
  const direct = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
  if (direct) return direct;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function adminFormFromTournament(item?: Record<string, any>): AdminTournamentForm {
  if (!item) return { ...emptyAdminTournamentForm, feeBreakdown: [...emptyAdminTournamentForm.feeBreakdown], prizes: [...emptyAdminTournamentForm.prizes], cities: [...emptyAdminTournamentForm.cities], assignedManagerIds: [] };
  const prizes = Array.isArray(item.prizes) && item.prizes.length
    ? item.prizes.map((line: any) => ({ position: Number(line.position), label: line.label, amount: Number(line.amount) }))
    : [...emptyAdminTournamentForm.prizes];
  const feeBreakdown = Array.isArray(item.fee_breakdown) && item.fee_breakdown.length
    ? item.fee_breakdown.map((line: any) => ({ label: line.label ?? "Fee", value: Number(line.value ?? 0) }))
    : [{ label: "Entry Fee", value: Number(String(item.prize ?? "0").replace(/\D/g, "")) || 0 }];
  const cities = Array.isArray(item.cities) && item.cities.length ? item.cities : [item.location ?? "Mumbai"];
  return {
    slug: item.slug,
    name: item.name ?? "",
    sport: item.sport ?? "Cricket",
    newSportName: "",
    status: item.status ?? "Upcoming",
    location: item.location ?? cities[0] ?? "Mumbai",
    date: formatDateInput(item.date),
    registrationStart: formatDateInput(item.registration_start),
    registrationEnd: formatDateInput(item.registration_end),
    teams: Number(item.teams ?? 0),
    capacity: Number(item.capacity ?? 32),
    minTeamSize: Number(item.min_team_size ?? 2),
    maxTeamSize: Number(item.max_team_size ?? item.team_size ?? 16),
    minAge: Number(item.min_age ?? 18),
    maxAge: Number(item.max_age ?? 45),
    image: item.image ?? "/assets/cricket-stadium.png",
    poster: item.poster ?? item.image ?? "/assets/poster.jpeg",
    accent: item.accent ?? "emerald",
    address: item.address ?? "",
    sportDescription: item.sport_description ?? "",
    tournamentDescription: item.tournament_description ?? "",
    showOnHome: Boolean(item.show_on_home),
    blockRepeatRegistration: Boolean(item.block_repeat_registration),
    feeBreakdown,
    prizes,
    cities,
    assignedManagerIds: Array.isArray(item.assigned_manager_ids) ? item.assigned_manager_ids : [],
  };
}

function AdminDashboardDbPanel() {
  const { token } = useAuth();
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [tournamentRows, setTournamentRows] = useState<Array<Record<string, any>>>([]);
  const [logs, setLogs] = useState<Array<Record<string, any>>>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setError("");
    Promise.all([
      apiRequest<AdminDashboardData>("/admin/dashboard", {}, token),
      apiRequest<Array<Record<string, any>>>("/admin/tournaments", {}, token),
      apiRequest<Array<Record<string, any>>>("/admin/logs", {}, token),
    ])
      .then(([dashboard, tournamentsList, logList]) => {
        if (!alive) return;
        setData(dashboard);
        setTournamentRows(tournamentsList);
        setLogs(logList);
      })
      .catch((caught) => {
        if (alive) setError(caught instanceof Error ? caught.message : "Could not load admin dashboard data.");
      });
    return () => {
      alive = false;
    };
  }, [token]);

  if (error) return <div className="form-alert">{error}</div>;
  if (!data) return <section className="panel user-empty-state"><h2>Loading admin dashboard</h2><p>Fetching live database records.</p></section>;

  return (
    <>
      <div className="mini-grid admin-metrics-grid">
        <Metric label="DB Tournaments" value={String(data.tournaments)} />
        <Metric label="DB Teams" value={String(data.teams)} />
        <Metric label="Registrations" value={String(data.registrations)} />
        <Metric label="Live Matches" value={String(data.liveMatches)} />
      </div>
      <div className="dashboard-two">
        <section className="panel">
          <h2>Database tournaments</h2>
          {tournamentRows.slice(0, 5).map((item) => (
            <a className="row-item readonly-row" href={`/Smart_Sportz/tournaments/${item.slug}`} key={item.slug}>
              <span>{item.name}</span>
              <b>{item.status}</b>
            </a>
          ))}
        </section>
        <section className="panel">
          <h2>Audit logs</h2>
          {logs.slice(0, 5).map((log, index) => (
            <div className="row-item readonly-row" key={log.id ?? index}>
              <span>{log.action ?? log.event_type ?? "Audit event"}</span>
              <small>{log.created_at ?? "Recorded"}</small>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}

function AdminTournamentsDbPanel() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [records, setRecords] = useState<Array<Record<string, any>>>([]);
  const [managers, setManagers] = useState<ManagerRow[]>([]);
  const [form, setForm] = useState<AdminTournamentForm>(() => adminFormFromTournament());
  const [editing, setEditing] = useState<Record<string, any> | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [flowStage, setFlowStage] = useState<"form" | "workspace" | "news" | "announcement">("form");
  const [savedTournament, setSavedTournament] = useState<Record<string, any> | null>(null);
  const [roundCount, setRoundCount] = useState(4);
  const [workspaceSaved, setWorkspaceSaved] = useState(false);
  const [confirmModal, setConfirmModal] = useState<"news" | "announcement" | null>(null);
  const [newsDraft, setNewsDraft] = useState({
    title: "",
    shortDescription: "",
    image: "",
    category: "Tournament Updates",
    status: "published",
    displayNews: true,
    highlight: false,
    homeNews: false,
    subHeader: "",
    body: "",
    quote: "",
    sections: [{ subHeader: "", description: "", image: "" }],
  });
  const [announcementDraft, setAnnouncementDraft] = useState({ title: "", image: "", description: "" });
  const [deleteCandidate, setDeleteCandidate] = useState<Record<string, any> | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadTournaments() {
    setError("");
    try {
      const data = await apiRequest<Array<Record<string, any>>>("/admin/tournaments", {}, token);
      setRecords(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load tournaments from database.");
    }
  }

  useEffect(() => {
    loadTournaments();
  }, [token]);

  useEffect(() => {
    let alive = true;
    apiRequest<ManagerRow[]>("/admin/managers", {}, token)
      .then((payload) => {
        if (alive) setManagers(payload);
      })
      .catch(() => {
        if (alive) setManagers([]);
      });
    return () => {
      alive = false;
    };
  }, [token]);

  function patchForm(patch: Partial<AdminTournamentForm>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function openForm(item?: Record<string, any>) {
    setEditing(item ?? null);
    setForm(adminFormFromTournament(item));
    setShowForm(true);
    setFlowStage("form");
    setSavedTournament(item ?? null);
    setWorkspaceSaved(false);
    setConfirmModal(null);
    setMessage("");
    setError("");
  }

  function updateMoneyLine(index: number, patch: Partial<{ label: string; value: number }>) {
    patchForm({ feeBreakdown: form.feeBreakdown.map((line, i) => i === index ? { ...line, ...patch } : line) });
  }

  function updatePrizeLine(index: number, patch: Partial<{ position: number; label: string; amount: number }>) {
    patchForm({ prizes: form.prizes.map((line, i) => i === index ? { ...line, ...patch } : line) });
  }

  async function saveTournament() {
    setMessage("");
    setError("");
    const prizeTotal = form.prizes.reduce((total, line) => total + Number(line.amount || 0), 0);
    const cities = Array.from(new Set([form.location, ...form.cities].map((city) => city.trim()).filter(Boolean)));
    const payload = {
      slug: form.slug,
      name: form.name,
      sport: form.sport === "__new__" ? form.newSportName : form.sport,
      new_sport_name: form.sport === "__new__" ? form.newSportName : undefined,
      status: form.status,
      location: form.location,
      date: form.date,
      registration_start: form.registrationStart,
      registration_end: form.registrationEnd,
      teams: form.teams,
      capacity: form.capacity,
      team_size: form.maxTeamSize,
      min_team_size: form.minTeamSize,
      max_team_size: form.maxTeamSize,
      min_age: form.minAge,
      max_age: form.maxAge,
      prize: `INR ${prizeTotal.toLocaleString("en-IN")}`,
      image: form.image,
      poster: form.poster,
      accent: form.accent,
      address: form.address,
      sport_description: form.sportDescription,
      tournament_description: form.tournamentDescription,
      fee_breakdown: form.feeBreakdown.filter((line) => line.label.trim()),
      prizes: form.prizes,
      cities,
      show_on_home: form.showOnHome,
      assigned_manager_ids: form.assignedManagerIds,
      block_repeat_registration: form.blockRepeatRegistration,
    };
    try {
      const saved = await apiRequest<Record<string, any>>(
        editing ? `/admin/tournaments/${editing.slug}` : "/admin/tournaments",
        { method: "POST", body: JSON.stringify(payload) }, 
        token,
      );
      await loadTournaments();
      setEditing(saved);
      setSavedTournament(saved);
      setForm(adminFormFromTournament(saved));
      setMessage(`${saved.name} saved in database.`);
      setFlowStage("workspace");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save tournament.");
    }
  }

  function updateManagerAssignment(managerId: string, checked: boolean) {
    patchForm({
      assignedManagerIds: checked
        ? Array.from(new Set([...form.assignedManagerIds, managerId]))
        : form.assignedManagerIds.filter((id) => id !== managerId),
    });
  }

  function prepareNewsDraft() {
    const tournament = savedTournament ?? editing;
    if (!tournament) return;
    setNewsDraft((current) => ({
      ...current,
      title: `${tournament.name} update`,
      shortDescription: `${tournament.name} is ready for ${tournament.location} with ${tournament.sport} tournament operations.`,
      image: tournament.image || form.image,
      category: "Tournament Updates",
      subHeader: `${tournament.sport} tournament in ${tournament.location}`,
      body: tournament.tournament_description || form.tournamentDescription || "Manager can edit this story before publishing.",
      quote: tournament.sport_description || form.sportDescription || "Smart Sportz tournament operations update.",
      sections: [
        {
          subHeader: "Tournament, sponsor, and prize detail",
          description: `${tournament.name} includes sponsor visibility, game details, prize records, venue/city information, manager notes, and official Smart Sportz registration context.`,
          image: tournament.image || form.image,
        },
      ],
    }));
    setFlowStage("news");
    setConfirmModal(null);
  }

  async function saveNewsDraft() {
    const tournament = savedTournament ?? editing;
    if (!tournament) return;
    setMessage("");
    setError("");
    try {
      const sectionBlocks = newsDraft.sections.flatMap((section) => [
        { block_type: "heading", content: section.subHeader },
        { block_type: "paragraph", content: section.description },
        ...(section.image ? [{ block_type: "image", content: section.image }] : []),
      ]).filter((block) => block.content.trim());
      await apiRequest("/admin/cms", {
        method: "POST",
        body: JSON.stringify({
          title: newsDraft.title,
          short_description: newsDraft.shortDescription,
          image: newsDraft.image,
          category: newsDraft.category,
          sport: tournament.sport || form.sport,
          tournament_slug: tournament.slug,
          city: tournament.location || form.location,
          status: newsDraft.displayNews ? newsDraft.status : "draft",
          is_highlight: newsDraft.highlight,
          blocks: [
            { block_type: "heading", content: newsDraft.subHeader || newsDraft.title },
            { block_type: "paragraph", content: newsDraft.body || newsDraft.shortDescription },
            { block_type: "quote", content: newsDraft.quote || "Published from Smart Sportz manager workflow." },
            ...sectionBlocks,
          ],
        }),
      }, token);
      setMessage("News draft saved. Confirm to prepare a user announcement.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save news draft.");
    }
  }

  function prepareAnnouncementDraft() {
    const tournament = savedTournament ?? editing;
    if (!tournament) return;
    setAnnouncementDraft({
      title: `${tournament.name} announcement`,
      image: tournament.image || form.image,
      description: `${tournament.name} is now published for ${tournament.location}. Teams can follow tournament updates from Smart Sportz.`,
    });
    setFlowStage("announcement");
    setConfirmModal(null);
  }

  function saveWorkspace() {
    setWorkspaceSaved(true);
    setMessage(`${roundCount} round workspace saved for ${savedTournament?.name ?? form.name}.`);
  }

  function updateNewsSection(index: number, patch: Partial<{ subHeader: string; description: string; image: string }>) {
    setNewsDraft((current) => ({
      ...current,
      sections: current.sections.map((section, sectionIndex) => sectionIndex === index ? { ...section, ...patch } : section),
    }));
  }

  function addNewsSection() {
    setNewsDraft((current) => ({
      ...current,
      sections: [...current.sections, { subHeader: "", description: "", image: "" }],
    }));
  }

  function readImageFile(file: File, callback: (value: string) => void) {
    const reader = new FileReader();
    reader.onload = () => callback(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  }

  async function deleteTournament() {
    if (!deleteCandidate) return;
    setError("");
    try {
      await apiRequest(`/admin/tournaments/${deleteCandidate.slug}/delete`, { method: "POST" }, token);
      setRecords((current) => current.filter((item) => item.slug !== deleteCandidate.slug));
      setMessage(`${deleteCandidate.name} deleted.`);
      setDeleteCandidate(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to delete tournament.");
    }
  }

  const groups = {
    Featured: records.filter((item) => item.status === "Featured" || item.show_on_home === true),
    Upcoming: records.filter((item) => item.status === "Upcoming"),
    "Registration Open": records.filter((item) => item.status === "Registration Open"),
    Live: records.filter((item) => item.status === "Live"),
    "Old / Completed": records.filter((item) => !["Featured", "Upcoming", "Registration Open", "Live"].includes(String(item.status))),
  };
  const sportOptions = Array.from(new Set([...sports.map((sport) => sport.name), ...records.map((item) => item.sport).filter(Boolean)]));
  const cityOptions = Array.from(new Set(["Mumbai", "Bengaluru", "Mysuru", "Delhi", "Chennai", ...records.map((item) => item.location).filter(Boolean), ...form.cities]));
  const feeTotal = form.feeBreakdown.reduce((total, line) => total + Number(line.value || 0), 0);
  const prizeTotal = form.prizes.reduce((total, line) => total + Number(line.amount || 0), 0);

  return (
    <>
      {message && <div className="form-alert success-alert">{message}</div>}
      {error && <div className="form-alert">{error}</div>}
      <div className="manager-tournament-board">
        <div className="manager-board-head">
          <div />
          <div className="hero-actions">
            <Link className="btn btn-secondary" to="/admin/tournaments/new">Add New Tournament</Link>
            <Link className="btn btn-primary" to="/admin/tournaments/new?featured=1">Add Featured Tournament</Link>
          </div>
        </div>
        {Object.entries(groups).map(([group, items]) => (
          <section className="manager-tournament-group" key={group}>
            <div className="group-title-row"><h3>{group}</h3><span>{items.length} tournaments</span></div>
            {items.length ? (
              <div className="manager-tournament-row">
                {items.map((item) => (
                  <article className="manager-tournament-card" key={item.slug}>
                    <div className="manager-tournament-image">
                      <img src={item.image || "/assets/cricket-stadium.png"} alt="" onError={(event) => { event.currentTarget.src = "/assets/cricket-stadium.png"; }} />
                    </div>
                    <div>
                      <span className={`status ${item.accent ?? "emerald"}`}>{item.status}</span>
                      <h4>{item.name}</h4>
                      <p><MapPin size={14} />{item.sport} - {item.location}</p>
                      <small>{item.registration_start || "-"} to {item.registration_end || "-"} - {item.min_team_size ?? 2}/{item.max_team_size ?? item.team_size ?? 16} players</small>
                    </div>
                    <div className="manager-card-actions">
                      <Link to={`/tournaments/${item.slug}`}>Open</Link>
                      <Link to={`/admin/tournaments/${item.slug}/bracket`}>Rounds</Link>
                      <Link to={`/admin/tournaments/${item.slug}/edit${item.status === "Featured" ? "?complete=1" : ""}`}>{item.status === "Featured" ? "Update" : "Edit"}</Link>
                      <button className="danger-link" type="button" onClick={() => setDeleteCandidate(item)}>Delete</button>
                    </div>
                  </article>
                ))}
              </div>
            ) : <p className="empty-line">No {group.toLowerCase()} tournaments.</p>}
          </section>
        ))}
      </div>
      {showForm && (
        <div className="modal-backdrop">
          <section className="manager-tournament-modal">
            <div className="modal-head">
              <div>
                <p className="eyebrow">{flowStage === "form" ? (editing ? "Edit Tournament" : "New Tournament") : flowStage}</p>
                <h2>{flowStage === "form" ? (editing ? form.name : "Create tournament") : savedTournament?.name ?? form.name}</h2>
              </div>
              <button className="icon-btn" type="button" onClick={() => setShowForm(false)}>x</button>
            </div>
            {flowStage === "form" ? (
              <>
            <div className="form-grid">
              <label>Tournament name<input value={form.name} onChange={(event) => patchForm({ name: event.target.value })} /></label>
              <label>Sport<select value={form.sport} onChange={(event) => patchForm({ sport: event.target.value })}>{sportOptions.map((sport) => <option key={sport}>{sport}</option>)}<option value="__new__">Add new sport</option></select></label>
              {form.sport === "__new__" && <label>New sport name<input value={form.newSportName} onChange={(event) => patchForm({ newSportName: event.target.value })} /></label>}
              <label>Status<select value={form.status} onChange={(event) => patchForm({ status: event.target.value })}><option>Upcoming</option><option>Registration Open</option><option>Registration Closed</option><option>Live</option><option>Completed</option></select></label>
              <label>Primary place<select value={form.location} onChange={(event) => patchForm({ location: event.target.value, cities: Array.from(new Set([...form.cities, event.target.value])) })}>{cityOptions.map((city) => <option key={city}>{city}</option>)}</select></label>
              <label>Tournament date<input type="date" value={form.date} onChange={(event) => patchForm({ date: event.target.value })} /></label>
              <label>Registration opens<input type="date" value={form.registrationStart} onChange={(event) => patchForm({ registrationStart: event.target.value })} /></label>
              <label>Registration closes<input type="date" value={form.registrationEnd} onChange={(event) => patchForm({ registrationEnd: event.target.value })} /></label>
              <label>Capacity<input type="number" value={form.capacity} onChange={(event) => patchForm({ capacity: Number(event.target.value) })} /></label>
              <label>Min members<input type="number" value={form.minTeamSize} onChange={(event) => patchForm({ minTeamSize: Number(event.target.value) })} /></label>
              <label>Max members<input type="number" value={form.maxTeamSize} onChange={(event) => patchForm({ maxTeamSize: Number(event.target.value) })} /></label>
              <label>Min age<input type="number" value={form.minAge} onChange={(event) => patchForm({ minAge: Number(event.target.value) })} /></label>
              <label>Max age<input type="number" value={form.maxAge} onChange={(event) => patchForm({ maxAge: Number(event.target.value) })} /></label>
              <label>Tournament image<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) patchForm({ image: `/assets/${file.name}` });
              }} /></label>
              <label>Tournament poster<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) patchForm({ poster: `/assets/${file.name}` });
              }} /></label>
            </div>
            <section className="mini-table-card manager-allocation-card">
              <div className="section-head-inline">
                <h3>Manager allocation</h3>
                <span>{form.assignedManagerIds.length} selected</span>
              </div>
              {managers.length ? (
                <div className="manager-select-list">
                  {managers.map((manager) => (
                    <label className="visibility-row" key={manager.id}>
                      <span><b>{manager.name}</b><small>{manager.email}</small></span>
                      <input type="checkbox" checked={form.assignedManagerIds.includes(manager.id)} onChange={(event) => updateManagerAssignment(manager.id, event.target.checked)} />
                    </label>
                  ))}
                </div>
              ) : <p className="empty-line">No manager accounts found. Create managers from Admin &gt; Managers first.</p>}
            </section>
            <label>Selected image path<input value={form.image} readOnly /></label>
            <label>Selected poster path<input value={form.poster} readOnly /></label>
            <label>Full address<textarea value={form.address} onChange={(event) => patchForm({ address: event.target.value })} /></label>
            <div className="manager-form-split">
              <section className="mini-table-card">
                <div className="section-head-inline"><h3>Payment lines</h3><button type="button" onClick={() => patchForm({ feeBreakdown: [...form.feeBreakdown, { label: "Fee", value: 0 }] })}>Add</button></div>
                {form.feeBreakdown.map((line, index) => <div className="money-row" key={index}><input value={line.label} onChange={(event) => updateMoneyLine(index, { label: event.target.value })} /><input type="number" value={line.value} onChange={(event) => updateMoneyLine(index, { value: Number(event.target.value) })} /></div>)}
                <b>Total - {feeTotal.toLocaleString("en-IN")}</b>
              </section>
              <section className="mini-table-card">
                <div className="section-head-inline"><h3>Prize money</h3><button type="button" onClick={() => patchForm({ prizes: [...form.prizes, { position: form.prizes.length + 1, label: `${form.prizes.length + 1}th Prize`, amount: 0 }] })}>Add</button></div>
                {form.prizes.map((line, index) => <div className="money-row" key={index}><input type="number" value={line.position} onChange={(event) => updatePrizeLine(index, { position: Number(event.target.value) })} /><input value={line.label} onChange={(event) => updatePrizeLine(index, { label: event.target.value })} /><input type="number" value={line.amount} onChange={(event) => updatePrizeLine(index, { amount: Number(event.target.value) })} /></div>)}
                <b>Total prize - {prizeTotal.toLocaleString("en-IN")}</b>
              </section>
            </div>
            <div className="form-grid">
              <label>Sport description<textarea value={form.sportDescription} onChange={(event) => patchForm({ sportDescription: event.target.value })} /></label>
              <label>Tournament description<textarea value={form.tournamentDescription} onChange={(event) => patchForm({ tournamentDescription: event.target.value })} /></label>
            </div>
            <label className="visibility-row"><span><b>Add featured tournament</b><small>Show this tournament in the Featured tournaments row.</small></span><input type="checkbox" checked={form.showOnHome} onChange={(event) => patchForm({ showOnHome: event.target.checked })} /></label>
            <div className="registration-actions compact-actions">
              <button className="btn btn-primary" type="button" onClick={saveTournament}>Save</button>
              <button className="btn btn-secondary" type="button" onClick={() => setShowForm(false)}>Close</button>
            </div>
              </>
            ) : flowStage === "workspace" ? (
              <section className="panel admin-flow-panel">
                <span className="status emerald">Rounds Workspace</span>
                <h2>Create bracket workspace</h2>
                <p>Choose the number of rounds required. Save keeps you on this workspace; Confirm starts the news publishing handoff.</p>
                <div className="form-grid">
                  <label>Rounds required<input type="number" min={1} max={12} value={roundCount} onChange={(event) => { setRoundCount(Number(event.target.value)); setWorkspaceSaved(false); }} /></label>
                  <label>Workspace status<input value={workspaceSaved ? "Saved" : "Unsaved changes"} readOnly /></label>
                </div>
                <div className="round-workspace-preview">
                  {Array.from({ length: Math.max(1, roundCount) }).map((_, index) => (
                    <article key={index}>
                      <b>Round {index + 1}</b>
                      <span>{index === roundCount - 1 ? "Final / Champion path" : "Pairing slots"}</span>
                    </article>
                  ))}
                </div>
                <div className="registration-actions compact-actions">
                  <button className="btn btn-primary" type="button" onClick={saveWorkspace}>Save Workspace</button>
                  <button className="btn btn-secondary" type="button" onClick={() => setConfirmModal("news")}>Confirm</button>
                </div>
              </section>
            ) : flowStage === "news" ? (
              <section className="panel admin-flow-panel">
                <span className="status emerald">News Draft</span>
                <h2>Create tournament news</h2>
                <p>Details are auto-filled from the tournament and remain editable. Saving stays on this page.</p>
                <RichTextToolbarPreview />
                <div className="form-grid">
                  <label>Title<input value={newsDraft.title} onChange={(event) => setNewsDraft((current) => ({ ...current, title: event.target.value }))} /></label>
                  <label>Category<select value={newsDraft.category} onChange={(event) => setNewsDraft((current) => ({ ...current, category: event.target.value }))}><option>Winner Teams</option><option>Match Updates</option><option>Tournament Updates</option><option>Announcements</option></select></label>
                  <label>Main image<input type="file" accept="image/*" onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) readImageFile(file, (image) => setNewsDraft((current) => ({ ...current, image: `/assets/${file.name}` })));
                  }} /></label>
                  <label>Image URL<input value={newsDraft.image} readOnly /></label>
                  <label>Sub header<input value={newsDraft.subHeader} onChange={(event) => setNewsDraft((current) => ({ ...current, subHeader: event.target.value }))} /></label>
                </div>
                <label>Short description<textarea value={newsDraft.shortDescription} onChange={(event) => setNewsDraft((current) => ({ ...current, shortDescription: event.target.value }))} /></label>
                <label>Body section<textarea value={newsDraft.body} onChange={(event) => setNewsDraft((current) => ({ ...current, body: event.target.value }))} /></label>
                <label>Quote / callout<textarea value={newsDraft.quote} onChange={(event) => setNewsDraft((current) => ({ ...current, quote: event.target.value }))} /></label>
                <div className="news-section-builder">
                  {newsDraft.sections.map((section, index) => (
                    <div className="panel subtle-panel" key={index}>
                      <div className="form-grid">
                        <label>Sub title<input value={section.subHeader} onChange={(event) => updateNewsSection(index, { subHeader: event.target.value })} /></label>
                        <label>Optional image<input type="file" accept="image/*" onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) updateNewsSection(index, { image: `/assets/${file.name}` });
                        }} /></label>
                      </div>
                      <label>Sub title description<textarea value={section.description} onChange={(event) => updateNewsSection(index, { description: event.target.value })} /></label>
                      <label>Optional image URL<input value={section.image} readOnly /></label>
                    </div>
                  ))}
                  <button className="btn btn-secondary" type="button" onClick={addNewsSection}>Add Sub Title</button>
                </div>
                <div className="admin-flow-checks">
                  <label className="visibility-row"><span><b>Display news</b><small>Default selected.</small></span><input type="checkbox" checked={newsDraft.displayNews} onChange={(event) => setNewsDraft((current) => ({ ...current, displayNews: event.target.checked }))} /></label>
                  <label className="visibility-row"><span><b>Highlight news</b><small>Top slider.</small></span><input type="checkbox" checked={newsDraft.highlight} onChange={(event) => setNewsDraft((current) => ({ ...current, highlight: event.target.checked }))} /></label>
                  <label className="visibility-row"><span><b>Home page news</b><small>Completed stories row.</small></span><input type="checkbox" checked={newsDraft.homeNews} onChange={(event) => setNewsDraft((current) => ({ ...current, homeNews: event.target.checked }))} /></label>
                </div>
                <div className="registration-actions compact-actions">
                  <button className="btn btn-primary" type="button" onClick={saveNewsDraft}>Save News</button>
                  <button className="btn btn-secondary" type="button" onClick={() => setConfirmModal("announcement")}>Confirm</button>
                </div>
              </section>
            ) : (
              <section className="panel admin-flow-panel">
                <span className="status emerald">User Announcement</span>
                <h2>Create announcement</h2>
                <p>Announcement is prepared from the tournament/news detail and can be edited before saving.</p>
                <div className="form-grid">
                  <label>Title<input value={announcementDraft.title} onChange={(event) => setAnnouncementDraft((current) => ({ ...current, title: event.target.value }))} /></label>
                  <label>Image<input type="file" accept="image/*" onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) setAnnouncementDraft(prev => ({...prev, image: `/assets/${file.name}`}));
                  }} /></label>
                  <label>Selected path<input value={announcementDraft.image} readOnly /></label>
                </div>
                <label>Description<textarea value={announcementDraft.description} onChange={(event) => setAnnouncementDraft((current) => ({ ...current, description: event.target.value }))} /></label>
                <div className="registration-actions compact-actions">
                  <button className="btn btn-primary" type="button" onClick={() => setMessage("Announcement saved as a local draft for user pages.")}>Save Announcement</button>
                  <button className="btn btn-secondary" type="button" onClick={() => { setShowForm(false); navigate("/admin/dashboard"); }}>Confirm</button>
                </div>
              </section>
            )}
          </section>
        </div>
      )}
      {confirmModal && (
        <div className="modal-backdrop">
          <section className="confirm-modal panel">
            <h2>{confirmModal === "news" ? "Add this to news?" : "Add announcement?"}</h2>
            <p>{confirmModal === "news" ? "Open the news page with this tournament detail auto-filled. It will not save until you choose Save News." : "Prepare a user-facing announcement from this tournament. It will not save until you choose Save Announcement."}</p>
            <div className="registration-actions compact-actions">
              <button className="btn btn-primary" type="button" onClick={confirmModal === "news" ? prepareNewsDraft : prepareAnnouncementDraft}>Yes</button>
              <button className="btn btn-secondary" type="button" onClick={() => {
                if (confirmModal === "news") setConfirmModal("announcement");
                else { setConfirmModal(null); setShowForm(false); navigate("/admin/dashboard"); }
              }}>{confirmModal === "news" ? "No, ask announcement" : "No, dashboard"}</button>
            </div>
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
    </>
  );
}

type AdminUserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  phone?: string;
  created_at?: string;
  registrations_count?: number;
  payments_count?: number;
};

type AdminUserDetailData = {
  user: AdminUserRow;
  registrations: Array<Record<string, any>>;
  payments: Array<Record<string, any>>;
  documents: Array<Record<string, any>>;
  members: Array<Record<string, any>>;
};

function formatAdminMoney(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value / 100);
}

function OptionalDataTable({ title, columns, rows }: { title: string; columns: string[]; rows: Array<Array<React.ReactNode>> }) {
  if (!rows.length) {
    return <section className="panel user-empty-state"><h2>No {title.toLowerCase()} records</h2><p>Only saved database records are shown here.</p></section>;
  }
  return <DataTable columns={columns} rows={rows} />;
}

function AdminCmsDbPanel() {
  const { token } = useAuth();
  const [records, setRecords] = useState<Array<Record<string, any>>>([]);
  const [homeContent, setHomeContent] = useState<{
    discoveryCards: Array<Record<string, any>>;
    liveHighlights: Array<Record<string, any>>;
    sponsorLogos: Array<Record<string, any>>;
  }>({ discoveryCards: [], liveHighlights: [], sponsorLogos: [] });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let alive = true;
    setError("");
    Promise.all([
      apiRequest<Array<Record<string, any>>>("/admin/cms", {}, token),
      apiRequest<{ discoveryCards: Array<Record<string, any>>; liveHighlights: Array<Record<string, any>>; sponsorLogos: Array<Record<string, any>> }>("/admin/home-content", {}, token),
    ])
      .then(([cmsPayload, homePayload]) => {
        if (!alive) return;
        setRecords(cmsPayload);
        setHomeContent(homePayload);
      })
      .catch((caught) => {
        if (alive) setError(caught instanceof Error ? caught.message : "Could not load CMS records.");
      });
    return () => { alive = false; };
  }, [token]);

  if (error) return <div className="form-alert">{error}</div>;

  async function saveHomeItem(kind: "discovery" | "live-highlight" | "sponsor", id: string, item: Record<string, any>) {
    const endpoint = kind === "discovery"
      ? `/admin/home-content/discovery/${id}`
      : kind === "live-highlight"
        ? `/admin/home-content/live-highlight/${id}`
        : `/admin/home-content/sponsor/${id}`;
    try {
      await apiRequest(endpoint, {
        method: "POST", 
        body: JSON.stringify({ ...item, published: Boolean(item.published) }),
      }, token);
      setMessage("Homepage content updated.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save homepage content.");
    }
  }

  function updateHomeList(listName: keyof typeof homeContent, index: number, patch: Record<string, any>) {
    setHomeContent((current) => ({
      ...current,
      [listName]: current[listName].map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item),
    }));
  }

  return (
    <div className="manager-news-layout">
      {message && <div className="form-alert success-alert">{message}</div>}
      <section className="panel admin-list-head">
        <div>
          <span className="status emerald">CMS Content</span>
          <h2>Website content</h2>
          <p>Backend database records for public website sections, publish state, and page routes.</p>
        </div>
      </section>
      <DataTable
        columns={["Section", "Type", "Path", "Status", "Action"]}
        rows={records.map((item) => [
          item.title,
          item.type,
          item.path,
          <span className={`status ${item.published ? "emerald" : "orange"}`}>{item.published ? "Published" : "Draft"}</span>,
          <span className="table-actions"><Link to={`/admin/cms/${item.slug}`}>Edit</Link><Link to={item.path || "/"}>Preview</Link></span>,
        ])}
      />
      <section className="panel cms-home-editor">
        <h2>Homepage discovery cards</h2>
        <p>Edit sponsor/game/tournament cards displayed in Discover tournaments across categories.</p>
        {homeContent.discoveryCards.map((item, index) => (
          <div className="cms-home-row" key={item.slug}>
            <div className="form-grid">
              <label>Label<input value={item.label || ""} onChange={(event) => updateHomeList("discoveryCards", index, { label: event.target.value })} /></label>
              <label>Title<input value={item.title || ""} onChange={(event) => updateHomeList("discoveryCards", index, { title: event.target.value })} /></label>
              <label>Sport<input value={item.sport || ""} onChange={(event) => updateHomeList("discoveryCards", index, { sport: event.target.value })} /></label>
              <label>Tournament slug<input value={item.tournament_slug || ""} onChange={(event) => updateHomeList("discoveryCards", index, { tournament_slug: event.target.value })} /></label>
              <label>Sponsor name<input value={item.sponsor_name || ""} onChange={(event) => updateHomeList("discoveryCards", index, { sponsor_name: event.target.value })} /></label>
              <label>Image<input type="file" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) updateHomeList("discoveryCards", index, { image: `/assets/${file.name}` });
              }} /></label>
              <label>Sponsor image<input type="file" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) updateHomeList("discoveryCards", index, { sponsor_image: `/assets/${file.name}` });
              }} /></label>
              <label>Event date<input value={item.event_date || ""} onChange={(event) => updateHomeList("discoveryCards", index, { event_date: event.target.value })} /></label>
              <label>Register path<input value={item.register_path || ""} onChange={(event) => updateHomeList("discoveryCards", index, { register_path: event.target.value })} /></label>
              <label>Sort order<input type="number" value={item.sort_order || 1} onChange={(event) => updateHomeList("discoveryCards", index, { sort_order: Number(event.target.value) })} /></label>
            </div>
            <label>Image path<input value={item.image || ""} readOnly /></label>
            <label>Description<textarea rows={3} value={item.description || ""} onChange={(event) => updateHomeList("discoveryCards", index, { description: event.target.value })} /></label>
            <label>Sponsor details<textarea rows={3} value={item.sponsor_details || ""} onChange={(event) => updateHomeList("discoveryCards", index, { sponsor_details: event.target.value })} /></label>
            <label className="checkbox-line"><input type="checkbox" checked={Boolean(item.published)} onChange={(event) => updateHomeList("discoveryCards", index, { published: event.target.checked })} /> Published</label>
            <button className="btn btn-primary" type="button" onClick={() => saveHomeItem("discovery", item.slug, item)}>Save discovery card</button>
          </div>
        ))}
      </section>
      <section className="panel cms-home-editor">
        <h2>Homepage live highlight</h2>
        {homeContent.liveHighlights.map((item, index) => (
          <div className="cms-home-row" key={item.id}>
            <div className="form-grid">
              {["title", "stage_label", "home_team", "away_team", "home_score", "away_score", "image", "link_path", "match_id"].map((field) => (
                <label key={field}>
                  {field.replace(/_/g, " ")}
                  {field === "image" ? (
                    <input type="file" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) updateHomeList("liveHighlights", index, { [field]: `/assets/${file.name}` });
                    }} />
                  ) : (
                    <input value={item[field] || ""} onChange={(event) => updateHomeList("liveHighlights", index, { [field]: event.target.value })} />
                  )}
                </label>
              ))}
              <label>Sort order<input type="number" value={item.sort_order || 1} onChange={(event) => updateHomeList("liveHighlights", index, { sort_order: Number(event.target.value) })} /></label>
            </div>
            <label>Image path<input value={item.image || ""} readOnly /></label>
            <label>Description<textarea rows={3} value={item.description || ""} onChange={(event) => updateHomeList("liveHighlights", index, { description: event.target.value })} /></label>
            <label>Impact notes<textarea rows={3} value={item.impact_notes || ""} onChange={(event) => updateHomeList("liveHighlights", index, { impact_notes: event.target.value })} /></label>
            <label className="checkbox-line"><input type="checkbox" checked={Boolean(item.published)} onChange={(event) => updateHomeList("liveHighlights", index, { published: event.target.checked })} /> Published</label>
            <button className="btn btn-primary" type="button" onClick={() => saveHomeItem("live-highlight", item.id, item)}>Save live highlight</button>
          </div>
        ))}
      </section>
      <section className="panel cms-home-editor">
        <h2>Sponsor company logos</h2>
        {homeContent.sponsorLogos.map((item, index) => (
          <div className="cms-home-row compact" key={item.slug}>
            <div className="form-grid">
              <label>Name<input value={item.name || ""} onChange={(event) => updateHomeList("sponsorLogos", index, { name: event.target.value })} /></label>
              <label>Image<input type="file" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) updateHomeList("sponsorLogos", index, { image: `/assets/${file.name}` });
              }} /></label>
              <label>Link<input value={item.link_url || ""} onChange={(event) => updateHomeList("sponsorLogos", index, { link_url: event.target.value })} /></label>
              <label>Sort order<input type="number" value={item.sort_order || 1} onChange={(event) => updateHomeList("sponsorLogos", index, { sort_order: Number(event.target.value) })} /></label>
            </div>
            <label>Image path<input value={item.image || ""} readOnly /></label>
            <label className="checkbox-line"><input type="checkbox" checked={Boolean(item.published)} onChange={(event) => updateHomeList("sponsorLogos", index, { published: event.target.checked })} /> Published</label>
            <button className="btn btn-primary" type="button" onClick={() => saveHomeItem("sponsor", item.slug, item)}>Save sponsor</button>
          </div>
        ))}
      </section>
    </div>
  );
}

export function AnnouncementManagerPanel({ role = "admin" }: { role?: "admin" | "manager" }) {
  const [items, setItems] = useState<AnnouncementRecord[]>(() => readAnnouncements());
  const [draft, setDraft] = useState<AnnouncementRecord>({
    id: "",
    title: "",
    description: "",
    image: "",
    dateFrom: "",
    dateTo: "",
    published: true,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setItems(readAnnouncements());
  }, []);

  function openDraft(item?: AnnouncementRecord) {
    if (item) {
      setDraft(item);
      setEditingId(item.id);
    } else {
      setDraft({
        id: "",
        title: "",
        description: "",
        image: "",
        dateFrom: "",
        dateTo: "",
        published: true,
      });
      setEditingId(null);
    }
    setIsOpen(true);
  }

  function saveDraft() {
    const next: AnnouncementRecord = {
      ...draft,
      id: draft.id || `announcement_${Date.now()}`,
      title: draft.title.trim() || "Tournament announcement",
      description: draft.description.trim() || "Tournament operations update.",
      image: draft.image.trim() || "/assets/poster.jpeg",
      published: draft.published,
      updatedBy: role,
      updatedAt: new Date().toISOString(),
    };
    const nextItems = [next, ...items.filter((item) => item.id !== editingId && item.id !== next.id)];
    setItems(nextItems);
    writeAnnouncements(nextItems);
    setIsOpen(false);
  }

  function toggleVisibility(id: string) {
    const nextItems = items.map((item) => item.id === id ? { ...item, published: !item.published, updatedAt: new Date().toISOString() } : item);
    setItems(nextItems);
    writeAnnouncements(nextItems);
  }

  function removeItem(id: string) {
    const nextItems = items.filter((item) => item.id !== id);
    setItems(nextItems);
    writeAnnouncements(nextItems);
  }

  return (
    <section className="panel admin-flow-panel">
      <div className="admin-list-head">
        <div>
          <span className="status emerald">Announcements</span>
          <h2>Announcement board</h2>
          <p>Create, publish, hide, edit, and delete tournament announcements.</p>
        </div>
        <button className="btn btn-primary" type="button" onClick={() => openDraft()}>
          <Plus size={16} />Add New Announcement
        </button>
      </div>
      {items.length === 0 ? (
        <div className="user-empty-state">
          <h2>No announcements yet</h2>
          <p>Use Add New Announcement to create the first entry.</p>
        </div>
      ) : (
        <div className="carousel-shell">
          <div className="carousel-row wheel-horizontal">
            {items.map((item) => (
              <article className="panel news-card" key={item.id}>
                <img src={item.image || "/assets/poster.jpeg"} alt="" className="news-card-media" style={{ width: "100%", height: 190, objectFit: "cover", borderRadius: 16 }} />
                <span className={`status ${item.published ? "emerald" : "slate"}`}>{item.published ? "Displayed" : "Hidden"}</span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                <div className="registration-actions compact-actions">
                  <button className="btn btn-secondary tiny-btn" type="button" onClick={() => toggleVisibility(item.id)}>
                    {item.published ? "Not display" : "Display"}
                  </button>
                  <button className="btn btn-secondary tiny-btn" type="button" onClick={() => openDraft(item)}>Edit</button>
                  <button className="btn btn-secondary tiny-btn" type="button" onClick={() => removeItem(item.id)}>Delete</button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
      {isOpen && (
        <div className="modal-backdrop" role="presentation">
          <section className="confirm-modal panel" role="dialog" aria-modal="true" aria-labelledby="announcement-title">
            <div className="modal-head">
              <div>
                <span className="status emerald">Announcement popup</span>
                <h2 id="announcement-title">{editingId ? "Edit announcement" : "Add new announcement"}</h2>
                <p>Title, description, and image are required. Date range is optional.</p>
              </div>
              <button className="icon-btn" type="button" aria-label="Close announcement popup" onClick={() => setIsOpen(false)}><X size={16} /></button>
            </div>
            <div className="form-grid">
              <label>Title<input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} /></label>
              <label>Image<input type="file" accept="image/*" onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) setDraft((current) => ({ ...current, image: `/assets/${file.name}` }));
              }} /></label>
              <label>Date from<input type="date" value={draft.dateFrom || ""} onChange={(event) => setDraft((current) => ({ ...current, dateFrom: event.target.value }))} /></label>
              <label>Date to<input type="date" value={draft.dateTo || ""} onChange={(event) => setDraft((current) => ({ ...current, dateTo: event.target.value }))} /></label>
            </div>
            <label>Selected image path<input value={draft.image} readOnly /></label>
            <label>Description<textarea value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} /></label>
            <label className="visibility-row">
              <span><b>Display announcement</b><small>Turn on to show this announcement on user pages.</small></span>
              <input type="checkbox" checked={draft.published} onChange={(event) => setDraft((current) => ({ ...current, published: event.target.checked }))} />
            </label>
            <div className="registration-actions compact-actions">
              <button className="btn btn-primary" type="button" onClick={saveDraft}>Save Announcement</button>
              <button className="btn btn-secondary" type="button" onClick={() => setIsOpen(false)}>Cancel</button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

export function AdminTournamentEditorPage() {
  const { slug } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const isNew = !slug;
  const featuredQuickStart = isNew && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("featured") === "1";
  const featuredCompleteMode = !isNew && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("complete") === "1";
  const [records, setRecords] = useState<Array<Record<string, any>>>([]);
  const [managers, setManagers] = useState<ManagerRow[]>([]);
  const [form, setForm] = useState<AdminTournamentForm>(() => adminFormFromTournament());
  const [savedTournament, setSavedTournament] = useState<Record<string, any> | null>(null);
  const [flowStage, setFlowStage] = useState<"form" | "workspace" | "news" | "announcement">("form");
  const [roundCount, setRoundCount] = useState(4);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([
      apiRequest<Array<Record<string, any>>>("/admin/tournaments", {}, token),
      apiRequest<ManagerRow[]>("/admin/managers", {}, token),
    ])
      .then(([tournamentRows, managerRows]) => {
        if (!alive) return;
        setRecords(tournamentRows);
        setManagers(managerRows);
        if (slug) {
          const existing = tournamentRows.find((item) => item.slug === slug);
          if (existing) {
            const loaded = adminFormFromTournament(existing);
            if (featuredCompleteMode && String(existing.status) === "Featured") {
              loaded.status = "Upcoming";
              loaded.showOnHome = false;
            }
            setForm(loaded);
            setSavedTournament(existing);
          }
        }
      })
      .catch((caught) => {
        if (alive) setError(caught instanceof Error ? caught.message : "Could not load tournament editor data.");
      });
    return () => { alive = false; };
  }, [slug, token]);

  function patchForm(patch: Partial<AdminTournamentForm>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function updateMoneyLine(index: number, patch: Partial<{ label: string; value: number }>) {
    patchForm({ feeBreakdown: form.feeBreakdown.map((line, i) => i === index ? { ...line, ...patch } : line) });
  }

  function updatePrizeLine(index: number, patch: Partial<{ position: number; label: string; amount: number }>) {
    patchForm({ prizes: form.prizes.map((line, i) => i === index ? { ...line, ...patch } : line) });
  }

  async function saveTournament() {
    setMessage("");
    setError("");
    const prizeTotal = form.prizes.reduce((total, line) => total + Number(line.amount || 0), 0);
    const cities = Array.from(new Set([form.location, ...form.cities].map((city) => city.trim()).filter(Boolean)));
    const payload = {
      slug: form.slug,
      name: form.name,
      sport: form.sport === "__new__" ? form.newSportName : form.sport,
      new_sport_name: form.sport === "__new__" ? form.newSportName : undefined,
      status: form.status,
      location: form.location,
      date: form.date,
      registration_start: form.registrationStart,
      registration_end: form.registrationEnd,
      teams: form.teams,
      capacity: form.capacity,
      team_size: form.maxTeamSize,
      min_team_size: form.minTeamSize,
      max_team_size: form.maxTeamSize,
      min_age: form.minAge,
      max_age: form.maxAge,
      prize: `INR ${prizeTotal.toLocaleString("en-IN")}`,
      image: form.image,
      poster: form.poster,
      accent: form.accent,
      address: form.address,
      sport_description: form.sportDescription,
      tournament_description: form.tournamentDescription,
      fee_breakdown: form.feeBreakdown.filter((line) => line.label.trim()),
      prizes: form.prizes,
      cities,
      show_on_home: form.showOnHome,
      assigned_manager_ids: form.assignedManagerIds,
      block_repeat_registration: form.blockRepeatRegistration,
    };
    try {
      const saved = await apiRequest<Record<string, any>>(
        isNew ? "/admin/tournaments" : `/admin/tournaments/${slug}`,
        { method: "POST", body: JSON.stringify(payload) }, 
        token,
      );
      setSavedTournament(saved);
      setForm(adminFormFromTournament(saved));
      setMessage(featuredQuickStart ? `${saved.name} saved.` : `${saved.name} saved. workspace update next.`);
      setFlowStage("workspace");
      if (isNew) window.history.replaceState(null, "", `/Smart_Sportz/admin/tournaments/${saved.slug}/edit`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save tournament.");
    }
  }

  const sportOptions = Array.from(new Set([...sports.map((sport) => sport.name), ...records.map((item) => item.sport).filter(Boolean)]));
  const cityOptions = Array.from(new Set(["Mumbai", "Bengaluru", "Mysuru", "Delhi", "Chennai", ...records.map((item) => item.location).filter(Boolean), ...form.cities]));
  const feeTotal = form.feeBreakdown.reduce((total, line) => total + Number(line.value || 0), 0);
  const prizeTotal = form.prizes.reduce((total, line) => total + Number(line.amount || 0), 0);

  return (
    <Page>
      <PortalShell title={isNew ? "Add New Tournament" : "Edit Tournament"} subtitle="" sidebar={sidebar} action={<Link className="btn btn-secondary" to="/admin/tournaments">All tournaments</Link>}>
        {message && <div className="form-alert success-alert">{message}</div>}
        {error && <div className="form-alert">{error}</div>}
        {flowStage === "form" ? (
          <section className="panel tournament-create-panel">
            {featuredQuickStart ? (
              <>
                <div className="form-grid">
                  <label>Title<input value={form.name} onChange={(event) => patchForm({ name: event.target.value })} placeholder="Featured tournament title" /></label>
                  <label>Image<input type="file" accept="image/*" onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) patchForm({ image: `/assets/${file.name}` });
                  }} /></label>
                  <label>Description<textarea value={form.tournamentDescription} onChange={(event) => patchForm({ tournamentDescription: event.target.value })} placeholder="Short featured tournament description" /></label>
                </div>
                <div className="registration-actions compact-actions">
                  <button className="btn btn-primary" type="button" onClick={saveTournament}>Save featured tournament</button>
                  <Link className="btn btn-secondary" to="/admin/tournaments">Cancel</Link>
                </div>
              </>
            ) : (
              <>
                <div className="form-grid">
                  <label>Tournament name<input value={form.name} onChange={(event) => patchForm({ name: event.target.value })} /></label>
                  <label>Sport<select value={form.sport} onChange={(event) => patchForm({ sport: event.target.value })}>{sportOptions.map((sport) => <option key={sport}>{sport}</option>)}<option value="__new__">Add new sport</option></select></label>
                  {form.sport === "__new__" && <label>New sport name<input value={form.newSportName} onChange={(event) => patchForm({ newSportName: event.target.value })} /></label>}
                  <label>Status<select value={form.status} onChange={(event) => patchForm({ status: event.target.value })}><option>Featured</option><option>Upcoming</option><option>Registration Open</option><option>Registration Closed</option><option>Live</option><option>Completed</option></select></label>
                  <label>Primary place<select value={form.location} onChange={(event) => patchForm({ location: event.target.value, cities: Array.from(new Set([...form.cities, event.target.value])) })}>{cityOptions.map((city) => <option key={city}>{city}</option>)}</select></label>
                  <label>Tournament date<input type="date" value={form.date} onChange={(event) => patchForm({ date: event.target.value })} /></label>
                  <label>Registration opens<input type="date" value={form.registrationStart} onChange={(event) => patchForm({ registrationStart: event.target.value })} /></label>
                  <label>Registration closes<input type="date" value={form.registrationEnd} onChange={(event) => patchForm({ registrationEnd: event.target.value })} /></label>
                  <label>Capacity<input type="number" value={form.capacity} onChange={(event) => patchForm({ capacity: Number(event.target.value) })} /></label>
                  <label>Min members<input type="number" value={form.minTeamSize} onChange={(event) => patchForm({ minTeamSize: Number(event.target.value) })} /></label>
                  <label>Max members<input type="number" value={form.maxTeamSize} onChange={(event) => patchForm({ maxTeamSize: Number(event.target.value) })} /></label>
                  <label>Min age<input type="number" value={form.minAge} onChange={(event) => patchForm({ minAge: Number(event.target.value) })} /></label>
                  <label>Max age<input type="number" value={form.maxAge} onChange={(event) => patchForm({ maxAge: Number(event.target.value) })} /></label>
                  <label>Tournament image<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) patchForm({ image: `/assets/${file.name}` }); }} /></label>
                  <label>Tournament poster<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) patchForm({ poster: `/assets/${file.name}` }); }} /></label>
                  <label>Manager allocation
                    <select multiple value={form.assignedManagerIds} onChange={(event) => patchForm({ assignedManagerIds: Array.from(event.target.selectedOptions).map((option) => option.value) })}>
                      {managers.map((manager) => <option value={manager.id} key={manager.id}>{manager.name} - {manager.email}</option>)}
                    </select>
                  </label>
                </div>
                <label>Selected image path<input value={form.image} readOnly /></label>
                <label>Selected poster path<input value={form.poster} readOnly /></label>
                <label>Full address<textarea value={form.address} onChange={(event) => patchForm({ address: event.target.value })} /></label>
                <div className="manager-form-split">
                  <section className="mini-table-card">
                    <div className="section-head-inline"><h3>Payment lines</h3><button type="button" onClick={() => patchForm({ feeBreakdown: [...form.feeBreakdown, { label: "Fee", value: 0 }] })}>Add</button></div>
                    {form.feeBreakdown.map((line, index) => <div className="money-row" key={index}><input value={line.label} onChange={(event) => updateMoneyLine(index, { label: event.target.value })} /><input type="number" value={line.value} onChange={(event) => updateMoneyLine(index, { value: Number(event.target.value) })} /></div>)}
                    <b>Total - {feeTotal.toLocaleString("en-IN")}</b>
                  </section>
                  <section className="mini-table-card">
                    <div className="section-head-inline"><h3>Prize money</h3><button type="button" onClick={() => patchForm({ prizes: [...form.prizes, { position: form.prizes.length + 1, label: `${form.prizes.length + 1}th Prize`, amount: 0 }] })}>Add</button></div>
                    {form.prizes.map((line, index) => <div className="money-row" key={index}><input type="number" value={line.position} onChange={(event) => updatePrizeLine(index, { position: Number(event.target.value) })} /><input value={line.label} onChange={(event) => updatePrizeLine(index, { label: event.target.value })} /><input type="number" value={line.amount} onChange={(event) => updatePrizeLine(index, { amount: Number(event.target.value) })} /></div>)}
                    <b>Total prize - {prizeTotal.toLocaleString("en-IN")}</b>
                  </section>
                </div>
                <div className="form-grid">
                  <label>Sport description<textarea value={form.sportDescription} onChange={(event) => patchForm({ sportDescription: event.target.value })} /></label>
                  <label>Tournament description<textarea value={form.tournamentDescription} onChange={(event) => patchForm({ tournamentDescription: event.target.value })} /></label>
                </div>
                <div className="admin-flow-checks">
                  <label className="visibility-row"><span><b>Add featured tournament</b><small>Show in featured row.</small></span><input type="checkbox" checked={form.showOnHome} onChange={(event) => patchForm({ showOnHome: event.target.checked })} /></label>
                  <label className="visibility-row"><span><b>Block repeat registration</b><small>On means same user cannot register this tournament again.</small></span><input type="checkbox" checked={form.blockRepeatRegistration} onChange={(event) => patchForm({ blockRepeatRegistration: event.target.checked })} /></label>
                </div>
                <div className="registration-actions compact-actions">
                  <button className="btn btn-primary" type="button" onClick={saveTournament}>{isNew ? "Create tournament" : "Save changes"}</button>
                  <Link className="btn btn-secondary" to="/admin/tournaments">Cancel</Link>
                </div>
              </>
            )}
          </section>
        ) : (
          <section className="panel admin-flow-panel">
            <span className="status emerald">Rounds Workspace</span>
            <h2>{savedTournament?.name ?? form.name}</h2>
            <div className="form-grid">
              <label>Rounds required<input type="number" min={1} max={12} value={roundCount} onChange={(event) => setRoundCount(Number(event.target.value))} /></label>
              <label>Workspace status<input value="Ready to save" readOnly /></label>
            </div>
            <div className="round-workspace-preview">
              {Array.from({ length: Math.max(1, roundCount) }).map((_, index) => <article key={index}><b>Round {index + 1}</b><span>{index === roundCount - 1 ? "Final / Champion path" : "Pairing slots"}</span></article>)}
            </div>
            <div className="registration-actions compact-actions">
              <button className="btn btn-primary" type="button" onClick={() => setMessage(`${roundCount} round workspace saved.`)}>Save Workspace</button>
              <Link className="btn btn-secondary" to={`/admin/tournaments/${savedTournament?.slug ?? slug}/bracket`}>Open Bracket</Link>
              <Link className="btn btn-secondary" to="/admin/cms">Confirm / Add News</Link>
            </div>
          </section>
        )}
      </PortalShell>
    </Page>
  );
}

function AdminTournamentPickerPanel({ mode }: { mode: "teams" | "payments" }) {
  if (mode === "teams") {
    return <AdminTeamsPanel />;
  }

  const { token } = useAuth();
  const [records, setRecords] = useState<Array<Record<string, any>>>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    apiRequest<Array<Record<string, any>>>("/admin/tournaments", {}, token)
      .then(setRecords)
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load tournaments."));
  }, [token]);

  return (
    <>
      {error && <div className="form-alert">{error}</div>}
      <section className="panel admin-list-head">
        <div>
          <span className="status emerald">Payment Records</span>
          <h2>Select tournament</h2>
          <p>Open a tournament to view total payments, team payments, receipts, and payment status.</p>
        </div>
      </section>
      <div className="manager-tournament-row">
        {records.map((item) => (
          <article className="manager-tournament-card" key={item.slug}>
            <div className="manager-tournament-image">
              <img src={item.image || "/assets/cricket-stadium.png"} alt="" onError={(event) => { event.currentTarget.src = "/assets/cricket-stadium.png"; }} />
            </div>
            <div>
              <span className={`status ${item.accent ?? "emerald"}`}>{item.status}</span>
              <h4>{item.name}</h4>
              <p><MapPin size={14} />{item.sport} - {item.location}</p>
              <small>{item.teams}/{item.capacity} teams</small>
            </div>
            <div className="manager-card-actions">
              <Link to={`/admin/payments/tournament/${item.slug}`}>Open</Link>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

type AdminTeamRow = {
  id: string;
  team_name: string;
  tournament_name: string;
  tournament_slug: string;
  sport: string;
  city: string;
  captain_name: string;
  user_email?: string;
  payment_status: string;
  status: string;
  players_count: number;
  latest_payment: number;
  team_logo?: string;
};

function AdminTeamsPanel() {
  const { token } = useAuth();
  const [teams, setTeams] = useState<AdminTeamRow[]>([]);
  const [deleteCandidate, setDeleteCandidate] = useState<AdminTeamRow | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadTeams() {
    setError("");
    try {
      setTeams(await apiRequest<AdminTeamRow[]>("/admin/teams", {}, token));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load teams from database.");
    }
  }

  useEffect(() => {
    loadTeams();
  }, [token]);

  async function deleteTeam() {
    if (!deleteCandidate) return;
    try {
      await apiRequest(`/admin/teams/${deleteCandidate.id}/delete`, { method: "POST" }, token);
      setTeams((current) => current.filter((item) => item.id !== deleteCandidate.id));
      setMessage(`${deleteCandidate.team_name} deleted.`);
      setDeleteCandidate(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete team.");
    }
  }

  return (
    <>
      {message && <div className="form-alert success-alert">{message}</div>}
      {error && <div className="form-alert">{error}</div>}
      <section className="panel admin-list-head">
        <div>
          <span className="status emerald">Team Records</span>
          <h2>Registered teams</h2>
          <p>Open, edit, or delete database-backed team registrations without mixing data between tournaments.</p>
        </div>
      </section>
      <DataTable
        columns={["Team Name", "Tournament", "Captain", "City", "Players", "Payment", "Status", "Actions"]}
        rows={teams.map((team) => [
          <span><b>{team.team_name}</b><small style={{ display: 'block', opacity: 0.7 }}>{team.user_email || team.sport}</small></span>,
          team.tournament_name,
          team.captain_name,
          team.city,
          team.players_count,
          <span className={`status ${team.payment_status === "paid" ? "emerald" : "orange"}`}>{team.payment_status}</span>,
          team.status,
          <span className="table-action-group">
            <Link className="inline-link" to={`/admin/teams/registrations/${team.id}`}>Open</Link>
            <Link className="inline-link" to={`/admin/teams/${team.id}/edit`}>Edit</Link>
            <button className="link-button danger-link" type="button" onClick={() => setDeleteCandidate(team)}>Delete</button>
          </span>,
        ])}
      />
      {deleteCandidate && (
        <div className="modal-backdrop" role="presentation">
          <section className="panel confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-team-title">
            <h3 id="delete-team-title">Delete team?</h3>
            <p>This will remove {deleteCandidate.team_name}, its members, documents, and payment records from this tournament registration.</p>
            <div className="form-actions">
              <button className="btn btn-secondary" type="button" onClick={() => setDeleteCandidate(null)}>Cancel</button>
              <button className="btn btn-primary danger-button" type="button" onClick={deleteTeam}>Delete</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

export function AdminTournamentTeamsPage() {
  const { slug } = useParams();
  const { token } = useAuth();
  const [data, setData] = useState<{ tournament: Record<string, any>; teams: Array<Record<string, any>> } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!slug) return;
    setError("");
    apiRequest<{ tournament: Record<string, any>; teams: Array<Record<string, any>> }>(`/admin/tournaments/${slug}/teams`, {}, token)
      .then(setData)
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load tournament teams."));
  }, [slug, token]);

  return (
    <Page>
      <PortalShell title={data?.tournament.name ?? "Tournament Teams"} subtitle="Registered teams for the selected tournament." sidebar={sidebar} action={<Link className="btn btn-secondary" to="/admin/teams">All team tournaments</Link>}>
        {error && <div className="form-alert">{error}</div>}
        {!data ? <section className="panel user-empty-state"><h2>Loading teams</h2><p>Fetching tournament registrations.</p></section> : (
          <>
            <div className="mini-grid">
              <Metric label="Registered Teams" value={String(data.teams.length)} />
              <Metric label="Sport" value={data.tournament.sport} />
              <Metric label="City" value={data.tournament.location} />
            </div>
            <DataTable
              columns={["Team", "Captain", "Players", "Payment", "Status", "Action"]}
              rows={data.teams.map((team) => [
                team.team_name,
                team.captain_name,
                team.players_count,
                <span className={`status ${team.payment_status === "paid" ? "emerald" : "orange"}`}>{team.payment_status}</span>,
                team.status,
                <Link className="inline-link" to={`/admin/teams/registrations/${team.id}`}>Open</Link>,
              ])}
            />
          </>
        )}
      </PortalShell>
    </Page>
  );
}

export function AdminRegistrationTeamDetailPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const [data, setData] = useState<{ registration: Record<string, any>; players: Array<Record<string, any>>; documents: Array<Record<string, any>>; payments: Array<Record<string, any>> } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    setError("");
    apiRequest<{ registration: Record<string, any>; players: Array<Record<string, any>>; documents: Array<Record<string, any>>; payments: Array<Record<string, any>> }>(`/admin/registrations/${id}/team-detail`, {}, token)
      .then(setData)
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load team detail."));
  }, [id, token]);

  const registration = data?.registration;

  return (
    <Page>
      <PortalShell title={registration?.team_name ?? "Team Detail"} subtitle="Team registration, player list, payment, and document records." sidebar={sidebar} action={<Link className="btn btn-secondary" to={registration ? `/admin/teams/tournament/${registration.tournament_slug}` : "/admin/teams"}>Back</Link>}>
        {error && <div className="form-alert">{error}</div>}
        {!data || !registration ? <section className="panel user-empty-state"><h2>Loading team</h2><p>Fetching team details.</p></section> : (
          <>
            <section className="panel review-summary">
              <span className={`status ${registration.payment_status === "paid" ? "emerald" : "orange"}`}>{registration.payment_status}</span>
              <h2>{registration.team_name}</h2>
              <div className="review-list">
                <p><b>Tournament</b><span>{registration.tournament_name}</span></p>
                <p><b>Captain</b><span>{registration.captain_name}</span></p>
                <p><b>Sub-captain</b><span>{registration.sub_captain_name || "-"}</span></p>
                <p><b>Coach</b><span>{registration.coach_name || "-"}</span></p>
                <p><b>User Login</b><span>{registration.user_email || registration.email}</span></p>
                <p><b>City</b><span>{registration.city}</span></p>
                <p><b>Status</b><span>{registration.status}</span></p>
              </div>
            </section>
            <DataTable columns={["Player", "Role", "Jersey", "Contact"]} rows={data.players.map((player) => [player.name, player.role, player.jersey || "-", player.contact || "-"])} />
            <DataTable columns={["Payment", "Amount", "Method", "Status"]} rows={data.payments.map((payment) => [payment.receipt_number, formatAdminMoney(payment.amount), payment.method, payment.status])} />
            <DataTable columns={["Document", "File", "Status", "Uploaded"]} rows={data.documents.map((document) => [document.document_type, document.file_name, document.status, document.uploaded_at])} />
          </>
        )}
      </PortalShell>
    </Page>
  );
}

export function AdminTeamEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [form, setForm] = useState({
    team_name: "",
    captain_name: "",
    sub_captain_name: "",
    coach_name: "",
    email: "",
    phone: "",
    city: "",
    team_logo: "",
    team_motto: "",
  });
  const [registration, setRegistration] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!id) return;
    setError("");
    apiRequest<{ registration: Record<string, any>; players: Array<Record<string, any>>; documents: Array<Record<string, any>>; payments: Array<Record<string, any>> }>(`/admin/registrations/${id}/team-detail`, {}, token)
      .then((payload) => {
        const item = payload.registration;
        setRegistration(item);
        setForm({
          team_name: item.team_name || "",
          captain_name: item.captain_name || "",
          sub_captain_name: item.sub_captain_name || "",
          coach_name: item.coach_name || "",
          email: item.email || item.user_email || "",
          phone: item.phone || "",
          city: item.city || "",
          team_logo: item.team_logo || "",
          team_motto: item.team_motto || "",
        });
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load team."));
  }, [id, token]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id) return;
    setError("");
    setMessage("");
    try {
      await apiRequest(`/admin/teams/${id}`, { method: "POST", body: JSON.stringify(form) }, token);
      setMessage("Team updated successfully.");
      setTimeout(() => navigate(`/admin/teams/registrations/${id}`), 500);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update team.");
    }
  }

  return (
    <Page>
      <PortalShell title={registration?.team_name ? `Edit ${registration.team_name}` : "Edit Team"} subtitle="Update tournament-specific team registration details." sidebar={sidebar} action={<Link className="btn btn-secondary" to={id ? `/admin/teams/registrations/${id}` : "/admin/teams"}>Back</Link>}>
        {message && <div className="form-alert success-alert">{message}</div>}
        {error && <div className="form-alert">{error}</div>}
        <form className="panel admin-edit-form" onSubmit={submit}>
          <div className="form-grid">
            <label>Team name<input value={form.team_name} onChange={(event) => setForm({ ...form, team_name: event.target.value })} required /></label>
            <label>Captain name<input value={form.captain_name} onChange={(event) => setForm({ ...form, captain_name: event.target.value })} required /></label>
            <label>Sub-captain name<input value={form.sub_captain_name} onChange={(event) => setForm({ ...form, sub_captain_name: event.target.value })} /></label>
            <label>Coach name<input value={form.coach_name} onChange={(event) => setForm({ ...form, coach_name: event.target.value })} /></label>
            <label>Email<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></label>
            <label>Phone<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
            <label>City<input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} required /></label>
            <label>Team logo URL<input value={form.team_logo} onChange={(event) => setForm({ ...form, team_logo: event.target.value })} placeholder="/assets/logo.png" /></label>
          </div>
          <label>Team motto<textarea value={form.team_motto} onChange={(event) => setForm({ ...form, team_motto: event.target.value })} rows={3} /></label>
          <div className="form-actions">
            <Link className="btn btn-secondary" to={id ? `/admin/teams/registrations/${id}` : "/admin/teams"}>Cancel</Link>
            <button className="btn btn-primary" type="submit">Save changes</button>
          </div>
        </form>
      </PortalShell>
    </Page>
  );
}

export function AdminTournamentPaymentsPage() {
  const { slug } = useParams();
  const { token } = useAuth();
  const [data, setData] = useState<{ tournament: Record<string, any>; summary: Record<string, number>; payments: Array<Record<string, any>> } | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [actionPayment, setActionPayment] = useState<Record<string, any> | null>(null);
  const [actionType, setActionType] = useState<"refund" | "cancel">("refund");
  const [actionForm, setActionForm] = useState({ destination: "", reference: "", note: "" });
  const [actionMessage, setActionMessage] = useState("");

  useEffect(() => {
    if (!slug) return;
    setError("");
    apiRequest<{ tournament: Record<string, any>; summary: Record<string, number>; payments: Array<Record<string, any>> }>(`/admin/tournaments/${slug}/payments`, {}, token)
      .then(setData)
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load tournament payments."));
  }, [slug, token]);

  const statusOptions = Array.from(new Set((data?.payments ?? []).map((payment) => String(payment.status || "pending"))));
  const methodOptions = Array.from(new Set((data?.payments ?? []).map((payment) => String(payment.method || "unknown"))));
  const filteredPayments = (data?.payments ?? []).filter((payment) => {
    const haystack = [payment.team_name, payment.captain_name, payment.receipt_number, payment.method, payment.status, payment.city].join(" ").toLowerCase();
    const matchesSearch = !search.trim() || haystack.includes(search.trim().toLowerCase());
    const matchesStatus = statusFilter === "all" || payment.status === statusFilter;
    const matchesMethod = methodFilter === "all" || payment.method === methodFilter;
    return matchesSearch && matchesStatus && matchesMethod;
  });

  function openPaymentAction(payment: Record<string, any>, type: "refund" | "cancel") {
    setActionPayment(payment);
    setActionType(type);
    setActionMessage("");
    setActionForm({
      destination: payment.method === "upi" ? String(payment.upi_id || "") : String(payment.card_reference || ""),
      reference: "",
      note: "",
    });
  }

  async function submitPaymentAction() {
    if (!actionPayment) return;
    setActionMessage("");
    try {
      const updated = await apiRequest<{ tournament: Record<string, any>; summary: Record<string, number>; payments: Array<Record<string, any>> }>(
        `/admin/payments/${actionPayment.id}/${actionType}`,
        {
          method: "POST",
          body: JSON.stringify({
            refund_destination: actionForm.destination,
            refund_reference: actionForm.reference,
            note: actionForm.note,
          }),
        },
        token,
      );
      setData(updated);
      setActionPayment(null);
    } catch (caught) {
      setActionMessage(caught instanceof Error ? caught.message : "Payment action failed.");
    }
  }

  return (
    <Page>
      <PortalShell title={data?.tournament.name ?? "Tournament Payments"} subtitle="Payment totals and team payment records." sidebar={sidebar} action={<Link className="btn btn-secondary" to="/admin/payments">All tournaments</Link>}>
        {error && <div className="form-alert">{error}</div>}
        {!data ? <section className="panel user-empty-state"><h2>Loading payments</h2><p>Fetching records.</p></section> : (
          <>
            <div className="mini-grid admin-payment-metrics">
              <Metric label="Total Paid" value={formatAdminMoney(data.summary.total ?? 0)} />
              <Metric label="Paid Payments" value={String(data.summary.paidPayments ?? 0)} />
              <Metric label="Team Records" value={String(data.summary.teams ?? 0)} />
              <Metric label="Pending Payments" value={String(data.summary.pendingPayments ?? 0)} />
            </div>
            <section className="panel admin-payment-tools">
              <label>Search<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search..." /></label>
              <label>Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option>{statusOptions.map((status) => <option value={status} key={status}>{status}</option>)}</select></label>
              <label>Method<select value={methodFilter} onChange={(event) => setMethodFilter(event.target.value)}><option value="all">All methods</option>{methodOptions.map((method) => <option value={method} key={method}>{method}</option>)}</select></label>
            </section>
            <DataTable
              columns={["Team", "Captain", "Receipt", "Amount", "Method", "Status", "Action"]}
              rows={filteredPayments.map((payment) => [
                payment.team_name,
                payment.captain_name,
                payment.receipt_number,
                formatAdminMoney(payment.amount),
                payment.method,
                <span className={`status ${payment.status === "paid" ? "emerald" : payment.status === "cancelled" ? "pink" : "orange"}`}>{payment.status}</span>,
                <button className="btn btn-secondary tiny-btn" type="button" onClick={() => openPaymentAction(payment, "refund")}>Set</button>,
              ])}
            />
            {actionPayment && (
              <div className="rules-modal-backdrop">
                <article className="rules-modal payment-action-modal">
                  <button className="rules-modal-close" type="button" onClick={() => setActionPayment(null)}>x</button>
                  <p className="eyebrow">Payment Action</p>
                  <h2>{actionPayment.team_name}</h2>
                  <div className="payment-action-tabs">
                    <button className={actionType === "refund" ? "active" : ""} type="button" onClick={() => setActionType("refund")}>Refund</button>
                    <button className={actionType === "cancel" ? "active" : ""} type="button" onClick={() => setActionType("cancel")}>Cancel</button>
                  </div>
                  <div className="form-grid">
                    {actionType === "refund" && (
                      <>
                        <label>Receiver Info<input value={actionForm.destination} onChange={(event) => setActionForm((current) => ({ ...current, destination: event.target.value }))} /></label>
                        <label>Reference<input value={actionForm.reference} onChange={(event) => setActionForm((current) => ({ ...current, reference: event.target.value }))} /></label>
                      </>
                    )}
                    <label>Admin note<textarea value={actionForm.note} onChange={(event) => setActionForm((current) => ({ ...current, note: event.target.value }))} /></label>
                  </div>
                  <div className="registration-actions compact-actions">
                    <button className="btn btn-primary" type="button" onClick={submitPaymentAction}>{actionType === "refund" ? "Record Refund" : "Cancel Payment"}</button>
                  </div>
                </article>
              </div>
            )}
          </>
        )}
      </PortalShell>
    </Page>
  );
}

function AdminUsersPanel() {
  const { token } = useAuth();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [deleteCandidate, setDeleteCandidate] = useState<AdminUserRow | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadUsers() {
    setError("");
    try {
      setUsers(await apiRequest<AdminUserRow[]>("/admin/users", {}, token));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load users.");
    }
  }

  useEffect(() => { loadUsers(); }, [token]);

  async function deleteUser() {
    if (!deleteCandidate) return;
    try {
      await apiRequest(`/admin/users/${deleteCandidate.id}/delete`, { method: "POST" }, token);
      setUsers((current) => current.filter((item) => item.id !== deleteCandidate.id));
      setMessage(`${deleteCandidate.name} deleted.`);
      setDeleteCandidate(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete user.");
    }
  }

  return (
    <>
      {message && <div className="form-alert success-alert">{message}</div>}
      {error && <div className="form-alert">{error}</div>}
      <section className="panel admin-list-head">
        <div><span className="status emerald">Login Users</span><h2>Participant accounts</h2></div>
        <Link className="btn btn-primary" to="/admin/users/add">Add User</Link>
      </section>
      <DataTable
        columns={["User", "Email", "Phone", "Registrations", "Payments", "Created", "Action"]}
        rows={users.map((user) => [
          user.name, user.email, user.phone || "-", user.registrations_count ?? 0, user.payments_count ?? 0,
          user.created_at ? new Date(user.created_at).toLocaleDateString() : "-",
          <span className="table-actions"><Link to={`/admin/users/${user.id}`}>Open</Link><button type="button" onClick={() => setDeleteCandidate(user)}>Delete</button></span>,
        ])}
      />
      {deleteCandidate && (
        <div className="modal-backdrop">
          <section className="confirm-modal panel">
            <h2>Delete user?</h2>
            <div className="registration-actions compact-actions">
              <button className="btn btn-primary" type="button" onClick={deleteUser}>Confirm delete</button>
              <button className="btn btn-secondary" type="button" onClick={() => setDeleteCandidate(null)}>Cancel</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

export function AdminUserCreatePage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "user123" });
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const created = await apiRequest<AdminUserDetailData>("/admin/users", { method: "POST", body: JSON.stringify(form) }, token);
      navigate(`/admin/users/${created.user.id}`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not create user."); }
  }

  return (
    <Page>
      <PortalShell title="Add User" sidebar={sidebar} action={<Link className="btn btn-secondary" to="/admin/users">All users</Link>}>
        {error && <div className="form-alert">{error}</div>}
        <form className="panel form-grid" onSubmit={submit}>
          <label>Name<input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label>
          <label>Email<input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} /></label>
          <label>Phone<input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} /></label>
          <label>Temporary password<input value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} /></label>
          <button className="btn btn-primary" type="submit">Create User</button>
        </form>
      </PortalShell>
    </Page>
  );
}

export function AdminUserDetailPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<AdminUserDetailData | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadUser() {
    if (!id) return;
    setError("");
    try {
      const payload = await apiRequest<AdminUserDetailData>(`/admin/users/${id}`, {}, token);
      setData(payload);
      setForm({ name: payload.user.name, email: payload.user.email, phone: payload.user.phone || "", password: "" });
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load user."); }
  }

  useEffect(() => { loadUser(); }, [id, token]);

  async function saveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id) return;
    setMessage("");
    setError("");
    try {
      const payload = { name: form.name, email: form.email, phone: form.phone, ...(form.password ? { password: form.password } : {}) };
      const updated = await apiRequest<AdminUserDetailData>(`/admin/users/${id}`, { method: "POST", body: JSON.stringify(payload) }, token);
      setData(updated);
      setForm({ name: updated.user.name, email: updated.user.email, phone: updated.user.phone || "", password: "" });
      setMessage("User updated.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not update user."); }
  }

  async function deleteUser() {
    if (!id) return;
    await apiRequest(`/admin/users/${id}/delete`, { method: "POST" }, token);
    navigate("/admin/users");
  }

  return (
    <Page>
      <PortalShell title={data?.user.name ?? "User Detail"} sidebar={sidebar} action={<Link className="btn btn-secondary" to="/admin/users">All users</Link>}>
        {message && <div className="form-alert success-alert">{message}</div>}
        {error && <div className="form-alert">{error}</div>}
        {!data ? <section className="panel user-empty-state"><h2>Loading user</h2></section> : (
          <>
            <form className="panel form-grid" onSubmit={saveUser}>
              <label>Name<input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label>
              <label>Email<input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} /></label>
              <label>Phone<input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} /></label>
              <label>New password<input value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} /></label>
              <button className="btn btn-primary" type="submit">Save User</button>
              <button className="btn btn-secondary" type="button" onClick={() => setDeleteOpen(true)}>Delete User</button>
            </form>
            <OptionalDataTable title="Registration" columns={["Tournament", "Team", "City", "Payment", "Status"]} rows={data.registrations.map((item) => [item.tournament_name, item.team_name, item.city, item.payment_status, item.status])} />
            <OptionalDataTable title="Payment" columns={["Receipt", "Amount", "Method", "Status"]} rows={data.payments.map((item) => [item.receipt_number, item.amount, item.method, item.status])} />
          </>
        )}
      </PortalShell>
    </Page>
  );
}

function ManagerManagementPanel() {
  const { token } = useAuth();
  const [managers, setManagers] = useState<ManagerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [deleteCandidate, setDeleteCandidate] = useState<ManagerRow | null>(null);

  async function loadManagers() {
    setLoading(true);
    setError("");
    try {
      const rows = await apiRequest<ManagerRow[]>("/admin/managers", {}, token);
      setManagers(rows);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load manager records."); } finally { setLoading(false); }
  }

  useEffect(() => { loadManagers(); }, [token]);

  async function deleteManager() {
    if (!deleteCandidate) return;
    try {
      await apiRequest(`/admin/managers/${deleteCandidate.id}/delete`, { method: "POST" }, token);
      setManagers((current) => current.filter((item) => item.id !== deleteCandidate.id));
      setMessage(`${deleteCandidate.name} deleted.`);
      setDeleteCandidate(null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to delete manager."); }
  }

  return (
    <div className="manager-news-layout">
      <section className="panel admin-list-head">
        <div><span className="status emerald">Manager Management</span><h2>Managers</h2></div>
        <Link className="btn btn-primary" to="/admin/managers/new">Add New Manager</Link>
      </section>
      <DataTable
        columns={["Manager", "Email", "Allocated Cities", "Created", "Action"]}
        rows={managers.map((manager) => [
          manager.name, manager.email, manager.cities.join(", "),
          manager.created_at ? new Date(manager.created_at).toLocaleDateString() : "Created",
          <span className="table-actions"><Link to={`/admin/managers/${manager.id}`}>Open</Link><button type="button" onClick={() => setDeleteCandidate(manager)}>Delete</button></span>,
        ])}
      />
    </div>
  );
}

export function AdminManagerCreatePage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [places, setPlaces] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [selectedPlace, setSelectedPlace] = useState("");
  const [newPlace, setNewPlace] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "manager123", cities: [] as string[] });

  useEffect(() => { apiRequest<string[]>("/admin/places", {}, token).then(setPlaces).catch(() => setPlaces([])); }, [token]);

  async function createManager(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim() || !form.email.trim() || form.cities.length === 0) { setError("Fill required fields."); return; }
    try {
      const created = await apiRequest<ManagerRow>("/admin/managers", { method: "POST", body: JSON.stringify(form) }, token);
      navigate(`/admin/managers/${created.id}`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to create manager."); }
  }

  return (
    <Page>
      <PortalShell title="Add Manager" sidebar={sidebar} action={<Link className="btn btn-secondary" to="/admin/managers">All managers</Link>}>
        <section className="panel tournament-create-panel">
          <form className="form-grid" onSubmit={createManager}>
            <label>Name<input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label>
            <label>Email<input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} /></label>
            <label>Allocate place
              <select value={selectedPlace} onChange={(e) => { 
                const v = e.target.value; 
                if(v && v !== "__new__") setForm(f => ({...f, cities: Array.from(new Set([...f.cities, v]))})); 
                setSelectedPlace(v); 
              }}>
                <option value="">Select place</option>
                {places.map(p => <option key={p} value={p}>{p}</option>)}
                <option value="__new__">Add new place</option>
              </select>
            </label>
            <div className="selected-place-list">{form.cities.map(c => <button type="button" key={c} onClick={() => setForm(f => ({...f, cities: f.cities.filter(i => i !== c)}))}>{c} x</button>)}</div>
            <button className="btn btn-primary" type="submit">Create manager</button>
          </form>
        </section>
      </PortalShell>
    </Page>
  );
}

export function AdminManagerDetailPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [manager, setManager] = useState<(ManagerRow & { assigned_tournaments?: Array<Record<string, any>> }) | null>(null);
  const [places, setPlaces] = useState<string[]>([]);
  const [form, setForm] = useState({ name: "", email: "", password: "", cities: [] as string[] });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    Promise.all([
      apiRequest<ManagerRow & { assigned_tournaments?: Array<Record<string, any>> }>(`/admin/managers/${id}`, {}, token),
      apiRequest<string[]>("/admin/places", {}, token),
    ]).then(([m, p]) => {
      setManager(m); setPlaces(p); setForm({ name: m.name, email: m.email, password: "", cities: m.cities });
    }).catch(() => setError("Load error"));
  }, [id, token]);

  async function saveManager(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const updated = await apiRequest<ManagerRow>(`/admin/managers/${id}`, { method: "POST", body: JSON.stringify(form) }, token);
      setMessage("Updated.");
    } catch (caught) { setError("Save error"); }
  }

  return (
    <Page>
      <PortalShell title={manager?.name ?? "Manager Detail"} sidebar={sidebar} action={<Link className="btn btn-secondary" to="/admin/managers">All managers</Link>}>
        {message && <div className="form-alert success-alert">{message}</div>}
        <form className="panel form-grid" onSubmit={saveManager}>
          <label>Name<input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label>
          <label>Email<input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} /></label>
          <button className="btn btn-primary" type="submit">Save Manager</button>
        </form>
      </PortalShell>
    </Page>
  );
}

export function AdminPage({ section = "dashboard" }: { section?: string }) {
  const title = section === "dashboard" ? "" : section.replace("-", " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <Page>
      <PortalShell title={title} sidebar={sidebar} action={<span className="status emerald">System optimal</span>}>
        {section === "dashboard" && <AdminDashboardDbPanel />}
        {section === "tournaments" && <AdminTournamentsDbPanel />}
        {section === "users" && <AdminUsersPanel />}
        {section === "managers" && <ManagerManagementPanel />}
        {section === "roles" && (
          <DataTable
            columns={["Role", "Programs", "Core Permissions", "Security Rule"]}
            rows={[
              ["Super Admin", "8", "Full access", "Full platform audit"],
              ["Management User", "7", "Assigned tournaments", "Tournament scoped"],
              ["Team / Participant", "7", "Own records", "Own data only"],
            ]}
          />
        )}
        {section === "teams" && <AdminTournamentPickerPanel mode="teams" />}
        {section === "players" && <AthleteProfile />}
        {section === "payments" && <AdminTournamentPickerPanel mode="payments" />}
        {section === "cms" && <AdminCmsDbPanel />}
        {section === "announcements" && <AnnouncementManagerPanel role="admin" />}
        {section === "reports" && <ListPanel title="Reports Center" items={reports} to="/admin/reports/detail" />}
        {section === "logs" && <ListPanel title="Audit Logs" items={logRows} to="/admin/logs/detail" />}
        {section === "settings" && <ListPanel title="System Settings" items={["RBAC policy", "Password policy"]} to="/settings" />}
      </PortalShell>
    </Page>
  );
}
