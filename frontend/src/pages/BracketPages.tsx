import { Bell, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { DataTable, Page, PortalShell } from "../components/UI";
import { managementSidebar, sidebar, tournaments } from "../data/platform";
import { apiRequest } from "../lib/api";

type TeamSeed = { id?: string; name: string; seed?: number };
type GroupMatch = {
  id?: string;
  round: string;
  team_1: string;
  team_2: string;
  starts_at: string;
  ends_at: string;
  status: "upcoming" | "live" | "completed";
  sort_order: number;
  published?: number | boolean;
};

const emptyMatch = (sortOrder: number): GroupMatch => ({
  round: "",
  team_1: "",
  team_2: "",
  starts_at: "",
  ends_at: "",
  status: "upcoming",
  sort_order: sortOrder,
});

function DeleteIcon({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M6 6l1 14h10l1-14" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

function statusLabel(status: string) {
  if (status === "live") return "Live";
  if (status === "completed") return "Completed";
  return "Upcoming";
}

function statusAccent(status: string) {
  if (status === "live") return "orange";
  if (status === "completed") return "emerald";
  return "blue";
}

export function TournamentRoundsPage() {
  const { slug } = useParams();
  const tournament = tournaments.find((item) => item.slug === slug) ?? tournaments[0];
  const [matches, setMatches] = useState<GroupMatch[]>([]);

  useEffect(() => {
    if (!slug) return;
    apiRequest<{ matches?: GroupMatch[] }>(`/public/tournaments/${slug}/bracket`)
      .then((payload) => setMatches(payload.matches ?? []))
      .catch(() => setMatches([]));
  }, [slug]);

  return (
    <Page>
      <section className="page-hero bracket-page-hero">
        <p className="eyebrow">{tournament.status} Rounds</p>
        <h1>{tournament.name} Rounds</h1>
        <p>Published group bracket rounds are listed with teams, match timing, and current status.</p>
        <div className="hero-actions">
          <Link className="btn btn-primary" to={`/tournaments/${tournament.slug}`}>Tournament detail</Link>
          <Link className="btn btn-secondary" to="/live">Live hub</Link>
        </div>
      </section>
      <section className="panel">
        {matches.length ? (
          <DataTable
            columns={["Round", "Team 1", "Team 2", "From", "To", "Status"]}
            rows={matches.map((match) => [
              match.round,
              match.team_1 || "TBD",
              match.team_2 || "TBD",
              match.starts_at || "-",
              match.ends_at || "-",
              <span className={`status ${statusAccent(match.status)}`}>{statusLabel(match.status)}</span>,
            ])}
          />
        ) : (
          <div className="user-empty-state">
            <h2>No published rounds</h2>
            <p>Rounds will appear after admin or manager saves and publishes the group bracket table.</p>
          </div>
        )}
      </section>
    </Page>
  );
}

export function BracketWorkspacePage() {
  const { slug } = useParams();
  const location = useLocation();
  const { token } = useAuth();
  const isAdmin = location.pathname.startsWith("/admin");
  const portalSidebar = isAdmin ? sidebar : managementSidebar;
  const tournamentsPath = isAdmin ? "/admin/tournaments" : "/management/tournaments";
  const [records, setRecords] = useState<Array<Record<string, any>>>([]);
  const [teams, setTeams] = useState<TeamSeed[]>([]);
  const [matches, setMatches] = useState<GroupMatch[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const selectedTournament = useMemo(
    () => records.find((item) => item.slug === slug) ?? tournaments.find((item) => item.slug === slug),
    [records, slug],
  );

  useEffect(() => {
    let active = true;
    apiRequest<Array<Record<string, any>>>(isAdmin ? "/admin/tournaments" : "/management/tournaments", {}, token)
      .then((items) => {
        if (active) setRecords(items);
      })
      .catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : "Could not load tournaments.");
      });
    return () => {
      active = false;
    };
  }, [isAdmin, token]);

  useEffect(() => {
    if (!slug) return;
    let active = true;
    setError("");
    apiRequest<{ acceptedTeams: TeamSeed[]; matches: GroupMatch[] }>(`/management/group-brackets/${slug}`, {}, token)
      .then((payload) => {
        if (!active) return;
        setTeams(payload.acceptedTeams ?? []);
        setMatches(payload.matches?.length ? payload.matches : [emptyMatch(1)]);
      })
      .catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : "Could not load group bracket.");
      });
    return () => {
      active = false;
    };
  }, [slug, token]);

  function updateMatch(index: number, patch: Partial<GroupMatch>) {
    setMatches((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  function addMatch() {
    setMatches((items) => [...items, emptyMatch(items.length + 1)]);
  }

  function removeMatch(index: number) {
    setMatches((items) => items.filter((_, itemIndex) => itemIndex !== index).map((item, itemIndex) => ({ ...item, sort_order: itemIndex + 1 })));
  }

  async function saveGroupBracket() {
    if (!slug) return;
    setMessage("");
    setError("");
    try {
      const saved = await apiRequest<{ matches: GroupMatch[] }>(`/management/group-brackets/${slug}/save`, {
        method: "POST",
        body: JSON.stringify({
          publish: true,
          audit_reason: "Saved group bracket table from portal",
          matches: matches.map((match, index) => ({ ...match, sort_order: index + 1 })),
        }),
      }, token);
      setMatches(saved.matches ?? matches);
      setMessage("Group bracket saved and published to public rounds.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save group bracket.");
    }
  }

  async function sendMessage() {
    if (!slug) return;
    const selectedTeams = Array.from(new Set(matches.flatMap((match) => [match.team_1, match.team_2]).filter(Boolean)));
    if (!selectedTeams.length) {
      setError("Select teams before sending a bracket message.");
      return;
    }
    setMessage("");
    setError("");
    try {
      await apiRequest(`/management/brackets/${slug}/notify`, {
        method: "POST",
        body: JSON.stringify({
          channels: ["sms", "whatsapp"],
          audience: selectedTeams.join(", "),
          message: `Group bracket updated for ${selectedTournament?.name ?? slug}: ${selectedTeams.join(", ")}`,
        }),
      }, token);
      setMessage("Message sent for selected bracket teams.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send team message.");
    }
  }

  if (!slug) {
    return (
      <Page>
        <PortalShell title="Group Bracket" subtitle="Select an existing tournament to manage round rows." sidebar={portalSidebar}>
          {error && <div className="form-alert">{error}</div>}
          <DataTable
            columns={["Tournament", "Sport", "City", "Status", "Action"]}
            rows={records.map((item) => [
              item.name,
              item.sport,
              item.location,
              <span className={`status ${item.accent ?? "emerald"}`}>{item.status}</span>,
              <Link to={`${tournamentsPath}/${item.slug}/bracket`}>Open group bracket</Link>,
            ])}
          />
        </PortalShell>
      </Page>
    );
  }

  return (
    <Page>
      <PortalShell
        title="Group Bracket"
        subtitle={selectedTournament ? `${selectedTournament.name} round table` : "Round table"}
        sidebar={portalSidebar}
        action={<Link className="btn btn-secondary" to={tournamentsPath}>All tournaments</Link>}
      >
        {message && <div className="form-alert success-alert">{message}</div>}
        {error && <div className="form-alert">{error}</div>}
        <section className="panel">
          <div className="section-head-inline">
            <div>
              <h2>Round Table</h2>
              <p>Add rounds manually, select teams from accepted teams, set match timing, and publish to public rounds.</p>
            </div>
            <button className="btn btn-secondary" type="button" onClick={addMatch}><Plus size={16} /> Add round</button>
          </div>
          <div className="group-bracket-table">
            <div className="group-bracket-head">
              <span>Round</span>
              <span>Team 1</span>
              <span>Team 2</span>
              <span>From</span>
              <span>To</span>
              <span>Status</span>
              <span>Action</span>
            </div>
            {matches.map((match, index) => (
              <div className="group-bracket-row" key={match.id ?? index}>
                <input value={match.round} onChange={(event) => updateMatch(index, { round: event.target.value })} placeholder="Round 1" />
                <select value={match.team_1} onChange={(event) => updateMatch(index, { team_1: event.target.value })}>
                  <option value="">Select team</option>
                  {teams.map((team) => <option key={`team1-${team.id ?? team.name}`} value={team.name}>{team.name}</option>)}
                </select>
                <select value={match.team_2} onChange={(event) => updateMatch(index, { team_2: event.target.value })}>
                  <option value="">Select team</option>
                  {teams.map((team) => <option key={`team2-${team.id ?? team.name}`} value={team.name}>{team.name}</option>)}
                </select>
                <input type="datetime-local" value={match.starts_at} onChange={(event) => updateMatch(index, { starts_at: event.target.value })} />
                <input type="datetime-local" value={match.ends_at} onChange={(event) => updateMatch(index, { ends_at: event.target.value })} />
                <select value={match.status} onChange={(event) => updateMatch(index, { status: event.target.value as GroupMatch["status"] })}>
                  <option value="upcoming">Upcoming</option>
                  <option value="live">Live</option>
                  <option value="completed">Completed</option>
                </select>
                <button className="icon-btn danger-link" type="button" onClick={() => removeMatch(index)}><DeleteIcon size={16} /></button>
              </div>
            ))}
          </div>
          <div className="registration-actions compact-actions">
            <button className="btn btn-primary" type="button" onClick={saveGroupBracket}>Save and Publish</button>
            <button className="btn btn-secondary" type="button" onClick={sendMessage}><Bell size={16} /> Send selected teams message</button>
          </div>
        </section>
      </PortalShell>
    </Page>
  );
}
