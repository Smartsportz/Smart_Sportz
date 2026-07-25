import { useMemo, useState } from "react";
import { DataTable, Page } from "../components/UI";
import { leaderboardRecords, sports } from "../data/platform";
import { PageHero } from "./shared";

export function LeaderboardsPage() {
  const [sport, setSport] = useState("Cricket");
  const records = useMemo(() => leaderboardRecords.filter((item) => item.sport === sport).sort((a, b) => a.rank - b.rank), [sport]);

  return (
    <Page>
      <PageHero title="Sport Leaderboards" text="Filter by game to view ranked teams, records, win rate, and points." />
      <div className="leaderboard-filter">
        {sports.map((item) => (
          <button className={item.name === sport ? "active" : ""} type="button" onClick={() => setSport(item.name)} key={item.slug}>{item.name}</button>
        ))}
      </div>
      <section className="panel leaderboard-panel">
        <DataTable
          columns={["Rank", "Team Name", "City", "Tournaments Won", "Win Rate", "Points", "Record"]}
          rows={records.map((item) => [
            `#${String(item.rank).padStart(2, "0")}`,
            item.teamName,
            item.city,
            item.tournamentsWon,
            `${item.winRate}%`,
            item.points.toLocaleString("en-IN"),
            item.recordLabel,
          ])}
        />
      </section>
    </Page>
  );
}
