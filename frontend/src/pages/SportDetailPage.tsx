import { Link, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { Page, TournamentCard } from "../components/UI";
import { assets, sports, withRuntimeTournamentStatus } from "../data/platform";
import { apiRequest } from "../lib/api";
import { InfoPanel, Metric, PageHero } from "./shared";

export function SportDetailPage() {
  const { slug } = useParams();
  const [remoteSport, setRemoteSport] = useState<Record<string, any> | null>(null);
  const [remoteTournaments, setRemoteTournaments] = useState<Array<Record<string, any>>>([]);
  const sport = remoteSport ?? sports.find((item) => item.slug === slug) ?? sports[0];
  const related = useMemo<any[]>(() => remoteTournaments.map((item) => withRuntimeTournamentStatus({
    ...item,
    registrationStart: item.registrationStart ?? item.registration_start,
    registrationEnd: item.registrationEnd ?? item.registration_end,
  } as any)), [remoteTournaments]);
  const grouped = {
    upcoming: related.filter((item) => item.status === "Upcoming" || item.status === "Registration Open" || item.status === "Registration Closed"),
    live: related.filter((item) => item.phase === "live"),
    existing: related.filter((item) => item.phase === "existing"),
  };
  const sections = [
    ["Upcoming Tournaments", grouped.upcoming],
    ["Live Tournaments", grouped.live],
    ["Existing / Completed Tournaments", grouped.existing],
  ] as const;
  const activeCount = related.filter((item) => item.status !== "Completed").length;

  useEffect(() => {
    if (!slug) return;
    let alive = true;
    apiRequest<Record<string, any>>(`/public/sports/${slug}`)
      .then((payload) => {
        if (!alive) return;
        setRemoteSport(payload);
        setRemoteTournaments(Array.isArray(payload.tournaments) ? payload.tournaments : []);
      })
      .catch(() => {
        if (!alive) {
          return;
        }
        setRemoteSport(null);
        setRemoteTournaments([]);
      });
    return () => {
      alive = false;
    };
  }, [slug]);

  return (
    <Page>
      <PageHero title={`${sport.name} Operations`} text="Category detail page for discovery, rules, active tournaments, live scoring model, and registration routing." />
      <section className="detail-hero">
        <img src={sport.name === "Football" ? assets.football : sport.name === "Basketball" ? assets.basketball : assets.cricket} alt="" />
        <div>
          <span className={`status ${sport.color ?? "emerald"}`}>{activeCount} active tournaments</span>
          <h1>{sport.name}</h1>
          <p>Manage sport-specific categories, eligibility rules, scoring templates, registration fields, fixture formats, and public discovery pages.</p>
          <a className="btn btn-primary" href="#sport-tournaments">View tournaments</a>
        </div>
      </section>
      <section id="sport-tournaments" className="sport-tournament-sections">
        {sections.map(([title, items]) => (
          <div className="status-section" key={title}>
            <div className="section-title compact">
              <p className="eyebrow">{sport.name}</p>
              <h2>{title}</h2>
            </div>
            {items.length ? (
              <div className="card-grid">
                {items.map((item) => <TournamentCard key={item.slug} item={item} />)}
              </div>
            ) : (
              <section className="panel empty-panel">
                <h3>No {title.toLowerCase()} yet</h3>
                <p>Only {sport.name} tournaments appear on this page. Other sports stay in their own category pages.</p>
              </section>
            )}
          </div>
        ))}
      </section>
      <div className="detail-grid">
        <InfoPanel title="Supported Workflows" items={["Public category listing", "Sport-specific registration forms", "Live score template mapping", "Rules and document validation"]} to="/tournaments" />
        <InfoPanel title="Scoring Intelligence" items={["Timeline updates", "Statistics dashboard", "Officials control panel", "Audience live hub"]} to="/live" highlight />
        <section className="panel">
          <h3>Active Category Metrics</h3>
          <div className="mini-grid">
            <Metric label="Active" value={`${activeCount}`} />
            <Metric label="Related" value={`${related.length}`} />
            <Metric label="Templates" value="6" />
          </div>
        </section>
        <InfoPanel title="Admin Controls" items={["Enable category", "Configure fields", "Assign fixture rules", "Publish CMS content"]} to="/admin/tournaments" />
      </div>
    </Page>
  );
}
