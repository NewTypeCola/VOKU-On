import { actions, type UxEvent } from "./model.ts";

export const outcomeLabel = (value: number) => ({ "1": "완료", "0": "실패", "-1": "취소·중단", "2": "실험에서 제한" }[String(value)] || "결과 미확인");
export const scrollLabels: Record<string, string> = { scroll: "이전 기록 · 원인 미분류", scroll_user: "직접 스크롤", scroll_auto: "자동 위치 이동", scroll_unknown: "입력 원인 미확인" };
export const elapsed = (seconds: number) => seconds >= 60 ? `${Math.floor(seconds / 60)}분 ${seconds % 60}초` : `${seconds}초`;
export function eventText(event: UxEvent) {
  const label = event.action ? actions[event.action] : "";
  if (event.kind === "result") return `${label} · ${event.action === "share.native" && event.value === 1 ? "기기 공유 기능 응답 완료" : outcomeLabel(event.value ?? 0)}`;
  if (event.kind === "change") return `${label} · ${event.value}년`;
  if (event.kind === "click") {
    let text: string = label || "기능 클릭";
    if (event.action === "board.category" && event.value !== undefined) text += " · " + ["전체", "자유글", "추억", "질문", "동문소식", "공지"][event.value];
    if (event.action === "popular.select" && event.value !== undefined) text += " · " + ["많이 본 글", "댓글 많은 글", "인기 큐시트"][event.value];
    if (event.action === "banner.open" && event.value) text += ` · ${event.value}번째 배너`;
    return text;
  }
  if (event.kind === "enter") return "화면 열기";
  if (event.kind === "leave") return `화면 떠남 · 활동 시간 ${elapsed(event.value || 0)}`;
  if (event.kind === "engagement") return `다른 앱·탭으로 전환 · 활동 시간 ${elapsed(event.value || 0)}`;
  if (event.kind in scrollLabels) return `${event.kind === "scroll_auto" && label ? label : scrollLabels[event.kind]} · 위치 ${event.value}%`;
  return `${label || "영역 미분류"} · ${event.value === 2 ? "두 손가락 조작" : event.value === 1 ? "오른쪽으로 밀기" : "왼쪽으로 밀기"}`;
}
