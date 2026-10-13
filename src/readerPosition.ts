import type { PageView } from "./readerGeometry";

export type ReadingPosition = {
  page: number;
  offset: number;
  angle: number;
  // Coordinates are fractions of the sheet, so a different screen width is safe.
  view: PageView;
};
export const READING_POSITIONS_KEY = "voku-reader-positions-v1";
export const READING_POSITION_CHANGED = "voku-reading-position-changed";

export function pageNumber(value: unknown, total: number): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const n = typeof value === "string" && !value.trim() ? NaN : Number(value);
  return Number.isInteger(n) && n >= 1 && n <= total ? n : null;
}
export function readingPosition(value: unknown, total: number): ReadingPosition | null {
  if (!value || typeof value !== "object") return null;
  const p = value as ReadingPosition;
  const page = pageNumber(p.page, total);
  if (!page || !Number.isFinite(p.offset) || ![0, 90, 180, 270].includes(p.angle) ||
    !p.view || ![p.view.scale, p.view.x, p.view.y].every(Number.isFinite)) return null;
  const scale = Math.max(1, Math.min(4, p.view.scale));
  return { page, offset: Math.max(0, Math.min(1, p.offset)), angle: p.angle,
    view: { scale, x: Math.max(1 - scale, Math.min(0, p.view.x)), y: Math.max(1 - scale, Math.min(0, p.view.y)) } };
}
export function readReadingPosition(id: string, total: number): ReadingPosition | null {
  try { return readingPosition(JSON.parse(localStorage.getItem(READING_POSITIONS_KEY) || "{}")[id], total); }
  catch { return null; }
}
export function saveReadingPosition(id: string, position: ReadingPosition) {
  try {
    const stored = JSON.parse(localStorage.getItem(READING_POSITIONS_KEY) || "{}");
    // Retain the most recently read 100 episodes; the ordinary saved-page number stays compatible.
    const entries = Object.entries(stored && typeof stored === "object" ? stored : {})
      .filter(([key]) => key !== id && key.startsWith("voku_")).slice(-99);
    localStorage.setItem(READING_POSITIONS_KEY, JSON.stringify(Object.fromEntries([...entries, [id, position]])));
    if (typeof window !== "undefined") window.dispatchEvent(new Event(READING_POSITION_CHANGED));
  } catch { /* Reading remains available when browser storage is full or disabled. */ }
}
