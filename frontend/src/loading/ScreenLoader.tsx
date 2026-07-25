import { Activity, Medal, Trophy, Zap } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { CSSProperties } from "react";
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
          <div className="screen-swap-loader">
            <div className="screen-swap-icons">
              <Trophy style={{ "--d": "0s" } as CSSProperties} />
              <Activity style={{ "--d": "1s" } as CSSProperties} />
              <Medal style={{ "--d": "2s" } as CSSProperties} />
              <Zap style={{ "--d": "3s" } as CSSProperties} />
            </div>
          </div>
          <span className="screen-loader-label">Loading Smart Sportz</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
