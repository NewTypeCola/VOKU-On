import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { RecentReadings } from "../src/RecentReadings";
import { saveReadingPosition } from "../src/readerPosition";
import { CommunityComposer } from "../src/community/Composer";
import { emptyPostDraft, removeDraft, saveDraft } from "../src/community/drafts";
import { readerComposerPath } from "../src/community/navigation";
import type { ArchiveRecord } from "../src/data";
import type { Community } from "../src/community/useCommunity";
import "../src/style.css";
import "../src/motion.css";
import "../src/archive.css";
import "../src/community/community.css";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const root = createRoot(document.querySelector("#screen")!);
const by = (selector: string) => document.querySelector<HTMLElement>(selector)!;
const wait = () => new Promise(resolve => setTimeout(resolve, 100));
const render = async (node: React.ReactNode) => { await act(async () => root.render(node)); await act(wait); };
const click = async (node: HTMLElement) => { await act(async () => node.click()); await act(wait); };
const button = (name: string) => [...document.querySelectorAll<HTMLButtonElement>("button")].find(node => node.textContent?.trim() === name)!;
const check = (pass: boolean, label: string) => {
  const item = document.createElement("li"); item.textContent = `${pass ? "PASS" : "FAIL"} ${label}`;
  by("#results").append(item); if (!pass) throw Error(label);
};
const records = Array.from({length: 6}, (_, n) => ({id: `voku_journey_qa_${n}`, title: `아주 긴 이름의 방송 프로그램 ${n}`, year: 2011, term: 1, pages: 10, issue: "01", slug: "journey", start: 0} as ArchiveRecord));
const profile = {id: "qa-archive-journey", nickname: "검사 회원", role: "member", profileComplete: true, suspendedUntil: null};
const draftKey = `voku-community-draft:preview:${profile.id}:new`;
let destination = "", payload: Record<string, unknown> | null = null;
const c = {live: false, profile, loading: false, action: async (_name: string, data: Record<string, unknown>) => {payload = data; return {postId: "qa-result"};}} as unknown as Community;
const list = "/archive?year=2011&term=1&program=journey&page=2";
const reader = "/read/" + records[0].id + "?" + new URLSearchParams({list, resume:"1"});
const params = new URLSearchParams(readerComposerPath(records[0].id, reader, list).split("?")[1]);
const compose = (member = true, query = params) => <CommunityComposer c={member ? c : {...c, profile: null}} go={path => {destination = path;}} notify={() => {}} catalog={records} params={query} />;

by("#run").onclick = async () => {
  const oldPositions = localStorage.getItem("voku-reader-positions-v1");
  const oldUrl = location.href;
  by("#run").setAttribute("disabled", ""); by("#results").textContent = ""; by("#status").textContent = "검사 중";
  try {
    localStorage.removeItem("voku-reader-positions-v1");
    await render(<RecentReadings catalog={records} openRecord={(record, resume) => {destination = record.id + ":" + resume;}} />);
    check(!document.querySelector(".archive-recent"), "기록이 없으면 빈 최근 목록을 표시하지 않음");
    await act(async () => { for (const record of records) saveReadingPosition(record.id, {page: 3, offset: .2, angle: 90, view: {scale: 1.25, x: -.1, y: -.1}}); });
    check(document.querySelectorAll(".archive-recent-row").length === 3, "최근 기록은 기본 3개로 표시");
    await click(button("더 보기 (5)"));
    check(document.querySelectorAll(".archive-recent-row").length === 5, "펼치면 최신 5개까지 표시");
    await click(by(".archive-recent-row"));
    check(destination === records[5].id + ":true", "가장 최근 회차를 읽던 위치 복귀로 열기");
    check(by(".archive-recent").scrollWidth <= by(".archive-recent").clientWidth, "긴 프로그램명과 최근 목록이 모바일 가로 폭 안에 들어옴");
    await render(null); await removeDraft(draftKey);
    await render(compose(false));
    check(!!button("로그인 / 회원가입") && !document.querySelector("form"), "비회원은 글쓰기 안내에서 로그인 선택 가능");
    await click(by('[aria-label="큐시트로 돌아가기"]'));
    check(destination === reader, "비회원도 로그인하지 않고 읽던 큐시트로 복귀");
    await render(compose());
    check(by(".community-attached").textContent!.includes(records[0].title), "새 글에 현재 큐시트 자동 연결");
    check(!document.querySelector(".community-compose-record-offer"), "빈 새 글에는 불필요한 연결 확인이 없음");
    await render(null); await removeDraft(draftKey);
    const previous = {...emptyPostDraft(), category: "추억", title: "기존 제목을 보존", body: "기존 내용과 비밀글을 보존", recordId: records[1].id, isSecret: true};
    await saveDraft(draftKey, previous, []); localStorage.setItem(draftKey, JSON.stringify(previous));
    await render(compose());
    check((by('#community-post-title') as HTMLInputElement).value === previous.title && by(".community-attached").textContent!.includes(records[1].title), "기존 제목·첨부 큐시트를 자동으로 덮어쓰지 않음");
    check(!!button("이 큐시트 연결") && by("#screen").scrollWidth <= by("#screen").clientWidth, "연결 선택 안내가 모바일 화면 안에 표시");
    await click(button("기존 글 계속 쓰기"));
    check(!document.querySelector(".community-compose-record-offer") && by(".community-attached").textContent!.includes(records[1].title), "기존 글 계속 쓰기로 원래 첨부 유지");
    await render(null); await render(compose());
    await click(button("이 큐시트 연결"));
    check(by(".community-attached").textContent!.includes(records[0].title) && (by('#community-post-title') as HTMLInputElement).value === previous.title, "선택 후 제목을 유지하면서 요청한 큐시트 연결");
    await click(button("등록"));
    check(payload?.recordId === records[0].id && payload?.body === previous.body && payload?.isSecret === true, "등록에는 선택한 큐시트·기존 본문·비밀글 설정 전달");
    check(new URLSearchParams(destination.split("?")[1]).get("list") === list, "등록 후 글은 원래 자료 목록 복귀 경로 유지");
    await render(null); await render(compose(true, new URLSearchParams({record: "not-in-catalog"})));
    check(!document.querySelector(".community-attached"), "목록에 없는 큐시트 주소는 자동 연결하지 않음");
    by("#status").textContent = `${document.querySelectorAll("#results li").length}개 검사 전체 통과`;
  } catch (error) { by("#status").textContent = "실패: " + (error as Error).message; }
  finally {
    await render(null); await removeDraft(draftKey);
    if (oldPositions === null) localStorage.removeItem("voku-reader-positions-v1"); else localStorage.setItem("voku-reader-positions-v1", oldPositions);
    history.replaceState(history.state, "", oldUrl); by("#run").removeAttribute("disabled");
  }
};
