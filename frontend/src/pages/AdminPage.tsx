import { Bell, CheckCircle2, ImagePlus, Plus, X, FileText, MapPin, Search } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import type React from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { DataTable, Page, PortalShell } from "../components/UI";
import { logRows, paymentRows, reports, sidebar, sports, teams, tournaments } from "../data/platform";
import type { TournamentNotice } from "../data/platform";
import { apiRequest, uploadFile } from "../lib/api";
import { AthleteProfile, ListPanel, Metric } from "./shared";
import { RichTextToolbarPreview } from "./NewsPages";

type IconProps = {
  size?: number;
  className?: string;
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function EditIcon({ size = 14, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function ViewIcon({ size = 14, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M2.1 12a10 10 0 0 1 19.8 0 10 10 0 0 1-19.8 0" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function HideIcon({ size = 14, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6A2 2 0 0 0 12 16a2 2 0 0 0 1.4-.6" />
      <path d="M9.9 4.2A10.4 10.4 0 0 1 12 4c5.5 0 9.5 4.8 10.7 8-0.4 1.1-1.2 2.6-2.5 4.1" />
      <path d="M6.1 6.1C3.8 7.7 2.6 10 1.3 12c1.4 2.1 5.4 7 10.7 7 .9 0 1.8-.1 2.6-.3" />
    </svg>
  );
}

function DeleteIcon({ size = 14, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M6 6l1 14h10l1-14" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}


const noticeStorageKey = "smart-sportz-tournament-notices";

// Define missing data structures
const AdminNews = {
  posts: [
    { slug: "news-1", title: "Cricket Tournament 2026", category: "Tournament Updates", city: "Mumbai", image: "/assets/news1.jpg", status: "published" },
    { slug: "news-2", title: "Football Championship", category: "Match Updates", city: "Bengaluru", image: "/assets/news2.jpg", status: "draft" },
  ],
  sports: [
    { sportSlug: "cricket", showOnHome: true, sortOrder: 1 },
    { sportSlug: "football", showOnHome: true, sortOrder: 2 },
  ]
};

const sportHomeVisibility = [
  { sportSlug: "cricket", showOnHome: true, sortOrder: 1 },
  { sportSlug: "football", showOnHome: true, sortOrder: 2 },
];

const newsPosts = AdminNews.posts;
const assignedCities = ["Mumbai", "Bengaluru", "Mysuru"];
const assignedTournaments = tournaments.slice(0, 3);

// Updated AnnouncementRecord to match backend schema
type AnnouncementRecord = {
  id: string;
  title: string;
  description: string;
  image: string;
  date_from?: string;
  date_to?: string;
  published: boolean;
  created_by?: string;
  created_by_name?: string;
  created_by_email?: string;
  city?: string;
  created_at?: string;
  updated_at?: string;
};

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
          if (file) void fileToDataUrl(file).then(setImage);
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
  temporary_password?: string;
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
  rulesPdf: string;
  rulesText: string;
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
  rulesPdf: "",
  rulesText: "",
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
  const trimmed = String(value).trim();
  if (!trimmed || trimmed.toUpperCase() === "TBA") return "";
  const dmy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return `${dmy[1].padStart(2, "0")}/${dmy[2].padStart(2, "0")}/${dmy[3]}`;
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return trimmed;
  return `${String(parsed.getDate()).padStart(2, "0")}/${String(parsed.getMonth() + 1).padStart(2, "0")}/${parsed.getFullYear()}`;
}

function parseJsonArray(value: unknown) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function slotSummary(item: Record<string, any>) {
  const filled = Number(item.registered_count ?? item.filled_slots ?? 0);
  const capacity = Number(item.capacity ?? 0);
  return capacity ? `${filled} / ${capacity}` : String(filled);
}

function adminFormFromTournament(item?: Record<string, any>): AdminTournamentForm {
  if (!item) return { ...emptyAdminTournamentForm, feeBreakdown: [...emptyAdminTournamentForm.feeBreakdown], prizes: [...emptyAdminTournamentForm.prizes], cities: [...emptyAdminTournamentForm.cities], assignedManagerIds: [] };
  const prizeRows = Array.isArray(item.prizes) ? item.prizes : parseJsonArray(item.prizes);
  const feeRows = Array.isArray(item.fee_breakdown) ? item.fee_breakdown : parseJsonArray(item.fee_breakdown_json);
  const prizes = prizeRows.length
    ? prizeRows.map((line: any) => ({ position: Number(line.position), label: line.label, amount: Number(line.amount) }))
    : [...emptyAdminTournamentForm.prizes];
  const feeBreakdown = feeRows.length
    ? feeRows.map((line: any) => ({ label: line.label ?? "Fee", value: Number(line.value ?? 0) }))
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
    rulesPdf: item.rules_pdf ?? "",
    rulesText: item.rules_text ?? "",
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

  const openRegistrationRows = tournamentRows.filter((item) => item.status === "Registration Open");

  return (
    <>
      <div className="mini-grid admin-metrics-grid">
        <Metric label="DB Tournaments" value={String(data.tournaments)} />
        <Metric label="DB Teams" value={String(data.teams)} />
        <Metric label="Registrations" value={String(data.registrations)} />
        <Metric label="Live Matches" value={String(data.liveMatches)} />
      </div>
      <section className="panel">
        <div className="section-head-inline">
          <h2>Open registration slots</h2>
          <span>{openRegistrationRows.length} open</span>
        </div>
        {openRegistrationRows.length ? (
          <DataTable
            columns={["Tournament", "Filled slots", "Registration closes"]}
            rows={openRegistrationRows.map((item) => [
              item.name,
              slotSummary(item),
              formatDateInput(item.registration_end) || "-",
            ])}
          />
        ) : <p className="empty-line">No open registration tournaments.</p>}
      </section>
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
      status: form.status === "Featured" ? "Upcoming" : form.status,
      location: form.location || "Mumbai",
      date: form.date || "TBA",
      registration_start: form.registrationStart || "TBA",
      registration_end: form.registrationEnd || "TBA",
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
      rules_pdf: form.rulesPdf,
      rules_text: form.rulesText,
      fee_breakdown: form.feeBreakdown.filter((line) => line.label.trim()),
      prizes: form.prizes,
      cities,
      show_on_home: form.showOnHome,
      assigned_manager_ids: form.assignedManagerIds,
      block_repeat_registration: form.blockRepeatRegistration,
    };
    try {
      const saved = await apiRequest<Record<string, any>>(
        editing ? `/management/tournaments/${editing.slug}` : "/management/tournaments",
        { method: editing ? "PATCH" : "POST", body: JSON.stringify(payload) }, 
        token,
      );
      setRecords((current) => [saved, ...current.filter((item) => item.slug !== (editing?.slug ?? saved.slug))]);
      void loadTournaments();
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
    "Upcoming Tournament": records.filter((item) => item.status === "Featured" || item.show_on_home === true),
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
            <Link className="btn btn-primary" to="/admin/tournaments/new?featured=1">Add New Upcoming Tournament</Link>
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
                      <small>{formatDateInput(item.registration_start) || "-"} to {formatDateInput(item.registration_end) || "-"} - {slotSummary(item)} slots filled</small>
                    </div>
                    <div className="manager-card-actions">
                      <Link to={`/tournaments/${item.slug}`}>Open</Link>
                      <Link to={`/admin/tournaments/${item.slug}/group-bracket`}>Rounds</Link>
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
              <label>Tournament date<input inputMode="numeric" placeholder="dd/mm/yyyy" value={form.date} onChange={(event) => patchForm({ date: event.target.value })} /></label>
              <label>Registration opens<input inputMode="numeric" placeholder="dd/mm/yyyy" value={form.registrationStart} onChange={(event) => patchForm({ registrationStart: event.target.value })} /></label>
              <label>Registration closes<input inputMode="numeric" placeholder="dd/mm/yyyy" value={form.registrationEnd} onChange={(event) => patchForm({ registrationEnd: event.target.value })} /></label>
              <label>Capacity<input type="number" value={form.capacity} onChange={(event) => patchForm({ capacity: Number(event.target.value) })} /></label>
              <label>Min members<input type="number" value={form.minTeamSize} onChange={(event) => patchForm({ minTeamSize: Number(event.target.value) })} /></label>
              <label>Max members<input type="number" value={form.maxTeamSize} onChange={(event) => patchForm({ maxTeamSize: Number(event.target.value) })} /></label>
              <label>Min age<input type="number" value={form.minAge} onChange={(event) => patchForm({ minAge: Number(event.target.value) })} /></label>
              <label>Max age<input type="number" value={form.maxAge} onChange={(event) => patchForm({ maxAge: Number(event.target.value) })} /></label>
              <label>Tournament image<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadFile(file, token, { silent: true }).then((upload) => patchForm({ image: upload.url })).catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to upload tournament image."));
              }} /></label>
              <label>Tournament poster<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadFile(file, token, { silent: true }).then((upload) => patchForm({ poster: upload.url })).catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to upload tournament poster."));
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
            <div className="form-grid">
              <label>Rules PDF<input type="file" accept="application/pdf,.pdf" onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadFile(file, token, { silent: true }).then((upload) => patchForm({ rulesPdf: upload.url })).catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to upload rules PDF."));
              }} /></label>
              <label>Tournament rules text<textarea value={form.rulesText} onChange={(event) => patchForm({ rulesText: event.target.value })} placeholder="Rules shown in the registration acceptance step." /></label>
            </div>
            <label className="visibility-row"><span><b>Add new upcoming tournament</b><small>Show this tournament in the Upcoming Tournament row.</small></span><input type="checkbox" checked={form.showOnHome} onChange={(event) => patchForm({ showOnHome: event.target.checked })} /></label>
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
                    if (file) void fileToDataUrl(file).then((image) => setNewsDraft((current) => ({ ...current, image })));
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
                          if (file) void fileToDataUrl(file).then((image) => updateNewsSection(index, { image }));
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
                    if (file) void fileToDataUrl(file).then((image) => setAnnouncementDraft(prev => ({...prev, image})));
                  }} /></label>
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
  temporary_password?: string;
};

