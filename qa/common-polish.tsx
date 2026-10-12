import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { Button, Input, Label, TextArea, TextField } from "@heroui/react";
import { Dialog } from "../src/ScreenDialog";
import { EmptyState } from "../src/ScreenFeedback";
import { LoadState } from "../src/community/shared";
import { useLoad } from "../src/community/useLoad";
import "../src/style.css";
import "../src/motion.css";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const root = createRoot(document.querySelector("#screen")!);
const requests: { resolve: (value: string[]) => void; reject: (error: Error) => void }[] = [];
const loader = () => new Promise<string[]>((resolve, reject) => requests.push({ resolve, reject }));
const settle = async () => { await new Promise(resolve => setTimeout(resolve, 320)); };
const render = async (node: React.ReactNode) => { await act(async () => root.render(node)); await settle(); };
const click = async (element: HTMLElement) => { await act(async () => element.click()); await settle(); };
const check = (pass: boolean, message: string) => {
  const li = document.createElement("li"); li.className = pass ? "pass" : "fail"; li.textContent = `${pass ? "PASS" : "FAIL"} ${message}`;
  document.querySelector("#results")!.append(li);
  if (!pass) throw Error(message);
};
function Form({ keyboard = false }: { keyboard?: boolean }) {
  const [open, setOpen] = useState(true);
  return <Dialog title="작은 화면에서도 읽고 닫을 수 있는 긴 안내 제목" open={open} close={() => setOpen(false)} className={keyboard ? "qa-keyboard-dialog" : ""}>
    <form className="community-form" onSubmit={event => event.preventDefault()}>
      <p>{"긴_안내_".repeat(30)}</p>
      <TextField><Label>설명</Label><Input /></TextField>
      <TextField><Label>상세 내용</Label><TextArea rows={4} /></TextField>
      <div className="community-dialog-actions"><Button variant="outline">원래 화면으로 돌아가기</Button><Button type="submit">내용 확인 완료</Button></div>
    </form>
  </Dialog>;
}
function Feedback() {
  const state = useLoad(loader, ["fixture"]);
  return <><LoadState state={state} />{state.data && <EmptyState title="검색 결과가 없어요" action={<Button>검색 해제</Button>}>다른 검색어로 찾아보세요.</EmptyState>}</>;
}
document.querySelector<HTMLButtonElement>("#run")!.onclick = async event => {
  const button = event.currentTarget as HTMLButtonElement; button.disabled = true;
  const status = document.querySelector("#status")!; status.textContent = "검사 중"; document.querySelector("#results")!.textContent = "";
  try {
    await render(<Form key="normal" />);
    let dialog = document.querySelector<HTMLElement>(".voku-dialog")!;
    let bounds = dialog.getBoundingClientRect();
    check(bounds.left >= 0 && bounds.right <= innerWidth && bounds.top >= 0 && bounds.bottom <= innerHeight, "팝업이 좁은 화면 안에 배치됨");
    check(dialog.scrollWidth <= dialog.clientWidth, "긴 제목·내용·버튼에도 가로 넘침 없음");
    const close = dialog.querySelector<HTMLElement>(".modal__close-trigger")!, heading = dialog.querySelector<HTMLElement>(".modal__heading")!;
    check(close.offsetWidth >= 44 && close.offsetHeight >= 44 && heading.getBoundingClientRect().right <= close.getBoundingClientRect().left, "닫기 버튼 44px와 긴 제목 영역 분리");
    check([...dialog.querySelectorAll("input,textarea")].every(el => parseFloat(getComputedStyle(el).fontSize) >= 16), "입력 글자 16px 이상");
    await click(close);
    check(!document.querySelector(".voku-dialog"), "닫기 후 배경으로 복귀");
    await render(<Form key="keyboard" keyboard />);
    dialog = document.querySelector<HTMLElement>(".voku-dialog")!; bounds = dialog.getBoundingClientRect();
    check(bounds.top >= 0 && bounds.bottom <= 280, "키보드 위 280px 영역 안에 팝업 유지");
    const body = dialog.querySelector<HTMLElement>(".modal__body")!;
    check(body.clientHeight > 0 && body.scrollHeight > body.clientHeight && getComputedStyle(body).overflowY === "auto", "짧은 높이에서 본문 스크롤 가능");
    body.scrollTop = body.scrollHeight;
    const submit = dialog.querySelector<HTMLElement>("button[type=submit]")!;
    check(submit.getBoundingClientRect().bottom <= body.getBoundingClientRect().bottom + 1, "스크롤로 마지막 실행 버튼까지 접근 가능");
    await render(<Feedback />);
    check(document.querySelector('.community-loading[role="status"]')?.textContent === "불러오는 중", "읽을 수 있는 한국어 로딩 안내");
    await act(async () => requests.shift()!.reject(Error("연결이 끊어졌어요.")));
    check(!!document.querySelector('.community-state [role="alert"]') && !document.querySelector('.community-empty'), "실패를 빈 목록과 구분해 안내");
    await click(document.querySelector<HTMLElement>(".community-state button")!);
    check(!!document.querySelector('.community-loading') && !document.querySelector('.community-state'), "오류 재시도 버튼으로 다시 조회");
    await act(async () => requests.shift()!.resolve([]));
    check(!!document.querySelector('.community-empty .feedback-actions button') && !document.querySelector('.community-loading'), "복구 후 빈 목록에 다음 행동 표시");
    status.textContent = "전체 통과";
  } catch (error) { status.textContent = "실패: " + (error as Error).message; }
  finally { await render(null); button.disabled = false; }
};
