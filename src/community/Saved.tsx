import { postPath } from "./postAddress";
import { ErrorState, LoadingState } from "../ScreenFeedback";
import { Button } from "@heroui/react";
import { ArrowRight, LogIn } from "lucide-react";
import type { ReactNode } from "react";
import type { ArchiveRecord, UserState } from "../data";
import { listReturnLabel, personalReturnPath, withList } from "./navigation";
import { authPath, Empty, Header, PostRow, type Base } from "./shared";

export function SavedScreen({ c, go, params, catalog, user, renderRecord }: Pick<Base, "c" | "go"> & {
  params: URLSearchParams;
  catalog: ArchiveRecord[];
  user: UserState;
  renderRecord: (record: ArchiveRecord) => ReactNode;
}) {
  const tab = params.get("tab") === "posts" ? "posts" : "records";
  const returnTo = personalReturnPath(params);
  const list = "/saved" + (params.size ? "?" + params : "");
  const records = [...user.saved].reverse().map(id => catalog.find(r => r.id === id)).filter((r): r is ArchiveRecord => !!r);
  const posts = c.account?.saved || [];
  const changeTab = (next: string) => {
    const query = new URLSearchParams(params);
    query.set("tab", next);
    go("/saved?" + query, true, true);
  };
  return <main className="saved-main" data-community-ready={tab === "records" || !c.loading}>
    <Header title="저장한 글·자료" go={go} backLabel={listReturnLabel(returnTo)} onBack={() => go(returnTo, false, false, true)} />
    <div className="archive-heading">
      <h1>저장한 글·자료</h1>
      <p>다시 읽고 싶은 큐시트와 게시글을 모았어요.</p>
    </div>
    <div className="saved-tabs" role="group" aria-label="저장 목록 분류">
      <Button variant="ghost" className={tab === "records" ? "chosen" : ""} aria-pressed={tab === "records"} onPress={() => changeTab("records")}>큐시트 {records.length}</Button>
      <Button variant="ghost" className={tab === "posts" ? "chosen" : ""} aria-pressed={tab === "posts"} onPress={() => changeTab("posts")}>게시글{c.account && !c.loading ? ` ${posts.length}` : ""}</Button>
    </div>
    {tab === "records" ? records.length ? records.map(record => <div key={record.id}>
      {renderRecord(record)}
      {!!user.progress[record.id] && <span className="saved-progress">{user.progress[record.id]} / {record.pages}쪽 읽는 중</span>}
    </div>) : <Empty title="다시 펼칠 원고를 담아보세요">큐시트의 저장 버튼을 누르면 여기에 모여요.<br /><Button variant="secondary" onPress={() => go("/archive")}>큐시트 찾기 <ArrowRight size={16} /></Button></Empty>
    : c.loading ? <LoadingState>저장한 게시글을 불러오는 중</LoadingState>
    : c.error ? <ErrorState message={c.error} retry={() => void c.refreshLatest()} />
    : !c.profile ? <div className="community-login-gate">
      <LogIn size={24} /><h2>로그인하면 저장한 게시글을 볼 수 있어요</h2>
      <p>큐시트는 로그인 없이 이 브라우저에 저장할 수 있어요.</p>
      <Button onPress={() => go(authPath())}>로그인 / 회원가입</Button>
    </div>
    : posts.length ? posts.map(post => <PostRow key={post.id} post={post} go={go} catalog={catalog} destination={withList(postPath(post), list)} />)
    : <Empty title="아직 저장한 글이 없어요">게시글의 저장 버튼을 누르면 여기에 모여요.<br /><Button variant="secondary" onPress={() => go("/board")}>커뮤니티 둘러보기</Button></Empty>}
    <p className="saved-note">큐시트는 이 브라우저에, 게시글은 {c.live ? "로그인 계정에" : "체험 계정에"} 저장합니다.</p>
  </main>;
}