const temporaryPasswordKey = (type: "user" | "manager", id: string) => `smart-sportz-temp-password:${type}:${id}`;

function formatAdminMoney(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value / 100);
}

function OptionalDataTable({ title, columns, rows }: { title: string; columns: string[]; rows: Array<Array<React.ReactNode>> }) {
  if (!rows.length) {
    return <section className="panel user-empty-state"><h2>No {title.toLowerCase()} records</h2><p>Only saved database records are shown here.</p></section>;
  }
  return <DataTable columns={columns} rows={rows} />;
}

function AdminRegistrationsPanel() {
  const { token } = useAuth();
  const [registrations, setRegistrations] = useState<Array<Record<string, any>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    apiRequest<Array<Record<string, any>>>("/admin/registrations", {}, token)
      .then((items) => {
        if (alive) setRegistrations(items);
      })
      .catch((caught) => {
        if (alive) setError(caught instanceof Error ? caught.message : "Could not load registrations.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [token]);

  if (loading) {
    return <section className="panel user-empty-state"><h2>Loading registrations</h2><p>Fetching registration records from the admin database route.</p></section>;
  }

  return (
    <>
      {error && <div className="form-alert">{error}</div>}
      <section className="panel admin-list-head">
        <div>
          <span className="status emerald">Admin Records</span>
          <h2>Registrations</h2>
          <p>All saved tournament registrations are shown from the admin route.</p>
        </div>
      </section>
      {registrations.length === 0 ? (
        <section className="panel user-empty-state"><h2>No registrations</h2><p>New database registrations will appear here.</p></section>
      ) : (
        <DataTable
          columns={["Team", "Tournament", "Captain", "City", "Payment", "Status", "Created", "Action"]}
          rows={registrations.map((item) => [
            item.team_name,
            item.tournament_slug,
            item.captain_name,
            item.city,
            <span className={`status ${item.payment_status === "paid" ? "emerald" : "orange"}`}>{item.payment_status}</span>,
            item.status,
            item.created_at ? new Date(item.created_at).toLocaleDateString() : "-",
            <Link className="inline-link" to={`/admin/teams/registrations/${item.id}`}>Open</Link>,
          ])}
        />
      )}
    </>
  );
}

// CMS Item Type Definitions
type CMSItemType = 'discovery' | 'sponsor' | 'organizer';

// CMS Edit Page Component
export function AdminCMSEditPage() {
  const { type, id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [item, setItem] = useState<Record<string, any> | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!type || !id) {
      navigate('/admin/cms');
      return;
    }

    setLoading(true);
    setError("");
    
    // Determine the endpoint based on type
    let endpoint = '';
    if (type === 'discovery') endpoint = `/admin/home-content/discovery/${id}`;
    else if (type === 'sponsor') endpoint = `/admin/home-content/sponsor/${id}`;
    else if (type === 'organizer') endpoint = `/admin/home-content/organizer/${id}`;
    else {
      navigate('/admin/cms');
      return;
    }

    apiRequest(endpoint, {}, token)
      .then((data: any) => {
        setItem(data);
        setFormData(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load CMS item");
        setLoading(false);
      });
  }, [type, id, token, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");

    try {
      let endpoint = '';
      if (type === 'discovery') endpoint = `/admin/home-content/discovery/${id}`;
      else if (type === 'sponsor') endpoint = `/admin/home-content/sponsor/${id}`;
      else if (type === 'organizer') endpoint = `/admin/home-content/organizer/${id}`;
      
      await apiRequest(endpoint, {
        method: "PATCH",
        body: JSON.stringify(formData)
      }, token);
      
      setMessage("CMS item updated successfully!");
      setTimeout(() => navigate('/admin/cms'), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update CMS item");
    }
  };

  const getTypeLabel = () => {
    if (type === 'discovery') return 'Discovery Card';
    if (type === 'sponsor') return 'Sponsor Logo';
    if (type === 'organizer') return 'Organizer Card';
    return 'CMS Item';
  };

  if (loading) {
    return (
      <Page>
        <PortalShell title="Edit CMS Item" subtitle="" sidebar={sidebar} action={<Link className="btn btn-secondary" to="/admin/cms">Back to CMS</Link>}>
          <section className="panel user-empty-state">
            <h2>Loading...</h2>
          </section>
        </PortalShell>
      </Page>
    );
  }

  return (
    <Page>
      <PortalShell 
        title={`Edit ${getTypeLabel()}`} 
        subtitle="" 
        sidebar={sidebar} 
        action={<Link className="btn btn-secondary" to="/admin/cms">Back to CMS</Link>}
      >
        {message && <div className="form-alert success-alert">{message}</div>}
        {error && <div className="form-alert">{error}</div>}
        
        <form className="panel tournament-create-panel" onSubmit={handleSubmit}>
          {/* Discovery Card Fields */}
          {type === 'discovery' && (
            <>
              <div className="form-grid">
                <label>Label<input value={formData.label || ""} onChange={(e) => setFormData({...formData, label: e.target.value})} /></label>
                <label>Title<input value={formData.title || ""} onChange={(e) => setFormData({...formData, title: e.target.value})} /></label>
                <label>Sport<input value={formData.sport || ""} onChange={(e) => setFormData({...formData, sport: e.target.value})} /></label>
                <label>Tournament Slug<input value={formData.tournament_slug || ""} onChange={(e) => setFormData({...formData, tournament_slug: e.target.value})} /></label>
                <label>Sponsor Name<input value={formData.sponsor_name || ""} onChange={(e) => setFormData({...formData, sponsor_name: e.target.value})} /></label>
                <label>Image Upload<input type="file" accept="image/*" onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void fileToDataUrl(file).then((image) => setFormData((current) => ({ ...current, image })));
                }} /></label>
                <label>Sponsor Image Upload<input type="file" accept="image/*" onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void fileToDataUrl(file).then((image) => setFormData((current) => ({ ...current, sponsor_image: image })));
                }} /></label>
                <label>Event Date<input value={formData.event_date || ""} onChange={(e) => setFormData({...formData, event_date: e.target.value})} /></label>
                <label>Register Path<input value={formData.register_path || ""} onChange={(e) => setFormData({...formData, register_path: e.target.value})} /></label>
                <label>Sort Order<input type="number" value={formData.sort_order || 1} onChange={(e) => setFormData({...formData, sort_order: Number(e.target.value)})} /></label>
              </div>
              <label>Description<textarea rows={3} value={formData.description || ""} onChange={(e) => setFormData({...formData, description: e.target.value})} /></label>
              <label>Sponsor Details<textarea rows={3} value={formData.sponsor_details || ""} onChange={(e) => setFormData({...formData, sponsor_details: e.target.value})} /></label>
              <label className="checkbox-line">
                <input type="checkbox" checked={Boolean(formData.published)} onChange={(e) => setFormData({...formData, published: e.target.checked})} /> Published
              </label>
            </>
          )}

          {/* Sponsor Logo Fields */}
          {type === 'sponsor' && (
            <>
              <div className="form-grid">
                <label>Name<input value={formData.name || ""} onChange={(e) => setFormData({...formData, name: e.target.value})} /></label>
                <label>Image Upload<input type="file" accept="image/*" onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void fileToDataUrl(file).then((image) => setFormData((current) => ({ ...current, image })));
                }} /></label>
                <label>Link URL<input value={formData.link_url || ""} onChange={(e) => setFormData({...formData, link_url: e.target.value})} /></label>
                <label>Sort Order<input type="number" value={formData.sort_order || 1} onChange={(e) => setFormData({...formData, sort_order: Number(e.target.value)})} /></label>
              </div>
              <label className="checkbox-line">
                <input type="checkbox" checked={Boolean(formData.published)} onChange={(e) => setFormData({...formData, published: e.target.checked})} /> Published
              </label>
            </>
          )}

          {type === 'organizer' && (
            <>
              <div className="form-grid">
                <label>Title<input value={formData.title || ""} onChange={(e) => setFormData({...formData, title: e.target.value})} /></label>
                <label>Sort Order<input type="number" value={formData.sort_order || 1} onChange={(e) => setFormData({...formData, sort_order: Number(e.target.value)})} /></label>
              </div>
              <label>Description<textarea rows={3} value={formData.description || ""} onChange={(e) => setFormData({...formData, description: e.target.value})} /></label>
              <label className="checkbox-line">
                <input type="checkbox" checked={Boolean(formData.published)} onChange={(e) => setFormData({...formData, published: e.target.checked})} /> Published
              </label>
            </>
          )}

          <div className="registration-actions compact-actions">
            <button className="btn btn-primary" type="submit">Save Changes</button>
            <Link className="btn btn-secondary" to="/admin/cms">Cancel</Link>
          </div>
        </form>
      </PortalShell>
    </Page>
  );
}

