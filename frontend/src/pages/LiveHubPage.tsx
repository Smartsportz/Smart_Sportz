import { Activity, Clock, MapPin, Radio, ShieldCheck, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Page } from "../components/UI";
import { apiRequest, mediaUrl, websocketUrl } from "../lib/api";
import { ProgressiveSection } from "../lib/progressive";
import { liveMatches, timeline } from "../data/platform";

type LivePerson = {
  team: string;
  name: string;
  role: string;
  status?: string;
  score?: string;
};

type PlayerScore = {
  team: string;
  player: string;
  score: string;
  detail: string;
  impact?: number;
};

type TeamStat = {
  possession?: number;
  shots?: string;
  accuracy?: string;
  momentum?: string;
};

export type LiveMatchDetail = {
  id: string;
  tournament: string;
  sport: string;
  home: string;
  away: string;
  score: string;
  awayScore: string;
  stage: string;
  status: string;
  image: string;
  youtubeUrl?: string;
  venue?: string;
  matchClock?: string;
  currentPlayers?: LivePerson[];
  substitutes?: LivePerson[];
  playerScores?: PlayerScore[];
  teamStats?: { home?: TeamStat; away?: TeamStat };
  timeline?: Array<{ time: string; type: string; text: string; score: string }>;
};

const fallbackDetails: LiveMatchDetail[] = liveMatches.map((match, index) => ({
  ...match,
  youtubeUrl: "https://www.youtube.com/embed/ThqHtJOfCK0",
  venue: index === 1 ? "Jawaharlal Nehru Indoor Arena, Chennai" : index === 2 ? "Delhi Youth Sports Complex" : "M. Chinnaswamy Stadium, Bengaluru",
  matchClock: match.stage,
  currentPlayers: [
    { team: match.home, name: index === 1 ? "Marcus Lee" : index === 2 ? "Aditya Rao" : "Rohan Sharma", role: index === 1 ? "Point Guard" : index === 2 ? "Forward" : "Striker", status: "Active", score: index === 1 ? "18 pts" : index === 2 ? "1 goal" : "74 (42)" },
    { team: match.home, name: index === 1 ? "Dev Arora" : index === 2 ? "Manu Iyer" : "Nikhil Rao", role: index === 1 ? "Forward" : index === 2 ? "Midfield" : "Non-striker", status: "Active", score: index === 1 ? "12 pts" : index === 2 ? "1 assist" : "39 (24)" },
    { team: match.away, name: index === 1 ? "Ryan Cole" : index === 2 ? "Kabir Shah" : "James Carter", role: index === 1 ? "Shooting Guard" : index === 2 ? "Forward" : "Bowler", status: "Active", score: index === 1 ? "21 pts" : index === 2 ? "1 goal" : "2/28" },
    { team: match.away, name: index === 1 ? "Arun Das" : index === 2 ? "Rohit Sen" : "Owen Smith", role: index === 1 ? "Center" : index === 2 ? "Goalkeeper" : "Keeper", status: "Active", score: index === 1 ? "9 reb" : index === 2 ? "4 saves" : "1 catch" },
  ],
  substitutes: [
    { team: match.home, name: "Impact Player", role: "Rotation" },
    { team: match.away, name: "Bench Option", role: "Tactical substitute" },
  ],
  playerScores: [
    { team: match.home, player: index === 1 ? "Marcus Lee" : index === 2 ? "Aditya Rao" : "Rohan Sharma", score: index === 1 ? "18 pts" : index === 2 ? "1 goal" : "74 runs", detail: "Highest impact so far", impact: 90 },
    { team: match.away, player: index === 1 ? "Ryan Cole" : index === 2 ? "Rohit Sen" : "James Carter", score: index === 1 ? "21 pts" : index === 2 ? "4 saves" : "2 wickets", detail: "Key pressure phase", impact: 86 },
  ],
  teamStats: {
    home: { possession: 56, shots: index === 0 ? "18 boundaries" : "12 attempts", accuracy: index === 0 ? "8.36 RR" : "51%", momentum: "Pressing" },
    away: { possession: 44, shots: index === 0 ? "4 wickets" : "10 attempts", accuracy: index === 0 ? "6.20 economy" : "47%", momentum: "Counter" },
  },
  timeline,
}));

