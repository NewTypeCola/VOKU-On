import { supabase, errorText } from "./client";
import type { PostPhoto } from "./types";
export type DraftPhoto = PostPhoto & { url: string; file?: Blob };
const bucket = "community-photos";
async function localPhoto(
  id: string,
  value?: Blob | null,
): Promise<Blob | undefined> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open("voku-community-preview-photos", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("photos");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(
        "photos",
        value === undefined ? "readonly" : "readwrite",
      );
      const table = tx.objectStore("photos");
      const req =
        value === undefined
          ? table.get(id)
          : value === null
            ? table.delete(id)
            : table.put(value, id);
      tx.oncomplete = () =>
        resolve(value === undefined ? req.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export async function resolvePhotos(
  photos: PostPhoto[],
): Promise<DraftPhoto[]> {
  if (!photos.length) return [];
  if (!supabase)
    return Promise.all(
      photos.map(async (p) => {
        const blob = await localPhoto(p.id);
        if (!blob)
          throw Error("이 브라우저에 저장된 체험 사진을 찾을 수 없습니다.");
        return { ...p, url: URL.createObjectURL(blob) };
      }),
    );
  const { data, error } = await supabase.storage.from(bucket).createSignedUrls(
    photos.map((p) => p.path),
    300,
  );
  if (error || !data || data.some((p) => p.error || !p.signedUrl))
    throw Error("사진을 불러오지 못했어요. 다시 시도해 주세요.");
  return photos.map((p, i) => ({ ...p, url: data[i].signedUrl! }));
}
export async function discardPhotos(photos: PostPhoto[]) {
  if (!photos.length) return;
  if (!supabase) {
    await Promise.all(photos.map((p) => localPhoto(p.id, null)));
    return;
  }
  const { error } = await supabase.storage
    .from(bucket)
    .remove(photos.map((p) => p.path));
  if (error) throw Error(errorText(error));
  const result = await supabase.rpc("community_media_discard", {
    p_ids: photos.map((p) => p.id),
  });
  if (result.error) throw Error(errorText(result.error));
}
export async function uploadPhotos(photos: DraftPhoto[], owner: string) {
  const pending = photos.filter((p) => p.file);
  if (!pending.length)
    return {
      photos: photos.map(({ id, path }) => ({ id, path })),
      uploaded: [] as PostPhoto[],
    };
  let uploaded: PostPhoto[] = [];
  try {
    if (!supabase) {
      for (const p of pending) {
        await localPhoto(p.id, p.file!);
        uploaded.push({ id: p.id, path: p.id });
      }
    } else {
      // At most twelve pending objects per member; interrupted uploads are reclaimed
      // on the next upload after 24 hours without touching another tab's fresh work.
      const stale = await supabase
        .from("community_media")
        .select("id,path")
        .eq("author_id", owner)
        .is("post_id", null)
        .lt("created_at", new Date(Date.now() - 86400000).toISOString());
      if (stale.error) throw stale.error;
      await discardPhotos(stale.data || []);
      const reserved = await supabase.rpc("community_media_reserve", {
        p_count: pending.length,
      });
      if (reserved.error) throw reserved.error;
      uploaded = reserved.data as PostPhoto[];
      for (let i = 0; i < pending.length; i++) {
        const result = await supabase.storage
          .from(bucket)
          .upload(uploaded[i].path, pending[i].file!, {
            contentType: "image/jpeg",
            upsert: false,
            cacheControl: "300",
          });
        if (result.error) throw result.error;
      }
    }
    let index = 0;
    return {
      uploaded,
      photos: photos.map((p) =>
        p.file ? uploaded[index++] : { id: p.id, path: p.path },
      ),
    };
  } catch (e) {
    await discardPhotos(uploaded).catch(() => {});
    throw Error(errorText(e));
  }
}
export function releasePhotoUrls(photos: { url: string }[]) {
  photos.forEach((p) => {
    if (p.url.startsWith("blob:")) URL.revokeObjectURL(p.url);
  });
}
