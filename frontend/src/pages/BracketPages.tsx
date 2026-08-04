import { ArrowRight, Bell, Hand, Minus, Plus, RefreshCw, ZoomIn } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Page, PortalShell } from "../components/UI";
import { acceptedTeams as fallbackAcceptedTeams, bracketConnections, bracketNodes, managementSidebar, tournaments } from "../data/platform";
import { apiRequest } from "../lib/api";
import { InfoPanel } from "./shared";

type BracketNode = typeof bracketNodes[number] & {
  bucket?: "main" | "left" | "right" | "final";
  scheduled_at?: string;
};
type TeamSeed = { id?: string; name: string; logo?: string; seed?: number };
type BracketConnection = { id?: string; source_id: string; target_id: string } | [string, string];
type RoundSchedule = { round: string; bucket: string; scheduled_at: string };
type BucketMode = "single" | "double";

const fallbackTeams: TeamSeed[] = fallbackAcceptedTeams.map((team) => ({ ...team }));

function normalizeConnection(connection: BracketConnection) {
  return Array.isArray(connection) ? { source_id: connection[0], target_id: connection[1] } : connection;
}

function toCanvasNode(node: BracketNode) {
  const percentMode = Math.max(Math.abs(Number(node.x)), Math.abs(Number(node.y))) <= 100;
  return {
    ...node,
    cx: percentMode ? Number(node.x) * 12 + 44 : Number(node.x),
    cy: percentMode ? Number(node.y) * 6 + 44 : Number(node.y),
  };
}

function bracketPath(from: ReturnType<typeof toCanvasNode>, to: ReturnType<typeof toCanvasNode>) {
  const startX = from.cx + (from.cx < to.cx ? 32 : -32);
  const endX = to.cx + (from.cx < to.cx ? -32 : 32);
  const midX = (startX + endX) / 2;
  return `M ${startX} ${from.cy} H ${midX} V ${to.cy} H ${endX}`;
}

function roundName(index: number, totalRounds: number, mode: BucketMode, bucket?: string) {
  if (mode === "double") {
    if (index === totalRounds) return "Final";
    if (index === totalRounds - 1) return bucket === "right" ? "Semi-Final 2" : "Semi-Final 1";
  }
  if (index === totalRounds) return "Final";
  if (index === totalRounds - 1) return "Semi-Final";
  if (index === totalRounds - 2) return "Quarter";
  return `Round-${index}`;
}

function seededTeamNames(source: TeamSeed[], count: number) {
  const names = source.map((team) => team.name);
  return Array.from({ length: count }, (_, index) => names[index % Math.max(names.length, 1)] || `Team ${index + 1}`);
}

function buildSideBracket(teams: string[], bucket: "main" | "left" | "right", totalRounds: number, originX: number, originY: number, xStep: number, yStep: number, mode: BucketMode) {
  const nodes: BracketNode[] = [];
  const connections: BracketConnection[] = [];
  let previousIds: string[] = [];
  const firstSlots = Math.max(2, Math.pow(2, Math.ceil(Math.log2(Math.max(teams.length, 2)))));

  for (let roundIndex = 1; roundIndex <= totalRounds; roundIndex += 1) {
    const round = roundName(roundIndex, totalRounds, mode, bucket);
    const slotCount = roundIndex === 1 ? firstSlots : Math.max(1, Math.ceil(previousIds.length / 2));
    const x = originX + (roundIndex - 1) * xStep;
    const startY = originY - ((slotCount - 1) * yStep) / 2;
    const currentIds: string[] = [];

    for (let slot = 0; slot < slotCount; slot += 1) {
      const id = `${bucket}_r${roundIndex}_${slot + 1}`;
      const team = roundIndex === 1 ? teams[slot] || "" : "";
      nodes.push({
        id,
        label: team || `${round} Slot ${slot + 1}`,
        team,
        round,
        x,
        y: Math.round(startY + slot * yStep),
        status: team ? "paired" : "empty",
        bucket,
      } as BracketNode);
      currentIds.push(id);
    }

    previousIds.forEach((sourceId, index) => {
      connections.push({ source_id: sourceId, target_id: currentIds[Math.min(Math.floor(index / 2), currentIds.length - 1)] });
    });
    previousIds = currentIds;
  }

  return { nodes, connections, winnerId: previousIds[0] };
}

