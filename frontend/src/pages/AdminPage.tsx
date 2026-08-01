import { Bell, CheckCircle2, ImagePlus, FileText, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { DataTable, Page, PortalShell } from "../components/UI";
import { cmsSections, logRows, paymentRows, reports, sidebar, sports, teams, tournaments } from "../data/platform";
import type { TournamentNotice } from "../data/platform";
import { apiRequest } from "../lib/api";
import { AthleteProfile, CatalogPage, ListPanel, Metric, TeamCard } from "./shared";

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
  image: string;
  accent: string;
  address: string;
  sportDescription: string;
  tournamentDescription: string;
  showOnHome: boolean;
  feeBreakdown: Array<{ label: string; value: number }>;
  prizes: Array<{ position: number; label: string; amount: number }>;
  cities: string[];
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
  image: "/assets/cricket-stadium.png",
  accent: "emerald",
  address: "",
  sportDescription: "",
  tournamentDescription: "",
  showOnHome: false,
  feeBreakdown: [{ label: "Entry Fee", value: 5000 }],
  prizes: [
    { position: 1, label: "1st Prize", amount: 0 },
    { position: 2, label: "2nd Prize", amount: 0 },
    { position: 3, label: "3rd Prize", amount: 0 },
  ],
  cities: ["Mumbai"],
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
  if (!item) return { ...emptyAdminTournamentForm, feeBreakdown: [...emptyAdminTournamentForm.feeBreakdown], prizes: [...emptyAdminTournamentForm.prizes], cities: [...emptyAdminTournamentForm.cities] };
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
    image: item.image ?? "/assets/cricket-stadium.png",
    accent: item.accent ?? "emerald",
    address: item.address ?? "",
    sportDescription: item.sport_description ?? "",
    tournamentDescription: item.tournament_description ?? "",
    showOnHome: Boolean(item.show_on_home),
    feeBreakdown,
    prizes,
    cities,
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
      <div className="mini-grid">
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
  const [records, setRecords] = useState<Array<Record<string, any>>>([]);
  const [form, setForm] = useState<AdminTournamentForm>(() => adminFormFromTournament());
  const [editing, setEditing] = useState<Record<string, any> | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<Record<string, any> | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadTournaments() {
    setError("");
    try {
      const data = await apiRequest<Array<Record<string, any>>>("/management/tournaments", {}, token);
      setRecords(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load tournaments from database.");
    }
  }

  useEffect(() => {
    loadTournaments();
  }, [token]);

  function patchForm(patch: Partial<AdminTournamentForm>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function openForm(item?: Record<string, any>) {
    setEditing(item ?? null);
    setForm(adminFormFromTournament(item));
    setShowForm(true);
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
      prize: `INR ${prizeTotal.toLocaleString("en-IN")}`,
      image: form.image,
      accent: form.accent,
      address: form.address,
      sport_description: form.sportDescription,
      tournament_description: form.tournamentDescription,
      fee_breakdown: form.feeBreakdown.filter((line) => line.label.trim()),
      prizes: form.prizes,
      cities,
      show_on_home: form.showOnHome,
    };
    try {
      const saved = await apiRequest<Record<string, any>>(
        editing ? `/management/tournaments/${editing.slug}` : "/management/tournaments",
        { method: editing ? "PATCH" : "POST", body: JSON.stringify(payload) },
        token,
      );
      await loadTournaments();
      setEditing(saved);
      setForm(adminFormFromTournament(saved));
      setMessage(`${saved.name} saved in database.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save tournament.");
    }
  }

  async function deleteTournament() {
    if (!deleteCandidate) return;
    setError("");
    try {
      await apiRequest(`/management/tournaments/${deleteCandidate.slug}`, { method: "DELETE" }, token);
      setRecords((current) => current.filter((item) => item.slug !== deleteCandidate.slug));
      setMessage(`${deleteCandidate.name} deleted.`);
      setDeleteCandidate(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to delete tournament.");
    }
  }

  const groups = {
    Upcoming: records.filter((item) => item.status === "Upcoming"),
    "Registration Open": records.filter((item) => item.status === "Registration Open"),
    Live: records.filter((item) => item.status === "Live"),
    "Old / Completed": records.filter((item) => !["Upcoming", "Registration Open", "Live"].includes(String(item.status))),
  };
  const sportOptions = Array.from(new Set([...sports.map((sport) => sport.name), ...records.map((item) => item.sport).filter(Boolean)]));
  const cityOptions = Array.from(new Set(["Mumbai", "Bengaluru", "Mysuru", "Delhi", "Chennai", ...records.map((item) => item.location).filter(Boolean), ...form.cities]));
  const feeTotal = form.feeBreakdown.reduce((total, line) => total + Number(line.value || 0), 0);
  const prizeTotal = form.prizes.reduce((total, line) => total + Number(line.amount || 0), 0);

  return (
    <>
      <NoticeBuilder role="admin" />
      {message && <div className="form-alert success-alert">{message}</div>}
      {error && <div className="form-alert">{error}</div>}
      <div className="manager-tournament-board">
        <div className="manager-board-head">
          <div>
            <h2>Database tournaments</h2>
            <p>Admin view uses backend records only, grouped like the manager tournament page.</p>
          </div>
          <button className="btn btn-primary" type="button" onClick={() => openForm()}>Add New Tournament</button>
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
                      <a href={`/Smart_Sportz/tournaments/${item.slug}`}>Open</a>
                      <a href={`/Smart_Sportz/management/tournaments/${item.slug}/bracket`}>Rounds</a>
                      <button type="button" onClick={() => openForm(item)}>Edit</button>
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
                <p className="eyebrow">{editing ? "Edit Tournament" : "New Tournament"}</p>
                <h2>{editing ? form.name : "Create tournament"}</h2>
              </div>
              <button className="icon-btn" type="button" onClick={() => setShowForm(false)}>x</button>
            </div>
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
              <label>Tournament image<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) patchForm({ image: `/assets/${file.name}` });
              }} /></label>
            </div>
            <label>Selected image path<input value={form.image} readOnly /></label>
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

function AdminTournamentPickerPanel({ mode }: { mode: "teams" | "payments" }) {
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
          <span className="status emerald">{mode === "teams" ? "Team Records" : "Payment Records"}</span>
          <h2>Select tournament</h2>
          <p>{mode === "teams" ? "Open a tournament to view registered teams, players, scores, and registration records." : "Open a tournament to view total payments, team payments, receipts, and payment status."}</p>
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
              <Link to={mode === "teams" ? `/admin/teams/tournament/${item.slug}` : `/admin/payments/tournament/${item.slug}`}>Open</Link>
            </div>
          </article>
        ))}
      </div>
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

export function AdminTournamentPaymentsPage() {
  const { slug } = useParams();
  const { token } = useAuth();
  const [data, setData] = useState<{ tournament: Record<string, any>; summary: Record<string, number>; payments: Array<Record<string, any>> } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!slug) return;
    setError("");
    apiRequest<{ tournament: Record<string, any>; summary: Record<string, number>; payments: Array<Record<string, any>> }>(`/admin/tournaments/${slug}/payments`, {}, token)
      .then(setData)
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load tournament payments."));
  }, [slug, token]);

  return (
    <Page>
      <PortalShell title={data?.tournament.name ?? "Tournament Payments"} subtitle="Payment totals and team payment records for this tournament." sidebar={sidebar} action={<Link className="btn btn-secondary" to="/admin/payments">All payment tournaments</Link>}>
        {error && <div className="form-alert">{error}</div>}
        {!data ? <section className="panel user-empty-state"><h2>Loading payments</h2><p>Fetching tournament payment records.</p></section> : (
          <>
            <div className="mini-grid">
              <Metric label="Total Paid" value={formatAdminMoney(data.summary.total ?? 0)} />
              <Metric label="Paid Payments" value={String(data.summary.paidPayments ?? 0)} />
              <Metric label="Team Records" value={String(data.summary.teams ?? 0)} />
              <Metric label="Pending Payments" value={String(data.summary.pendingPayments ?? 0)} />
            </div>
            <DataTable
              columns={["Team", "Captain", "Receipt", "Amount", "Method", "Status"]}
              rows={data.payments.map((payment) => [
                payment.team_name,
                payment.captain_name,
                payment.receipt_number,
                formatAdminMoney(payment.amount),
                payment.method,
                <span className={`status ${payment.status === "paid" ? "emerald" : "orange"}`}>{payment.status}</span>,
              ])}
            />
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
      setError(caught instanceof Error ? caught.message : "Could not load users from database.");
    }
  }

  useEffect(() => {
    loadUsers();
  }, [token]);

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
        <div>
          <span className="status emerald">Login Users</span>
          <h2>Participant accounts</h2>
          <p>Only normal login users are listed here. Admin and manager accounts stay in their own pages.</p>
        </div>
        <Link className="btn btn-primary" to="/admin/users/add">Add User</Link>
      </section>
      <DataTable
        columns={["User", "Email", "Phone", "Registrations", "Payments", "Created", "Action"]}
        rows={users.map((user) => [
          user.name,
          user.email,
          user.phone || "-",
          user.registrations_count ?? 0,
          user.payments_count ?? 0,
          user.created_at ? new Date(user.created_at).toLocaleDateString() : "-",
          <span className="table-actions">
            <Link to={`/admin/users/${user.id}`}>Open</Link>
            <button type="button" onClick={() => setDeleteCandidate(user)}>Delete</button>
          </span>,
        ])}
      />
      {deleteCandidate && (
        <div className="modal-backdrop">
          <section className="confirm-modal panel">
            <h2>Delete user?</h2>
            <p>{deleteCandidate.name} and all linked registration, payment, document, and member records will be removed.</p>
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
      const created = await apiRequest<AdminUserDetailData>("/admin/users", {
        method: "POST",
        body: JSON.stringify(form),
      }, token);
      navigate(`/admin/users/${created.user.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create user.");
    }
  }

  return (
    <Page>
      <PortalShell title="Add User" subtitle="Create a participant login account in the database." sidebar={sidebar} action={<Link className="btn btn-secondary" to="/admin/users">All users</Link>}>
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
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load user.");
    }
  }

  useEffect(() => {
    loadUser();
  }, [id, token]);

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
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update user.");
    }
  }

  async function deleteUser() {
    if (!id) return;
    await apiRequest(`/admin/users/${id}`, { method: "DELETE" }, token);
    navigate("/admin/users");
  }

  return (
    <Page>
      <PortalShell title={data?.user.name ?? "User Detail"} subtitle="View and manage this participant account from DB records." sidebar={sidebar} action={<Link className="btn btn-secondary" to="/admin/users">All users</Link>}>
        {message && <div className="form-alert success-alert">{message}</div>}
        {error && <div className="form-alert">{error}</div>}
        {!data ? <section className="panel user-empty-state"><h2>Loading user</h2><p>Fetching account records.</p></section> : (
          <>
            <form className="panel form-grid" onSubmit={saveUser}>
              <label>Name<input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label>
              <label>Email<input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} /></label>
              <label>Phone<input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} /></label>
              <label>New password<input value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} placeholder="Leave blank to keep current" /></label>
              <button className="btn btn-primary" type="submit">Save User</button>
              <button className="btn btn-secondary" type="button" onClick={() => setDeleteOpen(true)}>Delete User</button>
            </form>
            <DataTable columns={["Tournament", "Team", "City", "Payment", "Status"]} rows={data.registrations.map((item) => [item.tournament_name, item.team_name, item.city, item.payment_status, item.status])} />
            <DataTable columns={["Receipt", "Amount", "Method", "Status"]} rows={data.payments.map((item) => [item.receipt_number, item.amount, item.method, item.status])} />
            <DataTable columns={["Document", "File", "Status"]} rows={data.documents.map((item) => [item.document_type, item.file_name, item.status])} />
            <DataTable columns={["Member", "Role", "Contact"]} rows={data.members.map((item) => [item.name, item.role, item.contact || "-"])} />
          </>
        )}
        {deleteOpen && (
          <div className="modal-backdrop">
            <section className="confirm-modal panel">
              <h2>Delete user?</h2>
              <p>This removes the user and linked registration, payment, document, and member records.</p>
              <div className="registration-actions compact-actions">
                <button className="btn btn-primary" type="button" onClick={deleteUser}>Confirm delete</button>
                <button className="btn btn-secondary" type="button" onClick={() => setDeleteOpen(false)}>Cancel</button>
              </div>
            </section>
          </div>
        )}
      </PortalShell>
    </Page>
  );
}

