import { Link, useParams } from "react-router-dom";
import { DataTable, Page } from "../components/UI";
import { individualScores, liveMatches, tournaments } from "../data/platform";
import { InfoPanel, Metric } from "./shared";

export function TournamentDetailPage() {
  const params = useParams();
  const item = tournaments.find((t) => t.slug === params.slug) ?? tournaments[0];
  const isLive = item.phase === "live";
  const isExisting = item.phase === "existing";
  const canRegister = item.status === "Registration Open";
  const isUpcomingOnly = item.status === "Upcoming";
  const liveMatch = liveMatches.find((match) => match.tournament === item.name) ?? liveMatches[0];
  const action = isLive ? (
    <>
      <Link className="btn btn-primary" to={`/live/${liveMatch.id}`}>Open live center</Link>
      <Link className="btn btn-secondary" to={`/tournaments/${item.slug}/rounds`}>Rounds</Link>
    </>
  ) : isExisting ? (
    <>
      <Link className="btn btn-primary" to={`/tournaments/${item.slug}/rounds`}>View rounds</Link>
      <Link className="btn btn-secondary" to="/leaderboards">Download records</Link>
    </>
  ) : isUpcomingOnly ? (
    <>
      <span className="btn btn-secondary disabled-action">Registration opens {item.registrationStart}</span>
      <Link className="btn btn-primary" to={`/tournaments/${item.slug}/rounds`}>Preview rounds</Link>
    </>
  ) : (
    <>
      {canRegister && <Link className="btn btn-primary" to={`/tournaments/${item.slug}/register`}>Register now</Link>}
      <Link className="btn btn-secondary" to={`/tournaments/${item.slug}/rounds`}>Rounds</Link>
    </>
  );

  return (
    <Page>
      <section className="detail-hero">
        <img src={item.image} alt="" />
        <div>
          <span className={`status ${item.accent}`}>{item.status}</span>
          <h1>{item.name}</h1>
          <p>{item.sport} tournament in {item.location}. Registration, payment, rules, schedule, venue, teams, live updates, and bracket rounds are connected in this frontend flow.</p>
          <div className="hero-actions">{action}</div>
        </div>
      </section>
      {isLive ? (
        <>
          <div className="detail-grid">
            <section className="panel video-panel">
              <span className="live-dot">Live video</span>
              <img src={item.image} alt="" />
            </section>
            <section className="panel">
              <h2>Live match intelligence</h2>
              <div className="score-teams detail-score">
                <strong>{liveMatch.home}</strong>
                <span>{liveMatch.score}</span>
                <em>vs</em>
                <span>{liveMatch.awayScore}</span>
                <strong>{liveMatch.away}</strong>
              </div>
              <div className="mini-grid">
                <Metric label="Timing" value={liveMatch.stage} />
                <Metric label="Highlights" value="12" />
                <Metric label="Records" value="8" />
              </div>
            </section>
          </div>
          <div className="detail-grid">
            <section className="panel">
              <h2>Team-wise individual scores</h2>
              <DataTable columns={["Team", "Player", "Score", "Record"]} rows={individualScores.map((row) => [row.team, row.player, row.score, row.record])} />
            </section>
            <InfoPanel title="Live Records" items={["Score history by over/period", "Commentary and timeline", "Team-wise individual scorecards", "Highlights and match records"]} to={`/tournaments/${item.slug}/rounds`} highlight />
          </div>
        </>
      ) : isExisting ? (
        <div className="detail-grid tournament-info-grid">
          <InfoPanel title="Archived Rounds" items={["Round-1 scorecards", "Semi-final scorecards", "Final result", "Clickable player/team details"]} to={`/tournaments/${item.slug}/rounds`} highlight />
          <InfoPanel title="Final Result" items={["Winner: India Forge", "Runner-up: Mumbai Mavericks", "MVP: Rohan Sharma", "Downloadable records available"]} to="/leaderboards" />
          <InfoPanel title="Highlights" items={["Best plays", "Score history", "Match timeline", "Player records"]} to="/gallery" />
          <InfoPanel title="Documents" items={["Final fixture PDF", "Certificates", "Invoice archive", "Officials report"]} to="/user/documents" />
        </div>
      ) : (
        <div className="detail-grid tournament-info-grid">
          <InfoPanel title="Tournament Rules" items={["Roster min/max validation", "Team member details required", "Document verification required", "Payment required before approval"]} to="/faq" />
          <InfoPanel title="Prize Pool" items={[item.prize, "Winner trophy", "MVP award", "Digital certificates"]} to="/leaderboards" highlight />
          <InfoPanel title="Schedule" items={[`Registration opens: ${item.registrationStart}`, `Registration ends: ${item.registrationEnd}`, "Qualifiers", "Final"]} to="/live" />
          <InfoPanel title="Venue And Capacity" items={[item.location, `${item.teams}/${item.capacity} teams`, "Smart venue map", "Officials and support desk"]} to="/contact" />
        </div>
      )}
    </Page>
  );
}
