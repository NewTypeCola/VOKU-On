import {
  Button,
  Checkbox,
  Dropdown,
  Label,
  ListBox,
  Modal,
  Select,
  Spinner,
  TextArea,
  TextField,
} from "@heroui/react";
import {
  ArrowLeft,
  ChevronRight,
  FileText,
  Image,
  LockKeyhole,
  LogIn,
  MoreHorizontal,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { dateLabel, type ArchiveRecord } from "../data";
import { errorText } from "./client";
import {
  postLabel,
  roleLabel,
  staff,
  suspended,
  type Action,
  type CommunityPost,
  type Profile,
} from "./types";
import type { Community } from "./useCommunity";
import { isNewPost } from "./reading";
import { PostThumbnail } from "./PostThumbnail";

export type Go = (
  path: string,
  replace?: boolean,
  keepScroll?: boolean,
  restoreScroll?: boolean,
) => void;

export type Base = { c: Community; go: Go; notify: (text: string) => void };

export const authPath = () =>
  `/auth?next=${encodeURIComponent(location.hash.slice(1) || "/board")}`;

export const localDate = (value: string) =>
  new Date(value).toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export function Header({
  title,
  go,
  children,
  onBack,
  backLabel = "커뮤니티로 돌아가기",
}: {
  title: string;
  go: Go;
  children?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
}) {
  return (
    <header className="detail-header">
      <Button
        variant="ghost"
        isIconOnly
        className="icon-button"
        aria-label={backLabel}
        onPress={onBack || (() => go("/board"))}
      >
        <ArrowLeft size={21} />
      </Button>
      <span>{title}</span>
      <div className="detail-header-actions">{children}</div>
    </header>
  );
}

export function Dialog({
  title,
  open,
  close,
  children,
}: {
  title: string;
  open: boolean;
  close: () => void;
  children: ReactNode;
}) {
  return (
    <Modal.Backdrop
      isOpen={open}
      onOpenChange={(v) => {
        if (!v) close();
      }}
    >
      <Modal.Container placement="center" size="sm">
        <Modal.Dialog className="voku-dialog community-dialog">
          <Modal.CloseTrigger aria-label="닫기" />
          <Modal.Header>
            <Modal.Heading>{title}</Modal.Heading>
          </Modal.Header>
          <Modal.Body>{children}</Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

export function Choice({
  label,
  value,
  change,
  options,
}: {
  label: string;
  value: string;
  change: (v: string) => void;
  options: { id: string; label: string }[];
}) {
  return (
    <Select
      className="community-choice"
      aria-label={label}
      value={value}
      onChange={(v) => change(String(v))}
    >
      <Label>{label}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {options.map((o) => (
            <ListBox.Item key={o.id} id={o.id} textValue={o.label}>
              {o.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

export function CheckField({
  children,
  checked,
  change,
}: {
  children: ReactNode;
  checked: boolean;
  change: (v: boolean) => void;
}) {
  return (
    <Checkbox isSelected={checked} onChange={change}>
      <Checkbox.Content>
        <Checkbox.Control>
          <Checkbox.Indicator />
        </Checkbox.Control>
        {children}
      </Checkbox.Content>
    </Checkbox>
  );
}

export function ErrorLine({ text }: { text: string }) {
  return text ? (
    <p className="community-error" role="alert">
      {text}
    </p>
  ) : null;
}

export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="community-empty">
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  );
}

export function useLoad<T>(loader: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    loader()
      .then((v) => {
        if (active) setData(v);
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [...deps, retry]);
  return { data, error, loading, retry: () => setRetry((n) => n + 1) };
}

export function LoadState({
  state,
}: {
  state: { loading: boolean; error: string; retry: () => void };
}) {
  return state.error ? (
    <div className="community-state">
      <ErrorLine text={state.error} />
      <Button variant="outline" onPress={state.retry}>
        다시 불러오기
      </Button>
    </div>
  ) : state.loading ? (
    <div className="community-loading" role="status">
      <Spinner size="sm" />
      불러오는 중
    </div>
  ) : null;
}

export function PreviewNote({ c, go }: { c: Community; go: Go }) {
  return !c.live ? (
    <div className="community-preview-note">
      <span>화면 체험 중 · 실제 가입 전</span>
      <button onClick={() => go("/auth")}>
        계정 전환 <ChevronRight size={13} />
      </button>
    </div>
  ) : null;
}

export function LoginGate({
  c,
  go,
  children,
}: {
  c: Community;
  go: Go;
  children: ReactNode;
}) {
  if (c.loading)
    return (
      <div className="community-loading">
        <Spinner />
      </div>
    );
  if (!c.profile)
    return (
      <div className="community-login-gate">
        <LogIn size={22} />
        <h2>로그인하고 이야기를 나눠요</h2>
        <p>글과 댓글 작성, 추천과 스크랩을 이용할 수 있어요.</p>
        <Button onPress={() => go(authPath())}>로그인 / 회원가입</Button>
      </div>
    );
  if (suspended(c.profile))
    return (
      <div className="community-login-gate">
        <LockKeyhole size={23} />
        <h2>현재 이용이 제한되어 있어요</h2>
        <p>{c.profile.suspensionReason}</p>
        <p>{localDate(c.profile.suspendedUntil!)}까지</p>
      </div>
    );
  return <>{children}</>;
}

export function RoleTag({ role }: { role: Profile["role"] }) {
  return role !== "member" ? (
    <span className="community-role">
      <ShieldCheck size={11} />
      {roleLabel(role)}
    </span>
  ) : null;
}

export function PostRow({
  post: p,
  go,
  catalog = [],
  active = false,
  destination = "/post/" + p.id,
}: {
  post: CommunityPost;
  go: Go;
  catalog?: ArchiveRecord[];
  active?: boolean;
  destination?: string;
}) {
  const record = catalog.find((r) => r.id === p.recordId);
  return (
    <article
      className={`community-row ${p.status === "hidden" ? "is-hidden" : ""} ${active ? "is-current" : ""}`}
    >
      <a
        href={"#" + destination}
        aria-current={active ? "page" : undefined}
        onClick={(e) => {
          if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          e.preventDefault();
          go(destination);
        }}
      >
        <div className="community-row-copy">
          <div className="community-row-label">
            <span>{postLabel(p)}</span>
            {p.recordId && <span className="community-linked-tag"><FileText size={12} />큐시트 연결</span>}
            {active && <span>읽는 중</span>}
            {p.demo && <span className="community-sample-tag">예시</span>}
            {p.isSecret && (
              <span className="community-secret-tag">
                <LockKeyhole size={12} />
                비밀글
              </span>
            )}
            {isNewPost(p.date) && (
              <span className="community-new" title="24시간 이내 등록된 글">
                새글
              </span>
            )}
            {p.locked && <LockKeyhole size={12} aria-label="댓글 잠김" />}
            {p.status === "hidden" && <span>숨김</span>}
          </div>
          <div className="community-row-title">
            {p.title}
            {!!p.photos?.length && (
              <Image size={14} aria-label={`사진 ${p.photos.length}장`} />
            )}
            {p.commentCount > 0 && (
              <b aria-label={`댓글 ${p.commentCount}개`}>[{p.commentCount}]</b>
            )}
          </div>
          <div className="community-row-meta">
            <span>{p.author}</span>
            <RoleTag role={p.authorRole} />
            <time>{dateLabel(p.date)}</time>
            {p.readable !== false && (
              <span>조회 {p.views.toLocaleString()}</span>
            )}
            {p.likes > 0 && <span>추천 {p.likes}</span>}
          </div>
        </div>
        {!!p.photos?.length && p.readable !== false && (
          <PostThumbnail photo={p.photos[0]} count={p.photos.length} />
        )}
      </a>
      {record && (
        <button
          className="community-record-link"
          onClick={() =>
            go(`/read/${record.id}?from=${encodeURIComponent(p.id)}`)
          }
        >
          <FileText size={13} />
          <span>
            {record.year} · {record.title} {record.issue}회
          </span>
          <ChevronRight size={13} />
        </button>
      )}
    </article>
  );
}

export type Operation = {
  title: string;
  action: Action;
  payload: Record<string, unknown>;
  description?: string;
  reason?: boolean;
};

export function OperationDialog({
  operation,
  close,
  c,
  after,
}: {
  operation: Operation | null;
  close: () => void;
  c: Community;
  after?: () => void;
}) {
  const [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    setReason("");
    setError("");
  }, [operation]);
  return (
    <Dialog title={operation?.title || ""} open={!!operation} close={close}>
      <form
        className="community-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!operation) return;
          setBusy(true);
          setError("");
          try {
            await c.action(
              operation.action,
              {
                ...operation.payload,
                ...(operation.reason ? { reason: reason.trim() } : {}),
              },
              "처리했어요.",
            );
            close();
            after?.();
          } catch (e) {
            setError(errorText(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {operation?.description && <p>{operation.description}</p>}
        {operation?.reason && (
          <TextField isRequired value={reason} onChange={setReason}>
            <Label>처리 사유</Label>
            <TextArea
              rows={3}
              minLength={2}
              maxLength={500}
              placeholder="회원에게 안내할 수 있도록 구체적으로 적어 주세요."
            />
          </TextField>
        )}
        <ErrorLine text={error} />
        <div className="community-dialog-actions">
          <Button variant="outline" onPress={close}>
            취소
          </Button>
          <Button
            type="submit"
            isDisabled={busy || (operation?.reason && !reason.trim())}
          >
            {busy ? "처리 중…" : "확인"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function PostMenu({
  post: p,
  c,
  go,
  setOperation,
  report,
}: {
  post: CommunityPost;
  c: Community;
  go: Go;
  setOperation: (v: Operation) => void;
  report: () => void;
}) {
  const owner = c.profile?.id === p.authorId,
    isStaff = staff(c.profile);
  const items = [
    ...(owner
      ? [
          ["edit", "수정"],
          ["delete", "삭제"],
        ]
      : []),
    ["report", "신고"],
    ...(!owner && p.authorRole === "member"
      ? [["block", "작성자 숨기기"]]
      : []),
    ...(isStaff
      ? [
          ["pin", p.pinned ? "공지 해제" : "공지로 고정"],
          ["lock", p.locked ? "댓글 잠금 해제" : "댓글 잠금"],
          ["hide", p.status === "hidden" ? "게시글 다시 공개" : "게시글 숨김"],
        ]
      : []),
  ];
  return (
    <Dropdown>
      <Button
        isIconOnly
        variant="ghost"
        className="icon-button"
        aria-label="게시글 더보기"
      >
        <MoreHorizontal size={22} />
      </Button>
      <Dropdown.Popover className="community-menu">
        <Dropdown.Menu
          aria-label="게시글 관리"
          onAction={(key) => {
            if (!c.profile) {
              go(authPath());
              return;
            }
            const id = String(key);
            if (id === "edit") go("/write?edit=" + p.id);
            else if (id === "report") report();
            else if (id === "delete")
              setOperation({
                title: "게시글 삭제",
                description:
                  "목록과 검색에서 이 글이 사라집니다. 삭제하시겠어요?",
                action: "post_delete",
                payload: { postId: p.id },
              });
            else if (id === "block")
              setOperation({
                title: "작성자 숨기기",
                description: `${p.author}님의 글과 댓글을 내 화면에서 숨깁니다. 내 정보에서 해제할 수 있어요.`,
                action: "block",
                payload: { userId: p.authorId, value: true },
              });
            else if (id === "pin")
              setOperation({
                title: p.pinned ? "공지 해제" : "공지로 고정",
                action: "post_pin",
                payload: { postId: p.id, value: !p.pinned },
              });
            else if (id === "lock")
              setOperation({
                title: p.locked ? "댓글 잠금 해제" : "댓글 잠금",
                description: "댓글 작성 가능 여부를 변경합니다.",
                action: "post_lock",
                payload: { postId: p.id, value: !p.locked },
              });
            else if (id === "hide")
              setOperation({
                title:
                  p.status === "hidden" ? "게시글 다시 공개" : "게시글 숨김",
                action: "post_visibility",
                payload: { postId: p.id, value: p.status !== "hidden" },
                reason: true,
              });
          }}
        >
          {items.map(([id, label]) => (
            <Dropdown.Item
              key={id}
              id={id}
              textValue={label}
              variant={
                ["delete", "report", "hide"].includes(id) ? "danger" : "default"
              }
            >
              <Label>{label}</Label>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