function generateBracketWorkspace(teamSource: TeamSeed[], mode: BucketMode, rounds: number, teamCount: number) {
  const totalRounds = Math.max(2, rounds);
  if (mode === "double") {
    const teams = seededTeamNames(teamSource, teamCount);
    const leftTeams = teams.filter((_, index) => index % 2 === 0);
    const rightTeams = teams.filter((_, index) => index % 2 === 1);
    const sideRounds = Math.max(1, totalRounds - 1);
    const left = buildSideBracket(leftTeams, "left", sideRounds, 110, 440, 220, 74, mode);
    const right = buildSideBracket(rightTeams, "right", sideRounds, 1510, 440, -220, 74, mode);
    const finalNode: BracketNode = { id: "final_center", label: "Final", team: "", round: "Final", x: 820, y: 440, status: "empty", bucket: "final" } as BracketNode;
    const championNode: BracketNode = { id: "champion_center", label: "Champion", team: "", round: "Champion", x: 960, y: 440, status: "empty", bucket: "final" } as BracketNode;
    return {
      nodes: [...left.nodes, ...right.nodes, finalNode, championNode],
      connections: [
        ...left.connections,
        ...right.connections,
        { source_id: left.winnerId, target_id: finalNode.id },
        { source_id: right.winnerId, target_id: finalNode.id },
        { source_id: finalNode.id, target_id: championNode.id },
      ],
    };
  }

  const single = buildSideBracket(seededTeamNames(teamSource, teamCount), "main", totalRounds, 120, 430, 210, 74, mode);
  const championNode: BracketNode = { id: "champion", label: "Champion", team: "", round: "Champion", x: 120 + totalRounds * 210, y: 430, status: "empty", bucket: "main" } as BracketNode;
  return { nodes: [...single.nodes, championNode], connections: [...single.connections, { source_id: single.winnerId, target_id: championNode.id }] };
}

