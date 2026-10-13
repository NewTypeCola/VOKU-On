export const PROFILE_PHOTO_BUCKET = "profile-photos";
export const PROFILE_INTRODUCTION_LIMIT = 300;
export const PROFILE_PHOTO_LIMIT = 262144;
export function isProfilePhotoPath(path: string, owner?: string) {
  return /^[a-f0-9-]{36}\/[a-f0-9-]{36}\.jpg$/.test(path) && (!owner || path.startsWith(`${owner}/`));
}
export function profilePhotoUrl(path: string | null | undefined, origin: string) {
  if (!path) return null;
  if (!origin) return /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(path) && path.length < 360000 ? path : null;
  return isProfilePhotoPath(path) ? `${origin.replace(/\/$/, "")}/storage/v1/object/public/${PROFILE_PHOTO_BUCKET}/${path}` : null;
}
export function normalizeIntroduction(value: string) {
  const text = value.trim();
  if (text.length > PROFILE_INTRODUCTION_LIMIT) throw Error("소개는 300자 이내로 입력해 주세요.");
  return text;
}
