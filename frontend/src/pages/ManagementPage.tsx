import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DataTable, Page, PortalShell } from "../components/UI";
import { useAuth } from "../auth/AuthContext";
import { managementSidebar } from "../data/platform";
import { apiRequest } from "../lib/api";
import { NoticeBuilder } from "./AdminPage";

type ManagementDashboardData = {
  assignedCities: string[];
  assignedTournaments: Array<Record<string, any>>;
  pendingRegistrations: Array<Record<string, any>>;
  liveMatches: Array<Record<string, any>>;
};

export function ManagementPage() {
  const { token } = useAuth();
  const [data, setData] = useState<ManagementDashboardData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    apiRequest<ManagementDashboardData>("/management/dashboard", {}, token)
      .then((payload) => {
        if (alive) setData(payload);
      })
      .catch((caught) => {
        if (alive) setError(caught instanceof Error ? caught.message : "Could not load management dashboard.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [token]);

  return (
    <Page>
      <PortalShell title="" subtitle="" sidebar={managementSidebar}>
        {error && <div className="form-alert">{error}</div>}
        {loading ? (
          <section className="panel user-empty-state"><h2>Loading manager dashboard</h2><p>Fetching assigned city records from the backend database.</p></section>
        ) : (
          <div className="manager-dashboard-compact">
            <div className="user-metrics-grid">
              <article className="user-metric-card"><span>Scope</span><p>Assigned Cities</p><strong>{data?.assignedCities.length ?? 0}</strong></article>
              <article className="user-metric-card"><span>Active</span><p>Tournaments</p><strong>{data?.assignedTournaments.length ?? 0}</strong></article>
              <article className="user-metric-card"><span>Queue</span><p>Registrations</p><strong>{data?.pendingRegistrations.length ?? 0}</strong></article>
              <article className="user-metric-card"><span>Live</span><p>Matches</p><strong>{data?.liveMatches.length ?? 0}</strong></article>
            </div>
            <div className="dashboard-two">
              <section className="panel">
                <h2>Assigned Cities</h2>
                {data?.assignedCities.length ? data.assignedCities.map((city) => <div className="row-item readonly-row" key={city}><span>{city}</span><b>Manager access</b></div>) : <p>No city assignment found.</p>}
              </section>
              <section className="panel">
                <h2>Quick Actions</h2>
                <Link className="row-item" to="/management/tournaments"><span>Tournaments</span><b>Manage</b></Link>
                <Link className="row-item" to="/management/registrations"><span>Registrations</span><b>Review</b></Link>
                <Link className="row-item" to="/management/news"><span>News and notices</span><b>Publish</b></Link>
              </section>
            </div>
            <DataTable
              columns={["Tournament", "Status", "City", "Action"]}
              rows={(data?.assignedTournaments ?? []).map((item) => [
                item.name,
                <span className={`status ${item.accent ?? "emerald"}`}>{item.status}</span>,
                item.location ?? "Assigned city",
                <span className="table-actions"><Link to={`/tournaments/${item.slug}`}>Open</Link><Link to={`/management/tournaments/${item.slug}/bracket`}>Bracket</Link></span>,
              ])}
            />
            <div className="manager-notice-down">
              <NoticeBuilder role="manager" />
            </div>
          </div>
        )}
      </PortalShell>
    </Page>
  );
}
