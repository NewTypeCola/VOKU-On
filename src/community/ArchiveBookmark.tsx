import { studyEnabled } from "../ux/config";
import { useState } from "react";
import { Button } from "@heroui/react";
import { Bookmark } from "lucide-react";
import { Dialog } from "../ScreenDialog";
import { errorText } from "./client";
import { currentRoute } from "./postAddress";
import { authScreenPath } from "./authFlow";
import type { Community } from "./useCommunity";
import type { Go } from "./shared";

export function BookmarkLoginPrompt({ open, close, go }: { open: boolean; close: () => void; go: Go }) {
  return <Dialog title="로그인하고 스크랩해 보세요" open={open} close={close}>
    <p>{studyEnabled ? "체험 회원으로 들어오면 현재 탭에서 큐시트와 게시글 저장을 체험할 수 있어요." : "마음에 드는 큐시트와 게시글을 계정에 모아두고, 다른 기기에서도 다시 꺼내 볼 수 있어요."}</p>
    <div className="community-dialog-actions">
      <Button variant="outline" onPress={close}>계속 읽기</Button>
      <Button onPress={() => { const path = currentRoute(); close(); go(authScreenPath("login", path, path)); }}>로그인 / 회원가입</Button>
    </div>
  </Dialog>;
}

export function ArchiveBookmark({ recordId, c, go, notify }: { recordId: string; c: Community; go: Go; notify: (text: string) => void }) {
  const [prompt, setPrompt] = useState(false), [busy, setBusy] = useState(false);
  const saved = !!c.profile && !!c.account?.archiveSaved?.includes(recordId);
  const save = async () => {
    if (c.error) { notify(c.error); return; }
    if (!c.profile) { setPrompt(true); return; }
    if (!c.profile.profileComplete) { const path=currentRoute(); go(authScreenPath("profile",path,path)); return; }
    setBusy(true);
    try { await c.action("archive_bookmark", { ids: [recordId], value: !saved }, saved ? "스크랩을 해제했어요." : "큐시트를 저장했어요."); }
    catch (e) { notify(errorText(e)); }
    finally { setBusy(false); }
  };
  return <>
    <Button isIconOnly variant="ghost" className={`icon-button ${saved ? "active" : ""}`} aria-label={saved ? "큐시트 저장 해제" : "큐시트 저장"}
      isDisabled={busy || c.loading} onPress={() => void save()}><Bookmark size={20} fill={saved ? "currentColor" : "none"} /></Button>
    <BookmarkLoginPrompt open={prompt} close={() => setPrompt(false)} go={go} />
  </>;
}
