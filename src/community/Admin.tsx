import { postPath as publicPostPath, routeHref } from "./postAddress";
import { Button, Dropdown, Label } from "@heroui/react";
import { LoadingState } from "../ScreenFeedback";
import { ChevronRight, Eye, EyeOff, LockKeyhole, LockKeyholeOpen, MoreHorizontal, Pencil, Pin, PinOff, Search, ShieldCheck, X } from "lucide-react";
import { useEffect, useState, type MouseEvent } from "react";
import { api, errorText } from "./client";
import { adminReturnPath, pageNumber } from "./navigation";
import { Pagination } from "./Pagination";
import {
  Dialog, Empty, ErrorLine, Header, LoadState, localDate, OperationDialog,
  PostRow, PreviewNote, useLoad, type Base, type Go, type Operation,
} from "./shared";
import { canManageBoard, type BoardAdminPage, type BoardAdminTab, type CommunityPost } from "./types";
import "./admin.css";

const tabs = [["posts", "글·공지"], ["comments", "숨긴 댓글"], ["reports", "신고"], ["audit", "처리 기록"]] as const;
const actionNames: Record<string, string> = {
  post_pin: "공지 설정", post_lock: "댓글 잠금 설정",
  post_visibility: "글 공개 상태 변경", comment_hide: "댓글 숨김", comment_restore: "댓글 다시 공개",
  report_hide: "신고 내용 숨김", report_dismiss: "신고 확인 완료",
};
type Props = Base & { params: URLSearchParams };

export function CommunityAdmin({ c, go, notify, params }: Props) {
  const [previewError, setPreviewError] = useState("");
  const back = () => go(adminReturnPath(params), false, false, true);
  if (c.loading || !canManageBoard(c.profile)) return (
    <main className="board-admin">
      <Header title="관리자 페이지" go={go} onBack={back} backLabel="원래 화면으로 돌아가기" />
      {c.loading ? <LoadingState>관리 권한을 확인하고 있어요.</LoadingState> : <>
        <Empty title="관리자 계정으로 이용할 수 있어요">
          {c.profile ? "게시판 관리 권한이 있는 계정에서 열 수 있습니다." : "게시판 관리자 계정으로 로그인해 주세요."}
        </Empty>
        <div className="board-admin-gate">
          {!c.profile && <Button onPress={() => go("/auth?" + new URLSearchParams({ next: "/admin?" + params.toString() }))}>로그인</Button>}
          <Button variant="outline" onPress={back}>원래 화면으로 돌아가기</Button>
          {!c.live && <div className="board-admin-preview">
            <p>이 브라우저에만 저장되는 예시로 관리자 화면을 확인합니다.</p>
            <Button variant="outline" onPress={() => { void c.previewLogin("admin").catch(e => setPreviewError(errorText(e))); }}>관리자 화면 체험</Button>
          </div>}
          <ErrorLine text={previewError} />
        </div>
      </>}
    </main>
  );
  return <AdminPanel key={c.profile!.id} c={c} go={go} notify={notify} params={params} />;
}

