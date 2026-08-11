import { AnimatePresence, motion } from "framer-motion";
import { useLoading } from "./LoadingContext";

export function ScreenLoader() {
  const { loading } = useLoading();

  return (
    <AnimatePresence>
      {loading && (
        <motion.div
          className="screen-loader-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          role="status"
          aria-live="polite"
          aria-label="Loading"
        >
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
              <span />
              <span />
              <span />
            </div>
          </div>
          <div className="screen-loader-label">Loading</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