// Fixed AdminCmsDbPanel with table-based display and Edit navigation
function AdminCmsDbPanel() {
  const { token } = useAuth();
  const [records, setRecords] = useState<Array<Record<string, any>>>([]);
  const [homeContent, setHomeContent] = useState<{
    discoveryCards: Array<Record<string, any>>;
    sponsorLogos: Array<Record<string, any>>;
    organizerCards: Array<Record<string, any>>;
  }>({ discoveryCards: [], sponsorLogos: [], organizerCards: [] });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState<'discovery' | 'sponsor' | 'organizer'>('discovery');

  useEffect(() => {
    let alive = true;
    setError("");
    Promise.all([
      apiRequest<Array<Record<string, any>>>("/admin/cms", {}, token),
      apiRequest<{ discoveryCards: Array<Record<string, any>>; sponsorLogos: Array<Record<string, any>>; organizerCards: Array<Record<string, any>> }>("/admin/home-content", {}, token),
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

  async function reloadHomeContent() {
    const payload = await apiRequest<{ discoveryCards: Array<Record<string, any>>; sponsorLogos: Array<Record<string, any>>; organizerCards: Array<Record<string, any>> }>("/admin/home-content", {}, token);
    setHomeContent(payload);
  }

  async function createHomeItem(type: "discovery" | "sponsor" | "organizer") {
    setMessage("");
    if (type === "discovery") {
      await apiRequest("/admin/home-content/discovery", { method: "POST", body: JSON.stringify({ label: "New Card", title: "New Discovery Card", sport: "Gallery", tournament_slug: "", sponsor_name: "Smart Sportz", sponsor_image: "", image: "/assets/logo.png", event_date: "Upcoming", description: "Edit this discovery card description.", sponsor_details: "Edit sponsor details.", register_path: "/tournaments", sort_order: homeContent.discoveryCards.length + 1, published: true }) }, token);
    } else if (type === "sponsor") {
      await apiRequest("/admin/home-content/sponsor", { method: "POST", body: JSON.stringify({ name: "New Sponsor", image: "/assets/logo.png", link_url: "https://smart-sportz-dun.vercel.app/", sort_order: homeContent.sponsorLogos.length + 1, published: true }) }, token);
    } else {
      await apiRequest("/admin/home-content/organizer", { method: "POST", body: JSON.stringify({ title: "New Organizer Tool", description: "Edit this organizer workflow card.", sort_order: homeContent.organizerCards.length + 1, published: true }) }, token);
    }
    await reloadHomeContent();
    setMessage("CMS record created. Use Edit to update the details.");
  }

  async function deleteHomeItem(type: "discovery" | "sponsor" | "organizer", id: string, title: string) {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    await apiRequest(`/admin/home-content/${type}/${id}`, { method: "DELETE" }, token);
    await reloadHomeContent();
    setMessage("CMS record deleted.");
  }

  // Table rows for Discovery Cards
  const discoveryRows = homeContent.discoveryCards.map((item) => [
    item.title || item.label || "Untitled",
    "Homepage discovery card",
    item.register_path || `/discover/${item.slug}`,
    <span className={`status ${item.published ? "emerald" : "orange"}`}>{item.published ? "Published" : "Draft"}</span>,
    <span className="table-actions">
      <Link to={`/admin/cms/edit/discovery/${item.slug}`}><EditIcon size={14} /> Edit</Link>
      <Link to={item.register_path || "/"}><ViewIcon size={14} /> View</Link>
      <button className="danger-link" type="button" onClick={() => void deleteHomeItem("discovery", item.slug, item.title || item.label)}>Delete</button>
    </span>,
  ]);

  // Table rows for Sponsor Logos
  const sponsorRows = homeContent.sponsorLogos.map((item) => [
    item.name || "Untitled",
    "Sponsor company logo",
    item.link_url || "-",
    <span className={`status ${item.published ? "emerald" : "orange"}`}>{item.published ? "Published" : "Draft"}</span>,
    <span className="table-actions">
      <Link to={`/admin/cms/edit/sponsor/${item.slug}`}><EditIcon size={14} /> Edit</Link>
      {item.link_url && <Link to={item.link_url}><ViewIcon size={14} /> View</Link>}
      <button className="danger-link" type="button" onClick={() => void deleteHomeItem("sponsor", item.slug, item.name)}>Delete</button>
    </span>,
  ]);

  const organizerRows = homeContent.organizerCards.map((item) => [
    item.title || "Untitled",
    "Organizer card",
    "Home page",
    <span className={`status ${item.published ? "emerald" : "orange"}`}>{item.published ? "Published" : "Draft"}</span>,
    <span className="table-actions">
      <Link to={`/admin/cms/edit/organizer/${item.slug}`}><EditIcon size={14} /> Edit</Link>
      <Link to="/"><ViewIcon size={14} /> View</Link>
      <button className="danger-link" type="button" onClick={() => void deleteHomeItem("organizer", item.slug, item.title)}>Delete</button>
    </span>,
  ]);

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

      {/* Main CMS Table */}
      <DataTable
        columns={["Section", "Type", "Path", "Status", "Action"]}
        rows={records.map((item) => [
          item.title,
          item.type,
          item.path,
          <span className={`status ${item.published ? "emerald" : "orange"}`}>{item.published ? "Published" : "Draft"}</span>,
          <span className="table-actions">
            <Link to={`/admin/cms/${item.slug}`}>Edit</Link>
            <Link to={item.path || "/"}>Preview</Link>
          </span>,
        ])}
      />

      {/* Tab Navigation */}
      <div className="admin-tabs" style={{ display: 'flex', gap: '8px', margin: '1rem 0', borderBottom: '1px solid #e5e7eb', paddingBottom: '8px' }}>
        <button 
          className={`btn ${activeTab === 'discovery' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('discovery')}
        >
          Discovery Cards ({homeContent.discoveryCards.length})
        </button>
        <button
          className={`btn ${activeTab === 'sponsor' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('sponsor')}
        >
          Sponsor Logos ({homeContent.sponsorLogos.length})
        </button>
        <button
          className={`btn ${activeTab === 'organizer' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('organizer')}
        >
          Organizer Cards ({homeContent.organizerCards.length})
        </button>
      </div>

      {/* Discovery Cards Table */}
      {activeTab === 'discovery' && (
        <section className="panel">
          <div className="section-head-inline">
            <h2>Homepage discovery cards</h2>
            <button className="btn btn-secondary" type="button" onClick={() => void createHomeItem("discovery")}><Plus size={16} /> Create</button>
          </div>
          <p>Edit sponsor/game/tournament cards displayed in Discover tournaments across categories.</p>
          {homeContent.discoveryCards.length === 0 ? (
            <div className="user-empty-state">
              <h2>No discovery cards</h2>
              <p>Create discovery cards from the tournament management section.</p>
            </div>
          ) : (
            <DataTable
              columns={["Section", "Type", "Path", "Status", "Action"]}
              rows={discoveryRows}
            />
          )}
        </section>
      )}

      {/* Sponsor Logos Table */}
      {activeTab === 'sponsor' && (
        <section className="panel">
          <div className="section-head-inline">
            <h2>Sponsor company logos</h2>
            <button className="btn btn-secondary" type="button" onClick={() => void createHomeItem("sponsor")}><Plus size={16} /> Create</button>
          </div>
          <p>Sponsor logos displayed on the homepage.</p>
          {homeContent.sponsorLogos.length === 0 ? (
            <div className="user-empty-state">
              <h2>No sponsor logos</h2>
              <p>Add sponsor logos from the sponsor management section.</p>
            </div>
          ) : (
            <DataTable
              columns={["Section", "Type", "Path", "Status", "Action"]}
              rows={sponsorRows}
            />
          )}
        </section>
      )}
      {activeTab === 'organizer' && (
        <section className="panel">
          <div className="section-head-inline">
            <h2>Empowering Tournament Organizers</h2>
            <button className="btn btn-secondary" type="button" onClick={() => void createHomeItem("organizer")}><Plus size={16} /> Create</button>
          </div>
          <p>Organizer workflow cards displayed in the homepage organizer section.</p>
          {homeContent.organizerCards.length === 0 ? (
            <div className="user-empty-state">
              <h2>No organizer cards</h2>
              <p>Create organizer cards to show this homepage section.</p>
            </div>
          ) : (
            <DataTable
              columns={["Section", "Type", "Path", "Status", "Action"]}
              rows={organizerRows}
            />
          )}
        </section>
      )}
    </div>
  );
}

// Fixed AnnouncementManagerPanel with backend API integration
export function AnnouncementManagerPanel({ role = "admin" }: { role?: "admin" | "manager" }) {
  const { token } = useAuth();
  const [items, setItems] = useState<AnnouncementRecord[]>([]);
  const [draft, setDraft] = useState<Partial<AnnouncementRecord>>({
    title: "",
    description: "",
    image: "",
    date_from: "",
    date_to: "",
    published: true,
    city: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<AnnouncementRecord | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");

  // Load announcements from backend API
  const loadAnnouncements = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest<AnnouncementRecord[]>("/admin/announcements", {}, token);
      setItems(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load announcements");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnnouncements();
  }, [token]);

  function openDraft(item?: AnnouncementRecord) {
    if (item) {
      setDraft({ ...item });
      setEditingId(item.id);
      setImagePreview(item.image || "");
    } else {
      setDraft({
        title: "",
        description: "",
        image: "",
        date_from: "",
        date_to: "",
        published: true,
        city: "",
      });
      setImagePreview("");
      setEditingId(null);
    }
    setError("");
    setMessage("");
    setIsOpen(true);
  }

  // Handle image file upload
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Create a preview URL
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
      
      // Store the file path (in a real app, you'd upload to server and get URL)
      void fileToDataUrl(file).then((image) => setDraft((current) => ({ ...current, image })));
    }
  };

  async function saveDraft() {
    setError("");
    setMessage("");
    
    if (!draft.title?.trim()) {
      setError("Title is required.");
      return;
    }
    
    const payload = {
      title: draft.title.trim(),
      description: draft.description?.trim() || "Tournament operations update.",
      image: draft.image?.trim() || "/assets/poster.jpeg",
      date_from: draft.date_from || null,
      date_to: draft.date_to || null,
      published: draft.published ?? true,
      city: draft.city || null,
    };

    try {
      let result: AnnouncementRecord;
      if (editingId) {
        // Update existing announcement
        result = await apiRequest<AnnouncementRecord>(`/admin/announcements/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        }, token);
        setItems(items.map(item => item.id === result.id ? result : item));
        setMessage("Announcement updated successfully!");
      } else {
        // Create new announcement
        result = await apiRequest<AnnouncementRecord>("/admin/announcements", {
          method: "POST",
          body: JSON.stringify(payload)
        }, token);
        setItems([result, ...items]);
        setMessage("Announcement created successfully!");
      }
      setIsOpen(false);
      setDraft({ title: "", description: "", image: "", date_from: "", date_to: "", published: true, city: "" });
      setImagePreview("");
      setEditingId(null);
      // Reload to refresh data
      loadAnnouncements();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save announcement");
    }
  }

  async function toggleVisibility(id: string) {
    try {
      const updated = await apiRequest<AnnouncementRecord>(`/admin/announcements/${id}/publish`, {
        method: "PATCH",
        body: JSON.stringify({})
      }, token);
      setItems(items.map(i => i.id === id ? updated : i));
      setMessage(`Announcement ${updated.published ? "published" : "hidden"}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update announcement");
    }
  }

  async function confirmDelete() {
    if (!deleteConfirm) return;
    
    try {
      await apiRequest(`/admin/announcements/${deleteConfirm.id}`, {
        method: "DELETE"
      }, token);
      setItems(items.filter(item => item.id !== deleteConfirm.id));
      setMessage(`${deleteConfirm.title} deleted successfully.`);
      setDeleteConfirm(null);
      loadAnnouncements();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete announcement");
    }
  }

  // Table columns for announcements
  const columns = ["Title", "Description", "City", "Status", "Date Range", "Actions"];
  const rows = items.map((item) => [
    <span key={`title-${item.id}`}>
      <b>{item.title}</b>
      <small style={{ display: 'block', opacity: 0.7 }}>By: {item.created_by_name || "Unknown"}</small>
    </span>,
    <span key={`desc-${item.id}`} style={{ maxWidth: "200px", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
      {item.description || "-"}
    </span>,
    <span key={`city-${item.id}`}>{item.city || "-"}</span>,
    <span key={`status-${item.id}`} className={`status ${item.published ? "emerald" : "orange"}`}>
      {item.published ? "Published" : "Hidden"}
    </span>,
    <span key={`date-${item.id}`}>
      {item.date_from || "-"} to {item.date_to || "-"}
    </span>,
    <span key={`actions-${item.id}`} className="table-actions">
      <button className="btn btn-secondary tiny-btn" onClick={() => toggleVisibility(item.id)}>
        {item.published ? <HideIcon size={14} /> : <ViewIcon size={14} />}
      </button>
      <button className="btn btn-secondary tiny-btn" onClick={() => openDraft(item)}>Edit</button>
      <button className="btn btn-danger tiny-btn" onClick={() => setDeleteConfirm(item)}>
        <DeleteIcon size={14} />
      </button>
    </span>,
  ]);

  return (
    <section className="panel admin-flow-panel">
      {message && <div className="form-alert success-alert">{message}</div>}
      {error && <div className="form-alert">{error}</div>}
      
      <div className="admin-list-head">
        <div>
          <span className="status emerald">Announcements</span>
          <h2>Announcement board</h2>
          <p>Create, publish, hide, edit, and delete tournament announcements.</p>
        </div>
        <button className="btn btn-primary" type="button" onClick={() => openDraft()}>
          <Plus size={16} /> Add New Announcement
        </button>
      </div>
      
      {loading ? (
        <div className="user-empty-state">
          <h2>Loading announcements...</h2>
        </div>
      ) : items.length === 0 ? (
        <div className="user-empty-state">
          <h2>No announcements yet</h2>
          <p>Use "Add New Announcement" to create the first entry.</p>
        </div>
      ) : (
        <DataTable columns={columns} rows={rows} />
      )}

      {/* Create/Edit Modal with scrollable content */}
      {isOpen && (
        <div className="modal-backdrop" role="presentation" onClick={(e) => {
          if (e.target === e.currentTarget) setIsOpen(false);
        }}>
          <section 
            className="confirm-modal panel" 
            role="dialog" 
            aria-modal="true" 
            aria-labelledby="announcement-title"
            style={{ 
              maxWidth: "600px", 
              width: "90%", 
              maxHeight: "85vh", 
              overflowY: "auto",
              padding: "1.5rem"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
              <div>
                <span className="status emerald">Announcement</span>
                <h2 id="announcement-title">{editingId ? "Edit announcement" : "Add new announcement"}</h2>
                <p>Title, description, and image are required. Date range is optional.</p>
              </div>
              <button className="icon-btn" type="button" aria-label="Close announcement popup" onClick={() => setIsOpen(false)}><X size={20} /></button>
            </div>
            
            {error && <div className="form-alert">{error}</div>}
            
            <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <label style={{ gridColumn: "span 2" }}>
                Title*
                <input 
                  value={draft.title || ""} 
                  onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} 
                  placeholder="Announcement title"
                />
              </label>
              
              {/* Image Upload with Preview */}
              <label style={{ gridColumn: "span 2" }}>
                Image
                <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={handleImageUpload}
                    style={{ flex: 1 }}
                  />
                  {imagePreview && (
                    <div style={{ 
                      width: "80px", 
                      height: "80px", 
                      borderRadius: "8px", 
                      overflow: "hidden",
                      border: "1px solid #e5e7eb",
                      flexShrink: 0
                    }}>
                      <img 
                        src={imagePreview} 
                        alt="Preview" 
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </div>
                  )}
                </div>
              </label>
              
              <label style={{ gridColumn: "span 2" }}>
                City (optional)
                <input 
                  value={draft.city || ""} 
                  onChange={(event) => setDraft((current) => ({ ...current, city: event.target.value }))} 
                  placeholder="Mumbai"
                />
              </label>
              <label>
                Date from
                <input type="date" value={draft.date_from || ""} onChange={(event) => setDraft((current) => ({ ...current, date_from: event.target.value }))} />
              </label>
              <label>
                Date to
                <input type="date" value={draft.date_to || ""} onChange={(event) => setDraft((current) => ({ ...current, date_to: event.target.value }))} />
              </label>
              <label style={{ gridColumn: "span 2" }}>
                Description
                <textarea 
                  value={draft.description || ""} 
                  onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} 
                  rows={4}
                  placeholder="Announcement description"
                />
              </label>
              <label className="visibility-row" style={{ gridColumn: "span 2" }}>
                <span>
                  <b>Publish announcement</b>
                  <small>Turn on to show this announcement on user pages.</small>
                </span>
                <input 
                  type="checkbox" 
                  checked={draft.published ?? true} 
                  onChange={(event) => setDraft((current) => ({ ...current, published: event.target.checked }))} 
                />
              </label>
            </div>
            
            <div className="registration-actions compact-actions" style={{ marginTop: "1rem" }}>
              <button className="btn btn-primary" type="button" onClick={saveDraft}>
                {editingId ? "Update Announcement" : "Create Announcement"}
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => {
                setIsOpen(false);
                setImagePreview("");
              }}>Cancel</button>
            </div>
          </section>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="modal-backdrop" role="presentation" onClick={(e) => {
          if (e.target === e.currentTarget) setDeleteConfirm(null);
        }}>
          <section className="panel confirm-modal" role="dialog" aria-modal="true" style={{ maxWidth: "450px", width: "90%" }} onClick={(e) => e.stopPropagation()}>
            <h2>Delete Announcement?</h2>
            <p style={{ marginBottom: "1rem" }}>
              Are you sure you want to delete "<strong>{deleteConfirm.title}</strong>"? 
              This action cannot be undone.
            </p>
            <div className="registration-actions compact-actions" style={{ justifyContent: "center" }}>
              <button className="btn btn-danger" type="button" onClick={confirmDelete}>
                <DeleteIcon size={16} /> Yes, Delete
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => setDeleteConfirm(null)}>Cancel</button>
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
      status: form.status === "Featured" ? "Upcoming" : form.status,
      location: form.location || "Mumbai",
      date: form.date || "TBA",
      registration_start: form.registrationStart || "TBA",
      registration_end: form.registrationEnd || "TBA",
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
      rules_pdf: form.rulesPdf,
      rules_text: form.rulesText,
      fee_breakdown: form.feeBreakdown.filter((line) => line.label.trim()),
      prizes: form.prizes,
      cities,
      show_on_home: form.showOnHome,
      assigned_manager_ids: form.assignedManagerIds,
      block_repeat_registration: form.blockRepeatRegistration,
    };
    try {
      const saved = await apiRequest<Record<string, any>>(
        isNew ? "/management/tournaments" : `/management/tournaments/${slug}`,
        { method: isNew ? "POST" : "PATCH", body: JSON.stringify(payload) }, 
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
                  <label>Title<input value={form.name} onChange={(event) => patchForm({ name: event.target.value })} placeholder="Upcoming tournament title" /></label>
                <label>Image<input type="file" accept="image/*" onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadFile(file, token, { silent: true }).then((upload) => patchForm({ image: upload.url })).catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to upload tournament image."));
                  }} /></label>
                  <label>Description<textarea value={form.tournamentDescription} onChange={(event) => patchForm({ tournamentDescription: event.target.value })} placeholder="Short upcoming tournament description" /></label>
                </div>
                <div className="registration-actions compact-actions">
                  <button className="btn btn-primary" type="button" onClick={saveTournament}>Save upcoming tournament</button>
                  <Link className="btn btn-secondary" to="/admin/tournaments">Cancel</Link>
                </div>
              </>
            ) : (
              <>
                <div className="form-grid">
                  <label>Tournament name<input value={form.name} onChange={(event) => patchForm({ name: event.target.value })} /></label>
                  <label>Sport<select value={form.sport} onChange={(event) => patchForm({ sport: event.target.value })}>{sportOptions.map((sport) => <option key={sport}>{sport}</option>)}<option value="__new__">Add new sport</option></select></label>
                  {form.sport === "__new__" && <label>New sport name<input value={form.newSportName} onChange={(event) => patchForm({ newSportName: event.target.value })} /></label>}
                  <label>Status<select value={form.status} onChange={(event) => patchForm({ status: event.target.value })}><option>Upcoming</option><option>Registration Open</option><option>Registration Closed</option><option>Live</option><option>Completed</option></select></label>
                  <label>Primary place<select value={form.location} onChange={(event) => patchForm({ location: event.target.value, cities: Array.from(new Set([...form.cities, event.target.value])) })}>{cityOptions.map((city) => <option key={city}>{city}</option>)}</select></label>
                  <label>Tournament date<input inputMode="numeric" placeholder="dd/mm/yyyy" value={form.date} onChange={(event) => patchForm({ date: event.target.value })} /></label>
                  <label>Registration opens<input inputMode="numeric" placeholder="dd/mm/yyyy" value={form.registrationStart} onChange={(event) => patchForm({ registrationStart: event.target.value })} /></label>
                  <label>Registration closes<input inputMode="numeric" placeholder="dd/mm/yyyy" value={form.registrationEnd} onChange={(event) => patchForm({ registrationEnd: event.target.value })} /></label>
                  <label>Capacity<input type="number" value={form.capacity} onChange={(event) => patchForm({ capacity: Number(event.target.value) })} /></label>
                  <label>Min members<input type="number" value={form.minTeamSize} onChange={(event) => patchForm({ minTeamSize: Number(event.target.value) })} /></label>
                  <label>Max members<input type="number" value={form.maxTeamSize} onChange={(event) => patchForm({ maxTeamSize: Number(event.target.value) })} /></label>
                  <label>Min age<input type="number" value={form.minAge} onChange={(event) => patchForm({ minAge: Number(event.target.value) })} /></label>
                  <label>Max age<input type="number" value={form.maxAge} onChange={(event) => patchForm({ maxAge: Number(event.target.value) })} /></label>
                  <label>Tournament image<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadFile(file, token, { silent: true }).then((upload) => patchForm({ image: upload.url })).catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to upload tournament image.")); }} /></label>
                  <label>Tournament poster<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadFile(file, token, { silent: true }).then((upload) => patchForm({ poster: upload.url })).catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to upload tournament poster.")); }} /></label>
                  <label>Manager allocation
                    <select multiple value={form.assignedManagerIds} onChange={(event) => patchForm({ assignedManagerIds: Array.from(event.target.selectedOptions).map((option) => option.value) })}>
                      {managers.map((manager) => <option value={manager.id} key={manager.id}>{manager.name} - {manager.email}</option>)}
                    </select>
                  </label>
                </div>
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
                  <label>Rules PDF<input type="file" accept="application/pdf,.pdf" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadFile(file, token, { silent: true }).then((upload) => patchForm({ rulesPdf: upload.url })).catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to upload rules PDF.")); }} /></label>
                  <label>Tournament rules text<textarea value={form.rulesText} onChange={(event) => patchForm({ rulesText: event.target.value })} /></label>
                </div>
                <div className="admin-flow-checks">
                  <label className="visibility-row"><span><b>Add new upcoming tournament</b><small>Show in upcoming tournament row.</small></span><input type="checkbox" checked={form.showOnHome} onChange={(event) => patchForm({ showOnHome: event.target.checked })} /></label>
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

// Fixed AdminNewsPage component with full CRUD API integration
export function AdminNewsPage({ mode = "news" }: { mode?: string }) {
  const { token } = useAuth();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [newsList, setNewsList] = useState<any[]>([]);
  const [showEditor, setShowEditor] = useState(false);
  const [editingNews, setEditingNews] = useState<any | null>(null);
  const defaultCity = assignedCities[0] ?? "";
  const defaultSport = sports[0]?.name ?? "Cricket";
  const [formData, setFormData] = useState({
    title: "",
    short_description: "",
    image: "",
    category: "Tournament Updates",
    sport: defaultSport,
    tournament_slug: "",
    city: defaultCity,
    status: "published",
    is_highlight: false,
    blocks: [{ block_type: "paragraph", content: "", sort_order: 0 }]
  });

  // Fetch news from API
  const fetchNews = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest("/admin/news", {}, token);
      setNewsList(data as any[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch news");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (mode !== "dashboard") {
      fetchNews();
    }
  }, [token, mode]);

  // Reset form
  const resetForm = () => {
    setFormData({
      title: "",
      short_description: "",
      image: "",
      category: "Tournament Updates",
      sport: defaultSport,
      tournament_slug: "",
      city: defaultCity,
      status: "published",
      is_highlight: false,
      blocks: [{ block_type: "paragraph", content: "", sort_order: 0 }]
    });
    setEditingNews(null);
  };

  // Open editor for create
  const handleCreate = () => {
    resetForm();
    setShowEditor(true);
  };

  // Open editor for edit
  const handleEdit = (news: any) => {
    setEditingNews(news);
    setFormData({
      title: news.title || "",
      short_description: news.short_description || "",
      image: news.image || "",
      category: news.category || "Tournament Updates",
      sport: news.sport || "",
      tournament_slug: news.tournament_slug || "",
      city: news.city || "",
      status: news.status || "published",
      is_highlight: news.is_highlight || false,
      blocks: news.blocks?.length ? news.blocks : [{ block_type: "paragraph", content: "", sort_order: 0 }]
    });
    setShowEditor(true);
  };

  // Handle delete
  const handleDelete = async (slug: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"?`)) return;
    setError("");
    setMessage("");
    try {
      await apiRequest(`/admin/news/${slug}`, { method: "DELETE" }, token);
      setNewsList(newsList.filter(item => item.slug !== slug));
      setMessage("News article deleted successfully!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete news");
    }
  };

  // Handle form submit (Create or Update)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    const payload = {
      ...formData,
      short_description: formData.short_description.trim() || "News update from SmartSportz.",
      image: formData.image.trim(),
      tournament_slug: formData.tournament_slug || null,
      blocks: formData.blocks
        .map((block) => ({ ...block, content: String(block.content || "").trim() }))
        .filter((block) => block.content.length > 0),
    };

    try {
      let result: any;
      if (editingNews) {
        // UPDATE
        result = await apiRequest(`/admin/news/${editingNews.slug}`, {
          method: "PATCH",
          body: JSON.stringify(payload)
        }, token);
        setNewsList(newsList.map(item => item.slug === editingNews.slug ? result : item));
        setMessage("News article updated successfully!");
      } else {
        // CREATE
        result = await apiRequest("/admin/news", {
          method: "POST",
          body: JSON.stringify(payload)
        }, token);
        setNewsList([result, ...newsList]);
        setMessage("News article created successfully!");
      }
      setShowEditor(false);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save news");
    }
  };

  // Add block
  const addBlock = () => {
    setFormData({
      ...formData,
      blocks: [...formData.blocks, { block_type: "paragraph", content: "", sort_order: formData.blocks.length }]
    });
  };

  // Update block
  const updateBlock = (index: number, field: string, value: any) => {
    const updatedBlocks = [...formData.blocks];
    updatedBlocks[index] = { ...updatedBlocks[index], [field]: value };
    setFormData({ ...formData, blocks: updatedBlocks });
  };

  // Remove block
  const removeBlock = (index: number) => {
    const updatedBlocks = formData.blocks.filter((_, i) => i !== index);
    setFormData({ ...formData, blocks: updatedBlocks });
  };

  const newsRows = AdminNews?.posts ?? [];
  const newsSports = AdminNews?.sports ?? sportHomeVisibility.map((item) => {
    const sport = sports.find((entry) => entry.slug === item.sportSlug);
    return { slug: item.sportSlug, name: sport?.name, show_on_home: item.showOnHome, sort_order: item.sortOrder };
  });

  if (mode === "dashboard") {
    return <AdminDashboardDbPanel />;
  }

  return (
    <>
      {message && <div className="form-alert success-alert">{message}</div>}
      {error && <div className="form-alert">{error}</div>}
      <div className="manager-news-layout">
        <section className="panel admin-list-head">
          <div>
            <span className="status emerald">News Management</span>
            <h2>News Articles</h2>
            <p>Create, edit, and delete news articles for the platform.</p>
          </div>
          <button className="btn btn-primary" onClick={handleCreate}>
            <Plus size={16} /> Add News
          </button>
        </section>

        {loading ? (
          <div className="panel user-empty-state">
            <h2>Loading news...</h2>
          </div>
        ) : newsList.length === 0 ? (
          <div className="panel user-empty-state">
            <h2>No news articles</h2>
            <p>Click "Add News" to create your first article.</p>
          </div>
        ) : (
          <DataTable
            columns={["News", "Category", "City", "Status", "Action"]}
            rows={newsList.map((post) => [
              <div>
                <b>{post.title}</b>
                <small style={{ display: 'block', opacity: 0.7 }}>{post.short_description}</small>
              </div>,
              post.category,
              post.city,
              <span className={`status ${post.status === "published" ? "emerald" : "orange"}`}>
                {post.status}
              </span>,
              <span className="table-actions">
                <Link to={`/news/${post.slug}`}>Open</Link>
                <button onClick={() => handleEdit(post)}>Edit</button>
                <button onClick={() => handleDelete(post.slug, post.title)}>Delete</button>
              </span>
            ])}
          />
        )}

        {/* News Editor Modal */}
        {showEditor && (
          <div className="modal-backdrop">
            <section className="manager-tournament-modal news-editor-modal">
              <div className="modal-head">
                <div>
                  <p className="eyebrow">{editingNews ? "Edit News" : "Create News"}</p>
                  <h2>{editingNews ? `Editing: ${editingNews.title}` : "New News Article"}</h2>
                </div>
                <button className="icon-btn" type="button" onClick={() => { setShowEditor(false); resetForm(); }}>x</button>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="form-grid">
                  <label>
                    Title*
                    <input
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      required
                    />
                  </label>
                  <label>
                    Category
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    >
                      <option>Winner Teams</option>
                      <option>Match Updates</option>
                      <option>Tournament Updates</option>
                      <option>Announcements</option>
                    </select>
                  </label>
                  <label>
                    City
                    <select
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    >
                      {assignedCities.map((city) => <option key={city}>{city}</option>)}
                    </select>
                  </label>
                  <label>
                    Sport
                    <select
                      value={formData.sport}
                      onChange={(e) => setFormData({ ...formData, sport: e.target.value })}
                    >
                      {sports.map((sport) => <option key={sport.slug}>{sport.name}</option>)}
                    </select>
                  </label>
                  <label>
                    Tournament
                    <select
                      value={formData.tournament_slug}
                      onChange={(e) => setFormData({ ...formData, tournament_slug: e.target.value })}
                    >
                      <option value="">None</option>
                      {assignedTournaments.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}
                    </select>
                  </label>
                  <label>
                    Status
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    >
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                    </select>
                  </label>
                  <label>
                    Image upload
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void fileToDataUrl(file).then((image) => setFormData({ ...formData, image }));
                      }}
                    />
                  </label>
                  <label>
                    Image URL
                    <input value={formData.image.startsWith("data:") ? "Uploaded image selected" : formData.image} onChange={(e) => setFormData({ ...formData, image: e.target.value })} placeholder="Optional image URL" />
                  </label>
                </div>

                <label>
                  Short Description
                  <textarea
                    value={formData.short_description}
                    onChange={(e) => setFormData({ ...formData, short_description: e.target.value })}
                    rows={3}
                    placeholder="Brief summary of the news article"
                  />
                </label>

                <label className="visibility-row">
                  <span>
                    <b>Highlight News</b>
                    <small>Show this story in the top sliding news banner.</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={formData.is_highlight}
                    onChange={(e) => setFormData({ ...formData, is_highlight: e.target.checked })}
                  />
                </label>

                <div className="news-section-builder">
                  <h3>Content Blocks</h3>
                  {formData.blocks.map((block, index) => (
                    <div className="panel subtle-panel" key={index}>
                      <div className="form-grid">
                        <label>
                          Block Type
                          <select
                            value={block.block_type}
                            onChange={(e) => updateBlock(index, "block_type", e.target.value)}
                          >
                            <option value="heading">Heading</option>
                            <option value="paragraph">Paragraph</option>
                            <option value="quote">Quote</option>
                            <option value="image">Image</option>
                            <option value="list">List</option>
                          </select>
                        </label>
                        <button
                          type="button"
                          className="btn btn-secondary tiny-btn"
                          onClick={() => removeBlock(index)}
                          style={{ marginTop: 24 }}
                        >
                          <X size={14} /> Remove
                        </button>
                      </div>
                      <label>
                        Content
                        <textarea
                          value={block.content}
                          onChange={(e) => updateBlock(index, "content", e.target.value)}
                          rows={block.block_type === "heading" ? 2 : 4}
                          placeholder={`Enter ${block.block_type} content...`}
                        />
                      </label>
                    </div>
                  ))}
                  <button type="button" className="btn btn-secondary" onClick={addBlock}>
                    <Plus size={16} /> Add Block
                  </button>
                </div>

                <div className="registration-actions compact-actions">
                  <button className="btn btn-primary" type="submit">
                    {editingNews ? "Update News" : "Create News"}
                  </button>
                  <button className="btn btn-secondary" type="button" onClick={() => { setShowEditor(false); resetForm(); }}>
                    Cancel
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}

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
      </div>
    </>
  );
}

