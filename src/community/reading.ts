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

export function readingStart(
  total: number,
  anchor: number,
  requested?: number,
) {
  const last = Math.max(0, total - 5);
  return Math.min(
    last,
    Math.max(0, Number.isSafeInteger(requested) ? requested! : anchor - 2),
  );
}

export function commentDateTime(value: string) {
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value;
  return `${part("month")}.${part("day")} ${part("hour")}:${part("minute")}`;
}
