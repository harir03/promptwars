/**
 * WebSocket hook for real-time crowd snapshot streaming.
 *
 * Connects to the backend WebSocket endpoint with exponential
 * backoff reconnection. Falls back to demo data when no backend
 * is available so the UI is never blank.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { CrowdSnapshot } from "@/types";
import { getWsUrl } from "@/lib/utils";
import { buildDemoSnapshot } from "@/hooks/demoData";

/** Maximum reconnection attempts before giving up. */
const MAX_RETRIES = 20;

/** Maximum backoff delay in milliseconds (30 seconds). */
const MAX_BACKOFF_MS = 30_000;

/** Return type for the useWebSocket hook. */
interface WebSocketState {
  snapshot: CrowdSnapshot | null;
  connected: boolean;
  staleness: number;
  lastUpdated: number;
}

/** Checks whether a parsed message is a shutdown signal. */
function isShutdownMessage(data: unknown): boolean {
  return typeof data === "object" && data !== null && (data as Record<string, unknown>).type === "shutdown";
}

/** Computes exponential backoff delay capped at MAX_BACKOFF_MS. */
function computeBackoffDelay(retryCount: number): number {
  return Math.min(1000 * Math.pow(2, retryCount), MAX_BACKOFF_MS);
}

/**
 * React hook that streams CrowdSnapshot data via WebSocket.
 *
 * @returns WebSocketState with snapshot, connection status, and staleness.
 *
 * Features:
 * - Auto-detects ws:// vs wss:// from page protocol (P24)
 * - Exponential backoff reconnection up to MAX_RETRIES (P4)
 * - Falls back to demo data when backend is unreachable
 */
export function useWebSocket(): WebSocketState {
  const [snapshot, setSnapshot] = useState<CrowdSnapshot | null>(buildDemoSnapshot());
  const [connected, setConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());
  const socketRef = useRef<WebSocket | null>(null);
  const retryCountRef = useRef(0);
  const hasReceivedLiveData = useRef(false);

  const connect = useCallback(() => {
    const websocketUrl = getWsUrl("/ws/crowd");
    try {
      const socket = new WebSocket(websocketUrl);
      socketRef.current = socket;
      socket.onopen = () => handleOpen(setConnected, retryCountRef);
      socket.onmessage = (event) => handleMessage(event, setSnapshot, setLastUpdated, hasReceivedLiveData);
      socket.onclose = () => handleClose(setConnected, socketRef, hasReceivedLiveData, retryCountRef, connect);
      socket.onerror = () => socket.close();
    } catch {
      // Connection construction failed; onclose handler will retry
    }
  }, []);

  useEffect(() => {
    connect();
    return () => { socketRef.current?.close(); };
  }, [connect]);

  const staleness = Math.round((Date.now() - lastUpdated) / 1000);
  return { snapshot, connected, staleness, lastUpdated };
}

/* ─── Private handler helpers (≤20 lines each) ─── */

function handleOpen(
  setConnected: (value: boolean) => void,
  retryCountRef: React.MutableRefObject<number>,
): void {
  setConnected(true);
  retryCountRef.current = 0;
}

function handleMessage(
  event: MessageEvent,
  setSnapshot: (data: CrowdSnapshot) => void,
  setLastUpdated: (timestamp: number) => void,
  hasReceivedLiveData: React.MutableRefObject<boolean>,
): void {
  try {
    const data = JSON.parse(event.data) as CrowdSnapshot;
    if (isShutdownMessage(data)) return;
    hasReceivedLiveData.current = true;
    setSnapshot(data);
    setLastUpdated(Date.now());
  } catch {
    // Ignore malformed JSON messages
  }
}

function handleClose(
  setConnected: (value: boolean) => void,
  socketRef: React.MutableRefObject<WebSocket | null>,
  hasReceivedLiveData: React.MutableRefObject<boolean>,
  retryCountRef: React.MutableRefObject<number>,
  reconnect: () => void,
): void {
  setConnected(false);
  socketRef.current = null;

  if (retryCountRef.current >= MAX_RETRIES) return;

  const delay = computeBackoffDelay(retryCountRef.current);
  retryCountRef.current += 1;
  setTimeout(reconnect, delay);
}
