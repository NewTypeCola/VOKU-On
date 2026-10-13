import { supabase, errorText } from "./client";
import { isProfilePhotoPath, PROFILE_PHOTO_BUCKET, PROFILE_PHOTO_LIMIT } from "./profilePhoto";

export async function discardProfilePhoto(path: string | null | undefined) {
  if (!supabase || !path || !isProfilePhotoPath(path)) return;
  // Storage RLS refuses deletion of the currently selected photo, including
  // when a second tab saved it while this tab's request was still in flight.
  const { error } = await supabase.storage.from(PROFILE_PHOTO_BUCKET).remove([path]);
  if (error) throw Error(errorText(error));
}
export async function uploadProfilePhoto(file: Blob, owner: string) {
  if (file.type !== "image/jpeg" || !file.size || file.size > PROFILE_PHOTO_LIMIT) throw Error("프로필 사진을 다시 선택해 주세요.");
  if (!supabase) return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(Error("사진을 저장하지 못했어요. 다시 선택해 주세요."));
    reader.readAsDataURL(file);
  });
  const { data: { user }, error: identityError } = await supabase.auth.getUser();
  if (identityError || user?.id !== owner) throw Error("로그인한 계정이 변경되었어요. 내 프로필을 다시 열어 주세요.");
  const bucket = supabase.storage.from(PROFILE_PHOTO_BUCKET);
  // Reclaim abandoned uploads after a day; a different tab's fresh upload is
  // left alone. The policy never allows the active avatar to be removed.
  const { data: files, error: listError } = await bucket.list(owner, { limit: 100 });
  if (listError) throw Error(errorText(listError));
  const stale = (files || []).filter(item => item.created_at && Date.parse(item.created_at) < Date.now() - 86400000);
  for (const item of stale) await discardProfilePhoto(`${owner}/${item.name}`).catch(() => {});
  const path = `${owner}/${crypto.randomUUID()}.jpg`;
  const { error } = await bucket.upload(path, file, { contentType: "image/jpeg", cacheControl: "60", upsert: false });
  if (error) throw Error(errorText(error));
  return path;
}
