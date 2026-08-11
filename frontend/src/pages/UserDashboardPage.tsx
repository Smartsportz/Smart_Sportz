import { Activity, CircleDollarSign, Download, FileText, Medal, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import type React from "react";
import { Link } from "react-router-dom";
import { Page, PortalShell } from "../components/UI";
import { userSidebar } from "../data/platform";
import { apiRequest } from "../lib/api";
import { downloadRegistrationPassPdf } from "../lib/downloads";
import { useAuth } from "../auth/AuthContext";

export type UserDashboardData = {
  profile: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  summary: {
    registrations: number;
    paidPayments: number;
    certificates: number;
    pendingDocuments: number;
  };
  registrations: Array<{
    id: string;
    tournament_slug: string;
    tournament_name: string;
    team_name: string;
    team_code: string;
    city: string;
    status: string;
    payment_status: string;
    sport: string;
    date: string;
  }>;
  payments: Array<{
    id: string;
    registration_id: string;
    status: string;
    amount: number;
    method: string;
    receipt_number: string;
    created_at: string;
  }>;
  documents: Array<{
    registration_id: string;
    document_type: string;
    file_name: string;
    status: string;
  }>;
  members: Array<{
    registration_id: string;
    name: string;
    role: string;
    contact?: string;
  }>;
};

const emptyDashboard: UserDashboardData = {
  profile: { id: "", name: "Participant", email: "", role: "user" },
  summary: { registrations: 0, paidPayments: 0, certificates: 0, pendingDocuments: 0 },
  registrations: [],
  payments: [],
  documents: [],
  members: [],
};

function formatInr(cents: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(cents / 100);
}

function UserMetricCard({ label, value, note, icon: Icon }: { label: string; value: string; note: string; icon: React.ComponentType<{ size?: number | string }> }) {
  return (
    <article className="user-metric-card">
      <div className="metric-icon"><Icon size={22} /></div>
      <span>{note}</span>
      <p>{label}</p>
      <strong>{value}</strong>
    </article>
  );
}

function EmptyState({ title, text, to, action }: { title: string; text: string; to: string; action: string }) {
  return (
    <section className="panel user-empty-state">
      <h2>{title}</h2>
      <p>{text}</p>
      <Link className="btn btn-primary" to={to}>{action}</Link>
    </section>
  );
}

export function UserDashboardPage() {
  const { token, user } = useAuth();
  const [data, setData] = useState<UserDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloadError, setDownloadError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    apiRequest<UserDashboardData>("/user/dashboard", {}, token)
      .then((payload) => {
        if (alive) setData(payload);
      })
      .catch((caught) => {
        if (alive) setError(caught instanceof Error ? caught.message : "Could not load your dashboard data.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [token]);

  const dashboard = data ?? emptyDashboard;
  const profileName = data?.profile.name || user?.name || "Participant";
  const paidAmount = dashboard.payments
    .filter((payment) => payment.status === "paid")
    .reduce((sum, payment) => sum + payment.amount, 0);
  const latestRegistration = dashboard.registrations[0];

  return (
    <Page>
      <PortalShell title={`Welcome back, ${profileName.split(" ")[0]}`} subtitle="Your tournament registrations, payment receipts, documents, and verification passes." sidebar={userSidebar}>
        {error && <div className="form-alert">{error}</div>}
        {downloadError && <div className="form-alert">{downloadError}</div>}
        {loading ? (
          <section className="panel user-empty-state">
            <h2>Loading your records</h2>
            <p>Fetching your participant data from the backend database.</p>
          </section>
        ) : (
          <>
            <div className="user-metrics-grid">
              <UserMetricCard label="My Tournaments" value={String(dashboard.summary.registrations)} note="DB records" icon={Trophy} />
              <UserMetricCard label="Paid Payments" value={String(dashboard.summary.paidPayments)} note={formatInr(paidAmount)} icon={CircleDollarSign} />
              <UserMetricCard label="Certificates" value={String(dashboard.summary.certificates)} note="Approved teams" icon={Medal} />
              <UserMetricCard label="Pending Docs" value={String(dashboard.summary.pendingDocuments)} note="Need review" icon={FileText} />
            </div>
            {dashboard.registrations.length === 0 ? (
              <EmptyState
                title="No tournament registrations yet"
                text="Your dashboard will stay empty until you register and complete a tournament registration flow."
                to="/tournaments"
                action="Find tournaments"
              />
            ) : (
              <div className="dashboard-two user-dashboard-panels">
                <section className="panel">
                  <h2>Latest Tournament</h2>
                  <div className="user-record-card">
                    <span className="status emerald">{latestRegistration.status}</span>
                    <h3>{latestRegistration.team_name}</h3>
                    <p>{latestRegistration.tournament_name} - {latestRegistration.city} - {latestRegistration.date}</p>
                    <div className="review-list">
                      <p><b>Team Code</b><span>{latestRegistration.team_code || "Not generated"}</span></p>
                      <p><b>Payment</b><span>{latestRegistration.payment_status}</span></p>
                      <p><b>Sport</b><span>{latestRegistration.sport}</span></p>
                    </div>
                    <div className="form-actions">
                      <Link className="btn btn-primary" to={`/tournaments/${latestRegistration.tournament_slug}/registration-pass`}>View registration</Link>
                      <button
                        className="btn btn-secondary"
                        type="button"
                        onClick={() => {
                          setDownloadError("");
                          downloadRegistrationPassPdf(latestRegistration.id, token).catch((caught) => setDownloadError(caught instanceof Error ? caught.message : "Unable to download registration PDF."));
                        }}
                      >
                        <Download size={16} />Download PDF
                      </button>
                    </div>
                  </div>
                </section>
                <section className="panel">
                  <h2>Recent Payments</h2>
                  {dashboard.payments.length === 0 ? (
                    <p>No payment records found in the database.</p>
                  ) : dashboard.payments.slice(0, 4).map((payment) => (
                    <Link className="row-item" to={`/payments/${payment.id}/receipt`} key={payment.id}>
                      <span>{payment.receipt_number}</span>
                      <b>{formatInr(payment.amount)}</b>
                    </Link>
                  ))}
                </section>
                <section className="panel">
                  <h2>Documents</h2>
                  {dashboard.documents.length === 0 ? (
                    <p>No document metadata found for your registrations.</p>
                  ) : dashboard.documents.slice(0, 5).map((document) => (
                    <div className="row-item readonly-row" key={`${document.registration_id}-${document.document_type}`}>
                      <span>{document.document_type}</span>
                      <b>{document.status}</b>
                    </div>
                  ))}
                </section>
                <section className="panel">
                  <h2>Live Access</h2>
                  <p>Open public live centers for tournaments you follow. Your registered tournaments appear here after manager approval.</p>
                  <Link className="btn btn-secondary" to="/live"><Activity size={16} />Open live matches</Link>
                </section>
              </div>
            )}
          </>
        )}
      </PortalShell>
    </Page>
  );
}
