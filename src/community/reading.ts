export function pageWindow(page: number, pages: number) {
  const start = Math.max(1, Math.min(page - 1, pages - 2));
  return Array.from({ length: Math.min(3, pages) }, (_, i) => start + i);
}

export function isNewPost(date: string, now = Date.now()) {
  const elapsed = now - Date.parse(date);
  return elapsed >= 0 && elapsed < 24 * 60 * 60 * 1000;
}

export function commentPath(postId: string, commentId?: string | null) {
  return `/post/${postId}${commentId ? `?comment=${encodeURIComponent(commentId)}` : ""}`;
}

export const categoryHelp: Record<string, string> = {
  전체: "방송의 기억부터 오늘의 안부까지, 편하게 읽고 이야기 나눠요.",
  "자료 이야기":
    "큐시트가 연결된 글이에요. 그날의 방송 자료를 함께 읽어보세요.",
  자유글: "가벼운 인사와 오늘의 안부를 자유롭게 나누는 곳이에요.",
  추억: "방송실에서 함께했던 순간과 오래된 사진을 나눠요.",
  음악: "기억에 남은 선곡이나 요즘 듣는 음악을 소개해 주세요.",
  질문: "궁금한 방송 이야기나 자료에 관한 질문을 남겨주세요.",
  동문소식: "동문들의 근황과 함께 나누고 싶은 소식을 전해요.",
  공지: "커뮤니티 이용에 필요한 안내를 확인해 주세요.",
};
