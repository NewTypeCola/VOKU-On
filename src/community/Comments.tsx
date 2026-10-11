import { Button, Dropdown, Label, TextArea } from "@heroui/react";
import {
  ChevronDown,
  LockKeyhole,
  MoreHorizontal,
  ThumbsUp,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { dateLabel } from "../data";
import { errorText } from "./client";
import { setCommunityLeaveGuard } from "./navigationGuard";
import {
  authPath,
  ErrorLine,
  LoginGate,
  RoleTag,
  type Go,
  type Operation,
} from "./shared";
import { staff, type CommunityComment, type CommunityPost } from "./types";
import type { Community } from "./useCommunity";

export function CommentSection({
  comments,
  post: p,
  c,
  go,
  report,
  setOperation,
  targetComment,
}: {
  comments: CommunityComment[];
  post: CommunityPost;
  c: Community;
  go: Go;
  report: (id: string) => void;
  setOperation: (o: Operation) => void;
  targetComment: string;
}) {
  const prefix = `voku-comment-draft:${c.live ? "live" : "preview"}:${c.profile?.id || "guest"}:${p.id}:`;
  const read = (mode: string, fallback = "") => {
    try {
      return localStorage.getItem(prefix + mode) ?? fallback;
    } catch {
      return fallback;
    }
  };
  let initialMode = read("context", "new");
  const selected = comments.find(
    (x) => x.id === initialMode.split(":")[1] && x.status === "published",
  );
  if (!selected) initialMode = "new";
  const initialEdit = initialMode.startsWith("edit:") ? selected || null : null;
  const initialReply = initialMode.startsWith("reply:")
    ? selected || null
    : null;
  const [mode, setMode] = useState(initialMode),
    [body, setBody] = useState(() =>
      read(initialMode, initialEdit?.body || ""),
    ),
    [reply, setReply] = useState<CommunityComment | null>(initialReply),
    [edit, setEdit] = useState<CommunityComment | null>(initialEdit),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [reactionBusy, setReactionBusy] = useState(""),
    [expanded, setExpanded] = useState<Set<string>>(new Set()),
    [jump, setJump] = useState(targetComment),
    [highlight, setHighlight] = useState(""),
    [saved, setSaved] = useState(true);
  const input = useRef<HTMLTextAreaElement>(null),
    form = useRef<HTMLFormElement>(null);
  const roots = comments.filter(
    (x) => !x.parentId || !comments.some((parent) => parent.id === x.parentId),
  );
  const updateBody = (value: string) => {
    setBody(value);
    try {
      if (value) localStorage.setItem(prefix + mode, value);
      else localStorage.removeItem(prefix + mode);
      setSaved(true);
    } catch {
      setSaved(false);
    }
  };
  useEffect(() => {
    setJump(targetComment);
  }, [targetComment]);
  useEffect(() => {
    if (!jump) return;
    const target = comments.find((x) => x.id === jump);
    if (!target) return;
    if (target.parentId)
      setExpanded((values) => new Set([...values, target.parentId!]));
    const frame = requestAnimationFrame(() => {
      const element = document.getElementById(`comment-${jump}`);
      element?.scrollIntoView({ block: "center", behavior: "instant" });
      element?.focus({ preventScroll: true });
      setHighlight(jump);
      setJump("");
    });
    return () => cancelAnimationFrame(frame);
  }, [jump, comments]);
  const choose = (comment: CommunityComment | null, editing = false) => {
    if (!c.profile) {
      go(authPath());
      return;
    }
    if (
      !saved &&
      body &&
      !window.confirm(
        "현재 댓글을 임시 저장하지 못했어요. 다른 입력으로 전환하시겠어요?",
      )
    )
      return;
    const next = comment
      ? `${editing ? "edit" : "reply"}:${comment.id}`
      : "new";
    try {
      localStorage.setItem(prefix + "context", next);
    } catch {
      /* The body warning still applies. */
    }
    setMode(next);
    setReply(editing ? null : comment);
    setEdit(editing ? comment : null);
    setBody(read(next, editing ? comment!.body : ""));
    setSaved(true);
    setError("");
    requestAnimationFrame(() => {
      form.current?.scrollIntoView({ block: "center", behavior: "instant" });
      input.current?.focus({ preventScroll: true });
    });
  };
  useEffect(() => {
    if (saved) return;
    const before = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", before);
    const clear = setCommunityLeaveGuard(() =>
      window.confirm(
        "현재 댓글을 임시 저장하지 못했어요. 이동하면 내용이 사라질 수 있어요. 이동하시겠어요?",
      ),
    );
    return () => {
      window.removeEventListener("beforeunload", before);
      clear();
    };
  }, [saved]);
  const renderComment = (comment: CommunityComment) => (
    <article
      key={comment.id}
      id={`comment-${comment.id}`}
      tabIndex={-1}
      className={`community-comment ${comment.parentId ? "reply" : ""} ${highlight === comment.id ? "is-highlighted" : ""}`}
    >
      <div>
        <strong>{comment.author}</strong>
        <RoleTag role={comment.authorRole} />
        {comment.authorId === p.authorId && !comment.demo && (
          <small className="comment-author-badge">글쓴이</small>
        )}
        {comment.demo && <small>예시</small>}
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
                  if (key === "edit") choose(comment, true);
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
                {(c.profile?.id === comment.authorId || staff(c.profile)) && (
                  <Dropdown.Item id="delete" textValue="삭제" variant="danger">
                    <Label>
                      {c.profile?.id === comment.authorId ? "삭제" : "숨김"}
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
      {comment.parentId && (
        <small className="comment-reply-to">
          ↳{" "}
          {comments.find((x) => x.id === comment.parentId)?.author || "원 댓글"}
          님에게 답글
        </small>
      )}
      <p className={comment.status !== "published" ? "muted" : ""}>
        {comment.body}
      </p>
      {comment.status === "published" && (
        <div className="community-comment-actions">
          {!comment.parentId && !p.locked && (
            <button
              className="community-reply-button"
              onClick={() => choose(comment)}
            >
              답글 쓰기
            </button>
          )}
          <button
            className="community-comment-like"
            aria-label={`${comment.author} 댓글 공감 ${comment.likes || 0}개`}
            aria-pressed={!!comment.liked}
            disabled={!!reactionBusy || c.profile?.id === comment.authorId}
            onClick={async () => {
              if (!c.profile) {
                go(authPath());
                return;
              }
              setReactionBusy(comment.id);
              setError("");
              try {
                await c.action("comment_like", {
                  postId: p.id,
                  id: comment.id,
                  value: !comment.liked,
                });
              } catch (e) {
                setError(errorText(e));
              } finally {
                setReactionBusy("");
              }
            }}
          >
            <ThumbsUp
              size={14}
              fill={comment.liked ? "currentColor" : "none"}
            />
            공감 {comment.likes || 0}
          </button>
        </div>
      )}
    </article>
  );
  return (
    <section className="community-comments">
      <h2>
        댓글 <b>{comments.filter((x) => x.status === "published").length}</b>
      </h2>
      {targetComment && !comments.some((x) => x.id === targetComment) && (
        <p className="community-help">
          해당 댓글이 삭제되었거나 표시할 수 없어요.
        </p>
      )}
      {roots.map((root) => {
        const replies = comments.filter((x) => x.parentId === root.id);
        const open = expanded.has(root.id);
        return (
          <div key={root.id} className="community-comment-thread">
            {renderComment(root)}
            {(open ? replies : replies.slice(0, 2)).map(renderComment)}
            {replies.length > 2 && (
              <button
                className="community-replies-toggle"
                aria-expanded={open}
                onClick={() =>
                  setExpanded((values) => {
                    const next = new Set(values);
                    if (open) next.delete(root.id);
                    else next.add(root.id);
                    return next;
                  })
                }
              >
                <ChevronDown size={15} />
                {open ? "답글 접기" : `답글 ${replies.length - 2}개 더 보기`} ·
                전체 {replies.length}개
              </button>
            )}
          </div>
        );
      })}
      {!roots.length && <p className="community-help">첫 댓글을 남겨보세요.</p>}
      <ErrorLine text={error} />
      {p.locked ? (
        <p className="community-locked">
          <LockKeyhole size={15} />
          운영진이 댓글 작성을 잠갔습니다.
        </p>
      ) : (
        <LoginGate c={c} go={go}>
          <form
            ref={form}
            className="community-comment-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!body.trim()) return;
              setBusy(true);
              setError("");
              try {
                const result = await c.action(
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
                try {
                  localStorage.removeItem(prefix + mode);
                  localStorage.removeItem(prefix + "context");
                } catch {
                  /* The comment is already saved on the server. */
                }
                setBody(mode === "new" ? "" : read("new"));
                setMode("new");
                setEdit(null);
                setReply(null);
                setSaved(true);
                if (result.commentId) setJump(result.commentId);
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
                <button type="button" onClick={() => choose(null)}>
                  {edit ? "댓글 수정 중" : `${reply!.author}님에게 답글`}
                  <X size={14} />
                </button>
              )}
            </div>
            {reply && (
              <blockquote className="community-reply-context">
                {reply.body.slice(0, 180)}
                {reply.body.length > 180 ? "…" : ""}
              </blockquote>
            )}
            <TextArea
              ref={input}
              aria-label={
                edit
                  ? "수정할 댓글 내용"
                  : reply
                    ? `${reply.author}님에게 답글 내용`
                    : "댓글 내용"
              }
              value={body}
              onChange={(e) => updateBody(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="함께 나누고 싶은 이야기를 남겨주세요."
              disabled={busy}
            />
            <div>
              <small>
                {body.length} / 2,000
                {body ? (saved ? " · 임시 저장됨" : " · 임시 저장 실패") : ""}
              </small>
              <Button type="submit" size="sm" isDisabled={busy || !body.trim()}>
                {busy ? "등록 중…" : edit ? "수정" : "등록"}
              </Button>
            </div>
          </form>
        </LoginGate>
      )}
    </section>
  );
}
