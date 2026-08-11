import { useLoading } from "./LoadingContext";

export function ScreenLoader() {
  const { loading } = useLoading();

  if (!loading) return null;

  return (
    <div className="screen-loader-overlay" role="status" aria-live="polite" aria-label="Loading" aria-busy="true">
      <div className="screen-skeleton-shell" aria-hidden="true">
        <div className="screen-skeleton-header">
          <span className="screen-skeleton-logo" />
          <span />
          <span />
          <span />
        </div>
        <div className="screen-skeleton-hero">
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="screen-skeleton-grid">
          {Array.from({ length: 6 }).map((_, index) => (
            <span key={index} />
          ))}
        </div>
      </div>
      <span className="screen-loader-label">Loading content</span>
    </div>
  );
}