function BracketCanvas({
  nodes,
  connections = bracketConnections.map(([source_id, target_id]) => ({ source_id, target_id })),
  editable = false,
  publicMode = false,
  hideTeams = false,
  zoom = 1,
  panMode = false,
  roundSchedules = [],
  onDropTeam,
  onSelect,
  selected,
}: {
  nodes: BracketNode[];
  connections?: BracketConnection[];
  editable?: boolean;
  publicMode?: boolean;
  hideTeams?: boolean;
  zoom?: number;
  panMode?: boolean;
  roundSchedules?: RoundSchedule[];
  onDropTeam?: (nodeId: string, team: string) => void;
  onSelect?: (node: BracketNode) => void;
  selected?: string;
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const panRef = useRef({ active: false, x: 0, y: 0, left: 0, top: 0 });
  const canvasNodes = useMemo(() => nodes.map(toCanvasNode), [nodes]);
  const canvasWidth = Math.max(1320, ...canvasNodes.map((node) => node.cx + 180));
  const canvasHeight = Math.max(720, ...canvasNodes.map((node) => node.cy + 140));
  const stageLabels = useMemo(() => {
    const labels = new Map<string, number>();
    canvasNodes.forEach((node) => {
      if (!labels.has(node.round)) labels.set(node.round, node.cx);
    });
    return Array.from(labels.entries()).map(([label, x]) => ({ label, x }));
  }, [canvasNodes]);
  const teamLogoMap = useMemo(() => new Map(fallbackTeams.map((team) => [team.name, team.logo] as const)), []);

  return (
    <section className={`bracket-canvas panel ${publicMode ? "public-bracket" : ""}`}>
      <div
        className={`bracket-pan-viewport ${panMode ? "hand-active" : ""}`}
        ref={viewportRef}
        onMouseDown={(event) => {
          if (!panMode || !viewportRef.current) return;
          panRef.current = { active: true, x: event.clientX, y: event.clientY, left: viewportRef.current.scrollLeft, top: viewportRef.current.scrollTop };
        }}
        onMouseMove={(event) => {
          if (!panRef.current.active || !viewportRef.current) return;
          viewportRef.current.scrollLeft = panRef.current.left - (event.clientX - panRef.current.x);
          viewportRef.current.scrollTop = panRef.current.top - (event.clientY - panRef.current.y);
        }}
        onMouseUp={() => { panRef.current.active = false; }}
        onMouseLeave={() => { panRef.current.active = false; }}
      >
        <div className="bracket-stage" style={{ width: canvasWidth * zoom, height: canvasHeight * zoom }}>
          <div className="bracket-stage-content" style={{ width: canvasWidth, height: canvasHeight, transform: `scale(${zoom})` }}>
            {stageLabels.map((stage) => {
              const schedule = roundSchedules.find((item) => item.round === stage.label);
              return <div className="round-label" key={`${stage.label}-${stage.x}`} style={{ left: stage.x }}>{stage.label}{schedule?.scheduled_at && <small>{schedule.scheduled_at}</small>}</div>;
            })}
            <svg className="bracket-svg" viewBox={`0 0 ${canvasWidth} ${canvasHeight}`} preserveAspectRatio="none" aria-hidden="true">
              {connections.map((connection) => {
                const normalized = normalizeConnection(connection);
                const from = canvasNodes.find((node) => node.id === normalized.source_id);
                const to = canvasNodes.find((node) => node.id === normalized.target_id);
                if (!from || !to) return null;
                return <path key={`${normalized.source_id}-${normalized.target_id}`} d={bracketPath(from, to)} />;
              })}
            </svg>
            {canvasNodes.map((node) => (
              <button
                className={`bracket-node ${node.status} ${selected === node.id ? "selected" : ""}`}
                key={node.id}
                style={{ left: node.cx, top: node.cy }}
                onClick={() => onSelect?.(node)}
                onDragOver={(event) => editable && event.preventDefault()}
                onDrop={(event) => {
                  if (!editable) return;
                  onDropTeam?.(node.id, event.dataTransfer.getData("text/team"));
                }}
              >
                <span className="node-mark">
                  {node.team ? (
                    <img
                      className="bracket-node-logo"
                      src={teamLogoMap.get(node.team) || "/assets/logo.png"}
                      alt=""
                      onError={(event) => { event.currentTarget.src = "/assets/logo.png"; }}
                    />
                  ) : publicMode ? "" : <Plus size={18} />}
                </span>
                {!hideTeams && <b>{node.team || (publicMode ? "TBD" : node.label)}</b>}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function TournamentRoundsPage() {
  const { slug } = useParams();
  const tournament = tournaments.find((item) => item.slug === slug) ?? tournaments[0];
  const hideTeams = tournament.phase === "upcoming";

  return (
    <Page>
      <section className="page-hero bracket-page-hero">
        <p className="eyebrow">{tournament.status} Rounds</p>
        <h1>{tournament.name} Bracket</h1>
        <p>Public bracket view with active progression, archived rounds, score-linked winner paths, and clickable match/player score details.</p>
        <div className="hero-actions">
          <Link className="btn btn-primary" to={`/tournaments/${tournament.slug}`}>Tournament detail</Link>
          <Link className="btn btn-secondary" to="/live">Live hub</Link>
        </div>
      </section>
      <BracketCanvas nodes={bracketNodes as BracketNode[]} publicMode hideTeams={hideTeams} />
      <div className="detail-grid">
        {hideTeams ? (
          <InfoPanel title="Upcoming Round Preview" items={["Round slots are visible before registration closes", "Teams appear after manager accepts registrations", "Seeding is published only after manager saves the bracket", "No editable plus controls are shown on the public page"]} highlight />
        ) : (
          <InfoPanel title="Round Details" items={["Round-1: Mumbai Mavericks vs India Forge", "Round-1: Bengaluru Bulls vs Chennai Chargers", "Semi-Final: India Forge advanced", "Final slot pending live result"]} highlight />
        )}
        <InfoPanel title="Score Records" items={["Player scorecards", "Team score history", "Highlights", "Winner and runner-up records"]} to="/leaderboards" />
      </div>
    </Page>
  );
}

export function BracketWorkspacePage() {
  const { slug = "bangalore-corporate-t20" } = useParams();
  const { token } = useAuth();
  const tournament = tournaments.find((item) => item.slug === slug) ?? tournaments[1];
  const [acceptedTeams, setAcceptedTeams] = useState<TeamSeed[]>(fallbackTeams);
  const [bucketMode, setBucketMode] = useState<BucketMode>("single");
  const [roundCount, setRoundCount] = useState(5);
  const [teamCount, setTeamCount] = useState(20);
  const initial = useMemo(() => generateBracketWorkspace(fallbackTeams, "single", 5, 20), []);
  const [nodes, setNodes] = useState<BracketNode[]>(initial.nodes);
  const [connections, setConnections] = useState<BracketConnection[]>(initial.connections);
  const [roundSchedules, setRoundSchedules] = useState<RoundSchedule[]>([]);
  const [selectedId, setSelectedId] = useState(nodes[0]?.id);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [panMode, setPanMode] = useState(false);
  const [channels, setChannels] = useState({ sms: true, email: true });
  const [notice, setNotice] = useState("Auto bracket generated from accepted teams.");
  const selected = useMemo(() => nodes.find((node) => node.id === selectedId), [nodes, selectedId]);

  useEffect(() => {
    if (!token) return;
    apiRequest<{ acceptedTeams: TeamSeed[]; nodes: BracketNode[]; connections: BracketConnection[]; roundSchedules?: RoundSchedule[] }>(`/management/brackets/${slug}`, {}, token)
      .then((payload) => {
        const teams = payload.acceptedTeams?.length ? payload.acceptedTeams : fallbackTeams;
        setAcceptedTeams(teams);
        if (payload.nodes?.length) {
          setNodes(payload.nodes);
          setConnections(payload.connections ?? []);
          setRoundSchedules(payload.roundSchedules ?? []);
        }
      })
      .catch(() => setNotice("Using local bracket preview. Backend workspace could not be loaded."));
  }, [slug, token]);

  function regenerate(mode = bucketMode, rounds = roundCount, count = teamCount) {
    const generated = generateBracketWorkspace(acceptedTeams, mode, rounds, count);
    setNodes(generated.nodes);
    setConnections(generated.connections);
    setSelectedId(generated.nodes[0]?.id);
    setDirty(true);
    setSaved(false);
    setNotice(`${mode === "double" ? "Two bucket" : "Single bucket"} workspace generated with ${count} teams and ${rounds} rounds.`);
  }

  function updateNode(nodeId: string, patch: Partial<BracketNode>) {
    setNodes((items) => items.map((node) => node.id === nodeId ? { ...node, ...patch } : node));
    setDirty(true);
    setSaved(false);
  }

  function assignTeam(nodeId: string, team: string) {
    if (!team) return;
    updateNode(nodeId, { team, label: team, status: "paired" });
    setNotice(`${team} assigned. Save is required before users see the change.`);
  }

  function toolbarAction(action: string) {
    if (!selected) return;
    const nextStatus = action === "Cancel" ? "cancelled" : action === "Rematch" ? "rematch" : action === "Delete" ? "empty" : selected.status;
    updateNode(selected.id, action === "Delete" ? { team: "", label: "+", status: nextStatus } : { status: nextStatus });
    setNotice(`${action} prepared for ${selected.team || selected.label}. Save to persist the workspace.`);
  }

  function updateRoundSchedule(round: string, bucket: string, scheduled_at: string) {
    setRoundSchedules((items) => {
      const exists = items.some((item) => item.round === round && item.bucket === bucket);
      return exists
        ? items.map((item) => item.round === round && item.bucket === bucket ? { ...item, scheduled_at } : item)
        : [...items, { round, bucket, scheduled_at }];
    });
    setDirty(true);
    setSaved(false);
  }

  async function saveWorkspace() {
    const payload = {
      nodes: nodes.map((node) => ({
        id: node.id,
        label: node.label,
        team: node.team || "",
        round: node.round,
        x: Math.round(Number(node.x)),
        y: Math.round(Number(node.y)),
        status: node.status,
        bucket: node.bucket || "main",
        scheduled_at: roundSchedules.find((item) => item.round === node.round && (item.bucket === node.bucket || item.bucket === "all"))?.scheduled_at || node.scheduled_at || "",
      })),
      connections: connections.map((connection, index) => {
        const normalized = normalizeConnection(connection);
        return { ...normalized, id: normalized.id || `conn_${index + 1}` };
      }),
      round_schedules: roundSchedules,
      bucket_mode: bucketMode,
      publish: true,
      audit_reason: "Manager saved generated bracket workspace with schedules",
    };
    try {
      if (token) {
        const response = await apiRequest<{ nodes: BracketNode[]; connections: BracketConnection[]; roundSchedules?: RoundSchedule[] }>(`/management/brackets/${slug}/save`, { method: "POST", body: JSON.stringify(payload) }, token);
        setNodes(response.nodes);
        setConnections(response.connections);
        setRoundSchedules(response.roundSchedules ?? roundSchedules);
      }
      setDirty(false);
      setSaved(true);
      setNotice("Bracket saved. Manual notification can now be sent to teams.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Bracket save failed.");
    }
  }

  const scheduleRows = Array.from(new Set(nodes.filter((node) => node.round !== "Champion").map((node) => `${node.bucket || "main"}:${node.round}`)))
    .map((key) => {
      const [bucket, round] = key.split(":");
      return { bucket, round };
    });

  return (
    <Page>
      <PortalShell
        title="Bracket Allocation Workspace"
        subtitle={`${tournament.name} manager workspace. Auto bracket first, then manual edits before save and publish.`}
        sidebar={managementSidebar}
        action={<Link className="btn btn-secondary" to={`/tournaments/${tournament.slug}/rounds`}>Public rounds</Link>}
      >
        <div className="workspace-status">
          <span className={`status ${dirty ? "orange" : "emerald"}`}>{dirty ? "Unsaved changes" : "Saved"}</span>
          <p>{notice}</p>
        </div>
        <section className="panel bracket-generator-panel">
          <label>Workspace bucket
            <select value={bucketMode} onChange={(event) => { const mode = event.target.value as BucketMode; setBucketMode(mode); regenerate(mode, roundCount, teamCount); }}>
              <option value="single">Single bucket</option>
              <option value="double">Two bucket: left and right branch</option>
            </select>
          </label>
          <label>Total teams<input type="number" min={2} max={128} value={teamCount} onChange={(event) => setTeamCount(Number(event.target.value))} /></label>
          <label>Rounds<input type="number" min={2} max={9} value={roundCount} onChange={(event) => setRoundCount(Number(event.target.value))} /></label>
          <button className="btn btn-primary" type="button" onClick={() => regenerate()}><RefreshCw size={16} />Generate workspace</button>
        </section>
        <section className="panel bracket-schedule-panel">
          <h3>Round Date / Time Allocation</h3>
          <div className="round-schedule-grid">
            {scheduleRows.map((item) => (
              <label key={`${item.bucket}-${item.round}`}>{item.bucket !== "main" ? `${item.bucket} - ` : ""}{item.round}
                <input type="datetime-local" value={roundSchedules.find((row) => row.round === item.round && row.bucket === item.bucket)?.scheduled_at ?? ""} onChange={(event) => updateRoundSchedule(item.round, item.bucket, event.target.value)} />
              </label>
            ))}
          </div>
        </section>
        <div className="bracket-workspace">
          <aside className="team-bank panel">
            <h3>Accepted Teams</h3>
            {acceptedTeams.map((team, index) => (
              <button
                draggable
                className="team-pill"
                key={team.id || `${team.name}-${index}`}
                onDragStart={(event) => event.dataTransfer.setData("text/team", team.name)}
                onClick={() => selected && assignTeam(selected.id, team.name)}
              >
                <img src={team.logo || "/assets/logo.png"} alt="" />
                <span>{team.name}</span>
                <b>Seed {team.seed ?? index + 1}</b>
              </button>
            ))}
          </aside>
          <div className="workspace-canvas-column">
            <div className="bracket-zoom-toolbar panel">
              <button className={panMode ? "active" : ""} type="button" onClick={() => setPanMode((value) => !value)}><Hand size={16} />Hand</button>
              <button type="button" onClick={() => setZoom((value) => Math.max(.55, Number((value - .1).toFixed(2))))}><Minus size={16} /></button>
              <span>{Math.round(zoom * 100)}%</span>
              <button type="button" onClick={() => setZoom((value) => Math.min(1.8, Number((value + .1).toFixed(2))))}><ZoomIn size={16} /></button>
            </div>
            <BracketCanvas nodes={nodes} connections={connections} editable selected={selectedId} zoom={zoom} panMode={panMode} roundSchedules={roundSchedules} onSelect={(node) => setSelectedId(node.id)} onDropTeam={assignTeam} />
          </div>
          <aside className="inspector panel">
            <h3>Node Inspector</h3>
            <p><b>Round:</b> {selected?.round}</p>
            <p><b>Bucket:</b> {selected?.bucket || "main"}</p>
            <p><b>Team:</b> {selected?.team || "Empty slot"}</p>
            <p><b>Status:</b> {selected?.status}</p>
            <div className="inspector-actions">
              <button className="btn btn-secondary" onClick={() => toolbarAction("Pair")}>Pair</button>
              <button className="btn btn-secondary" onClick={() => toolbarAction("Next Round")}><ArrowRight size={16} /> Next round</button>
              <button className="btn btn-secondary" onClick={() => toolbarAction("Repair")}>Repair</button>
              <button className="btn btn-secondary" onClick={() => toolbarAction("Cancel")}>Cancel</button>
              <button className="btn btn-secondary" onClick={() => toolbarAction("Rematch")}>Rematch</button>
              <button className="btn btn-secondary" onClick={() => toolbarAction("Delete")}>Delete</button>
            </div>
          </aside>
        </div>
        <div className="bracket-toolbar panel">
          <button className="btn btn-primary" disabled={!dirty} onClick={saveWorkspace}>Save bracket</button>
          <button className="btn btn-secondary" onClick={() => regenerate()}>Regenerate auto bracket</button>
          <button className="btn btn-secondary" onClick={() => { if (selected) assignTeam(selected.id, "India Forge"); }}>Advance winner</button>
        </div>
        {saved && (
          <section className="notify-panel panel">
            <h3>Manual Notification</h3>
            <label><input type="checkbox" checked={channels.sms} onChange={(event) => setChannels({ ...channels, sms: event.target.checked })} /> SMS</label>
            <label><input type="checkbox" checked={channels.email} onChange={(event) => setChannels({ ...channels, email: event.target.checked })} /> Email</label>
            <button className="btn btn-primary" onClick={() => setNotice(`Notification sent by ${[channels.sms && "SMS", channels.email && "Email"].filter(Boolean).join(" and ")}.`)}><Bell size={18} /> Send update</button>
          </section>
        )}
      </PortalShell>
    </Page>
  );
}
