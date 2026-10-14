import { studyEnabled } from "./config.ts";
import { screenOf, type Screen, type ResultAction } from "./model.ts";

export type ResultValue = -1 | 0 | 1 | 2; // cancelled, failed, completed, restricted
export type AutoScrollAction = "scroll.restore" | "scroll.jump" | "scroll.navigation" | "scroll.layout";
export type StudySignal =
  | { kind: "result"; action: ResultAction; value: ResultValue; screen: Screen }
  | { kind: "change"; action: "archive.ring_year"; value: number; screen: Screen }
  | { kind: "auto_scroll"; action: AutoScrollAction; screen: Screen };
const listeners = new Set<(signal: StudySignal) => void>();
const currentScreen = (): Screen => typeof location === "undefined" ? "other" : screenOf(location.hash.slice(1) || location.pathname);
function send(signal: StudySignal) {
  if (!studyEnabled || signal.screen === "private") return;
  // Logging must never turn a successful application action into a failure.
  for (const listener of listeners) { try { listener(signal); } catch { /* best effort */ } }
}
export function subscribeStudySignals(listener: (signal: StudySignal) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function studyResult(action: ResultAction, value: ResultValue, screen = currentScreen()) {
  send({ kind: "result", action, value, screen });
}
/** Capture the originating screen before an async operation changes the route. */
export function studyOperation(action: ResultAction) {
  const screen = currentScreen();
  let settled = false;
  return (value: ResultValue) => {
    if (settled) return;
    settled = true;
    studyResult(action, value, screen);
  };
}
export async function measureStudy<T>(action: ResultAction, operation: () => Promise<T> | T): Promise<T> {
  const finish = studyOperation(action);
  try { const result = await operation(); finish(1); return result; }
  catch (error) { finish((error as { name?: string })?.name === "AbortError" ? -1 : 0); throw error; }
}
export function studyAutoScroll(action: AutoScrollAction) { send({ kind: "auto_scroll", action, screen: currentScreen() }); }
export function studyYearChange(value: number) { send({ kind: "change", action: "archive.ring_year", value, screen: currentScreen() }); }
export const memberResultAction = (action: string, enabled: unknown): ResultAction | undefined => {
  const map: Record<string, [ResultAction, ResultAction]> = {
    like: ["post.unlike", "post.like"], bookmark: ["post.unsave", "post.save"],
    comment_like: ["comment.unlike", "comment.like"], archive_bookmark: ["reader.unsave", "reader.save"],
  };
  return map[action]?.[enabled ? 1 : 0];
};
