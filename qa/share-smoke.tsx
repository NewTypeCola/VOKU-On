import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { SharePost } from "../src/community/SharePost";
import type { CommunityPost } from "../src/community/types";
import "../src/style.css";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const root = createRoot(document.querySelector("#screen")!);
const resultList = document.querySelector("#results")!;
const post = { id: "10000000-0000-4000-8000-000000000001", publicCode: "QaPost_123", title: "공유 검사", status: "published" } as CommunityPost;
const button = () => document.querySelector<HTMLButtonElement>('[aria-label="게시글 공유"]');
const check = (ok: boolean, message: string) => {
  const li = document.createElement("li"); li.className = ok ? "pass" : "fail"; li.textContent = `${ok ? "PASS" : "FAIL"} ${message}`;
  resultList.append(li); if (!ok) throw Error(message);
};
document.querySelector<HTMLButtonElement>("#run")!.onclick = async () => {
  resultList.replaceChildren();
  const descriptors = [Object.getOwnPropertyDescriptor(navigator, "share"), Object.getOwnPropertyDescriptor(navigator, "clipboard"), Object.getOwnPropertyDescriptor(document, "execCommand")];
  let notices: string[] = [], copies: string[] = [], calls: ShareData[] = [];
  let rejectShare: (value: unknown) => void = () => {};
  const setShare = (value: unknown) => Object.defineProperty(navigator, "share", {configurable:true, value});
  const setClipboard = (writeText: (value: string) => Promise<void>) => Object.defineProperty(navigator, "clipboard", {configurable:true, value:{writeText}});
  const render = async (value = post) => act(async () => root.render(<SharePost post={value} live notify={value => notices.push(value)} />));
  const click = () => act(async () => button()!.click());
  try {
    setShare((data: ShareData) => { calls.push(data); return new Promise((_, reject) => {rejectShare = reject;}); });
    setClipboard(async value => {copies.push(value);});
    await render(); await click(); await click();
    check(calls.length === 1 && button()!.disabled, "기기 공유를 한 번만 즉시 호출하고 중복 클릭을 막음");
    check(calls[0].url === location.origin + "/p/QaPost_123" && !document.querySelector('[role="dialog"]'), "추가 창 없이 짧은 주소를 전달");
    await act(async () => rejectShare({name:"AbortError"}));
    check(!button()!.disabled && !notices.length && !copies.length, "취소 후 조용히 복귀하고 주소를 복사하지 않음");
    setShare(undefined); await click();
    check(copies.length === 1 && notices.at(-1) === "공유 주소를 복사했어요.", "기본 공유 미지원 시 주소 복사와 안내");
    setShare(async () => {throw Error("unsupported");}); await click();
    check(copies.length === 2 && !button()!.disabled, "기본 공유 오류 시 주소 복사로 전환");
    setClipboard(async () => {throw Error("denied");});
    Object.defineProperty(document, "execCommand", {configurable:true, value:()=>false});
    await click();
    check(notices.at(-1)?.includes("복사하지 못했어요") === true && !document.querySelector('[role="dialog"]') && !button()!.disabled, "복사까지 실패하면 안내만 표시하고 별도 창 없음");
    await render({...post, isSecret:true});
    check(!button(), "비밀글 공유 버튼은 표시하지 않음");
    document.querySelector("#status")!.textContent = "7개 검사 통과";
  } catch (error) { document.querySelector("#status")!.textContent = String(error); }
  finally {
    for (const [i, target, key] of [[0,navigator,"share"],[1,navigator,"clipboard"],[2,document,"execCommand"]] as const) {
      const descriptor = descriptors[i];
      if (descriptor) Object.defineProperty(target, key, descriptor); else Reflect.deleteProperty(target,key);
    }
  }
};
