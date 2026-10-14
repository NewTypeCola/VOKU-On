import type { AutoScrollAction } from "./signals";

/** Input evidence is separate from position changes, including restored scroll. */
export function createScrollTracker(initialY = 0) {
  let y = initialY, userUntil = 0, autoUntil = 0;
  let action: AutoScrollAction | undefined;
  let last = "";
  return {
    reset(top: number) { y = top; userUntil = 0; autoUntil = 0; action = undefined; last = ""; },
    input(now: number) { userUntil = now + 1500; autoUntil = 0; action = undefined; },
    automatic(reason: AutoScrollAction, now: number) { action = reason; autoUntil = now + 1200; userUntil = 0; last = ""; },
    sample(top: number, max: number, now: number) {
      if (Math.abs(top - y) < 1) return null;
      y = top;
      if (max <= 0) return null;
      const value = Math.max(0, Math.min(100, Math.floor(((top + 2) / max) * 4) * 25));
      const kind: "scroll_auto" | "scroll_user" | "scroll_unknown" = now < autoUntil ? "scroll_auto" : now < userUntil ? "scroll_user" : "scroll_unknown";
      if (kind === "scroll_user") userUntil = now + 1500; // touch/wheel inertia
      const key = `${kind}:${kind === "scroll_auto" ? action : ""}:${value}`;
      if (key === last) return null;
      last = key;
      return { kind, value, ...(kind === "scroll_auto" ? { action } : {}) };
    },
  };
}
