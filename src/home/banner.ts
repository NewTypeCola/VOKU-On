/**
 * Illustrative example banner, generated with the built-in image_gen tool on
 * 2026-10-11. The headline is part of the image, as requested by the user.
 * This is not a historical VOKU photo or a modified archive document.
 * Example assets are archived in assets/home and excluded from deployment.
 * Actual banners are managed through the administrator page and Supabase.
 *
 * Final generation prompt (edit of the original text-free generated illustration):
 * Use case: text-localization. Asset type: final sample image banner for the
 * VOKU On mobile community homepage. Edit the supplied radio studio illustration
 * into a wide 2:1 banner, 1536 by 768 if possible. Preserve the warm illustrated
 * broadcasting equipment and evening window on the right, and deep navy negative
 * space on the left. Add beautiful, perfectly legible KOREAN typography baked
 * into the image, large bold warm-white modern sans serif. Exact main text on
 * two lines: '그때의 방송,' on line 1 and '오늘의 이야기' on line 2. Spell every
 * Korean syllable accurately. The two-line main headline should fill the left
 * 50 percent, around 88 pixels high characters, clean generous line spacing.
 * Above it add a smaller 'VOKU On' wordmark in warm-white, about 44 pixels tall.
 * No other text. No borders, no UI controls, no extra logos, no watermarks, no
 * people. Place all text within safe margins at least 80 pixels from left and
 * top. This is an illustrative example banner, not an archival photograph.
 * Keep the microphone, reel-to-reel tape recorder and warm golden light.
 * Recompose the illustration as needed for the wider ratio without warping equipment.
 */
export type HomeBanner = {
  id: string;
  src: string;
  width: number;
  height: number;
  alt: string;
  label: string;
  path: string;
  enabled?: boolean;
};

export const MAX_HOME_BANNERS = 10;
export const BANNER_INTERVAL_MS = 10_000;

export const HOME_BANNER_BUCKET = "home-banners";
export const HOME_BANNER_BYTES = 1_048_576;
export type BannerRecord = {
  id: string; title: string; imagePath: string; link: string;
  width: number; height: number; enabled: boolean; position: number; version: number;
};
export type BannerInput = Omit<BannerRecord, "id" | "version" | "position"> & { id?: string; version?: number };
export type ResolvedBanner = BannerRecord & { src: string };
export const isBannerImagePath = (path: string) => /^[a-f0-9-]{36}\/[a-f0-9-]{36}\.jpg$/.test(path);

/** Accept copied public post URLs and hash routes; never execute URL schemes. */
export function bannerTarget(value: string, origin = "https://voku.pages.dev"): string {
  let path = value.trim();
  if (!path) return "";
  if (path.length > 1000 || /[\s\\\u0000-\u001f\u007f]/.test(path)) throw Error("연결 주소를 확인해 주세요.");
  if (/^https:\/\//i.test(path)) {
    const url = new URL(path);
    if (url.username || url.password) throw Error("연결 주소를 확인해 주세요.");
    if (![origin, "https://voku.pages.dev"].includes(url.origin)) return url.href;
    if (!url.hash.startsWith("#/" ) && !/^\/p\/[A-Za-z0-9_-]{10}\/?$/.test(url.pathname)) return url.href;
    path = url.hash.startsWith("#/") ? url.hash.slice(1) : url.pathname.replace(/^\/p\//,"/post/").replace(/\/$/,"") + url.search;
  }
  path = path.replace(/^\/?#\//,"/");
  if (/^\/p\/[A-Za-z0-9_-]{10}(?:\?|$)/.test(path)) path = path.replace(/^\/p\//,"/post/");
  if (!/^\/(?:home|archive|board|write|post\/[A-Za-z0-9_-]+|read\/[^/?#]+)(?:\?|$)/.test(path))
    throw Error("VOKU On 화면 주소나 https://로 시작하는 주소를 입력해 주세요.");
  return path;
}
export function bannerView(banner: ResolvedBanner): HomeBanner {
  return { id: banner.id, src: banner.src, width: banner.width, height: banner.height,
    alt: banner.title, label: banner.title, path: banner.link, enabled: banner.enabled };
}
