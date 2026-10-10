import type { ArchiveRecord, CuePage, Manifest } from "./data";

// Viewer image links are signed. Bound both their lifetime and the in-memory cache.
const TTL = 5 * 60 * 1000;
const cached = new Map<string, { pages: CuePage[]; expires: number }>();
const invalid = () => new Error("페이지 순서를 확인할 수 없어요. 다시 불러와 주세요.");
function validate(pages: CuePage[], record: ArchiveRecord, offset: number) {
  if (!pages.length || offset + pages.length > record.pages) throw invalid();
  if (pages.some((p, i) => p.page !== offset + i + 1 ||
    typeof p.id !== "string" || !p.id.startsWith(record.id + "_") ||
    typeof p.image !== "string" || !p.image ||
    !Number.isFinite(p.width) || p.width <= 0 || !Number.isFinite(p.height) || p.height <= 0)) throw invalid();
}

/** Publish a verified first page immediately, then append ordered batches. */
export async function getPages(
  record: ArchiveRecord,
  manifest: Manifest,
  signal: AbortSignal,
  refresh = false,
  onPages?: (pages: CuePage[]) => void,
): Promise<CuePage[]> {
  signal.throwIfAborted();
  const key = `${manifest.dataset}:${manifest.revision}:${record.id}`;
  if (refresh) cached.delete(key);
  const previous = cached.get(key);
  if (previous && previous.expires > Date.now()) {
    onPages?.(previous.pages);
    return previous.pages;
  }
  cached.delete(key);
  const pages: CuePage[] = [];
  const publish = (batch: CuePage[]) => {
    signal.throwIfAborted();
    validate(batch, record, pages.length);
    pages.push(...batch);
    onPages?.([...pages]);
  };
  if (manifest.featured.includes(record.id)) {
    const response = await fetch(`/data/${record.id}.json`, { signal });
    if (!response.ok) throw Error("큐시트를 불러오지 못했어요. 다시 시도해 주세요.");
    const payload = await response.json();
    if (payload.id !== record.id) throw Error("자료 정보가 일치하지 않아요.");
    if (!Array.isArray(payload.pages) || payload.pages.length !== record.pages) throw invalid();
    publish(payload.pages);
  } else {
    while (pages.length < record.pages) {
      // The first request creates just one preview; later work cannot hold it up.
      const length = pages.length === 0 ? 1 : Math.min(record.pages - pages.length, 12);
      const params = new URLSearchParams({
        dataset: manifest.dataset, config: "pages", split: "corpus",
        offset: String(record.start + pages.length), length: String(length),
      });
      const response = await fetch("https://datasets-server.huggingface.co/rows?" + params, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]),
      });
      if (!response.ok) throw Error("자료 연결이 잠시 지연되고 있어요. 다시 시도해 주세요.");
      const payload = await response.json();
      if (!Array.isArray(payload.rows) || payload.rows.length !== length) throw invalid();
      const batch: CuePage[] = payload.rows.map(({ row }: { row: Record<string, any> }) => {
        if (!row || row.document_id !== record.id)
          throw Error("자료 목록이 변경되었어요. 원본에서 확인해 주세요.");
        // The shared Viewer schema also contains OCR. Retain image fields only.
        return { id: row.page_id, page: row.page, image: row.image?.src, width: row.width, height: row.height };
      });
      publish(batch);
    }
  }
  signal.throwIfAborted();
  if (pages.length !== record.pages) throw invalid();
  if (cached.size >= 30) cached.delete(cached.keys().next().value!);
  cached.set(key, { pages, expires: Date.now() + TTL });
  return pages;
}
