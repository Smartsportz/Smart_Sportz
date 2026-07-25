import { ArrowRight, Bell, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Page, PortalShell } from "../components/UI";
import { acceptedTeams, bracketConnections, bracketNodes, managementSidebar, tournaments } from "../data/platform";
import { InfoPanel } from "./shared";

type BracketNode = typeof bracketNodes[number];

function bracketPath(from: BracketNode, to: BracketNode) {
  const startX = from.x + (from.x < to.x ? 4 : -4);
  const startY = from.y;
  const endX = to.x + (from.x < to.x ? -4 : 4);
  const endY = to.y;
  const midX = (startX + endX) / 2;
  return `M ${startX} ${startY} H ${midX} V ${endY} H ${endX}`;
}

const bracketStages = [
  { label: "Round-1", x: 8 },
  { label: "Quarter", x: 34 },
  { label: "Semi-Final", x: 60 },
  { label: "Final", x: 80 },
  { label: "Champion", x: 94 },
];

function BracketCanvas({
  nodes,
  editable = false,
  publicMode = false,
  hideTeams = false,
  onDropTeam,
  onSelect,
  selected,
}: {
  nodes: BracketNode[];
  editable?: boolean;
  publicMode?: boolean;
  hideTeams?: boolean;
  onDropTeam?: (nodeId: string, team: string) => void;
  onSelect?: (node: BracketNode) => void;
  selected?: string;
}) {
  return (
    <section className={`bracket-canvas panel ${publicMode ? "public-bracket" : ""}`}>
      {bracketStages.map((stage) => (
        <div className="round-label" key={stage.label} style={{ left: `${stage.x}%` }}>{stage.label}</div>
      ))}
      <svg className="bracket-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {bracketConnections.map(([source, target]) => {
          const from = nodes.find((node) => node.id === source);
          const to = nodes.find((node) => node.id === target);
          if (!from || !to) return null;
          return <path key={`${source}-${target}`} d={bracketPath(from, to)} />;
        })}
      </svg>
      {nodes.map((node) => (
        <button
          className={`bracket-node ${node.status} ${selected === node.id ? "selected" : ""}`}
          key={node.id}
          style={{ left: `${node.x}%`, top: `${node.y}%` }}
          onClick={() => onSelect?.(node)}
          onDragOver={(event) => editable && event.preventDefault()}
          onDrop={(event) => {
            if (!editable) return;
            onDropTeam?.(node.id, event.dataTransfer.getData("text/team"));
          }}
        >
          <span className="node-mark">{publicMode ? "" : node.team ? node.team.charAt(0) : <Plus size={18} />}</span>
          {!hideTeams && <b>{node.team || (publicMode ? "TBD" : node.label)}</b>}
        </button>
      ))}
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
      <BracketCanvas nodes={bracketNodes} publicMode hideTeams={hideTeams} />
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
  const tournament = tournaments.find((item) => item.slug === slug) ?? tournaments[1];
  const [nodes, setNodes] = useState<BracketNode[]>(bracketNodes);
  const [selectedId, setSelectedId] = useState(nodes[0]?.id);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [channels, setChannels] = useState({ sms: true, email: true });
  const [notice, setNotice] = useState("Auto bracket generated from accepted teams.");
  const selected = useMemo(() => nodes.find((node) => node.id === selectedId), [nodes, selectedId]);

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

  function saveWorkspace() {
    setDirty(false);
    setSaved(true);
    setNotice("Bracket saved. Manual notification can now be sent to teams.");
  }

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
        <div className="bracket-workspace">
          <aside className="team-bank panel">
            <h3>Accepted Teams</h3>
            {acceptedTeams.map((team) => (
              <button
                draggable
                className="team-pill"
                key={team.id}
                onDragStart={(event) => event.dataTransfer.setData("text/team", team.name)}
                onClick={() => selected && assignTeam(selected.id, team.name)}
              >
                <img src={team.logo} alt="" />
                <span>{team.name}</span>
                <b>Seed {team.seed}</b>
              </button>
            ))}
          </aside>
          <BracketCanvas nodes={nodes} editable selected={selectedId} onSelect={(node) => setSelectedId(node.id)} onDropTeam={assignTeam} />
          <aside className="inspector panel">
            <h3>Node Inspector</h3>
            <p><b>Round:</b> {selected?.round}</p>
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
          <button className="btn btn-secondary" onClick={() => { setNodes(bracketNodes); setDirty(true); setSaved(false); }}>Regenerate auto bracket</button>
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
