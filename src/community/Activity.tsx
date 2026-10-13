import { postPath } from "./postAddress";
import { commentPath } from "./reading";
import { Button } from "@heroui/react";
import { Bell, ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "./client";
import { Empty, LoadState, localDate, PostRow, useLoad, type Base } from "./shared";
import type { ActivityKind, CommunityNotification } from "./types";
import { withList } from "./navigation";

export function ActivityList({ c, go, kind, page, changePage, openNotification, busy }: Pick<Base, "c" | "go"> & {
  kind: ActivityKind;
  page: number;
  changePage: (page: number) => void;
  openNotification: (notification: CommunityNotification) => void;
  busy: boolean;
}) {
  const state = useLoad(() => api.activity(kind, page), [kind, page, c.profile?.id, c.profile?.role], c.revision);
  const data = state.data;
  const list = location.hash.slice(1);
  return <section className="community-activity-list" data-community-ready={!state.loading && !!data} aria-label={kind === "posts" ? "내 글 목록" : kind === "comments" ? "내 댓글 목록" : "알림 목록"}>
    <LoadState state={state} />
    {!state.error && data && <>
      {data.kind === "posts" && data.items.map(post => <PostRow key={post.id} post={post} go={go} destination={withList(postPath(post), list)} />)}
      {data.kind === "comments" && data.items.map(comment => <button key={comment.id} className="community-activity" onClick={() => go(withList(commentPath(comment.postId, comment.id), list))}>
        <span><strong className="community-activity-post">{comment.postTitle || "원글을 확인할 수 없어요"}</strong>{comment.body}<small>{localDate(comment.date)}</small></span><ChevronRight size={16} />
      </button>)}
      {data.kind === "notifications" && data.items.map(n => <button key={n.id} disabled={busy} className={`community-notification ${n.read ? "" : "unread"}`} onClick={() => openNotification(n)}>
        <Bell size={17} /><span>{n.text}<small>{n.read ? "읽음" : "읽지 않음"} · {localDate(n.date)}</small></span><ChevronRight size={16} />
      </button>)}
      {!data.items.length && !state.loading && <Empty title={kind === "posts" ? "아직 작성한 글이 없어요" : kind === "comments" ? "아직 작성한 댓글이 없어요" : "새로운 알림이 없어요"}>
        {kind === "notifications" ? "내 글과 댓글에 새 답글이 달리면 알려드려요." : kind === "comments" ? "다른 동문의 이야기를 읽고 댓글로 안부를 나눠보세요." : "동문들과 나누고 싶은 이야기를 남겨보세요."}<br />
        <Button variant="secondary" onPress={() => go(kind === "posts" ? "/write?" + new URLSearchParams({ list }) : "/board")}>{kind === "posts" ? "글쓰기" : "커뮤니티 둘러보기"}</Button>
      </Empty>}
      {data.total > data.pageSize && <nav className="community-pagination" aria-label="내 활동 페이지">
        <Button isIconOnly variant="outline" aria-label="이전 활동 페이지" isDisabled={state.loading || data.page === 1} onPress={() => changePage(data.page - 1)}><ChevronLeft size={18} /></Button>
        <span>{data.page} / {Math.ceil(data.total / data.pageSize)} · 총 {data.total}개</span>
        <Button isIconOnly variant="outline" aria-label="다음 활동 페이지" isDisabled={state.loading || data.page >= Math.ceil(data.total / data.pageSize)} onPress={() => changePage(data.page + 1)}><ChevronRight size={18} /></Button>
      </nav>}
    </>}
  </section>;
}