function AdminPanel({ c, go, notify, params }: Props) {
  const tab = (tabs.some(([key]) => key === params.get("tab")) ? params.get("tab")! : "posts") as BoardAdminTab;
  const query = tab === "posts" ? (params.get("q") || "").trim().slice(0, 100) : "";
  const postFilter = ["notice", "hidden"].includes(params.get("filter") || "") ? params.get("filter")! : "all";
  const reportFilter = ["done", "all"].includes(params.get("status") || "") ? params.get("status")! : "open";
  const [search, setSearch] = useState(query);
  const [operation, setOperation] = useState<Operation | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  useEffect(() => setSearch(query), [query, tab]);
  const requestedPage = pageNumber(params.get("page"));
  const filter = tab === "posts" ? postFilter : tab === "reports" ? reportFilter : "all";
  const state = useLoad<BoardAdminPage>(() => api.boardAdmin({ tab, filter, query, page: requestedPage }), [tab, filter, query, requestedPage, c.profile?.id, c.profile?.role], c.revision);
  const d = state.data;
  const ready = !state.loading && !state.error && !!d;
  const currentPath = "/admin" + (params.size ? "?" + params.toString() : "");
  function pathFor(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value); else next.delete(key);
    }
    return "/admin" + (next.size ? "?" + next.toString() : "");
  }
  const change = (changes: Record<string, string | null>) => go(pathFor({ page: null, ...changes }), true, true);
  const follow = (path: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    go(path, true, true);
  };
  const postPath = (id: string, commentId?: string) => publicPostPath(d?.posts.find(p => p.id === id) || { id }) + "?" +
    new URLSearchParams({ list: currentPath, ...(commentId ? { comment: commentId } : {}) });
  const posts = d?.posts || [];
  const reports = d?.reports || [];
  const audit = d?.audit || [];
  const total = d?.total || 0;
  const page = d?.page || requestedPage;
  const selectedReport = d?.reports.find(r => r.id === reportId);

  return (
    <main className="board-admin" data-community-ready={ready}>
      <Header title="관리자 페이지" go={go}
        onBack={() => go(adminReturnPath(params), false, false, true)} backLabel="원래 화면으로 돌아가기">
        <Button size="sm" variant="outline" onPress={() => go("/write?" + new URLSearchParams({ notice: "1", list: currentPath }))}>
          <Pencil size={15} aria-hidden="true" />공지 쓰기
        </Button>
      </Header>
      <div className="board-admin-intro"><ShieldCheck size={19} aria-hidden="true" /><p>게시글과 댓글을 살피고, 공지와 신고를 관리합니다.</p></div>
      <nav className="board-admin-tabs" aria-label="관리 항목">
        {tabs.map(([key, label]) => {
          const path = pathFor({ tab: key === "posts" ? null : key, q: null, filter: null, status: null, page: null });
          return <a key={key} href={"#" + path} onClick={follow(path)} aria-current={tab === key ? "page" : undefined}>
            {label}{key === "reports" && !!d?.pendingReports && <small aria-label={d.pendingReports + "건 확인 대기"}>{d.pendingReports}</small>}
          </a>;
        })}
      </nav>
      {tab === "posts" ? <div className="board-admin-tools">
        <form className="board-admin-search" role="search" onSubmit={e => { e.preventDefault(); change({ q: search.trim() || null }); }}>
          <Search size={18} aria-hidden="true" />
          <input type="search" aria-label="관리할 글 제목 검색" placeholder="글 제목으로 찾기" maxLength={100} value={search} onChange={e => setSearch(e.target.value)} />
          {search && <Button isIconOnly variant="ghost" aria-label="검색어 지우기" onPress={() => { setSearch(""); change({ q: null }); }}><X size={16} /></Button>}
          <Button type="submit" size="sm" variant="secondary">검색</Button>
        </form>
        <div className="board-admin-filters" role="group" aria-label="글 필터">
          {[["all", "전체"], ["notice", "공지"], ["hidden", "숨긴 글"]].map(([key, label]) =>
            <button key={key} type="button" aria-pressed={postFilter === key} onClick={() => change({ filter: key === "all" ? null : key })}>{label}</button>)}
        </div>
        <p className="board-admin-help">글을 열면 본문과 댓글을 함께 확인하고 관리할 수 있어요.</p>
      </div> : tab === "reports" ? <div className="board-admin-tools">
        <div className="board-admin-filters" role="group" aria-label="신고 상태">
          {[["open", "확인 대기"], ["done", "처리 완료"], ["all", "전체"]].map(([key, label]) =>
            <button key={key} type="button" aria-pressed={reportFilter === key} onClick={() => change({ status: key === "open" ? null : key })}>{label}</button>)}
        </div>
        <p className="board-admin-help">내용을 확인한 뒤 숨기거나, 조치 없이 마무리할 수 있어요.</p>
      </div> : <p className="board-admin-help board-admin-tools">{tab === "comments" ? "숨긴 댓글을 확인하고 다시 공개할 수 있어요. 작성자가 삭제한 댓글은 포함되지 않습니다." : "누가 어떤 글과 댓글을 관리했는지 확인합니다."}</p>}
      <LoadState state={state} />
      {ready && d && <>
        <div className="board-admin-result"><span>{total.toLocaleString()}건</span><small>전체 내역 기준 · {page}페이지</small></div>
        {tab === "posts" && (posts.length ? posts.map(p =>
          <div className="community-admin-post" key={p.id}>
            <PostRow post={p} go={go} destination={postPath(p.id)} />
            <PostActions post={p} own={p.authorId === c.profile?.id} list={currentPath} go={go} setOperation={setOperation} />
          </div>,
        ) : <Empty title={query ? "검색 결과가 없어요" : postFilter === "hidden" ? "숨긴 글이 없어요" : postFilter === "notice" ? "등록된 공지가 없어요" : "아직 게시글이 없어요"}>{query ? "다른 제목으로 검색하거나 검색어를 지워 주세요." : postFilter === "notice" ? "위의 공지 쓰기로 소식을 안내해 보세요." : "게시글이 등록되면 이곳에서 관리할 수 있습니다."}</Empty>)}
        {tab === "comments" && (d.comments.length ? d.comments.map(comment => <article className="board-admin-comment" key={comment.id}>
          <strong>{comment.postTitle}</strong><small>{comment.author} · {localDate(comment.date)}</small>
          <blockquote>{comment.body}</blockquote>
          <div className="board-admin-comment-actions">
            <Button variant="outline" onPress={() => go(postPath(comment.postId, comment.id))}>글과 댓글 확인</Button>
            <Button variant="secondary" onPress={() => setOperation({ title: "댓글 다시 공개", action: "comment_restore", payload: { id: comment.id }, reason: true,
              target: { title: comment.postTitle || "숨긴 댓글", author: comment.author, body: comment.body }, description: "이 댓글을 다시 볼 수 있도록 공개합니다. 원글이 숨겨져 있다면 원글의 공개 상태는 유지됩니다." })}>다시 공개</Button>
          </div>
        </article>) : <Empty title="숨긴 댓글이 없어요">관리자가 숨긴 댓글이 여기에 모입니다.</Empty>)}
        {tab === "reports" && (reports.length ? reports.map(r =>
          <button type="button" className="community-report-row" key={r.id} onClick={() => setReportId(r.id)}>
            <div><div className="community-meta"><span>{r.commentId ? "댓글 신고" : "글 신고"}</span><b>{r.status === "open" ? "확인 대기" : r.status === "resolved" ? "숨김 처리" : "확인 완료"}</b></div>
              <strong>{r.title || "신고된 글"}</strong><p>{r.reason}</p><small>{r.reporter} · {localDate(r.date)}</small></div><ChevronRight size={18} aria-hidden="true" />
          </button>,
        ) : <Empty title={reportFilter === "open" ? "확인할 신고가 없어요" : "신고 내역이 없어요"}>신고가 접수되면 이곳에서 내용을 확인할 수 있습니다.</Empty>)}
        {tab === "audit" && (audit.length ? audit.map(a => {
          const value = a.reason.match(/ \[(true|false)\]$/)?.[1];
          const label = value && a.action === "post_pin" ? (value === "true" ? "공지로 고정" : "공지 해제")
            : value && a.action === "post_lock" ? (value === "true" ? "댓글 잠금" : "댓글 잠금 해제")
              : value && a.action === "post_visibility" ? (value === "true" ? "글 숨김" : "글 다시 공개") : actionNames[a.action];
          const reason = a.reason.replace(/ \[(true|false)\]$/, "");
          return <div className="community-audit-row" key={a.id}><strong>{label}</strong><small>{a.actor} · {localDate(a.date)}</small>
            {a.postId ? <a href={routeHref(postPath(a.postId, a.commentId))} onClick={e => {
              if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
              e.preventDefault(); go(postPath(a.postId!, a.commentId));
            }}>{a.postTitle || "원문 확인"}</a> : <p>{a.postTitle || "원문을 확인할 수 없어요."}</p>}
            {a.excerpt && <blockquote>{a.excerpt}</blockquote>}
            {reason && <p>{reason}</p>}
          </div>;
        }) : <Empty title="아직 처리 기록이 없어요">공지 설정이나 글·댓글 관리 내역이 여기에 남습니다.</Empty>)}
        <Pagination page={page} total={total} label="관리 목록 페이지" change={n => go(pathFor({ page: n === 1 ? null : String(n) }), true)} />
      </>}
      <Dialog title={selectedReport?.commentId ? "댓글 신고 확인" : "게시글 신고 확인"} open={!!selectedReport} close={() => setReportId(null)}>
        {selectedReport && <div className="community-report-detail">
          <strong>{selectedReport.title}</strong><blockquote>{selectedReport.body || "원문을 열어 내용을 확인해 주세요."}</blockquote>
          <p><b>신고 이유</b> {selectedReport.reason}</p>{selectedReport.detail && <p>{selectedReport.detail}</p>}
          <small>{selectedReport.reporter} · {localDate(selectedReport.date)}</small>
          <Button variant="outline" onPress={() => { setReportId(null); go(postPath(selectedReport.postId, selectedReport.commentId)); }}>글과 댓글 확인<ChevronRight size={17} /></Button>
          {selectedReport.status === "open" ? <div className="community-dialog-actions">
            <Button variant="outline" onPress={() => { setReportId(null); setOperation({ target: { title: selectedReport.title, body: selectedReport.body }, title: "신고 확인 완료", action: "resolve_report", payload: { id: selectedReport.id, decision: "dismiss" }, reason: true, description: "내용을 그대로 두고 신고를 처리 완료로 표시합니다." }); }}>조치 없이 마무리</Button>
            <Button onPress={() => { setReportId(null); setOperation({ target: { title: selectedReport.title, body: selectedReport.body }, title: "신고된 내용 숨기기", action: "resolve_report", payload: { id: selectedReport.id, decision: "hide" }, reason: true, description: "신고된 글 또는 댓글을 숨기고 신고를 처리 완료로 표시합니다." }); }}>내용 숨기기</Button>
          </div> : <p><b>처리 사유</b> {selectedReport.resolution || "처리 완료"}</p>}
        </div>}
      </Dialog>
      <OperationDialog operation={operation} close={() => setOperation(null)} c={c} />
      <PreviewNote c={c} go={go} />
    </main>
  );
}

