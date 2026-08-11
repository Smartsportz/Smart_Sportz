import { Download } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { DataTable, Page } from "../components/UI";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { archiveForTournament, individualScores, liveMatches, withRuntimeTournamentStatus } from "../data/platform";
import { InfoPanel, Metric } from "./shared";
import { apiRequest, mediaUrl } from "../lib/api";
import { SectionSkeleton } from "../lib/progressive";

async function downloadRulesPdf(tournament: Record<string, any>) {
  const rulesPdf = String(tournament.rulesPdf ?? tournament.rules_pdf ?? "").trim();
  const isPdfSource = /^data:application\/pdf/i.test(rulesPdf) || /^https?:\/\/.+\.pdf(\?|#|$)/i.test(rulesPdf) || /^\/media\/.+\.pdf(\?|#|$)/i.test(rulesPdf);
  if (!rulesPdf || !isPdfSource) {
    window.alert("Rules PDF is not uploaded for this tournament.");
    return;
  }
  const filename = rulesPdf.split("/").pop()?.split("?")[0] || `${tournament.slug}-rules.pdf`;
  if (/^https?:\/\//i.test(rulesPdf)) {
    const response = await fetch(rulesPdf);
    if (!response.ok) {
      window.alert("Rules PDF could not be downloaded.");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 300);
    return;
  }
  const link = document.createElement("a");
  link.href = rulesPdf;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function TournamentDetailPage() {
  const params = useParams();
  const tournamentQuery = useQuery({
    queryKey: ["public", "tournament", params.slug],
    queryFn: () => apiRequest<any>(`/public/tournaments/${params.slug}`, { silent: true }),
    enabled: Boolean(params.slug),
  });
  const [selectedArchiveMatchId, setSelectedArchiveMatchId] = useState("");

  if (tournamentQuery.isError) {
    return (
      <Page>
        <section className="panel user-empty-state">
          <h2>Tournament not found</h2>
          <p>This tournament is not available in the database.</p>
          <Link className="btn btn-primary" to="/tournaments">Back to tournaments</Link>
        </section>
      </Page>
    );
  }

  if (tournamentQuery.isLoading || !tournamentQuery.data) {
    return <Page><SectionSkeleton rows={3} /></Page>;
  }

  const remoteItem = tournamentQuery.data;
  const item = withRuntimeTournamentStatus({
    ...remoteItem,
    registrationStart: remoteItem.registrationStart ?? remoteItem.registration_start,
    registrationEnd: remoteItem.registrationEnd ?? remoteItem.registration_end,
    tournamentDescription: remoteItem.tournamentDescription ?? remoteItem.tournament_description,
    feeBreakdown: remoteItem.feeBreakdown ?? remoteItem.fee_breakdown ?? [],
  });
  const isLive = item.phase === "live";
  const isExisting = item.phase === "existing";
  const isFeatureOnly = Boolean((item as any).featureOnly);
  const registeredTeams = Number((item as any).registered_count ?? item.teams ?? 0);
  const capacity = Number(item.capacity ?? 0);
  const slotsFull = capacity > 0 && registeredTeams >= capacity;
  const canRegister = item.status === "Registration Open" && !slotsFull;
  const isUpcomingOnly = item.status === "Upcoming";
  const isRegistrationClosed = item.status === "Registration Closed";
  const liveMatch = liveMatches.find((match) => match.tournament === item.name) ?? liveMatches[0];
  const archive = archiveForTournament(item.slug);
  const archivedMatches = archive?.rounds.flatMap((round) => round.matches) ?? [];
  const selectedArchiveMatch = archivedMatches.find((match) => match.id === selectedArchiveMatchId) ?? archivedMatches[0];

  const action = isFeatureOnly ? null : isLive ? (
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
  ) : isRegistrationClosed ? (
    <>
      <span className="btn btn-secondary disabled-action">Registration closed {item.registrationEnd}</span>
      <Link className="btn btn-primary" to={`/tournaments/${item.slug}/rounds`}>Preview rounds</Link>
    </>
  ) : (
    <>
      {canRegister && <Link className="btn btn-primary" to={`/tournaments/${item.slug}/register`}>Register now</Link>}
      {item.status === "Registration Open" && slotsFull && <span className="btn btn-secondary disabled-action">Slots full</span>}
      <Link className="btn btn-secondary" to={`/tournaments/${item.slug}/rounds`}>Rounds</Link>
    </>
  );

  return (
    <Page>
      <section className="detail-hero">
        <img src={mediaUrl(item.image)} alt="" loading="eager" fetchpriority="high" />
        <div>
          <span className={`status ${item.accent}`}>{item.status}</span>
          <h1>{item.name}</h1>
          <p>{item.sport} tournament in {item.location}. Registration, payment, rules, schedule, venue, teams, live updates, and bracket rounds are connected in this frontend flow.</p>
          {action && <div className="hero-actions">{action}</div>}
        </div>
      </section>
      {isFeatureOnly ? (
        <div className="detail-grid tournament-info-grid">
          <InfoPanel title="Featured Event Details" items={[item.location, item.date, (item as any).tournamentDescription || "Manager-selected feature tournament showcase"]} to="/tournaments" highlight />
          <InfoPanel title="Public Showcase" items={["Name, place, and description only", "No registration button", "No rounds button", "Managed by admin or manager"]} to="/news" />
        </div>
      ) : isLive ? (
        <>
          <div className="detail-grid">
            <section className="panel video-panel">
              <span className="live-dot">Live video</span>
              <img src={mediaUrl(item.image)} alt="" loading="lazy" />
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
        archive ? (
          <div className="archive-detail-layout">
            <section className="panel archive-summary-panel">
              <div>
                <p className="eyebrow">Completed Tournament Archive</p>
                <h2>{archive.champion} won the title</h2>
                <p>{archive.description}</p>
              </div>
              <div className="archive-summary-grid">
                <Metric label="Champion" value={archive.champion} />
                <Metric label="Runner-up" value={archive.runnerUp} />
                <Metric label="Final Result" value={archive.finalScore} />
                <Metric label="MVP" value={archive.mvp} />
              </div>
            </section>

            <section className="detail-grid tournament-info-grid">
              <InfoPanel title="Partners" items={archive.partners} highlight />
              <InfoPanel title="Investments" items={[archive.investment, archive.attendance]} />
              <InfoPanel title="Managers" items={archive.managers} />
              <InfoPanel title="Operations" items={archive.operations} />
            </section>

            <section className="panel archive-rounds-panel">
              <div className="section-head-inline">
                <div>
                  <p className="eyebrow">Round Records</p>
                  <h2>Rounds, teams, scores, and recorded match videos</h2>
                </div>
                <Link className="btn btn-secondary" to={`/live?archive=${item.slug}`}>Open recorded videos</Link>
              </div>
              <div className="archive-round-stack">
                {archive.rounds.map((round) => (
                  <article className="archive-round-card" key={round.name}>
                    <div className="archive-round-head">
                      <h3>{round.name}</h3>
                      <p>{round.stageNote}</p>
                    </div>
                    <div className="archive-match-list">
                      {round.matches.map((match) => (
                        <button
                          className={`archive-match-button ${selectedArchiveMatch?.id === match.id ? "active" : ""}`}
                          type="button"
                          onClick={() => setSelectedArchiveMatchId(match.id)}
                          key={match.id}
                        >
                          <span>{match.title}</span>
                          <strong>{match.scoreA} - {match.scoreB}</strong>
                          <small>Winner: {match.winner}</small>
                        </button>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>

            {selectedArchiveMatch && (
              <section className="archive-match-detail">
                <article className="panel archive-video-panel">
                  <iframe
                    title={`${selectedArchiveMatch.title} recorded video`}
                    src={selectedArchiveMatch.videoUrl}
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                  <div>
                    <span className="status emerald">{selectedArchiveMatch.round}</span>
                    <h2>{selectedArchiveMatch.title}</h2>
                    <p>{selectedArchiveMatch.summary}</p>
                    <div className="archive-score-strip">
                      <strong>{selectedArchiveMatch.teamA}<b>{selectedArchiveMatch.scoreA}</b></strong>
                      <span>vs</span>
                      <strong>{selectedArchiveMatch.teamB}<b>{selectedArchiveMatch.scoreB}</b></strong>
                    </div>
                    <small>{selectedArchiveMatch.date} - {selectedArchiveMatch.venue}</small>
                  </div>
                </article>
                <section className="panel">
                  <h2>Team Player Score Details</h2>
                  <DataTable
                    columns={["Team", "Player", "Role", "Score", "Record"]}
                    rows={selectedArchiveMatch.players.map((player) => [
                      player.team,
                      <Link className="inline-link" to={`/teams/${player.team.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>{player.name}</Link>,
                      player.role,
                      player.score,
                      player.record,
                    ])}
                  />
                </section>
              </section>
            )}
          </div>
        ) : (
          <div className="detail-grid tournament-info-grid">
            <InfoPanel title="Archived Rounds" items={["Round scorecards", "Semi-final scorecards", "Final result", "Clickable player/team details"]} to={`/tournaments/${item.slug}/rounds`} highlight />
            <InfoPanel title="Final Result" items={["Winner records", "Runner-up records", "MVP scorecard", "Downloadable archives"]} to="/leaderboards" />
          </div>
        )
      ) : (
        <div className="detail-grid tournament-info-grid">
          <article className="panel tournament-rules-panel">
            <h3>Tournament Rules</h3>
            {["Roster min/max validation", "Team member details required", "Document verification required", "Payment required before approval"].map((rule) => (
              <p key={rule}><span className="rule-check">✓</span>{rule}</p>
            ))}
            <button className="btn btn-secondary wide" type="button" onClick={() => void downloadRulesPdf(item)}>
              <Download size={16} /> Download rules
            </button>
          </article>
          <InfoPanel title="Prize Pool" items={[item.prize, "Winner trophy", "MVP award", "Digital certificates"]} to="/leaderboards" highlight />
          <InfoPanel title="Schedule" items={[`Registration opens: ${item.registrationStart}`, `Registration ends: ${item.registrationEnd}`, "Qualifiers", "Final"]} to="/live" />
          <InfoPanel title="Venue And Capacity" items={[item.location, `${registeredTeams}/${capacity} teams`, slotsFull ? "Slots full" : "Smart venue map", "Officials and support desk"]} to="/contact" />
        </div>
      )}
    </Page>
  );
}
