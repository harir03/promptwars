import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Build WebSocket URL from current page protocol (P24).
 * Auto-detects ws:// vs wss:// — never hardcoded.
 */
export function getWsUrl(path: string): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}${path}`;
}

/**
 * Density level to display properties (P13 — accessibility).
 * Includes icon, label, and CSS class for colorblind safety.
 */
export const DENSITY_MAP = {
  clear: { icon: "✅", label: "Clear", css: "density-clear", bg: "density-bg-clear" },
  moderate: { icon: "⚠️", label: "Moderate", css: "density-moderate", bg: "density-bg-moderate" },
  busy: { icon: "🔶", label: "Busy", css: "density-busy", bg: "density-bg-busy" },
  packed: { icon: "🚫", label: "Packed", css: "density-packed", bg: "density-bg-packed" },
} as const;

/**
 * Format a percentage (0.0-1.0) to display string.
 */
export function formatPct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/**
 * Generate a random session ID for the chat.
 */
export function generateSessionId(): string {
  return `session_${Math.random().toString(36).substring(2, 10)}`;
}
