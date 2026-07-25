import { CheckCircle2, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { DataTable, MetricCard, Page } from "../components/UI";
import { assets, dashboardStats, liveMatches, logRows, tournaments } from "../data/platform";

export function PageHero({ title, text }: { title: string; text: string }) {
  return (
    <section className="page-hero">
      <p className="eyebrow">SmartSportz.in</p>
      <h1>{title}</h1>
      <p>{text}</p>
    </section>
  );
}

export function InfoPanel({ title, items, highlight, to }: { title: string; items: string[]; highlight?: boolean; to?: string }) {
  const panel = (
    <article className={`panel ${highlight ? "highlight-panel" : ""}`}>
      <h3>{title}</h3>
      {items.map((item) => (
        <p key={item}>
          <CheckCircle2 size={16} />
          {item}
        </p>
      ))}
    </article>
  );

  return to ? <Link to={to} className="click-card">{panel}</Link> : panel;
}

export function StatBar({ label, left, right }: { label: string; left: string; right: string }) {
  return (
    <div className="statbar">
      <div>
        <span>{label}</span>
        <b>{left} / {right}</b>
      </div>
      <div className="bar">
        <span style={{ width: left }} />
      </div>
    </div>
  );
}

export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-mini">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

export function TeamCard({ team }: { team: any }) {
  return (
    <Link to={`/teams/${team.slug}`} className="click-card">
      <article className="team-card">
        <img src={team.image} alt="" />
        <span>{team.rank}</span>
        <h3>{team.name}</h3>
        <p>{team.sport} - {team.players} players</p>
        <div className="meter">
          <span style={{ width: `${team.rating}%` }} />
        </div>
      </article>
    </Link>
  );
}

export function CatalogPage({
  title,
  items,
  embedded = false,
}: {
  title: string;
  items: Array<{ title: string; text: string; icon: any; path?: string }>;
  embedded?: boolean;
}) {
  const content = (
    <div className="catalog-grid">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Link to={item.path ?? "#"} className="click-card" key={item.title}>
          <article className="panel">
            <Icon size={24} />
            <h3>{item.title}</h3>
            <p>{item.text}</p>
          </article>
          </Link>
        );
      })}
    </div>
  );

  if (embedded) return content;

  return (
    <Page>
      <PageHero title={title} text="A complete reusable page model from the frontend structure blueprint." />
      {content}
    </Page>
  );
}

export function DashboardGrid() {
  return (
    <div className="metrics-grid">
      {dashboardStats.map((stat) => (
        <MetricCard key={stat.label} {...stat} to={stat.path} />
      ))}
    </div>
  );
}

export function AdminOverview() {
  return (
    <div className="dashboard-two">
      <section className="panel">
        <h2>Featured tournaments</h2>
        {tournaments.slice(0, 3).map((t) => (
          <Link className="row-item" to={`/tournaments/${t.slug}`} key={t.slug}>
            <span>{t.name}</span>
            <b>{t.status}</b>
          </Link>
        ))}
      </section>
      <section className="panel">
        <h2>System logs</h2>
        {logRows.map((log) => (
          <Link className="row-item" to="/admin/logs" key={log}>
            <span>{log}</span>
            <small>Just now</small>
          </Link>
        ))}
      </section>
    </div>
  );
}

export function ListPanel({ title, items, to = "/admin/dashboard" }: { title: string; items: string[]; to?: string }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      {items.map((item) => (
        <Link className="row-item" to={to} key={item}>
          <span>{item}</span>
          <span className="btn btn-secondary">Review</span>
        </Link>
      ))}
    </section>
  );
}

export function AthleteProfile() {
  return (
    <section className="profile-panel">
      <img src={assets.cricket} alt="" />
      <div>
        <span className="status emerald">Active</span>
        <h2>Arjun R. Sharma</h2>
        <p>Captain - Mumbai Mavericks - Performance index 94.2</p>
        <div className="mini-grid">
          <Metric label="Runs" value="4,281" />
          <Metric label="Avg" value="42.5" />
          <Metric label="Matches" value="28" />
        </div>
      </div>
    </section>
  );
}

export function MatchControlTable() {
  return (
    <DataTable
      columns={["Match", "Score", "Status", "Action"]}
      rows={liveMatches.map((m) => [
        `${m.home} vs ${m.away}`,
        `${m.score} - ${m.awayScore}`,
        <span className="status orange">{m.status}</span>,
        <span className="table-actions"><Link to={`/management/matches/${m.id}/control`}>Control</Link><Link to="/management/tournaments/bangalore-corporate-t20/bracket">Rounds</Link></span>,
      ])}
    />
  );
}

export function CmsCatalog() {
  return (
    <CatalogPage
      embedded
      title="CMS Builder"
      items={["Homepage Hero", "Sponsors", "Gallery", "Blogs", "FAQs", "About", "Contact", "Footer"].map((title) => ({
        title,
        text: "Editable CMS section",
        icon: FileText,
      }))}
    />
  );
}
