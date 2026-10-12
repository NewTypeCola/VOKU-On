import React, { act, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import SiteMenu, { MenuSurface } from "../src/SiteMenu";
import type { Community } from "../src/community/useCommunity";
import "../src/style.css";
import "../src/motion.css";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const root = createRoot(document.querySelector("#screen")!);
const wait = (ms = 450) => new Promise(resolve => setTimeout(resolve, ms));
const click = async (el: HTMLElement, ms = 450) => { await act(async () => el.click()); await wait(ms); };
const by = (selector: string) => document.querySelector<HTMLElement>(selector)!;
let calls = 0;
let logoutResult: (error?: Error) => void;
function Fixture({ guest = false }: { guest?: boolean }) {
  const [open, setOpen] = useState(false);
  const [route, setRoute] = useState("#/home");
  const [signedIn, setSignedIn] = useState(!guest);
  const [notice, setNotice] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  const profile = { nickname: "메뉴 검사", role: "moderator" };
  const c = {
    live: true, loading: false, profile: signedIn ? profile : null,
    account: signedIn ? { profile, unreadNotificationCount: 2 } : null,
    logout: () => { calls++; return new Promise<void>((resolve, reject) => {
      logoutResult = error => { if (error) reject(error); else { setSignedIn(false); resolve(); } };
    }); },
  } as unknown as Community;
  return <MenuSurface open={open} currentRoute={route}>
    <header className="qa-sticky"><button id="open-menu" ref={trigger} onClick={() => setOpen(value => !value)}>전체 메뉴</button><span>{route}</span></header>
    <input id="preserved-input" aria-label="보존할 입력" defaultValue="읽던 내용" />
    <main>{Array.from({ length: route === "#/home" ? 180 : 5 }, (_, i) => <p className="qa-row" key={i}>읽던 글 {i + 1} · 긴 목록에서도 같은 위치로 돌아갑니다.</p>)}</main>
    <p id="notice" role="status">{notice}</p>
    <SiteMenu open={open} setOpen={setOpen} triggerRef={trigger} community={c} currentPath={route.slice(1)} currentRoute={route}
      go={path => { setRoute("#" + path); requestAnimationFrame(() => window.scrollTo(0, 0)); }} about={() => {}} notify={setNotice} />
  </MenuSurface>;
}
const check = (pass: boolean, message: string) => {
  const li = document.createElement("li"); li.className = pass ? "pass" : "fail"; li.textContent = `${pass ? "PASS" : "FAIL"} ${message}`;
  by("#results").append(li);
  if (!pass) throw Error(message);
};
const render = async (node: React.ReactNode) => { await act(async () => root.render(node)); await wait(); };
const openMenu = () => click(by("#open-menu"));
const closeMenu = () => click(by('.site-menu-close'));
async function sampleMotion() {
  const gaps: number[] = [];
  let frame = 0, previous = 0;
  const sample = (now: number) => {
    if (previous) gaps.push(now - previous);
    previous = now;
    frame = requestAnimationFrame(sample);
  };
  frame = requestAnimationFrame(sample);
  try { await openMenu(); }
  finally { cancelAnimationFrame(frame); }
  return gaps;
}
document.querySelector<HTMLButtonElement>("#run")!.onclick = async () => {
  by("#checks").dataset.running = "true";
  by("#status").textContent = "검사 중"; by("#results").textContent = "";
  const originalMatchMedia = window.matchMedia;
  try {
    await render(<Fixture key="guest" guest />);
    await openMenu();
    check(!by('.site-menu-personal button') && !!by('.site-menu-profile.is-guest'), "비회원에게 로그인 진입만 표시");
    await closeMenu();
    check(!by('.site-menu-dialog') && document.activeElement === by('#open-menu'), "닫기 후 메뉴 버튼으로 포커스 복귀");

    await render(<Fixture key="member" />);
    const input = by('#preserved-input');
    window.scrollTo(0, 2800); await wait(80);
    const scroll = window.scrollY;
    const gaps = await sampleMotion();
    const view = by('.menu-page-viewport'), rect = view.getBoundingClientRect();
    by('#metrics').textContent = JSON.stringify({ viewport: [innerWidth, innerHeight], pageHeight: by('.app-shell').offsetHeight,
      layerHeight: view.clientHeight, visibleHeight: rect.height, sampledFrames: gaps.length,
      frameGapP95Ms: Number([...gaps].sort((a, b) => a - b)[Math.floor(gaps.length * .95)]?.toFixed(1)), maxFrameGapMs: Number(Math.max(...gaps).toFixed(1)) }, null, 2);
    check(Math.abs(rect.height / innerHeight - .85) < .001 && Math.abs(rect.top / innerHeight - .075) < .002, "미리보기 높이 85%, 위아래 여백 7.5%");
    const matrix = new DOMMatrix(getComputedStyle(view).transform);
    check(Math.abs(matrix.a - .76) < .001 && Math.abs(matrix.d - matrix.a) < .001, "가로 크기 유지와 글자·이미지 비율 보존");
    check(view.clientHeight < innerHeight * 1.12 && by('.app-shell').offsetHeight > 16000 && getComputedStyle(view).contain.includes('paint'), "긴 목록도 약 한 화면 크기의 레이어만 이동");
    check(Math.abs(view.scrollTop - scroll) < 1 && Math.abs(window.scrollY - scroll) < 1 && by('.app-shell').inert, "읽던 위치 유지와 배경 조작 차단");
    check(document.documentElement.scrollWidth <= innerWidth && by('.site-menu-panel').getBoundingClientRect().right <= innerWidth, "메뉴와 미리보기에 가로 넘침 없음");
    await closeMenu();
    check(Math.abs(window.scrollY - scroll) < 1 && by('#preserved-input') === input && (input as HTMLInputElement).value === "읽던 내용", "닫아도 스크롤·입력 DOM·내용 유지");
    check(!view.dataset.menuActive && !by('.app-frame').style.height && getComputedStyle(view).willChange === 'auto', "닫은 뒤 임시 레이어·높이 제한 해제");

    window.scrollTo(0, document.documentElement.scrollHeight); await wait(80);
    const bottom = window.scrollY;
    await openMenu();
    check(Math.abs(view.scrollTop - bottom) < 1, "목록 맨 아래에서도 열기 전 위치 유지");
    await closeMenu();
    check(Math.abs(window.scrollY - bottom) < 1, "맨 아래에서 닫아도 화면 점프 없음");

    await click(by('#open-menu'), 60);
    await click(by('.site-menu-close'), 20);
    await click(by('#open-menu'));
    check(view.dataset.menuOpen === "true" && !!by('.site-menu-dialog'), "빠른 열기·닫기·재열기 정상 처리");
    await click(by('.site-menu-primary a[href="#/board"]'));
    check(!view.dataset.menuActive && !by('.site-menu-dialog') && window.scrollY === 0 && by('.qa-sticky').textContent!.includes('#/board'), "다른 화면으로 이동할 때 임시 높이·스크롤 정리");

    await openMenu();
    calls = 0;
    const logout = by('.site-menu-personal button') as HTMLButtonElement;
    await act(async () => { logout.click(); logout.click(); });
    check(calls === 1 && logout.disabled && logout.getAttribute('aria-busy') === 'true', "로그아웃 중 연속 클릭 차단");
    await act(async () => logoutResult(Error("연결이 끊어졌어요. 다시 시도해 주세요.")));
    check(!!by('.site-menu-error[role=alert]') && !logout.disabled && !!by('.site-menu-dialog'), "로그아웃 실패 안내와 재시도 가능");
    await click(logout, 30);
    await act(async () => logoutResult()); await wait();
    check(!by('.site-menu-dialog') && by('#notice').textContent === '로그아웃했어요.' && by('.qa-sticky').textContent!.includes('#/board'), "로그아웃 성공 안내와 원래 화면 유지");
    await openMenu();
    check(!by('.site-menu-personal button') && !!by('.site-menu-profile.is-guest'), "로그아웃 후 개인 메뉴와 로그아웃 버튼 제거");
    await closeMenu();

    window.matchMedia = query => query === '(prefers-reduced-motion: reduce)' ? { ...originalMatchMedia.call(window, query), matches: true } as MediaQueryList : originalMatchMedia.call(window, query);
    document.documentElement.dataset.qaReduced = 'true';
    await openMenu();
    check(getComputedStyle(view).transitionDuration === '0s' && view.dataset.menuOpen === 'true', "동작 줄이기에서는 전환 애니메이션 생략");
    await closeMenu();
    check(!view.dataset.menuActive, "동작 줄이기에서도 닫기 정리 완료");
    by('#status').textContent = `${document.querySelectorAll('#results .pass').length}개 검사 전체 통과`;
  } catch (error) { by('#status').textContent = '실패: ' + (error as Error).message; }
  finally {
    window.matchMedia = originalMatchMedia; delete document.documentElement.dataset.qaReduced;
    await render(null); window.scrollTo(0, 0); delete by('#checks').dataset.running;
  }
};