function ManagerManagementPanel() {
  const { token } = useAuth();
  const [managers, setManagers] = useState<ManagerRow[]>([]);
  const [places, setPlaces] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [newPlace, setNewPlace] = useState("");
  const [deleteCandidate, setDeleteCandidate] = useState<ManagerRow | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "manager123",
    cities: [] as string[],
  });

  async function loadManagers() {
    setLoading(true);
    setError("");
    try {
      const [rows, placeRows] = await Promise.all([
        apiRequest<ManagerRow[]>("/admin/managers", {}, token),
        apiRequest<string[]>("/admin/places", {}, token),
      ]);
      setManagers(rows);
      setPlaces(placeRows);
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
    const cities = form.cities;
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
      setForm({ name: "", email: "", password: "manager123", cities: [] });
      setMessage(`${created.name} created with ${created.cities.length} city assignment${created.cities.length === 1 ? "" : "s"}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create manager.");
    }
  }

  function addPlace() {
    const value = newPlace.trim();
    if (!value) return;
    setPlaces((current) => Array.from(new Set([...current, value])).sort());
    setForm((current) => ({ ...current, cities: Array.from(new Set([...current.cities, value])) }));
    setNewPlace("");
  }

  async function deleteManager() {
    if (!deleteCandidate) return;
    try {
      await apiRequest(`/admin/managers/${deleteCandidate.id}`, { method: "DELETE" }, token);
      setManagers((current) => current.filter((item) => item.id !== deleteCandidate.id));
      setMessage(`${deleteCandidate.name} deleted.`);
      setDeleteCandidate(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to delete manager.");
    }
  }

  const tableRows = managers.map((manager) => [
        manager.name,
        manager.email,
        manager.cities.join(", ") || "No city assigned",
        manager.created_at ? new Date(manager.created_at).toLocaleDateString() : "Created",
        <span className="table-actions"><Link to={`/admin/managers/${manager.id}`}>Open</Link><button type="button" onClick={() => setDeleteCandidate(manager)}>Delete</button></span>,
      ]);

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
          <label>Allocated place
            <select value="" onChange={(event) => event.target.value && setForm((current) => ({ ...current, cities: Array.from(new Set([...current.cities, event.target.value])) }))}>
              <option value="">Select existing place</option>
              {places.map((place) => <option key={place}>{place}</option>)}
            </select>
          </label>
          <label>Add new place<input value={newPlace} onChange={(event) => setNewPlace(event.target.value)} placeholder="New city or place" /></label>
          <button className="btn btn-secondary" type="button" onClick={addPlace}>Add place</button>
          <div className="selected-place-list">
            {form.cities.map((city) => <button type="button" key={city} onClick={() => setForm((current) => ({ ...current, cities: current.cities.filter((item) => item !== city) }))}>{city} x</button>)}
          </div>
          <button className="btn btn-primary" type="submit">Create manager</button>
          <button className="btn btn-secondary" type="button" onClick={loadManagers}>Refresh from DB</button>
        </form>
      </section>
      <DataTable
        columns={["Manager", "Email", "Allocated Cities", "Created", "Action"]}
        rows={loading ? [["Loading managers...", "", "", "", ""]] : tableRows}
      />
      {deleteCandidate && (
        <div className="modal-backdrop">
          <section className="confirm-modal panel">
            <h2>Delete manager?</h2>
            <p>{deleteCandidate.name} will lose all city access.</p>
            <div className="registration-actions compact-actions">
              <button className="btn btn-primary" type="button" onClick={deleteManager}>Confirm delete</button>
              <button className="btn btn-secondary" type="button" onClick={() => setDeleteCandidate(null)}>Cancel</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export function AdminManagerDetailPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [manager, setManager] = useState<(ManagerRow & { assigned_tournaments?: Array<Record<string, any>> }) | null>(null);
  const [places, setPlaces] = useState<string[]>([]);
  const [form, setForm] = useState({ name: "", email: "", password: "", cities: [] as string[] });
  const [newPlace, setNewPlace] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadManager() {
    if (!id) return;
    setError("");
    try {
      const [managerPayload, placeRows] = await Promise.all([
        apiRequest<ManagerRow & { assigned_tournaments?: Array<Record<string, any>> }>(`/admin/managers/${id}`, {}, token),
        apiRequest<string[]>("/admin/places", {}, token),
      ]);
      setManager(managerPayload);
      setPlaces(placeRows);
      setForm({ name: managerPayload.name, email: managerPayload.email, password: "", cities: managerPayload.cities });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load manager.");
    }
  }

  useEffect(() => {
    loadManager();
  }, [id, token]);

  function addPlace() {
    const value = newPlace.trim();
    if (!value) return;
    setPlaces((current) => Array.from(new Set([...current, value])).sort());
    setForm((current) => ({ ...current, cities: Array.from(new Set([...current.cities, value])) }));
    setNewPlace("");
  }

  async function saveManager(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id) return;
    setMessage("");
    setError("");
    try {
      const payload = { name: form.name, email: form.email, cities: form.cities, ...(form.password ? { password: form.password } : {}) };
      const updated = await apiRequest<ManagerRow & { assigned_tournaments?: Array<Record<string, any>> }>(`/admin/managers/${id}`, { method: "PATCH", body: JSON.stringify(payload) }, token);
      setManager(updated);
      setForm({ name: updated.name, email: updated.email, password: "", cities: updated.cities });
      setMessage("Manager updated.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update manager.");
    }
  }

  async function deleteManager() {
    if (!id) return;
    await apiRequest(`/admin/managers/${id}`, { method: "DELETE" }, token);
    navigate("/admin/managers");
  }

  return (
    <Page>
      <PortalShell title={manager?.name ?? "Manager Detail"} subtitle="Edit manager login and city/place access from DB records." sidebar={sidebar} action={<Link className="btn btn-secondary" to="/admin/managers">All managers</Link>}>
        {message && <div className="form-alert success-alert">{message}</div>}
        {error && <div className="form-alert">{error}</div>}
        {!manager ? <section className="panel user-empty-state"><h2>Loading manager</h2><p>Fetching manager details.</p></section> : (
          <>
            <form className="panel form-grid" onSubmit={saveManager}>
              <label>Name<input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label>
              <label>Email<input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} /></label>
              <label>New password<input value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} placeholder="Leave blank to keep current" /></label>
              <label>Allocate existing place
                <select value="" onChange={(event) => event.target.value && setForm((current) => ({ ...current, cities: Array.from(new Set([...current.cities, event.target.value])) }))}>
                  <option value="">Select place</option>
                  {places.map((place) => <option key={place}>{place}</option>)}
                </select>
              </label>
              <label>Add new place<input value={newPlace} onChange={(event) => setNewPlace(event.target.value)} /></label>
              <button className="btn btn-secondary" type="button" onClick={addPlace}>Add place</button>
              <div className="selected-place-list">
                {form.cities.map((city) => <button type="button" key={city} onClick={() => setForm((current) => ({ ...current, cities: current.cities.filter((item) => item !== city) }))}>{city} x</button>)}
              </div>
              <button className="btn btn-primary" type="submit">Save Manager</button>
              <button className="btn btn-secondary" type="button" onClick={() => setDeleteOpen(true)}>Delete Manager</button>
            </form>
            <DataTable
              columns={["Assigned Tournament", "Sport", "City", "Status"]}
              rows={(manager.assigned_tournaments ?? []).map((item) => [item.name, item.sport, item.location, <span className={`status ${item.accent ?? "emerald"}`}>{item.status}</span>])}
            />
          </>
        )}
        {deleteOpen && (
          <div className="modal-backdrop">
            <section className="confirm-modal panel">
              <h2>Delete manager?</h2>
              <p>This removes the manager login and all place access assignments.</p>
              <div className="registration-actions compact-actions">
                <button className="btn btn-primary" type="button" onClick={deleteManager}>Confirm delete</button>
                <button className="btn btn-secondary" type="button" onClick={() => setDeleteOpen(false)}>Cancel</button>
              </div>
            </section>
          </div>
        )}
      </PortalShell>
    </Page>
  );
}

export function AdminPage({ section = "dashboard" }: { section?: string }) {
  const title = section === "dashboard" ? "Executive Dashboard" : section.replace("-", " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <Page>
      <PortalShell title={title} subtitle="Platform-wide control for Smart Sportz operations." sidebar={sidebar} action={<span className="status emerald">System optimal</span>}>
        {section === "dashboard" && <AdminDashboardDbPanel />}
        {section === "tournaments" && <AdminTournamentsDbPanel />}
        {section === "users" && <AdminUsersPanel />}
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
        {section === "teams" && <AdminTournamentPickerPanel mode="teams" />}
        {section === "players" && <AthleteProfile />}
        {section === "payments" && <AdminTournamentPickerPanel mode="payments" />}
        {section === "cms" && <CatalogPage embedded title="CMS Builder" items={cmsSections.map((title) => ({ title, text: "Editable CMS section", icon: FileText, path: `/admin/cms/${title.toLowerCase().replace(/\s+/g, "-")}` }))} />}
        {section === "reports" && <ListPanel title="Reports Center" items={reports} to="/admin/reports/detail" />}
        {section === "logs" && <ListPanel title="Audit and Event Logs" items={logRows} to="/admin/logs/detail" />}
        {section === "settings" && <ListPanel title="System Settings" items={["RBAC policy", "Password policy", "Local storage", "Audit retention"]} to="/settings" />}
      </PortalShell>
    </Page>
  );
}
