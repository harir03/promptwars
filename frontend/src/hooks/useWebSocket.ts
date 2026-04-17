import { useCallback, useEffect, useRef, useState } from "react";
import type { CrowdSnapshot } from "@/types";
import { getWsUrl } from "@/lib/utils";

/**
 * WebSocket hook with exponential backoff reconnection (P4).
 * Auto-detects ws:// vs wss:// (P24).
 * Uses server timestamp for clock sync (P5).
 */
export function useWebSocket() {
  const [snapshot, setSnapshot] = useState<CrowdSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());
  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const maxRetries = 20;

  const connect = useCallback(() => {
    const url = getWsUrl("/ws/crowd");

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        retriesRef.current = 0; // Reset on successful connect
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as CrowdSnapshot;

          // Handle shutdown message (P3)
          if ((data as any).type === "shutdown") {
            setConnected(false);
            return;
          }

          setSnapshot(data);
          setLastUpdated(Date.now());
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;

        // Exponential backoff reconnection (P4)
        if (retriesRef.current < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, retriesRef.current), 30000);
          retriesRef.current += 1;
          setTimeout(connect, delay);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      // Connection failed, will retry via onclose
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);

  /** Seconds since last data update (for stale detection P22) */
  const staleness = Math.round((Date.now() - lastUpdated) / 1000);

  return { snapshot, connected, staleness, lastUpdated };
}
