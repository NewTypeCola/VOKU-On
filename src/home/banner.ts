/**
 * Illustrative example banner, generated with the built-in image_gen tool on
 * 2026-10-11. The headline is part of the image, as requested by the user.
 * This is not a historical VOKU photo or a modified archive document.
 * Replace this configuration and its local asset when an actual campaign is ready.
 * No banner upload or administrator workflow is introduced here.
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

const storyBanner: HomeBanner = {
  id: "broadcast-stories",
  src: "/home/broadcast-stories-banner.jpg",
  width: 1774,
  height: 887,
  alt: "VOKU On. 그때의 방송, 오늘의 이야기. 따뜻한 빛이 드는 방송실을 그린 예시 배너.",
  label: "그때의 방송, 오늘의 이야기 — 추억 게시글 보기",
  path: "/board?" + new URLSearchParams({ category: "추억", sort: "latest" }),
};

// Add/reorder entries here. The carousel accepts at most ten enabled banners;
// it does not introduce an upload service or an administrator screen.
const configuredBanners: HomeBanner[] = [
  storyBanner,
  {
    id: "archive", src: "/home/archive-banner.jpg", width: 1774, height: 887,
    alt: "큐시트 찾기. 그 시절 원고를 다시 펼쳐보세요. 원고와 테이프를 그린 예시 배너.",
    label: "그 시절 원고를 다시 펼쳐보세요 — 큐시트 찾기", path: "/archive",
  },
  {
    id: "memories", src: "/home/memories-banner.jpg", width: 1774, height: 887,
    alt: "추억 이야기. 사진 한 장에 추억이 한가득. 카메라와 사진을 그린 예시 배너.",
    label: "사진 한 장에 추억이 한가득 — 추억 게시글 보기",
    path: "/board?" + new URLSearchParams({ category: "추억", sort: "latest" }),
  },
  {
    id: "alumni", src: "/home/alumni-banner.jpg", width: 1774, height: 887,
    alt: "동문 소식. 오랜만에, 안부를 전해요. 커피 두 잔과 라디오를 그린 예시 배너.",
    label: "오랜만에, 안부를 전해요 — 동문 소식 보기",
    path: "/board?" + new URLSearchParams({ category: "동문소식", sort: "latest" }),
  },
];

export const homeBanners = configuredBanners.filter((banner) => banner.enabled !== false).slice(0, MAX_HOME_BANNERS);
