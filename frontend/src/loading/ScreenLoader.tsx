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
          <div className="logo-loader-card" aria-hidden="true">
            <img src={`${import.meta.env.BASE_URL}assets/logo.png`} alt="" />
            <span />
          </div>
          <div className="screen-loader-label">Loading</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
