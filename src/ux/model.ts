// UX events are an allowlist. Never send DOM text, URLs, form values or account IDs.
export const screens = ["home", "archive", "reader", "board", "post", "search", "write", "auth", "account", "saved", "notifications", "private", "other"] as const;
export type Screen = typeof screens[number];
export const resultActions = {
  "auth.demo": "체험 로그인", "auth.logout": "체험 로그아웃",
  "post.like": "게시글 추천", "post.unlike": "추천 해제", "post.save": "게시글 저장", "post.unsave": "게시글 저장 해제",
  "comment.like": "댓글 공감", "comment.unlike": "공감 해제", "reader.save": "큐시트 저장", "reader.unsave": "큐시트 저장 해제",
  "share.native": "기기 공유 기능", "share.copy": "공유 주소 복사",
  "content.archive": "자료 목록 불러오기", "content.feed": "게시글 목록 요청", "content.post": "게시글 데이터 요청",
  "content.reading": "이어 읽기 목록 요청", "content.banner": "홈 배너 목록 요청", "content.photos": "게시글 사진 주소 요청",
  "reader.pages": "원고 페이지 목록 불러오기", "reader.image": "원고 이미지 표시", "post.image": "게시글 사진 표시", "banner.image": "홈 배너 이미지 표시",
  "reader.page_jump": "원고 쪽 이동", "reader.rotate": "원고 회전", "reader.zoom_in": "원고 확대", "reader.zoom_out": "원고 축소", "reader.fit": "원고 크기 맞추기",
  "write.restricted": "글쓰기 제한 안내",
} as const;
export type ResultAction = keyof typeof resultActions;
export const actions = {
  ...resultActions,
  "nav.home": "홈으로 이동", "nav.archive": "큐시트 찾기로 이동", "nav.board": "커뮤니티로 이동",
  "menu.open": "전체 메뉴 열기", "menu.close": "전체 메뉴 닫기", "menu.profile": "내 프로필 열기",
  "menu.saved": "저장한 자료 열기", "menu.notifications": "알림 열기", "menu.settings": "프로필 수정 열기",
  "search.open": "검색 열기", "search.submit": "검색 실행", "search.clear": "검색어 지우기",
  "banner.open": "홈 배너 열기", "banner.select": "배너 선택", "banner.pause": "배너 자동 넘김 정지", "banner.play": "배너 자동 넘김 시작",
  "popular.select": "인기 콘텐츠 선택", "archive.year": "연도 선택", "archive.browse": "학기·프로그램 선택", "archive.recent": "최근 본 큐시트 열기",
  "reader.open": "큐시트 열기", "reader.zoom_in": "원고 확대", "reader.zoom_out": "원고 축소", "reader.fit": "원고 크기 맞추기", "reader.rotate": "원고 회전",
  "reader.page_picker": "쪽 이동 창 열기", "reader.page_jump": "쪽 이동", "reader.save": "큐시트 저장", "reader.share": "큐시트 공유", "reader.resume": "읽던 쪽으로 이동", "reader.write": "큐시트로 글쓰기",
  "board.category": "말머리 선택", "board.sort": "목록 정렬 선택", "board.page": "게시글 목록 넘기기", "board.search": "게시글 검색창 전환", "post.open": "게시글 열기", "post.like": "게시글 추천",
  "post.save": "게시글 저장", "post.share": "게시글 공유", "post.more": "게시글 더보기", "post.photo": "사진 크게 보기", "photo.next": "다음 사진", "photo.previous": "이전 사진", "photo.close": "사진 닫기",
  "comment.reply": "답글 쓰기", "comment.like": "댓글 공감", "comment.submit": "댓글 등록 시도", "write.open": "글쓰기 열기", "write.submit": "글 등록 시도",
  "auth.kakao": "카카오 로그인 시도", "auth.email": "이메일 로그인 선택", "auth.submit": "인증 양식 제출 시도", "auth.forgot": "비밀번호 찾기", "auth.signup": "이메일 회원가입 선택",
  "back": "이전 화면·목록으로 복귀", "info.open": "이용 안내 열기", "link.external": "외부 링크 열기", "form.submit": "양식 제출 시도",
  "archive.preview": "시간 고리의 원고 열기", "archive.previous_year": "시간 고리 이전 연도", "archive.next_year": "시간 고리 다음 연도", "archive.ring_year": "시간 고리 연도 변경",
  "board.notice": "공지 넘기기",
  "reader.jump_cancel": "쪽 이동 취소",
  "auth.open": "로그인 화면 열기",
  "archive.path": "자료 탐색 경로 선택", "archive.page": "자료 목록 넘기기", "archive.recent_toggle": "최근 본 큐시트 펼치기·접기", "archive.motion": "시간 고리 움직임 전환",
  "popular.pause": "인기 콘텐츠 자동 넘김 정지", "popular.play": "인기 콘텐츠 자동 넘김 시작", "content.retry": "불러오기 재시도",
  "post.reading": "다른 게시글 이어 읽기", "home.more": "홈 코너 더보기", "home.community": "커뮤니티 전체 보기",
  "photo.zoom": "사진 확대·축소", "menu.logout": "로그아웃", "account.section": "내 프로필 메뉴 선택",
  "scroll.restore": "읽던 위치 복귀", "scroll.jump": "버튼으로 위치 이동", "scroll.navigation": "화면 이동 시 위치 설정", "scroll.layout": "화면 배치에 따른 위치 조정",
  "gesture.home": "홈 화면 밀기", "gesture.banner": "배너 밀기", "gesture.archive": "시간 고리 조작", "gesture.reader": "원고 조작", "gesture.photo": "사진 조작", "gesture.other": "기타 영역 조작",
} as const;
export type Action = keyof typeof actions;
export type EventKind = "enter" | "leave" | "click" | "scroll" | "engagement" | "gesture" | "result" | "change" | "scroll_user" | "scroll_auto" | "scroll_unknown";
export type UxEvent = { seq: number; at: number; kind: EventKind; screen: Screen; action?: Action; value?: number; target?: Screen };
export const screenLabels: Record<Screen, string> = {home:"홈",archive:"큐시트 찾기",reader:"원고 열람",board:"커뮤니티",post:"게시글",search:"검색",write:"글쓰기",auth:"로그인·가입",account:"내 프로필",saved:"저장한 자료",notifications:"알림",private:"관리 화면",other:"기타"};
export function screenOf(path: string): Screen {
  const clean = path.split("?")[0].replace(/^#/, "");
  if (clean === "/auth" && new URLSearchParams(path.split("?")[1]).get("next") === "/ux-log") return "private";
  if (/^\/(?:post|p)\//.test(clean)) return "post";
  if (clean.startsWith("/read/")) return "reader";
  if (/^\/(?:admin|ux-log)/.test(clean)) return "private";
  const name = clean.split("/")[1] || "home";
  return screens.includes(name as Screen) ? name as Screen : "other";
}
export function classifyLabel(label: string): Action | undefined {
  const extra: Record<string, Action> = {"뒤로":"back", "로그아웃":"menu.logout", "이전 연도":"archive.previous_year", "다음 연도":"archive.next_year", "이전 자료 목록":"archive.page", "다음 자료 목록":"archive.page", "전체 연도":"archive.path", "이전 쪽":"reader.page_jump", "다음 쪽":"reader.page_jump", "인기 콘텐츠 자동 넘김 멈추기":"popular.pause", "인기 콘텐츠 자동 넘김 시작하기":"popular.play", "관람객 움직임 재생":"archive.motion", "관람객 움직임 일시정지":"archive.motion", "사진 확대":"photo.zoom", "사진 축소":"photo.zoom", "내 활동":"account.section", "저장한 글·자료":"account.section", "신고 내역":"account.section"};
  if (extra[label]) return extra[label];
  if (["이전 공지", "다음 공지"].includes(label)) return "board.notice";
  if (/^(?:이미지 |사진 )?다시 불러오기$/.test(label)) return "content.retry";
  const exact: Record<string, Action> = {"홈":"nav.home","VOKU On 홈":"nav.home","큐시트 찾기":"nav.archive","커뮤니티":"nav.board","전체 메뉴":"menu.open","메뉴 닫기":"menu.close","메뉴 닫고 본문으로 돌아가기":"menu.close","통합 검색":"search.open","게시글 검색":"board.search","검색어 지우기":"search.clear","저장한 글·자료":"menu.saved","내 활동":"menu.profile","내 설정":"menu.settings","프로필 수정":"menu.settings","알림":"menu.notifications","글쓰기":"write.open","이 큐시트로 글쓰기":"reader.write","회차 링크 공유":"reader.share","게시글 공유":"post.share","게시글 더보기":"post.more","이용 안내 · 자료 출처":"info.open","권리·출처 안내":"info.open","사진 닫기":"photo.close","다음 사진":"photo.next","이전 사진":"photo.previous","답글 쓰기":"comment.reply","비밀번호 찾기":"auth.forgot","이메일 회원가입":"auth.signup","이메일로 로그인":"auth.email","카카오로 로그인":"auth.kakao","카카오 로그인":"auth.kakao","배너 자동 넘김 멈추기":"banner.pause","배너 자동 넘김 시작하기":"banner.play","많이 본 글":"popular.select","댓글 많은 글":"popular.select","인기 큐시트":"popular.select","최신글":"board.sort","추천순":"board.sort"};
  if (exact[label]) return exact[label];
  if (/^(전체|자유글|추억|질문|동문소식|공지)$/.test(label)) return "board.category";
  if (/^\d{4}년 자료$/.test(label)) return "archive.year";
  if (/^현재 \d+쪽, 전체 \d+쪽\. 페이지 이동$/.test(label)) return "reader.page_picker";
  if (/^\d+쪽으로 이동$/.test(label)) return "reader.page_jump";
  if (/^\d+쪽 확대$/.test(label)) return "reader.zoom_in";
  if (/^\d+쪽 축소$/.test(label)) return "reader.zoom_out";
  if (/^현재 \d+%\. 화면에 맞추기$/.test(label)) return "reader.fit";
  if (/^\d+쪽 시계 방향으로 90도 회전$/.test(label)) return "reader.rotate";
  if (/^큐시트 저장(?: 해제)?$/.test(label)) return "reader.save";
  if (/^게시글 저장(?: 해제)?$/.test(label)) return "post.save";
  if (/^\d+번 사진 크게 보기$/.test(label)) return "post.photo";
  if (/^추천 \d+$/.test(label)) return "post.like";
  if (/^공감(?: 취소)? \d+$/.test(label)) return "comment.like";
  if (/^(?:이전|다음) 게시글 \d+개$/.test(label)) return "board.page";
  if (/돌아가기$/.test(label) && label.length < 35) return "back";
  return undefined;
}

/** Class/route fallback for controls whose text contains real content titles. */
export function controlAction(label: string, classes: string, target?: Screen, region = ""): Action | undefined {
  const has = (name: string) => classes.split(/\s+/).includes(name);
  if (label === "로그인 / 회원가입" || target === "auth") return "auth.open";
  if (region === "photo" && ["확대", "화면에 맞춤"].includes(label)) return "photo.zoom";
  if (has("ring-preview")) return "archive.preview";
  if (has("record-row") || has("community-attachment") || has("attachment") || has("home-episode-link")) return "reader.open";
  if (has("browse-row")) return "archive.browse";
  if (has("resume-link")) return "reader.resume";
  if (has("reader-jump-cancel")) return "reader.jump_cancel";
  if (has("archive-recent-row")) return "archive.recent";
  if (region === "recent") return "archive.recent_toggle";
  if (region === "archive-path") return "archive.path";
  if (has("site-menu-profile")) return "menu.profile";
  if (has("community-reading-row")) return "post.reading";
  if (has("home-more") || has("home-notice-label")) return "home.more";
  if (has("home-board-link")) return "home.community";
  return classifyLabel(label) || (target === "reader" ? "reader.open" : target === "post" ? "post.open" : target === "board" ? "nav.board" : target === "archive" ? "nav.archive" : undefined);
}
export function bucketWidth(width: number): "small" | "mobile" | "tablet" | "desktop" {
  return width < 360 ? "small" : width < 600 ? "mobile" : width < 1024 ? "tablet" : "desktop";
}

/** Keep copied public VOKU links in the study without editing shared post content. */
export function studyLink(href: string, enabled: boolean, origin: string): string {
  if (!enabled) return href;
  try {
    const url = new URL(href);
    if (url.origin !== "https://voku.pages.dev" || url.username || url.password) return href;
    const publicHash = url.pathname === "/" && /^#\/(?:home|archive|board|post\/[A-Za-z0-9_-]+|read\/voku_[a-z0-9_]+)(?:\?|$)/.test(url.hash);
    const publicPost = /^\/p\/[A-Za-z0-9_-]{10}\/?$/.test(url.pathname);
    return publicHash || publicPost ? origin + url.pathname + url.search + url.hash : href;
  } catch { return href; }
}
