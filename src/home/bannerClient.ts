import { errorText, communityReader as supabase } from "../community/client";
import { createReadCache } from "../readCache";
import { HOME_BANNER_BUCKET, type BannerRecord, type ResolvedBanner } from "./banner";

const reads = createReadCache<ResolvedBanner[]>(30_000);
export async function bannerRpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase!.rpc(name, args);
  if (error) throw Error(errorText(error));
  return data as T;
}
export async function resolveBannerImages(rows: BannerRecord[]): Promise<ResolvedBanner[]> {
  if (!rows.length) return [];
  const { data, error } = await supabase!.storage.from(HOME_BANNER_BUCKET).createSignedUrls(rows.map(row => row.imagePath), 3600);
  if (error || !data || data.some(item => item.error || !item.signedUrl)) throw Error("배너 이미지를 불러오지 못했어요. 다시 불러와 주세요.");
  return rows.map((row, index) => ({ ...row, src: data[index].signedUrl! }));
}
export async function loadBanners(): Promise<ResolvedBanner[]> {
  if (!supabase) return (await import("./previewBanners")).previewBanners.read(false);
  return reads.read("public", async () => resolveBannerImages(await bannerRpc<BannerRecord[]>("home_banners")));
}
export const invalidateBannerReads = () => reads.clear();
