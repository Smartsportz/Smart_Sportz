import { Send } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { DataTable, Page } from "../components/UI";
import { individualScores, liveMatches, timeline, tournaments } from "../data/platform";
import { Metric, StatBar } from "./shared";

export function LiveMatchPage() {
  const { matchId } = useParams();
  const match = liveMatches.find((item) => item.id === matchId) ?? liveMatches[0];
  const tournament = tournaments.find((item) => item.name === match.tournament);

  return (
    <Page className="live-page">
      <section className="scoreboard">
        <div>
          <span className="live-dot">Live</span>
          <h1>{match.tournament}</h1>
          <p>{match.sport} - {match.stage}</p>
          {tournament && <Link className="btn btn-secondary" to={`/tournaments/${tournament.slug}/rounds`}>Rounds</Link>}
        </div>
        <div className="score-teams">
          <strong>{match.home}</strong>
          <span>{match.score}</span>
          <em>vs</em>
          <span>{match.awayScore}</span>
          <strong>{match.away}</strong>
        </div>
      </section>
      <div className="score-layout">
        <section className="panel video-panel">
          <span className="live-dot">Live video</span>
          <img src={match.image} alt="" />
        </section>
        <section className="panel">
          <h2>Match statistics</h2>
          <StatBar label="Run Rate / Momentum" left="62%" right="38%" />
          <StatBar label="Possession / Control" left="54%" right="46%" />
          <div className="mini-grid">
            <Metric label="Boundaries" value="18" />
            <Metric label="Wickets" value="4" />
            <Metric label="Projected" value="188" />
          </div>
        </section>
      </div>
      <div className="score-layout">
        <section className="panel">
          <h2>Team-wise individual scores</h2>
          <DataTable columns={["Team", "Player", "Score", "Record"]} rows={individualScores.map((row) => [row.team, row.player, row.score, row.record])} />
        </section>
        <section className="panel timeline">
          <h2>Live timeline</h2>
          {timeline.map((event) => (
            <div className="timeline-item" key={event.time}>
              <span>{event.time}</span>
              <b>{event.type}</b>
              <p>{event.text}</p>
              <small>{event.score}</small>
            </div>
          ))}
          <div className="comment-box">
            <input placeholder="Add commentary (admin only)..." />
            <button><Send size={18} /></button>
          </div>
        </section>
      </div>
      <div className="detail-grid">
        <section className="panel">
          <h2>Highlights</h2>
          {["Powerplay boundary package", "Key wicket replay", "Fielding moments", "Captain review"].map((item) => <p key={item}>{item}</p>)}
        </section>
        <section className="panel">
          <h2>Records</h2>
          {["Fastest fifty: Rohan Sharma", "Best economy: James Carter", "Highest stand: 82", "Current run rate: 8.36"].map((item) => <p key={item}>{item}</p>)}
        </section>
      </div>
    </Page>
  );
}
