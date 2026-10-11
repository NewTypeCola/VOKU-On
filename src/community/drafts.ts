import type { DraftPhoto } from "./photoStorage";

export type PostDraft = {
  title: string;
  body: string;
  category: string;
  recordId: string;
  bodyFormat: string;
  isSecret: boolean;
  notice: boolean;
  baseUpdatedAt?: string;
};
export type SavedDraft = {
  text: PostDraft;
  photos: Pick<DraftPhoto, "id" | "path" | "file">[];
  savedAt: string;
};
export const emptyPostDraft = (): PostDraft => ({
  title: "",
  body: "",
  category: "일상",
  recordId: "",
  bodyFormat: "plain",
  isSecret: false,
  notice: false,
});
export function readDraftText(key: string): PostDraft | null {
  try {
    const v = JSON.parse(localStorage.getItem(key) || "null");
    if (
      !v ||
      !["title", "body", "category", "recordId"].every(
        (k) => typeof v[k] === "string",
      )
    )
      return null;
    return {
      ...emptyPostDraft(),
      ...v,
      isSecret: v.isSecret === true,
      notice: v.notice === true,
    };
  } catch {
    return null;
  }
}

// Separate from published preview photos. Account and edit ID are part of each key.
async function transaction<T>(
  key: string,
  value?: SavedDraft | null,
): Promise<T> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open("voku-community-drafts", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("drafts");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(
        "drafts",
        value === undefined ? "readonly" : "readwrite",
      );
      const table = tx.objectStore("drafts");
      const req =
        value === undefined
          ? table.get(key)
          : value === null
            ? table.delete(key)
            : table.put(value, key);
      tx.oncomplete = () => resolve(req.result as T);
      tx.onerror = tx.onabort = () =>
        reject(tx.error || Error("임시 저장 실패"));
    });
  } finally {
    db.close();
  }
}
const queues = new Map<string, Promise<unknown>>();
function enqueue<T>(key: string, task: () => Promise<T>) {
  const next = (queues.get(key) || Promise.resolve())
    .catch(() => {})
    .then(task);
  queues.set(key, next);
  void next
    .finally(() => {
      if (queues.get(key) === next) queues.delete(key);
    })
    .catch(() => {});
  return next;
}
export const readDraft = (key: string) =>
  enqueue(key, () => transaction<SavedDraft | undefined>(key));
export const saveDraft = (key: string, text: PostDraft, photos: DraftPhoto[]) =>
  enqueue(key, () =>
    transaction(key, {
      text,
      photos: photos.map(({ id, path, file }) => ({ id, path, file })),
      savedAt: new Date().toISOString(),
    }),
  );
export const removeDraft = (key: string) =>
  enqueue(key, async () => {
    await transaction(key, null);
    localStorage.removeItem(key);
  });