export function GalleryManagerPanel() {
  const { token } = useAuth();
  const [records, setRecords] = useState<any[]>([]);
  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    image: "",
    sport: "Gallery",
    city: "",
    from_date: "",
    to_date: "",
    published: true,
    sort_order: 0,
  });

  function resetForm() {
    setEditing(null);
    setForm({ title: "", description: "", image: "", sport: "Gallery", city: "", from_date: "", to_date: "", published: true, sort_order: 0 });
  }

  async function fetchGallery() {
    setError("");
    try {
      const payload = await apiRequest<any[]>("/management/gallery", {}, token);
      setRecords(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load gallery records.");
    }
  }

  useEffect(() => {
    void fetchGallery();
  }, [token]);

  function openEdit(item: any) {
    setEditing(item);
    const [fromDate = "", toDate = ""] = String(item.date_label || "").split(" - ");
    setForm({
      title: item.title || "",
      description: item.summary || "",
      image: item.cover || "",
      sport: item.sport || "Gallery",
      city: item.city || "",
      from_date: fromDate,
      to_date: toDate,
      published: Boolean(item.published),
      sort_order: Number(item.sort_order || 0),
    });
    setShowEditor(true);
  }

  async function saveGallery(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const saved = await apiRequest<any>(editing ? `/management/gallery/${editing.slug}` : "/management/gallery", {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(form),
      }, token);
      setRecords((current) => editing ? current.map((item) => item.slug === saved.slug ? saved : item) : [saved, ...current]);
      setMessage(editing ? "Gallery updated successfully." : "Gallery created successfully.");
      setShowEditor(false);
      resetForm();
      void fetchGallery();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save gallery.");
    }
  }

  async function deleteGallery(item: any) {
    if (!window.confirm(`Delete gallery "${item.title}"? This cannot be undone.`)) return;
    setError("");
    setMessage("");
    try {
      await apiRequest(`/management/gallery/${item.slug}`, { method: "DELETE" }, token);
      setRecords((current) => current.filter((record) => record.slug !== item.slug));
      setMessage("Gallery deleted successfully.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete gallery.");
    }
  }

  return (
    <div className="manager-news-layout">
      {message && <div className="form-alert success-alert">{message}</div>}
      {error && <div className="form-alert">{error}</div>}
      <section className="panel admin-list-head">
        <div>
          <span className="status emerald">Gallery Management</span>
          <h2>Gallery containers</h2>
          <p>Create single-image gallery cards for the public Gallery page from database records only.</p>
        </div>
        <button className="btn btn-primary" type="button" onClick={() => { resetForm(); setShowEditor(true); }}><Plus size={16} /> Add Gallery</button>
      </section>
      {records.length ? (
        <DataTable
          columns={["Title", "Description", "Date", "Status", "Action"]}
          rows={records.map((item) => [
            <span><b>{item.title}</b><small style={{ display: "block", opacity: 0.7 }}>{item.city || "No city"}</small></span>,
            item.summary || "-",
            item.date_label || "-",
            <span className={`status ${item.published ? "emerald" : "orange"}`}>{item.published ? "Published" : "Draft"}</span>,
            <span className="table-actions">
              <Link to={`/gallery/${item.slug}`}>Preview</Link>
              <button type="button" onClick={() => openEdit(item)}>Edit</button>
              <button className="danger-link" type="button" onClick={() => void deleteGallery(item)}>Delete</button>
            </span>,
          ])}
        />
      ) : (
        <section className="panel user-empty-state"><h2>No gallery containers</h2><p>Click Add Gallery to create the first public gallery card.</p></section>
      )}
      {showEditor && (
        <div className="modal-backdrop">
          <section className="manager-tournament-modal news-editor-modal">
            <div className="modal-head">
              <div>
                <p className="eyebrow">{editing ? "Edit Gallery" : "Add Gallery"}</p>
                <h2>{editing ? editing.title : "New gallery image"}</h2>
              </div>
              <button className="icon-btn" type="button" onClick={() => { setShowEditor(false); resetForm(); }}>x</button>
            </div>
            <form onSubmit={saveGallery}>
              <div className="form-grid">
                <label>Title<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></label>
                <label>Sport / type<input value={form.sport} onChange={(event) => setForm({ ...form, sport: event.target.value })} /></label>
                <label>City<input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} placeholder="Optional city" /></label>
                <label>From date<input type="date" value={form.from_date} onChange={(event) => setForm({ ...form, from_date: event.target.value })} /></label>
                <label>To date<input type="date" value={form.to_date} onChange={(event) => setForm({ ...form, to_date: event.target.value })} /></label>
                <label>Image upload<input type="file" accept="image/*" onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void fileToDataUrl(file).then((image) => setForm((current) => ({ ...current, image })));
                }} /></label>
                <label>Image URL<input value={form.image.startsWith("data:") ? "Uploaded image selected" : form.image} onChange={(event) => setForm({ ...form, image: event.target.value })} placeholder="Optional image URL" /></label>
                <label>Sort order<input type="number" value={form.sort_order} onChange={(event) => setForm({ ...form, sort_order: Number(event.target.value) })} /></label>
              </div>
              <label>Description<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={4} /></label>
              <label className="visibility-row"><span><b>Published</b><small>Show on public Gallery page.</small></span><input type="checkbox" checked={form.published} onChange={(event) => setForm({ ...form, published: event.target.checked })} /></label>
              <div className="registration-actions compact-actions">
                <button className="btn btn-primary" type="submit">{editing ? "Update Gallery" : "Create Gallery"}</button>
                <button className="btn btn-secondary" type="button" onClick={() => { setShowEditor(false); resetForm(); }}>Cancel</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
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
  selected_jersey?: string;
  jersey_size?: string;
  age?: number;
  members?: Array<{ name: string; age?: number; jersey_size?: string; role?: string }>;
};

