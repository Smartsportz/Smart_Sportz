import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { DataTable, Page, PortalShell } from "../components/UI";
import { useAuth } from "../auth/AuthContext";
import { managementSidebar } from "../data/platform";
import { apiRequest } from "../lib/api";
import { ProgressiveSection, SectionSkeleton } from "../lib/progressive";
import { NoticeBuilder } from "./AdminPage";

type ManagementDashboardData = {
  assignedCities: string[];
  assignedTournaments: Array<Record<string, any>>;
  pendingRegistrations: Array<Record<string, any>>;
  liveMatches: Array<Record<string, any>>;
};

export function ManagementPage() {
  const { token } = useAuth();
  const dashboardQuery = useQuery({
    queryKey: ["management", "dashboard", token],
    queryFn: () => apiRequest<ManagementDashboardData>("/management/dashboard", { silent: true }, token),
    enabled: Boolean(token),
    staleTime: 60_000,
  });
  const data = dashboardQuery.data;
  const dashboardDataQuery = {
    queryKey: ["management", "dashboard-lower", token] as const,
    queryFn: async () => dashboardQuery.data ?? dashboardQuery.refetch().then((result) => result.data as ManagementDashboardData),
  };

  return (
    <Page>
      <PortalShell title="" subtitle="" sidebar={managementSidebar}>
        {dashboardQuery.isError && <div className="form-alert">{dashboardQuery.error instanceof Error ? dashboardQuery.error.message : "Could not load management dashboard."}</div>}
        {dashboardQuery.isLoading ? (
          <section className="panel"><SectionSkeleton rows={3} /></section>
        ) : (
          <div className="manager-dashboard-compact">
            <div className="user-metrics-grid">
              <article className="user-metric-card"><span>Scope</span><p>Assigned Cities</p><strong>{data?.assignedCities.length ?? 0}</strong></article>
              <article className="user-metric-card"><span>Active</span><p>Tournaments</p><strong>{data?.assignedTournaments.length ?? 0}</strong></article>
              <article className="user-metric-card"><span>Queue</span><p>Registrations</p><strong>{data?.pendingRegistrations.length ?? 0}</strong></article>
              <article className="user-metric-card"><span>Live</span><p>Matches</p><strong>{data?.liveMatches.length ?? 0}</strong></article>
            </div>
            <ProgressiveSection query={dashboardDataQuery} skeletonRows={2}>
              {(loaded) => (
                <div className="dashboard-two">
                  <section className="panel">
                    <h2>Assigned Cities</h2>
                    {loaded.assignedCities.length ? loaded.assignedCities.map((city) => <div className="row-item readonly-row" key={city}><span>{city}</span><b>Manager access</b></div>) : <p>No city assignment found.</p>}
                  </section>
                  <section className="panel">
                    <h2>Quick Actions</h2>
                    <Link className="row-item" to="/management/tournaments"><span>Tournaments</span><b>Manage</b></Link>
                    <Link className="row-item" to="/management/registrations"><span>Registrations</span><b>Review</b></Link>
                    <Link className="row-item" to="/management/news"><span>News and notices</span><b>Publish</b></Link>
                  </section>
                </div>
              )}
            </ProgressiveSection>
            <ProgressiveSection query={dashboardDataQuery} skeletonRows={1}>
              {(loaded) => (
                <DataTable
                  columns={["Tournament", "Status", "City", "Action"]}
                  rows={loaded.assignedTournaments.map((item) => [
                    item.name,
                    <span className={`status ${item.accent ?? "emerald"}`}>{item.status}</span>,
                    item.location ?? "Assigned city",
                    <span className="table-actions"><Link to={`/tournaments/${item.slug}`}>Open</Link><Link to={`/management/tournaments/${item.slug}/bracket`}>Bracket</Link></span>,
                  ])}
                />
              )}
            </ProgressiveSection>
            <ProgressiveSection query={dashboardDataQuery} skeletonRows={1}>
              {() => <div className="manager-notice-down"><NoticeBuilder role="manager" /></div>}
            </ProgressiveSection>
          </div>
        )}
      </PortalShell>
    </Page>
  );
}
