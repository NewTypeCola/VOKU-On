import React, { act, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import { useLoad } from "../src/community/useLoad";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const root = createRoot(document.querySelector("#screen")!);
const status = document.querySelector("#status")!;
const results = document.querySelector("#results")!;
const requests: { resolve: (value: string) => void; reject: (error: Error) => void }[] = [];
let latest: ReturnType<typeof useLoad<string>>;
let frames: { data: string | null; loading: boolean; error: string }[] = [];
const load = () => new Promise<string>((resolve, reject) => requests.push({ resolve, reject }));
function Screen({ query, revision }: { query: string[]; revision: number }) {
  const state = useLoad(load, query, revision);
  latest = state;
  useLayoutEffect(() => { frames.push({ data: state.data, loading: state.loading, error: state.error }); });
  return <section><p role="status">{state.loading ? "불러오는 중" : state.error || "읽는 중"}</p>
    {state.data && <article><h2>{state.data}</h2><input aria-label="작성 중 댓글" defaultValue="지켜야 하는 작성 내용" /></article>}</section>;
}
const render = (query: string[], revision = 0) => act(async () => { root.render(<Screen query={query} revision={revision} />); });
const resolve = (value: string) => act(async () => requests.shift()!.resolve(value));
const check = (pass: boolean, message: string) => {
  const li = document.createElement("li"); li.textContent = `${pass ? "PASS" : "FAIL"} ${message}`; li.className = pass ? "pass" : "fail"; results.append(li);
  if (!pass) throw Error(message);
};
document.querySelector<HTMLButtonElement>("#run")!.onclick = async event => {
  const button = event.currentTarget as HTMLButtonElement; button.disabled = true; results.textContent = ""; status.textContent = "검사 중";
  try {
    await render(["board", "member-a"]);
    check(latest.loading && latest.data === null, "최초 조회만 로딩 표시");
    await resolve("첫 화면");
    const input = document.querySelector<HTMLInputElement>("#screen input")!; input.focus();
    frames = [];
    await render(["board", "member-a"], 1);
    check(!latest.loading && latest.refreshing && latest.data === "첫 화면", "백그라운드 조회 중 기존 화면 유지");
    await resolve("갱신된 화면");
    check(!frames.some(frame => frame.loading || !frame.data), "갱신 동안 빈 화면과 로딩 프레임 없음");
    check(document.querySelector("#screen input") === input && document.activeElement === input && input.value === "지켜야 하는 작성 내용", "댓글 입력 노드·내용·포커스 유지");
    frames = [];
    await render(["search", "member-a"], 1);
    check(latest.loading && latest.data === null && frames.every(frame => frame.data === null), "검색 변경 즉시 이전 결과 숨김");
    const stale = requests.shift()!;
    await render(["other-search", "member-a"], 1);
    await resolve("새 검색 결과");
    await act(async () => stale.resolve("늦게 도착한 옛 결과"));
    check(latest.data === "새 검색 결과", "늦은 응답이 새 결과를 덮어쓰지 않음");
    frames = [];
    await render(["other-search", "member-b"], 1);
    check(latest.data === null && frames.every(frame => frame.data === null), "계정 변경 첫 프레임부터 이전 사용자 내용 제거");
    await resolve("새 사용자의 화면");
    await render(["other-search", "member-b"], 2);
    await act(async () => requests.shift()!.reject(Error("열람 권한이 없습니다")));
    check(latest.data === null && !!latest.error && !document.querySelector("#screen article"), "권한 재확인 실패 시 이전 비공개 내용 제거");
    await act(async () => latest.retry());
    check(latest.loading && !latest.error, "오류 후 재시도 가능");
    await resolve("복구된 화면");
    check(latest.data === "복구된 화면" && !latest.loading, "재시도 성공 시 새 내용 표시");
    await render(["other-search", "member-b"], 3);
    const afterUnmount = requests.shift()!;
    await act(async () => root.render(null));
    await act(async () => afterUnmount.resolve("이미 떠난 화면"));
    check(!document.querySelector("#screen article"), "화면을 떠난 뒤 도착한 응답 무시");
    status.textContent = "전체 통과";
  } catch(error) { status.textContent = "실패: " + (error as Error).message; }
  finally { button.disabled = false; }
};