function embedUrl(url?: string) {
  if (!url) return fallbackDetails[0].youtubeUrl;
  if (url.includes("embed/")) return url;
  const watch = url.match(/[?&]v=([^&]+)/)?.[1];
  if (watch) return `https://www.youtube.com/embed/${watch}`;
  const short = url.match(/youtu\.be\/([^?]+)/)?.[1];
  if (short) return `https://www.youtube.com/embed/${short}`;
  return url;
}

function teamPlayers(players: LivePerson[] = [], team: string) {
  return players.filter((player) => player.team === team);
}

function scoreRows(scores: PlayerScore[] = [], team: string) {
  return scores.filter((score) => score.team === team);
}

export function LiveMatchCenter({ initialMatchId }: { initialMatchId?: string }) {
  const [matches, setMatches] = useState<LiveMatchDetail[]>(fallbackDetails);
  const [selectedId, setSelectedId] = useState(initialMatchId ?? fallbackDetails[0].id);
  const liveQuery = useQuery({
    queryKey: ["live", "matches"],
    queryFn: () => apiRequest<LiveMatchDetail[]>("/live", { silent: true }),
  });
  const selected = useMemo(() => matches.find((match) => match.id === selectedId) ?? matches[0], [matches, selectedId]);

  useEffect(() => {
    const items = liveQuery.data;
    if (!items?.length) return;
    setMatches(items);
    setSelectedId((current) => items.some((item) => item.id === current) ? current : items[0].id);
  }, [liveQuery.data]);

  useEffect(() => {
    const socket = new WebSocket(websocketUrl("/live/ws"));
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as { event?: string; data?: LiveMatchDetail[] };
        if ((payload.event === "live:list:snapshot" || payload.event === "live:list:update") && Array.isArray(payload.data) && payload.data.length) {
          setMatches(payload.data);
          setSelectedId((current) => payload.data?.some((item) => item.id === current) ? current : payload.data?.[0]?.id || current);
        }
      } catch {
        return;
      }
    };
    return () => socket.close();
  }, []);

  useEffect(() => {
    if (initialMatchId) setSelectedId(initialMatchId);
  }, [initialMatchId]);

  useEffect(() => {
    if (!selectedId) return;
    const socket = new WebSocket(websocketUrl(`/live/ws/${selectedId}`));
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as { event?: string; data?: LiveMatchDetail };
        if ((payload.event === "score:snapshot" || payload.event === "score:update") && payload.data?.id) {
          setMatches((current) => current.map((match) => match.id === payload.data?.id ? { ...match, ...payload.data } : match));
        }
      } catch {
        return;
      }
    };
    return () => socket.close();
  }, [selectedId]);

  const homeStats = selected.teamStats?.home ?? {};
  const awayStats = selected.teamStats?.away ?? {};
  const events = selected.timeline?.length ? selected.timeline : timeline;

  return (
    <Page className="live-page live-match-center-page">
      <section className="live-control-bar">
        <div>
          <p className="eyebrow">Live Match Center</p>
          <h1>{selected.tournament}</h1>
        </div>
        <div className="live-control-meta">
          <span><Radio size={16} /> {selected.status}</span>
          <span><Clock size={16} /> {selected.matchClock || selected.stage}</span>
          <span><MapPin size={16} /> {selected.venue || "Smart Sportz arena"}</span>
        </div>
      </section>

      <section className="live-stage-grid">
        <ProgressiveSection query={{ queryKey: ["live", "video", selected.id] as const, queryFn: async () => selected }} skeletonRows={1} className="live-video-progressive">
          {(match) => (
            <div className="live-video-shell">
              <iframe
                title={`${match.tournament} live video`}
                src={embedUrl(match.youtubeUrl)}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
              <div className="live-video-badge"><Radio size={16} /> Manager YouTube Live</div>
            </div>
          )}
        </ProgressiveSection>
        <aside className="live-score-panel">
          <span className="live-dot">Live</span>
          <div className="live-score-row">
            <strong>{selected.home}</strong>
            <b>{selected.score}</b>
          </div>
          <div className="live-score-row">
            <strong>{selected.away}</strong>
            <b>{selected.awayScore}</b>
          </div>
          <p>{selected.sport} - {selected.stage}</p>
          <div className="live-stat-pair">
            <span>{homeStats.momentum ?? "High"} momentum</span>
            <span>{awayStats.momentum ?? "Holding"} momentum</span>
          </div>
          <Link className="btn btn-primary wide" to={`/live/${selected.id}`}>Open full match</Link>
        </aside>
      </section>

      <ProgressiveSection query={{ queryKey: ["live", "players", selected.id] as const, queryFn: async () => selected }} skeletonRows={2}>
        {(match) => (
          <section className="live-dashboard-grid">
            <article className="live-panel live-lineup-panel">
              <div className="live-panel-heading"><Users size={18} /><h2>Live Players</h2></div>
              <div className="live-team-columns">
                {[match.home, match.away].map((team) => (
                  <div key={team}>
                    <h3>{team}</h3>
                    {teamPlayers(match.currentPlayers, team).map((player) => (
                      <div className="live-player-row" key={`${team}-${player.name}`}>
                        <span>{player.role}</span>
                        <strong>{player.name}</strong>
                        <em>{player.score}</em>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </article>

            <article className="live-panel">
              <div className="live-panel-heading"><ShieldCheck size={18} /><h2>Substitutes</h2></div>
              <div className="live-sub-list">
                {(match.substitutes ?? []).map((player) => (
                  <div key={`${player.team}-${player.name}`}>
                    <span>{player.team}</span>
                    <strong>{player.name}</strong>
                    <p>{player.role}</p>
                  </div>
                ))}
              </div>
            </article>
          </section>
        )}
      </ProgressiveSection>

      <section className="live-dashboard-grid wide-left">
        <article className="live-panel">
          <div className="live-panel-heading"><Activity size={18} /><h2>Individual Player Scores</h2></div>
          <div className="live-scorecards">
            {[selected.home, selected.away].map((team) => (
              <div key={team}>
                <h3>{team}</h3>
                {scoreRows(selected.playerScores, team).map((row) => (
                  <div className="live-scorecard-row" key={`${team}-${row.player}`}>
                    <div>
                      <strong>{row.player}</strong>
                      <span>{row.detail}</span>
                    </div>
                    <b>{row.score}</b>
                    <meter min="0" max="100" value={row.impact ?? 70} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </article>

        <article className="live-panel live-timeline-panel">
          <div className="live-panel-heading"><Radio size={18} /><h2>Timeline</h2></div>
          {events.slice(0, 6).map((event) => (
            <div className="live-event-row" key={`${event.time}-${event.type}-${event.score}`}>
              <span>{event.time}</span>
              <strong>{event.type}</strong>
              <p>{event.text}</p>
              <b>{event.score}</b>
            </div>
          ))}
        </article>
      </section>

      <ProgressiveSection query={{ queryKey: ["live", "comparison", selected.id] as const, queryFn: async () => selected }} skeletonRows={2}>
        {() => (
          <section className="live-panel live-comparison-panel">
            <div className="live-panel-heading"><Activity size={18} /><h2>Team Control</h2></div>
            <div className="live-comparison-grid">
              <div>
                <h3>{selected.home}</h3>
                <strong>{homeStats.possession ?? 50}%</strong>
                <p>{homeStats.shots ?? "Active attempts"} - {homeStats.accuracy ?? "High accuracy"}</p>
              </div>
              <div>
                <h3>{selected.away}</h3>
                <strong>{awayStats.possession ?? 50}%</strong>
                <p>{awayStats.shots ?? "Active attempts"} - {awayStats.accuracy ?? "High accuracy"}</p>
              </div>
            </div>
          </section>
        )}
      </ProgressiveSection>
    </Page>
  );
}

export function LiveHubPage() {
  return (
    <Page className="live-page live-list-page">
      <section className="live-list-hero coming-soon-hero">
        <p className="eyebrow">Live Tournaments</p>
        <h1>Coming Soon</h1>
      </section>
    </Page>
  );
}