function PostActions({ post: p, own, list, go, setOperation }: {
  post: CommunityPost; own: boolean; list: string; go: Go;
  setOperation: (operation: Operation) => void;
}) {
  const items = [
    ...(own && p.status === "published" ? [{ id: "edit", label: "내 글 수정", icon: Pencil }] : []),
    ...(!p.isSecret ? [{ id: "pin", label: p.pinned ? "공지 해제" : "공지로 고정", icon: p.pinned ? PinOff : Pin }] : []),
    { id: "lock", label: p.locked ? "댓글 잠금 해제" : "댓글 잠금", icon: p.locked ? LockKeyholeOpen : LockKeyhole },
    { id: "visibility", label: p.status === "hidden" ? "다시 공개" : "글 숨기기", icon: p.status === "hidden" ? Eye : EyeOff },
  ];
  return <Dropdown><Button isIconOnly variant="ghost" aria-label={p.title + " 관리"}><MoreHorizontal size={20} /></Button>
    <Dropdown.Popover placement="bottom end" offset={6} containerPadding={8} className="board-admin-post-menu"><Dropdown.Menu aria-label="게시글 관리" onAction={key => {
      if (key === "edit") go("/write?" + new URLSearchParams({ edit: p.id, list }));
      else if (key === "pin") setOperation({ target: { title: p.title, author: p.author }, title: p.pinned ? "공지 해제" : "공지로 고정", action: "post_pin", payload: { postId: p.id, value: !p.pinned }, description: p.pinned ? "일반 게시글로 표시합니다." : "커뮤니티의 공지 영역에 표시합니다." });
      else if (key === "lock") setOperation({ target: { title: p.title, author: p.author }, title: p.locked ? "댓글 잠금 해제" : "댓글 잠금", action: "post_lock", payload: { postId: p.id, value: !p.locked }, description: p.locked ? "새 댓글을 다시 작성할 수 있습니다." : "기존 댓글은 그대로 보이고 새 댓글 작성을 멈춥니다." });
      else if (key === "visibility") setOperation({ target: { title: p.title, author: p.author }, title: p.status === "hidden" ? "글 다시 공개" : "글 숨기기", action: "post_visibility", payload: { postId: p.id, value: p.status !== "hidden" }, reason: true, description: p.status === "hidden" ? "다른 회원이 다시 읽을 수 있도록 공개합니다." : "목록과 본문에서 숨깁니다. 숨긴 글 필터에서 다시 공개할 수 있습니다." });
    }}>{items.map(({ id, label, icon: Icon }) => <Dropdown.Item key={id} id={id} textValue={label}><Icon size={18} aria-hidden="true" /><Label>{label}</Label></Dropdown.Item>)}</Dropdown.Menu></Dropdown.Popover>
  </Dropdown>;
}
