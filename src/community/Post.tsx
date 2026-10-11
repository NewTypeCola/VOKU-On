import { PostMenu } from "./shared";
import { PhotoGallery } from "./Photos";
import { PostBody } from "./PostBody";
import { SharePost } from "./SharePost";
import { viewerId } from "./viewer";
import { Button, Dropdown, Label, TextArea, TextField } from "@heroui/react";
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  FileText,
  Flag,
  LockKeyhole,
  MoreHorizontal,
  ThumbsUp,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { archiveCatalog } from "../archiveCatalog";
import { dateLabel, type ArchiveRecord } from "../data";
import { api, errorText } from "./client";
import {
  authPath,
  Choice,
  Dialog,
  ErrorLine,
  Header,
  LoadState,
  localDate,
  LoginGate,
  OperationDialog,
  PreviewNote,
  RoleTag,
  useLoad,
  type Base,
  type Go,
  type Operation,
} from "./shared";
import {
  postLabel,
  reportReasons,
  staff,
  type Action,
  type CommunityComment,
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
  returnTo = "/board",
}: Base & { id: string; catalog: ArchiveRecord[]; returnTo?: string }) {
  const returnToList = () => go(returnTo, false, false, true);
  const state = useLoad<Thread>(() => api.thread(id), [id, c.revision]);
  const [report, setReport] = useState<{ commentId?: string } | null>(null),
    [operation, setOperation] = useState<Operation | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [views, setViews] = useState<{ id: string; value: number } | null>(null);
  const p = state.data?.post,
    record = catalog.find((r) => r.id === p?.recordId);
  useEffect(() => {
    if (p?.recordId) void archiveCatalog.load();
  }, [p?.recordId]);
  useEffect(() => {
    if (c.loading || p?.id !== id || p.status !== "published") return;
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
  }, [id, p?.id, p?.status, c.profile?.id, c.loading]);
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
    <main className="community-post-screen">
      <Header
        title="커뮤니티"
        go={go}
        onBack={returnToList}
        backLabel="이전 목록으로 돌아가기"
      >
        {p && (
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
      {p && !state.error && (
        <>
          <article className="community-article">
            <div className="community-article-label">
              <span>{postLabel(p)}</span>
              {p.demo && <span>예시 글</span>}
              {p.status === "hidden" && <span>운영진에게만 표시 · 숨김</span>}
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
                <ThumbsUp size={18} fill={p.liked ? "currentColor" : "none"} />
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
            comments={state.data!.comments}
            post={p}
            c={c}
            go={go}
            report={(commentId) => setReport({ commentId })}
            setOperation={setOperation}
          />
          <div className="back-to-list">
            <Button variant="outline" onPress={returnToList}>
              <ChevronLeft size={17} />
              목록으로
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

function CommentSection({
  comments,
  post: p,
  c,
  go,
  report,
  setOperation,
}: {
  comments: CommunityComment[];
  post: CommunityPost;
  c: Community;
  go: Go;
  report: (id: string) => void;
  setOperation: (o: Operation) => void;
}) {
  const [body, setBody] = useState(""),
    [reply, setReply] = useState<CommunityComment | null>(null),
    [edit, setEdit] = useState<CommunityComment | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const roots = comments.filter(
    (x) => !x.parentId || !comments.some((parent) => parent.id === x.parentId),
  );
  const ordered = roots.flatMap((x) => [
    x,
    ...comments.filter((v) => v.parentId === x.id),
  ]);
  return (
    <section className="community-comments">
      <h2>
        댓글 <b>{comments.filter((c) => c.status === "published").length}</b>
      </h2>
      {ordered.length ? (
        ordered.map((comment) => (
          <article
            key={comment.id}
            className={`community-comment ${comment.parentId ? "reply" : ""}`}
          >
            <div>
              <strong>{comment.author}</strong>
              <RoleTag role={comment.authorRole} />
              <time>{dateLabel(comment.date)}</time>
              {comment.status === "published" && (
                <Dropdown>
                  <Button
                    variant="ghost"
                    isIconOnly
                    aria-label={`${comment.author} 댓글 더보기`}
                  >
                    <MoreHorizontal size={17} />
                  </Button>
                  <Dropdown.Popover className="community-menu">
                    <Dropdown.Menu
                      aria-label="댓글 메뉴"
                      onAction={(key) => {
                        if (!c.profile) {
                          go(authPath());
                          return;
                        }
                        if (key === "edit") {
                          setEdit(comment);
                          setBody(comment.body);
                          setReply(null);
                        }
                        if (key === "delete")
                          setOperation({
                            title:
                              c.profile.id === comment.authorId
                                ? "댓글 삭제"
                                : "댓글 숨김",
                            description:
                              "댓글 본문은 숨겨지고 답글의 연결은 유지됩니다.",
                            action: "comment_delete",
                            payload: { postId: p.id, id: comment.id },
                            reason: c.profile.id !== comment.authorId,
                          });
                        if (key === "report") report(comment.id);
                      }}
                    >
                      {c.profile?.id === comment.authorId && (
                        <Dropdown.Item id="edit" textValue="수정">
                          <Label>수정</Label>
                        </Dropdown.Item>
                      )}
                      {(c.profile?.id === comment.authorId ||
                        staff(c.profile)) && (
                        <Dropdown.Item
                          id="delete"
                          textValue="삭제"
                          variant="danger"
                        >
                          <Label>
                            {c.profile?.id === comment.authorId
                              ? "삭제"
                              : "숨김"}
                          </Label>
                        </Dropdown.Item>
                      )}
                      <Dropdown.Item id="report" textValue="신고">
                        <Label>신고</Label>
                      </Dropdown.Item>
                    </Dropdown.Menu>
                  </Dropdown.Popover>
                </Dropdown>
              )}
            </div>
            <p className={comment.status !== "published" ? "muted" : ""}>
              {comment.body}
            </p>
            {comment.status === "published" &&
              !comment.parentId &&
              !p.locked && (
                <button
                  className="community-reply-button"
                  onClick={() => {
                    if (!c.profile) {
                      go(authPath());
                      return;
                    }
                    setReply(comment);
                    setEdit(null);
                    setBody("");
                  }}
                >
                  답글
                </button>
              )}
          </article>
        ))
      ) : (
        <p className="community-help">첫 댓글을 남겨보세요.</p>
      )}
      {p.locked ? (
        <p className="community-locked">
          <LockKeyhole size={15} />
          운영진이 댓글 작성을 잠갔습니다.
        </p>
      ) : (
        <LoginGate c={c} go={go}>
          <form
            className="community-comment-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!body.trim()) return;
              setBusy(true);
              setError("");
              try {
                await c.action(
                  "comment_save",
                  {
                    postId: p.id,
                    body: body.trim(),
                    ...(edit
                      ? { id: edit.id }
                      : reply
                        ? { parentId: reply.id }
                        : {}),
                  },
                  edit ? "댓글을 수정했어요." : "댓글을 등록했어요.",
                );
                setBody("");
                setEdit(null);
                setReply(null);
              } catch (e) {
                setError(errorText(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            <div>
              <strong>{c.profile?.nickname}</strong>
              {(reply || edit) && (
                <button
                  type="button"
                  onClick={() => {
                    setReply(null);
                    setEdit(null);
                    setBody("");
                  }}
                >
                  {edit ? "댓글 수정 중" : `${reply!.author}님에게 답글`}{" "}
                  <X size={14} />
                </button>
              )}
            </div>
            <TextArea
              aria-label="댓글 내용"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="함께 나누고 싶은 이야기를 남겨주세요."
            />
            <div>
              <small>{body.length} / 2,000</small>
              <Button type="submit" size="sm" isDisabled={busy || !body.trim()}>
                {edit ? "수정" : "등록"}
              </Button>
            </div>
            <ErrorLine text={error} />
          </form>
        </LoginGate>
      )}
    </section>
  );
}