// Get jersey display name from URL or data
function getJerseyDisplayName(jerseyUrl?: string): string {
  if (!jerseyUrl) return "Not Selected";
  if (jerseyUrl.startsWith("data:")) return "Uploaded team kit";
  // Extract jersey name from URL or use stored value
  if (jerseyUrl.includes("Home")) return "Home";
  if (jerseyUrl.includes("Away")) return "Away";
  if (jerseyUrl.includes("Third")) return "Third";
  if (jerseyUrl.includes("Classic")) return "Classic";
  // If the URL contains a name, extract it
  const urlParts = jerseyUrl.split('/');
  const fileName = urlParts[urlParts.length - 1];
  const nameWithoutExt = fileName.split('.')[0];
  // Return formatted name
  return nameWithoutExt.replace(/-/g, ' ').replace(/_/g, ' ');
}

function teamAgeSummary(team: AdminTeamRow): string {
  const ages = (team.members ?? []).map((member) => member.age).filter((age): age is number => Number(age) > 0);
  if (!ages.length) return "-";
  return ages.length === 1 ? `${ages[0]} yrs` : `${Math.min(...ages)}-${Math.max(...ages)} yrs`;
}

function teamJerseySizeSummary(team: AdminTeamRow): string {
  const sizes = Array.from(new Set((team.members ?? []).map((member) => member.jersey_size).filter(Boolean)));
  return sizes.length ? sizes.join(", ") : "-";
}

