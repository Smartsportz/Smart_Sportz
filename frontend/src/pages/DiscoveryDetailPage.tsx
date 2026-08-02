import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Page } from "../components/UI";
import { apiRequest } from "../lib/api";

type DiscoveryDetail = Record<string, any> & {
  tournament?: Record<string, any> | null;
};

export function DiscoveryDetailPage() {
  const { slug } = useParams();
  const [detail, setDetail] = useState<DiscoveryDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!slug) return;
    setError("");
    apiRequest<DiscoveryDetail>(`/public/home-discovery/${slug}`)
      .then(setDetail)
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load sponsor detail."));
  }, [slug]);

  const tournament = detail?.tournament;
  const canRegister = tournament?.status === "Registration Open" && detail?.register_path;

  return (
    <Page className="discovery-detail-page">
      {error && <div className="form-alert">{error}</div>}
      {!detail ? (
        <section className="panel user-empty-state"><h2>Loading sponsor story</h2><p>Fetching tournament and sponsor details.</p></section>
      ) : (
        <>
          <section className="discovery-detail-hero">
            <img src={detail.image} alt="" />
            <div>
              <span className="status emerald">{detail.label}</span>
              <h1>{detail.title}</h1>
              <p>{detail.description}</p>
              <div className="hero-actions">
                {canRegister ? <Link className="btn btn-primary" to={detail.register_path}>Tournament Register</Link> : <Link className="btn btn-secondary" to={tournament ? `/tournaments/${tournament.slug}` : "/tournaments"}>View Tournament</Link>}
                <Link className="btn btn-secondary" to="/sports">Explore Sports</Link>
              </div>
            </div>
          </section>
          <section className="discovery-detail-grid">
            <article className="panel">
              <h2>Game And Tournament</h2>
              <p>{detail.sport} is connected to {tournament?.name || detail.title}. The event page includes tournament schedule, registration state, sponsor presentation, venue context, team flow, and public records for participants and organizers.</p>
              <dl className="detail-dl">
                <div><dt>Sport</dt><dd>{detail.sport}</dd></div>
                <div><dt>Tournament Date</dt><dd>{detail.event_date}</dd></div>
                <div><dt>Location</dt><dd>{tournament?.location || "Configured by admin"}</dd></div>
                <div><dt>Status</dt><dd>{tournament?.status || "Published"}</dd></div>
              </dl>
            </article>
            <article className="panel">
              <h2>Sponsor Details</h2>
              <div className="sponsor-detail-logo">
                <img src={detail.sponsor_image || detail.image} alt="" />
                <strong>{detail.sponsor_name}</strong>
              </div>
              <p>{detail.sponsor_details}</p>
            </article>
          </section>
        </>
      )}
    </Page>
  );
}
