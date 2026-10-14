import { studyEnabled } from "../ux/config";
import { postPath } from "./postAddress";
import { ErrorState, LoadingState } from "../ScreenFeedback";
import { Button } from "@heroui/react";
import { ArrowRight, BookmarkCheck, LogIn, Undo2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { errorText } from "./client";
import { Dialog } from "../ScreenDialog";
import type { ArchiveRecord, UserState } from "../data";
import { listReturnLabel, personalReturnPath, withList } from "./navigation";
import { authPath, Empty, Header, PostRow, type Base } from "./shared";

export type SavedCollectionData = {
  catalog: ArchiveRecord[];
  user: UserState;
  renderRecord: (record: ArchiveRecord) => ReactNode;
  clearLegacy: (ids: string[]) => void;
};
type SavedProps = Pick<Base, "c" | "go"> & SavedCollectionData & { params: URLSearchParams };

export function SavedScreen(props: SavedProps) {
  const { c, go, params } = props;
  const returnTo = personalReturnPath(params);
  return <main className="saved-main" data-community-ready={!c.loading}>
    <Header title="저장한 글·자료" go={go} backLabel={listReturnLabel(returnTo)} onBack={() => go(returnTo, false, false, true)} />
    <SavedCollection {...props} />
  </main>;
}

/** Shared by the existing shortcut and the profile's saved tab. */
export function SavedCollection({ c, go, params, catalog, user, renderRecord, clearLegacy, inProfile = false }: SavedProps & { inProfile?: boolean }) {
  // Old /account?tab=saved links refer to posts; new profile entries specify records.
  const selected = params.get(inProfile ? "saved" : "tab") || (inProfile ? "posts" : "records");
  const tab = selected === "posts" ? "posts" : "records";
  const base = inProfile ? "/account" : "/saved";
  const list = base + (params.size ? "?" + params : "");
  const [importOpen, setImportOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [undo, setUndo] = useState<{ id: string; title: string; kind: "records" | "posts"; owner: string } | null>(null);
  const pending = useRef(false);
  const owner = useRef(c.profile?.id);
  owner.current = c.profile?.id;
  useEffect(() => { setUndo(null); setError(""); }, [c.profile?.id]);
  const changeSaved = async (item: NonNullable<typeof undo>, value: boolean) => {
    if (pending.current || item.owner !== c.profile?.id) return;
    pending.current = true; setBusy(true); setError("");
    try {
      await c.action(item.kind === "records" ? "archive_bookmark" : "bookmark", item.kind === "records" ? { ids: [item.id], value } : { postId: item.id, value });
      if (owner.current === item.owner) setUndo(value ? null : item);
    } catch (e) { if (owner.current === item.owner) setError(errorText(e)); }
    finally { pending.current = false; setBusy(false); }
  };
  const removeButton = (id: string, title: string, kind: "records" | "posts") => <Button variant="ghost" isIconOnly className="saved-remove" aria-label={`${title} 저장 해제`} isDisabled={busy} onPress={() => void changeSaved({ id, title, kind, owner: c.profile!.id }, false)}><BookmarkCheck size={19} /></Button>;
  const catalogById = useMemo(() => new Map(catalog.map(record => [record.id, record])), [catalog]);
  const legacy = [...new Set(user.saved)].filter(id => catalogById.has(id));
  const records = (c.account?.archiveSaved || []).map(id => catalogById.get(id)).filter((r): r is ArchiveRecord => !!r);
  const posts = c.account?.saved || [];
  const changeTab = (next: string) => {
    const query = new URLSearchParams(params);
    query.set(inProfile ? "saved" : "tab", next);
    go(base + "?" + query, true, true);
  };
  return <section className="saved-collection" aria-label="저장한 글·자료 목록" data-community-ready={!c.loading}>
    <div className="saved-tabs" role="group" aria-label="저장 목록 분류">
      <Button variant="ghost" className={tab === "records" ? "chosen" : ""} aria-pressed={tab === "records"} onPress={() => changeTab("records")}>큐시트{c.account && !c.loading ? ` ${records.length}` : ""}</Button>
      <Button variant="ghost" className={tab === "posts" ? "chosen" : ""} aria-pressed={tab === "posts"} onPress={() => changeTab("posts")}>게시글{c.account && !c.loading ? ` ${posts.length}` : ""}</Button>
    </div>
    {c.loading ? <LoadingState>스크랩을 불러오는 중</LoadingState>
    : c.error ? <ErrorState message={c.error} retry={() => void c.refreshLatest()} />
    : !c.profile ? <div className="community-login-gate">
      <LogIn size={24} /><h2>로그인하고 스크랩을 모아보세요</h2>
      <p>{studyEnabled ? "체험 회원으로 현재 탭에서 스크랩을 체험해 보세요." : "저장한 큐시트와 게시글을 다른 기기에서도 이어서 볼 수 있어요."}</p>
      <Button onPress={() => go(authPath())}>로그인 / 회원가입</Button>
    </div>
    : <>
      <p className="saved-account-note">{studyEnabled ? "현재 탭에서 체험용으로 저장한 목록입니다." : "계정에 저장한 목록입니다."}{tab === "records" && " 읽던 위치는 현재 기기에 보관돼요."}</p>
      {undo && undo.owner === c.profile.id && <div className="saved-undo" role="status"><span><strong>{undo.title}</strong>저장을 해제했어요.</span><Button variant="ghost" isDisabled={busy} onPress={() => void changeSaved(undo, true)}><Undo2 size={16} />실행 취소</Button></div>}
      {error && <p className="community-error" role="alert">{error}</p>}
      {tab === "records" ? <>
        {!!legacy.length && <div className="saved-legacy">
          <strong>이 브라우저에 저장해 둔 큐시트 {legacy.length}개가 있어요.</strong>
          <p>본인이 저장한 목록이라면 현재 계정으로 옮길 수 있어요.</p>
          <Button variant="outline" onPress={() => setImportOpen(true)}>계정에 옮기기</Button>
        </div>}
        {records.length ? records.map(record => <div className="saved-item" key={record.id}>
          <div>{renderRecord(record)}
          {!!user.progress[record.id] && <span className="saved-progress">{user.progress[record.id]} / {record.pages}쪽 읽는 중</span>}</div>
          {removeButton(record.id, `${record.title} ${record.issue}회`, "records")}
        </div>) : <Empty title="다시 펼칠 원고를 담아보세요">큐시트의 저장 버튼을 누르면 계정에 모여요.<br /><Button variant="secondary" onPress={() => go("/archive")}>큐시트 찾기 <ArrowRight size={16} /></Button></Empty>}
      </> : posts.length ? posts.map(post => <div className="saved-item" key={post.id}><PostRow post={post} go={go} catalog={catalog} destination={withList(postPath(post), list)} />{removeButton(post.id, post.title, "posts")}</div>)
      : <Empty title="아직 저장한 글이 없어요">게시글의 저장 버튼을 누르면 여기에 모여요.<br /><Button variant="secondary" onPress={() => go("/board")}>커뮤니티 둘러보기</Button></Empty>}
      {!c.live && !inProfile && <p className="saved-note">체험 계정의 스크랩은 이 브라우저에서만 확인할 수 있어요.</p>}
    </>}
    <Dialog title="저장한 큐시트 옮기기" open={importOpen && !!c.profile} close={() => { if (!busy) setImportOpen(false); }}>
      <p>이 브라우저의 큐시트 {legacy.length}개를 <strong>{c.profile?.nickname}</strong> 계정에 추가합니다. 이미 저장한 큐시트는 중복되지 않아요.</p>
      {error && <p className="community-error" role="alert">{error}</p>}
      <div className="community-dialog-actions"><Button variant="outline" isDisabled={busy} onPress={() => setImportOpen(false)}>취소</Button>
        <Button isDisabled={busy || !legacy.length} onPress={() => { void (async () => {
          setBusy(true); setError("");
          try { await c.action("archive_bookmark", { ids: legacy, value: true }, "계정으로 큐시트를 옮겼어요."); clearLegacy(legacy); setImportOpen(false); }
          catch(e) { setError(errorText(e)); } finally { setBusy(false); }
        })(); }}>{busy ? "옮기는 중…" : "계정에 추가"}</Button></div>
    </Dialog>
  </section>;
}
