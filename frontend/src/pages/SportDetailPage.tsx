import { Link, useParams } from "react-router-dom";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Page, TournamentCard } from "../components/UI";
import { assets, sports, withRuntimeTournamentStatus } from "../data/platform";
import { apiRequest } from "../lib/api";
import { ProgressiveSection, SectionSkeleton } from "../lib/progressive";
import { InfoPanel, Metric, PageHero } from "./shared";

export function SportDetailPage() {
  const { slug } = useParams();
  const sportQuery = useQuery({
    queryKey: ["public", "sport", slug],
    queryFn: () => apiRequest<Record<string, any>>(`/public/sports/${slug}`, { silent: true }),
    enabled: Boolean(slug),
  });
  const remoteSport = sportQuery.data ?? null;
  const remoteTournaments = Array.isArray(remoteSport?.tournaments) ? remoteSport.tournaments : [];
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

  return (
    <Page>
      <PageHero title={`${sport.name} Operations`} text="Category detail page for discovery, rules, active tournaments, live scoring model, and registration routing." />
      <section className="detail-hero">
        <img src={sport.name === "Football" ? assets.football : sport.name === "Basketball" ? assets.basketball : assets.cricket} alt="" loading="eager" fetchpriority="high" />
        <div>
          <span className={`status ${sport.color ?? "emerald"}`}>{activeCount} active tournaments</span>
          <h1>{sport.name}</h1>
          <p>Manage sport-specific categories, eligibility rules, scoring templates, registration fields, fixture formats, and public discovery pages.</p>
          <a className="btn btn-primary" href="#sport-tournaments">View tournaments</a>
        </div>
      </section>
      <section id="sport-tournaments" className="sport-tournament-sections">
        {sportQuery.isLoading ? <SectionSkeleton rows={3} /> : sections.map(([title, items]) => (
          <ProgressiveSection key={title} query={{ queryKey: ["sport-section", slug, title] as const, queryFn: async () => items }} skeletonRows={Math.max(2, Math.min(items.length, 4))}>
            {() => (
              <div className="status-section">
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
            )}
          </ProgressiveSection>
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
