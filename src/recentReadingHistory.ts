import type { ArchiveRecord } from "./data";
import { READING_POSITIONS_KEY, readingPosition } from "./readerPosition.ts";

/** Saved positions already retain last-read order, including visits before this feature. */
export function recentReadings(catalog: ArchiveRecord[], limit = 5) {
  try {
    const stored = JSON.parse(localStorage.getItem(READING_POSITIONS_KEY) || "{}");
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) return [];
    const records = new Map(catalog.map(record => [record.id, record]));
    return Object.entries(stored).reverse().flatMap(([id, value]) => {
      const record = records.get(id);
      const position = record && readingPosition(value, record.pages);
      return record && position ? [{ record, position }] : [];
    }).slice(0, limit);
  } catch { return []; }
}
