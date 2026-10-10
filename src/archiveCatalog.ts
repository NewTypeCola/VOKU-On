import type { ArchiveRecord, Manifest } from "./data";

export type ArchiveSnapshot = {
  catalog: ArchiveRecord[];
  manifest: Manifest | null;
  error: string;
};

// One shared request survives route changes and StrictMode remounts.
// Community and authentication screens do not depend on its completion.
export function createArchiveResource(fetcher: typeof fetch = fetch) {
  let snapshot: ArchiveSnapshot = { catalog: [], manifest: null, error: "" };
  let pending: Promise<void> | undefined;
  const listeners = new Set<() => void>();
  const publish = (next: ArchiveSnapshot) => {
    snapshot = next;
    listeners.forEach(listener => listener());
  };
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    load(): Promise<void> {
      if (snapshot.manifest) return Promise.resolve();
      if (pending) return pending;
      if (snapshot.error) publish({ ...snapshot, error: "" });
      const signal = AbortSignal.timeout(30000);
      pending = Promise.all(["/data/catalog.json", "/data/manifest.json"].map(async url => {
        const response = await fetcher(url, { signal });
        if (!response.ok) throw new Error("Archive unavailable");
        return response.json();
      })).then(([catalog, manifest]) => {
        publish({ catalog, manifest, error: "" });
      }).catch(() => {
        publish({ ...snapshot, error: "자료 목록을 불러오지 못했어요." });
      }).finally(() => { pending = undefined; });
      return pending;
    },
  };
}

export const archiveCatalog = createArchiveResource();
