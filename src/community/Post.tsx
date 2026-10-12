import { CommentSection } from "./Comments";
import { ReadingList } from "./ReadingList";
import { isCommunityList } from "./navigation";
import { PostMenu } from "./shared";
import { PhotoGallery } from "./Photos";
import { PostBody } from "./PostBody";
import { SharePost } from "./SharePost";
import { viewerId } from "./viewer";
import { Button, Label, TextArea, TextField } from "@heroui/react";
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  FileText,
  Flag,
  LockKeyhole,
  ThumbsUp,
} from "lucide-react";
import { useEffect, useState } from "react";
import { archiveCatalog } from "../archiveCatalog";
import { type ArchiveRecord } from "../data";
import { api, errorText } from "./client";
import {
  authPath,
  Choice,
  Dialog,
  ErrorLine,
  Header,
  LoadState,
  localDate,
  OperationDialog,
  PreviewNote,
  RoleTag,
  useLoad,
  type Base,
  type Operation,
} from "./shared";
import {
  postLabel,
  staff,
  reportReasons,
  type Action,
  type CommunityPost,
  type Thread,
} from "./types";
import type { Community } from "./useCommunity";

function ReportDialog({
  open,
  close,
  c,
  postId,
  commentId,
}: {
  open: boolean;
  close: () => void;
  c: Community;
  postId: string;
  commentId?: string;
}) {
  const [reason, setReason] = useState<string>(reportReasons[0]),
    [detail, setDetail] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Dialog
      title={commentId ? "댓글 신고" : "게시글 신고"}
      open={open}
      close={close}
    >
      <form
        className="community-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await c.action(
              "report",
              { postId, commentId, reason, detail },
              "신고를 접수했어요. 운영진이 확인합니다.",
            );
            close();
          } catch (e) {
            setError(errorText(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <p className="community-help">
          신고자 정보는 작성자에게 공개되지 않습니다.
        </p>
        <Choice
          label="신고 사유"
          value={reason}
          change={setReason}
          options={reportReasons.map((r) => ({ id: r, label: r }))}
        />
        <TextField value={detail} onChange={setDetail}>
          <Label>추가 설명 (선택)</Label>
          <TextArea
            rows={3}
            maxLength={1000}
            placeholder="운영진이 확인할 내용을 적어 주세요."
          />
        </TextField>
        <ErrorLine text={error} />
        <Button type="submit" fullWidth isDisabled={busy}>
          신고 접수
        </Button>
      </form>
    </Dialog>
  );
}

export function CommunityPostScreen({
  c,
  go,
  notify,
  id,
  catalog,
  returnTo: sourceReturn = "/board",
  params = new URLSearchParams(),
}: Base & {
  id: string;
  catalog: ArchiveRecord[];
  returnTo?: string;
  params?: URLSearchParams;
}) {
  const explicitList = params.get("list");
  const returnTo =
    explicitList && isCommunityList(explicitList)
      ? explicitList
      : isCommunityList(sourceReturn) ? sourceReturn : "/board";
  const fromHome = /^\/home(?:\?|$)/.test(returnTo);
  const fromAdmin = /^\/admin(?:\?|$)/.test(returnTo);
  const returnToList = () => go(returnTo, false, false, true);
  const state = useLoad<Thread>(() => api.thread(id), [id, c.profile?.id, c.profile?.role], c.revision);
  const [report, setReport] = useState<{ commentId?: string } | null>(null),
    [operation, setOperation] = useState<Operation | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [views, setViews] = useState<{ id: string; value: number } | null>(null);
  const p = state.data?.post,
    record = catalog.find((r) => r.id === p?.recordId);
  const canRead =
    !!p &&
    p.readable !== false &&
    (!p.isSecret || p.authorId === c.profile?.id || staff(c.profile));
  useEffect(() => {
    document.title = `${canRead ? p!.title : p?.isSecret ? "비밀글" : "게시글"} · VOKU On`;
  }, [id, p?.title, p?.isSecret, canRead]);
  useEffect(() => {
    if (p?.recordId) void archiveCatalog.load();
  }, [p?.recordId]);
  useEffect(() => {
    if (c.loading || p?.id !== id || p.status !== "published" || !canRead)
      return;
    let active = true;
    void api
      .recordView(id, viewerId())
      .then((value) => {
        if (active) setViews({ id, value });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [id, p?.id, p?.status, p?.readable, canRead, c.profile?.id, c.loading]);
  const act = async (
    action: Action,
    payload: Record<string, unknown>,
    message?: string,
  ) => {
    if (!c.profile) {
      go(authPath());
      return;
    }
    setBusy(true);
    setError("");
    try {
      await c.action(action, payload, message);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="community-post-screen" data-community-ready={!state.loading && !c.loading && !!p}>
      <Header
        title="커뮤니티"
        go={go}
        onBack={returnToList}
        backLabel={fromHome ? "홈으로 돌아가기" : fromAdmin ? "관리자 페이지로 돌아가기" : "이전 목록으로 돌아가기"}
      >
        {p && canRead && !c.loading && (
          <>
            <Button
              isIconOnly
              variant="ghost"
              className="icon-button"
              aria-label={p.bookmarked ? "스크랩 해제" : "글 스크랩"}
              isDisabled={busy}
              onPress={() =>
                void act(
                  "bookmark",
                  { postId: p.id, value: !p.bookmarked },
                  p.bookmarked ? "스크랩을 해제했어요." : "글을 스크랩했어요.",
                )
              }
            >
              <Bookmark
                size={20}
                fill={p.bookmarked ? "currentColor" : "none"}
              />
            </Button>
            <PostMenu
              post={p}
              c={c}
              go={go}
              setOperation={setOperation}
              report={() => setReport({})}
            />
          </>
        )}
      </Header>
      <LoadState state={state} />
      {p && !state.error && !c.loading && (
        <>
          {!canRead ? (
            <div className="community-secret-gate">
              <LockKeyhole size={28} />
              <h1>비밀글입니다</h1>
              <p>작성자와 운영진만 내용을 볼 수 있어요.</p>
              {!c.profile && (
                <Button onPress={() => go(authPath())}>
                  작성자 계정으로 로그인
                </Button>
              )}
            </div>
          ) : (
            <>
              <article className="community-article">
                <div className="community-article-label">
                  <span>{postLabel(p)}</span>
                  {p.recordId && <span>큐시트 연결</span>}
                  {p.isSecret && <span>비밀글 · 작성자와 운영진만 열람</span>}
                  {p.demo && <span>예시 글</span>}
                  {p.status === "hidden" && (
                    <span>운영진에게만 표시 · 숨김</span>
                  )}
                </div>
                <h1>{p.title}</h1>
                <div className="community-author">
                  <span className="community-avatar">{p.author[0]}</span>
                  <div>
                    <strong>{p.author}</strong>
                    <RoleTag role={p.authorRole} />
                    <p>
                      {localDate(p.date)}
                      {p.updatedAt && p.updatedAt !== p.date ? " · 수정됨" : ""}
                      {" · 조회 "}
                      {(views?.id === p.id
                        ? views.value
                        : p.views
                      ).toLocaleString()}
                    </p>
                  </div>
                </div>
                {record && (
                  <button
                    className="community-attachment"
                    onClick={() =>
                      go(`/read/${record.id}?from=${encodeURIComponent(p.id)}`)
                    }
                  >
                    <FileText size={23} />
                    <span>
                      <small>함께 읽는 큐시트</small>
                      <strong>
                        {record.title} {record.issue}회
                      </strong>
                      <small>
                        {record.year}년 {record.term}학기 · {record.pages}쪽
                      </small>
                    </span>
                    <ChevronRight size={18} />
                  </button>
                )}
                <PostBody body={p.body} format={p.bodyFormat} />
                <PhotoGallery photos={p.photos || []} title={p.title} />
                <div className="community-reactions">
                  <Button
                    variant="outline"
                    aria-pressed={p.liked}
                    isDisabled={busy}
                    onPress={() =>
                      void act("like", { postId: p.id, value: !p.liked })
                    }
                  >
                    <ThumbsUp
                      size={18}
                      fill={p.liked ? "currentColor" : "none"}
                    />
                    추천 {p.likes}
                  </Button>
                  <SharePost post={p} live={c.live} notify={notify} />
                  <button
                    onClick={() => (c.profile ? setReport({}) : go(authPath()))}
                  >
                    <Flag size={14} />
                    신고
                  </button>
                </div>
                <ErrorLine text={error} />
              </article>
              <CommentSection
                key={`${p.id}:${c.profile?.id || "guest"}`}
                targetComment={params.get("comment") || ""}
                comments={state.data!.comments}
                post={p}
                c={c}
                go={go}
                report={(commentId) => setReport({ commentId })}
                setOperation={setOperation}
              />
            </>
          )}
          <ReadingList
            key={`${id}:${returnTo}`}
            pinned={p.pinned}
            c={c}
            go={go}
            id={id}
            returnTo={returnTo}
            catalog={catalog}
          />
          <div className="back-to-list">
            <Button variant="outline" onPress={returnToList}>
              <ChevronLeft size={17} />
              {fromHome ? "홈으로" : fromAdmin ? "관리자 페이지로" : "목록으로"}
            </Button>
          </div>
          <PreviewNote c={c} go={go} />
        </>
      )}
      <ReportDialog
        key={report?.commentId || "post"}
        open={!!report}
        close={() => setReport(null)}
        c={c}
        postId={id}
        commentId={report?.commentId}
      />
      <OperationDialog
        operation={operation}
        close={() => setOperation(null)}
        c={c}
        after={() => {
          if (operation?.action === "post_delete") returnToList();
        }}
      />
    </main>
  );
}
