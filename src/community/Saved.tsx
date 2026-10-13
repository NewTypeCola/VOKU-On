import { postPath } from "./postAddress";
import { ErrorState, LoadingState } from "../ScreenFeedback";
import { Button } from "@heroui/react";
import { ArrowRight, LogIn } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { errorText } from "./client";
import { Dialog } from "../ScreenDialog";
import type { ArchiveRecord, UserState } from "../data";
import { listReturnLabel, personalReturnPath, withList } from "./navigation";
import { authPath, Empty, Header, PostRow, type Base } from "./shared";

export function SavedScreen({ c, go, params, catalog, user, renderRecord, clearLegacy }: Pick<Base, "c" | "go"> & {
  params: URLSearchParams;
  catalog: ArchiveRecord[];
  user: UserState;
  renderRecord: (record: ArchiveRecord) => ReactNode;
  clearLegacy: (ids: string[]) => void;
}) {
  const tab = params.get("tab") === "posts" ? "posts" : "records";
  const returnTo = personalReturnPath(params);
  const list = "/saved" + (params.size ? "?" + params : "");
  const [importOpen, setImportOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const catalogById = useMemo(() => new Map(catalog.map(record => [record.id, record])), [catalog]);
  const legacy = [...new Set(user.saved)].filter(id => catalogById.has(id));
  const records = (c.account?.archiveSaved || []).map(id => catalogById.get(id)).filter((r): r is ArchiveRecord => !!r);
  const posts = c.account?.saved || [];
  const changeTab = (next: string) => {
    const query = new URLSearchParams(params);
    query.set("tab", next);
    go("/saved?" + query, true, true);
  };
  return <main className="saved-main" data-community-ready={!c.loading}>
    <Header title="저장한 글·자료" go={go} backLabel={listReturnLabel(returnTo)} onBack={() => go(returnTo, false, false, true)} />
    <div className="archive-heading">
      <h1>저장한 글·자료</h1>
      <p>큐시트와 게시글을 계정에 저장해 다른 기기에서도 꺼내 보세요.</p>
    </div>
    <div className="saved-tabs" role="group" aria-label="저장 목록 분류">
      <Button variant="ghost" className={tab === "records" ? "chosen" : ""} aria-pressed={tab === "records"} onPress={() => changeTab("records")}>큐시트{c.account && !c.loading ? ` ${records.length}` : ""}</Button>
      <Button variant="ghost" className={tab === "posts" ? "chosen" : ""} aria-pressed={tab === "posts"} onPress={() => changeTab("posts")}>게시글{c.account && !c.loading ? ` ${posts.length}` : ""}</Button>
    </div>
    {c.loading ? <LoadingState>스크랩을 불러오는 중</LoadingState>
    : c.error ? <ErrorState message={c.error} retry={() => void c.refreshLatest()} />
    : !c.profile ? <div className="community-login-gate">
      <LogIn size={24} /><h2>로그인하고 스크랩을 모아보세요</h2>
      <p>저장한 큐시트와 게시글을 다른 기기에서도 이어서 볼 수 있어요.</p>
      <Button onPress={() => go(authPath())}>로그인 / 회원가입</Button>
    </div>
    : <>
      {tab === "records" ? <>
        {!!legacy.length && <div className="saved-legacy">
          <strong>이 브라우저에 저장해 둔 큐시트 {legacy.length}개가 있어요.</strong>
          <p>본인이 저장한 목록이라면 현재 계정으로 옮길 수 있어요.</p>
          <Button variant="outline" onPress={() => setImportOpen(true)}>계정에 옮기기</Button>
        </div>}
        {records.length ? records.map(record => <div key={record.id}>
          {renderRecord(record)}
          {!!user.progress[record.id] && <span className="saved-progress">{user.progress[record.id]} / {record.pages}쪽 읽는 중</span>}
        </div>) : <Empty title="다시 펼칠 원고를 담아보세요">큐시트의 저장 버튼을 누르면 계정에 모여요.<br /><Button variant="secondary" onPress={() => go("/archive")}>큐시트 찾기 <ArrowRight size={16} /></Button></Empty>}
      </> : posts.length ? posts.map(post => <PostRow key={post.id} post={post} go={go} catalog={catalog} destination={withList(postPath(post), list)} />)
      : <Empty title="아직 저장한 글이 없어요">게시글의 저장 버튼을 누르면 여기에 모여요.<br /><Button variant="secondary" onPress={() => go("/board")}>커뮤니티 둘러보기</Button></Empty>}
      {!c.live && <p className="saved-note">체험 계정의 스크랩은 이 브라우저에서만 확인할 수 있어요.</p>}
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
  </main>;
}
