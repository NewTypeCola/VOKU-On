export type StudySession = { id: string; seq: number; test: boolean };
export function restoreStudySession(raw: string | null, test: boolean): StudySession {
  try {
    const saved = JSON.parse(raw || "null");
    if (saved && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(saved.id) &&
      Number.isSafeInteger(saved.seq) && saved.seq >= 0 && saved.seq < 100000 && typeof saved.test === "boolean") {
      return { id: saved.id, seq: saved.seq, test: test || saved.test };
    }
  } catch { /* Start a new visit for invalid or unavailable storage. */ }
  return { id: crypto.randomUUID(), seq: 0, test };
}
