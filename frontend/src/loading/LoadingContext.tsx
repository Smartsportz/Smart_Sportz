import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { setLoadingNotifier } from "./loadingBus";

type LoadingContextValue = {
  loading: boolean;
  showFor: (milliseconds?: number) => void;
};

const LoadingContext = createContext<LoadingContextValue | null>(null);

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [apiLoading, setApiLoading] = useState(false);
  const [routeLoading, setRouteLoading] = useState(false);
  const routeTimer = useRef<number | null>(null);
  const apiTimer = useRef<number | null>(null);

  useEffect(() => {
    setLoadingNotifier((loading) => {
      if (apiTimer.current) {
        window.clearTimeout(apiTimer.current);
      }
      if (loading) {
        setApiLoading(true);
        return;
      }
      apiTimer.current = window.setTimeout(() => setApiLoading(false), 650);
    });
    return () => setLoadingNotifier(null);
  }, []);

  const showFor = useCallback((milliseconds = 900) => {
    if (routeTimer.current) {
      window.clearTimeout(routeTimer.current);
    }
    setRouteLoading(true);
    routeTimer.current = window.setTimeout(() => setRouteLoading(false), milliseconds);
  }, []);

  const value = useMemo<LoadingContextValue>(() => ({
    loading: apiLoading || routeLoading,
    showFor,
  }), [apiLoading, routeLoading, showFor]);

  return <LoadingContext.Provider value={value}>{children}</LoadingContext.Provider>;
}

export function useLoading() {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error("useLoading must be used inside LoadingProvider");
  }
  return context;
}
