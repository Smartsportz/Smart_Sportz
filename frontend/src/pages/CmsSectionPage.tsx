import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Page, PortalShell } from "../components/UI";
import { sidebar } from "../data/platform";
import { useAuth } from "../auth/AuthContext";
import { apiRequest } from "../lib/api";

type CmsRecord = {
  slug: string;
  title: string;
  type: string;
  body: string;
  path: string;
  published: number | boolean;
};

export function CmsSectionPage() {
  const { section } = useParams();
  const { token } = useAuth();
  const [record, setRecord] = useState<CmsRecord | null>(null);
  const [form, setForm] = useState({ title: "", body: "", published: true });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setError("");
    apiRequest<CmsRecord[]>("/admin/cms", {}, token)
      .then((records) => {
        if (!alive) return;
        const match = records.find((item) => item.slug === section) ?? records[0];
        if (match) {
          setRecord(match);
          setForm({ title: match.title, body: match.body, published: Boolean(match.published) });
        }
      })
      .catch((caught) => {
        if (alive) setError(caught instanceof Error ? caught.message : "Could not load CMS content.");
      });
    return () => { alive = false; };
  }, [section, token]);

  async function saveCms() {
    if (!record) return;
    setMessage("");
    setError("");
    try {
      const updated = await apiRequest<CmsRecord>(`/admin/cms/${record.slug}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: form.title,
          body: form.body,
          published: form.published,
        }),
      }, token);
      setRecord(updated);
      setForm({ title: updated.title, body: updated.body, published: Boolean(updated.published) });
      setMessage(`${updated.title} saved to the database.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save CMS content.");
    }
  }

  return (
    <Page>
      <PortalShell title={record ? `${record.title} CMS` : "CMS"} subtitle="Edit database-backed website content and publish state." sidebar={sidebar} action={<Link className="btn btn-secondary" to="/admin/cms">All CMS</Link>}>
        {message && <div className="form-alert success-alert">{message}</div>}
        {error && <div className="form-alert">{error}</div>}
        {!record ? (
          <section className="panel user-empty-state"><h2>Loading CMS</h2><p>Fetching CMS content from the backend database.</p></section>
        ) : (
          <div className="dashboard-two">
            <section className="panel tournament-create-panel">
              <span className="status emerald">{record.type}</span>
              <div className="form-grid single">
                <label>Title<input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /></label>
                <label>Body<textarea value={form.body} onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} /></label>
              </div>
              <label className="visibility-row">
                <span><b>Published</b><small>Show this content on public pages.</small></span>
                <input type="checkbox" checked={form.published} onChange={(event) => setForm((current) => ({ ...current, published: event.target.checked }))} />
              </label>
              <div className="registration-actions compact-actions">
                <button className="btn btn-primary" type="button" onClick={saveCms}>Save CMS</button>
                <Link className="btn btn-secondary" to={record.path || "/"}>Preview Page</Link>
              </div>
            </section>
            <section className="panel">
              <h2>Database Details</h2>
              <div className="review-list">
                <p><b>Slug</b><span>{record.slug}</span></p>
                <p><b>Type</b><span>{record.type}</span></p>
                <p><b>Path</b><span>{record.path || "/"}</span></p>
                <p><b>Status</b><span>{form.published ? "Published" : "Draft"}</span></p>
              </div>
            </section>
          </div>
        )}
      </PortalShell>
    </Page>
  );
}