function AdminTeamsPanel() {
  const { token } = useAuth();
  const [teams, setTeams] = useState<AdminTeamRow[]>([]);
  const [allTeams, setAllTeams] = useState<AdminTeamRow[]>([]);
  const [deleteCandidate, setDeleteCandidate] = useState<AdminTeamRow | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTournament, setSelectedTournament] = useState<string>("all");
  const [selectedTeam, setSelectedTeam] = useState<AdminTeamRow | null>(null);
  const [showTeamDetail, setShowTeamDetail] = useState(false);

  // Get unique tournament names for filter
  const tournamentOptions = useMemo(() => {
    const names = allTeams.map(t => t.tournament_name).filter(Boolean);
    return Array.from(new Set(names));
  }, [allTeams]);

  async function loadTeams() {
    setError("");
    try {
      const data = await apiRequest<AdminTeamRow[]>("/admin/teams", {}, token);
      setAllTeams(data);
      setTeams(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load teams from database.");
    }
  }

  useEffect(() => {
    loadTeams();
  }, [token]);

  // Filter teams based on search and tournament selection
  useEffect(() => {
    let filtered = allTeams;
    
    // Filter by tournament
    if (selectedTournament !== "all") {
      filtered = filtered.filter(team => team.tournament_name === selectedTournament);
    }
    
    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(team => 
        team.team_name?.toLowerCase().includes(term) ||
        team.captain_name?.toLowerCase().includes(term) ||
        team.tournament_name?.toLowerCase().includes(term) ||
        team.city?.toLowerCase().includes(term)
      );
    }
    
    setTeams(filtered);
  }, [searchTerm, selectedTournament, allTeams]);

  async function deleteTeam() {
    if (!deleteCandidate) return;
    try {
      await apiRequest(`/admin/teams/${deleteCandidate.id}/delete`, { method: "POST" }, token);
      setAllTeams((current) => current.filter((item) => item.id !== deleteCandidate.id));
      setMessage(`${deleteCandidate.team_name} deleted.`);
      setDeleteCandidate(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete team.");
    }
  }

  function handleViewTeam(team: AdminTeamRow) {
    setSelectedTeam(team);
    setShowTeamDetail(true);
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

      {/* Tournament Filter and Search Section */}
      <section className="panel admin-payment-tools" style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "flex-end" }}>
          {/* Tournament Name Containers */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", flex: "1", minWidth: "200px" }}>
            <button 
              className={`btn ${selectedTournament === "all" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setSelectedTournament("all")}
              style={{ fontSize: "13px", padding: "6px 14px" }}
            >
              All Tournaments
            </button>
            {tournamentOptions.map((name) => (
              <button 
                key={name}
                className={`btn ${selectedTournament === name ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setSelectedTournament(name)}
                style={{ fontSize: "13px", padding: "6px 14px" }}
              >
                {name}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", minWidth: "200px" }}>
            <div style={{ position: "relative", flex: 1 }}>
              <Search size={16} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#999" }} />
              <input 
                value={searchTerm} 
                onChange={(event) => setSearchTerm(event.target.value)} 
                placeholder="Search teams, captains..." 
                style={{ width: "100%", paddingLeft: "32px" }}
              />
            </div>
            {(searchTerm || selectedTournament !== "all") && (
              <button 
                className="btn btn-secondary" 
                onClick={() => { setSearchTerm(""); setSelectedTournament("all"); }}
                style={{ fontSize: "13px", padding: "6px 12px" }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
        <div style={{ marginTop: "0.5rem", fontSize: "14px", color: "#666" }}>
          {teams.length} team{teams.length !== 1 ? 's' : ''} found
        </div>
      </section>

      <DataTable
        columns={["Team Name", "Tournament", "Captain", "City", "Jersey", "Age", "Size", "Players", "Payment", "Status", "Actions"]}
        rows={teams.map((team) => [
          <span>
            <b>{team.team_name}</b>
            <small style={{ display: 'block', opacity: 0.7 }}>{team.user_email || team.sport}</small>
          </span>,
          team.tournament_name,
          team.captain_name,
          team.city,
          <span style={{ fontWeight: "500" }}>{getJerseyDisplayName(team.selected_jersey)}</span>,
          teamAgeSummary(team),
          teamJerseySizeSummary(team),
          team.players_count || 0,
          <span className={`status ${team.payment_status === "paid" ? "emerald" : "orange"}`}>
            {team.payment_status}
          </span>,
          team.status,
          <span className="table-action-group admin-team-actions">
            <button 
              className="btn btn-secondary tiny-btn" 
              onClick={() => handleViewTeam(team)}
            >
              View
            </button>
            <Link className="inline-link" to={`/admin/teams/registrations/${team.id}`}>Open</Link>
            <Link className="inline-link" to={`/admin/teams/${team.id}/edit`}>Edit</Link>
            <button className="link-button danger-link" type="button" onClick={() => setDeleteCandidate(team)}>Delete</button>
          </span>,
        ])}
      />

      {/* Team Detail Modal */}
      {showTeamDetail && selectedTeam && (
        <div className="modal-backdrop" role="presentation" onClick={() => setShowTeamDetail(false)}>
          <section className="panel confirm-modal" role="dialog" aria-modal="true" style={{ maxWidth: "700px", width: "90%", maxHeight: "80vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span className="status emerald">Team Detail</span>
                <h2>{selectedTeam.team_name}</h2>
              </div>
              <button className="icon-btn" type="button" onClick={() => setShowTeamDetail(false)}>x</button>
            </div>
            
            {/* Team Information */}
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <p><b>Tournament:</b> <span>{selectedTeam.tournament_name}</span></p>
                <p><b>Sport:</b> <span>{selectedTeam.sport}</span></p>
                <p><b>Captain:</b> <span>{selectedTeam.captain_name}</span></p>
                <p><b>City:</b> <span>{selectedTeam.city}</span></p>
                <p><b>Jersey:</b> <span style={{ fontWeight: "500" }}>{getJerseyDisplayName(selectedTeam.selected_jersey)}</span></p>
                <p><b>Age:</b> <span>{teamAgeSummary(selectedTeam)}</span></p>
                <p><b>Jersey Sizes:</b> <span>{teamJerseySizeSummary(selectedTeam)}</span></p>
                <p><b>Players:</b> <span>{selectedTeam.players_count || 0}</span></p>
                <p><b>Payment:</b> <span className={`status ${selectedTeam.payment_status === "paid" ? "emerald" : "orange"}`}>{selectedTeam.payment_status}</span></p>
                <p><b>Status:</b> <span>{selectedTeam.status}</span></p>
              </div>
            </div>

            {/* Players Table with Age and Size */}
            {selectedTeam.members && selectedTeam.members.length > 0 && (
              <>
                <h3 style={{ marginTop: "1rem", marginBottom: "0.5rem" }}>Team Players</h3>
                <DataTable
                  columns={["#", "Player Name", "Age", "Jersey Size", "Role"]}
                  rows={selectedTeam.members.map((player, index) => [
                    index + 1,
                    player.name || "-",
                    player.age || "-",
                    player.jersey_size || "-",
                    player.role || "-"
                  ])}
                />
              </>
            )}

            <div className="form-actions" style={{ marginTop: "1rem", display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <Link className="btn btn-primary" to={`/admin/teams/registrations/${selectedTeam.id}`}>Open Full Details</Link>
              <Link className="btn btn-secondary" to={`/admin/teams/${selectedTeam.id}/edit`}>Edit Team</Link>
              <button className="btn btn-secondary" type="button" onClick={() => setShowTeamDetail(false)}>Close</button>
            </div>
          </section>
        </div>
      )}

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
              columns={["Team", "Captain", "Jersey", "Age", "Size", "Players", "Payment", "Status", "Action"]}
              rows={data.teams.map((team) => [
                team.team_name,
                team.captain_name,
                getJerseyDisplayName(team.selected_jersey),
                teamAgeSummary(team as AdminTeamRow),
                teamJerseySizeSummary(team as AdminTeamRow),
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
                <p><b>Jersey</b><span>{getJerseyDisplayName(registration.selected_jersey)}</span></p>
                <p><b>Status</b><span>{registration.status}</span></p>
              </div>
            </section>
            
            {/* Players Table with Age and Size */}
            {data.players.length > 0 && (
              <>
                <h3 style={{ marginTop: "1rem", marginBottom: "0.5rem" }}>Players</h3>
                <DataTable 
                  columns={["Player", "Age", "Jersey Size", "Role", "Contact"]} 
                  rows={data.players.map((player) => [
                    player.name,
                    player.age || "-",
                    player.jersey_size || "-",
                    player.role || "-",
                    player.contact || "-"
                  ])} 
                />
              </>
            )}
            
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
      await apiRequest(`/admin/users/${deleteCandidate.id}`, { method: "DELETE" }, token);
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
      sessionStorage.setItem(temporaryPasswordKey("user", created.user.id), created.temporary_password || form.password);
      navigate(`/admin/users/${created.user.id}`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not create user."); }
  }

  return (
    <Page>
      <PortalShell title="Add User" subtitle="" sidebar={sidebar} action={<Link className="btn btn-secondary" to="/admin/users">All users</Link>}>
        {error && <div className="form-alert">{error}</div>}
        <div className="form-hint">Default password shown to the new user: {form.password}</div>
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
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadUser() {
    if (!id) return;
    setError("");
    try {
      const payload = await apiRequest<AdminUserDetailData>(`/admin/users/${id}`, {}, token);
      setData(payload);
      setForm({ name: payload.user.name, email: payload.user.email, phone: payload.user.phone || "", password: "" });
      const storedPassword = sessionStorage.getItem(temporaryPasswordKey("user", payload.user.id));
      if (storedPassword) setTemporaryPassword(storedPassword);
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
      const updated = await apiRequest<AdminUserDetailData>(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(payload) }, token);
      setData(updated);
      setForm({ name: updated.user.name, email: updated.user.email, phone: updated.user.phone || "", password: "" });
      setMessage("User updated.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not update user."); }
  }

  async function deleteUser() {
    if (!id) return;
    await apiRequest(`/admin/users/${id}`, { method: "DELETE" }, token);
    navigate("/admin/users");
  }

  function closeTemporaryPassword() {
    if (data?.user.id) sessionStorage.removeItem(temporaryPasswordKey("user", data.user.id));
    setTemporaryPassword("");
  }

  return (
    <Page>
      <PortalShell title={data?.user.name ?? "User Detail"} subtitle="" sidebar={sidebar} action={<Link className="btn btn-secondary" to="/admin/users">All users</Link>}>
        {message && <div className="form-alert success-alert">{message}</div>}
        {error && <div className="form-alert">{error}</div>}
        {temporaryPassword && (
          <div className="modal-backdrop">
            <section className="confirm-modal panel">
              <h2>Temporary password</h2>
              <p className="field-hint">Share this with {data?.user.email}. It is shown only after creation.</p>
              <div className="temporary-password-box">{temporaryPassword}</div>
              <div className="registration-actions compact-actions">
                <button className="btn btn-primary" type="button" onClick={() => void navigator.clipboard?.writeText(temporaryPassword)}>Copy password</button>
                <button className="btn btn-secondary" type="button" onClick={closeTemporaryPassword}>Close</button>
              </div>
            </section>
          </div>
        )}
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
      await apiRequest(`/admin/managers/${deleteCandidate.id}`, { method: "DELETE" }, token);
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
      sessionStorage.setItem(temporaryPasswordKey("manager", created.id), created.temporary_password || form.password);
      navigate(`/admin/managers/${created.id}`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to create manager."); }
  }

  return (
    <Page>
      <PortalShell title="Add Manager" subtitle="" sidebar={sidebar} action={<Link className="btn btn-secondary" to="/admin/managers">All managers</Link>}>
        {error && <div className="form-alert">{error}</div>}
        <div className="form-hint">Default password shown to the new manager: {form.password}</div>
        <section className="panel tournament-create-panel">
          <form className="form-grid" onSubmit={createManager}>
            <label>Name<input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label>
            <label>Email<input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} /></label>
            <label>Temporary password<input value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} /></label>
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
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    Promise.all([
      apiRequest<ManagerRow & { assigned_tournaments?: Array<Record<string, any>> }>(`/admin/managers/${id}`, {}, token),
      apiRequest<string[]>("/admin/places", {}, token),
    ]).then(([m, p]) => {
      setManager(m); setPlaces(p); setForm({ name: m.name, email: m.email, password: "", cities: m.cities });
      const storedPassword = sessionStorage.getItem(temporaryPasswordKey("manager", m.id));
      if (storedPassword) setTemporaryPassword(storedPassword);
    }).catch(() => setError("Load error"));
  }, [id, token]);

  async function saveManager(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const updated = await apiRequest<ManagerRow>(`/admin/managers/${id}`, { method: "PATCH", body: JSON.stringify(form) }, token);
      setManager(updated);
      setForm({ name: updated.name, email: updated.email, password: "", cities: updated.cities });
      setMessage("Updated.");
    } catch (caught) { setError("Save error"); }
  }

  function closeTemporaryPassword() {
    if (manager?.id) sessionStorage.removeItem(temporaryPasswordKey("manager", manager.id));
    setTemporaryPassword("");
  }

  return (
    <Page>
      <PortalShell title={manager?.name ?? "Manager Detail"} subtitle="" sidebar={sidebar} action={<Link className="btn btn-secondary" to="/admin/managers">All managers</Link>}>
        {message && <div className="form-alert success-alert">{message}</div>}
        {error && <div className="form-alert">{error}</div>}
        {temporaryPassword && (
          <div className="modal-backdrop">
            <section className="confirm-modal panel">
              <h2>Temporary password</h2>
              <p className="field-hint">Share this with {manager?.email}. It is shown only after creation.</p>
              <div className="temporary-password-box">{temporaryPassword}</div>
              <div className="registration-actions compact-actions">
                <button className="btn btn-primary" type="button" onClick={() => void navigator.clipboard?.writeText(temporaryPassword)}>Copy password</button>
                <button className="btn btn-secondary" type="button" onClick={closeTemporaryPassword}>Close</button>
              </div>
            </section>
          </div>
        )}
        <form className="panel form-grid" onSubmit={saveManager}>
          <label>Name<input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label>
          <label>Email<input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} /></label>
          <label>New password<input value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} /></label>
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
      <PortalShell title={title} subtitle="" sidebar={sidebar} action={<span className="status emerald">System optimal</span>}>
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
        {section === "registrations" && <AdminRegistrationsPanel />}
        {section === "teams" && <AdminTournamentPickerPanel mode="teams" />}
        {section === "players" && <AthleteProfile />}
        {section === "payments" && <AdminTournamentPickerPanel mode="payments" />}
        {section === "news" && <AdminNewsPage mode="news" />}
        {section === "gallery" && <GalleryManagerPanel />}
        {section === "cms" && <AdminCmsDbPanel />}
        {section === "announcements" && <AnnouncementManagerPanel role="admin" />}
        {section === "reports" && <ListPanel title="Reports Center" items={reports} to="/admin/reports/detail" />}
        {section === "logs" && <ListPanel title="Audit Logs" items={logRows} to="/admin/logs/detail" />}
        {section === "settings" && <ListPanel title="System Settings" items={["RBAC policy", "Password policy"]} to="/settings" />}
      </PortalShell>
    </Page>
  );
}
