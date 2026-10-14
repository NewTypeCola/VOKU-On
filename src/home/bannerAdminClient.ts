import { errorText, supabase } from "../community/client";
import { HOME_BANNER_BUCKET, HOME_BANNER_BYTES, isBannerImagePath, type BannerInput, type BannerRecord } from "./banner";
import { bannerRpc, resolveBannerImages, invalidateBannerReads } from "./bannerClient";
export async function loadBannerAdmin() {
  if (!supabase) return (await import("./previewBanners")).previewBanners.read(true);
  return resolveBannerImages(await bannerRpc<BannerRecord[]>("home_banner_admin"));
}
export async function saveBannerAction(action: "save" | "remove" | "reorder", payload: BannerInput | Record<string, unknown>) {
  invalidateBannerReads();
  try {
    if (!supabase) await (await import("./previewBanners")).previewBanners.action(action, payload);
    else await bannerRpc("home_banner_action", { p_action: action, p_payload: payload });
  } finally { invalidateBannerReads(); }
}
export async function discardBannerImage(path: string) {
  if (!supabase || !isBannerImagePath(path)) return;
  const { error } = await supabase.storage.from(HOME_BANNER_BUCKET).remove([path]);
  if (error) throw Error(errorText(error));
}
export async function uploadBannerImage(file: Blob, owner: string) {
  if (file.type !== "image/jpeg" || !file.size || file.size > HOME_BANNER_BYTES) throw Error("배너 이미지를 다시 선택해 주세요.");
  if (!supabase) return new Promise<string>((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(Error("이미지를 저장하지 못했어요.")); reader.readAsDataURL(file);
  });
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || user?.id !== owner) throw Error("로그인한 계정이 변경되었어요. 관리자 페이지를 다시 열어 주세요.");
  const bucket = supabase.storage.from(HOME_BANNER_BUCKET);
  const stale = await bucket.list(owner, { limit: 100 });
  if (stale.error) throw Error(errorText(stale.error));
  for (const item of stale.data || []) {
    if (item.created_at && Date.parse(item.created_at) < Date.now() - 86400000)
      await discardBannerImage(`${owner}/${item.name}`).catch(() => {});
  }
  const path = `${owner}/${crypto.randomUUID()}.jpg`;
  const uploaded = await bucket.upload(path, file, { contentType: "image/jpeg", cacheControl: "60", upsert: false });
  if (uploaded.error) throw Error(errorText(uploaded.error));
  return path;
}
