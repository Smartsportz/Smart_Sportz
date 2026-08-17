import { useEffect, useRef, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { websocketUrl } from "../lib/api";

type RealtimeMessage = {
  event?: string;
  entity?: string;
  action?: string;
  payload?: Record<string, unknown>;
  invalidates?: string[];
};

const queryScopes: Record<string, string[]> = {
  database: [],
  home: ["home"],
  tournaments: ["tournaments", "tournament"],
  tournament: ["tournaments", "tournament"],
  sports: ["public-sports-page", "sports"],
  sport: ["public-sports-page", "sports"],
  news: ["news", "home"],
  gallery: ["gallery", "home"],
  likes: ["news", "gallery"],
  live: ["live", "home"],
  score: ["live", "home"],
  management: ["management", "managed-sports"],
};

function firstKeyPart(queryKey: readonly unknown[]) {
  return typeof queryKey[0] === "string" ? queryKey[0] : "";
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const timerRef = useRef<number | undefined>(undefined);
  const pendingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimer: number | undefined;
    let closedByEffect = false;

    function flushInvalidations() {
      const scopes = Array.from(pendingRef.current);
      pendingRef.current.clear();
      if (!scopes.length || scopes.includes("database")) {
        void queryClient.invalidateQueries();
        return;
      }
      const prefixes = new Set(scopes.flatMap((scope) => queryScopes[scope] ?? [scope]));
      void queryClient.invalidateQueries({
        predicate: (query) => prefixes.has(firstKeyPart(query.queryKey)),
      });
    }

    function scheduleInvalidation(message: RealtimeMessage) {
      const scopes = message.invalidates?.length ? message.invalidates : [message.entity || "database"];
      scopes.forEach((scope) => pendingRef.current.add(scope));
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(flushInvalidations, 250);
    }

    function connect() {
      socket = new WebSocket(websocketUrl("/realtime/ws"));
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as RealtimeMessage;
          if (!message.event || message.event === "connected") return;
          scheduleInvalidation(message);
        } catch {
          return;
        }
      };
      socket.onclose = () => {
        if (!closedByEffect) {
          reconnectTimer = window.setTimeout(connect, 2500);
        }
      };
    }

    connect();
    return () => {
      closedByEffect = true;
      window.clearTimeout(reconnectTimer);
      window.clearTimeout(timerRef.current);
      socket?.close();
    };
  }, [queryClient]);

  return <>{children}</>;
}
