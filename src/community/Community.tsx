import { useEffect, useState, type ReactNode } from "react";
import {
  Button,
  Checkbox,
  Dropdown,
  Input,
  Label,
  ListBox,
  Modal,
  SearchField,
  Select,
  Spinner,
  TextArea,
  TextField,
} from "@heroui/react";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Bookmark,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  Flag,
  LockKeyhole,
  LogIn,
  MoreHorizontal,
  Pencil,
  Pin,
  Search,
  Settings,
  ShieldCheck,
  ThumbsUp,
  X,
} from "lucide-react";
import {
  categories,
  dateLabel,
  normalize,
  type ArchiveRecord,
  type Category,
} from "../data";
import { api, authRedirect, errorText, supabase, kakaoEnabled, emailSignupEnabled, signInWithKakao } from "./client";
import { safeReturnPath } from "./oauth";
import { KakaoEntry, ProfileSetup } from "./KakaoAuth";
import type { Community } from "./useCommunity";
import {
  staff,
  suspended,
  postLabel,
  roleLabel,
  reportReasons,
  type CommunityPost,
  type CommunityComment,
  type Feed,
  type Thread,
  type AdminData,
  type Action,
  type Profile,
  type Report,
} from "./types";
import { AffiliationFields } from "./AffiliationFields";
import { affiliationLabel, parseAffiliation } from "./affiliation";
import "./community.css";

type Go = (path: string, replace?: boolean, keepScroll?: boolean) => void;
type Base = { c: Community; go: Go; notify: (text: string) => void };
const authPath = () =>
  `/auth?next=${encodeURIComponent(location.hash.slice(1) || "/board")}`;
const localDate = (value: string) =>
  new Date(value).toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
const actionNames: Record<string, string> = {
  post_pin: "공지 설정",
  post_lock: "댓글 잠금 설정",
  post_visibility: "게시글 공개 상태 변경",
  comment_hide: "댓글 숨김",
  suspend: "회원 이용 제한",
  restore_member: "회원 제한 해제",
  set_role: "운영진 권한 변경",
  report_hide: "신고 처리 · 숨김",
  report_dismiss: "신고 처리 · 반려",
};
function Header({
  title,
  go,
  children,
}: {
  title: string;
  go: Go;
  children?: ReactNode;
}) {
  return (
    <header className="detail-header">
      <Button
        variant="ghost"
        isIconOnly
        className="icon-button"
        aria-label="커뮤니티로 돌아가기"
        onPress={() => go("/board")}
      >
        <ArrowLeft size={21} />
      </Button>
      <span>{title}</span>
      <div className="detail-header-actions">{children}</div>
    </header>
  );
}
function Dialog({
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
function Choice({
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
function CheckField({
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
function ErrorLine({ text }: { text: string }) {
  return text ? (
    <p className="community-error" role="alert">
      {text}
    </p>
  ) : null;
}
function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="community-empty">
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  );
}
function useLoad<T>(loader: () => Promise<T>, deps: unknown[]) {
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
function LoadState({
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
function PreviewNote({ c, go }: { c: Community; go: Go }) {
  return !c.live ? (
    <div className="community-preview-note">
      <span>화면 체험 중 · 실제 가입 전</span>
      <button onClick={() => go("/auth")}>
        계정 전환 <ChevronRight size={13} />
      </button>
    </div>
  ) : null;
}
function LoginGate({
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
function RoleTag({ role }: { role: Profile["role"] }) {
  return role !== "member" ? (
    <span className="community-role">
      <ShieldCheck size={11} />
      {roleLabel(role)}
    </span>
  ) : null;
}
function PostRow({
  post: p,
  go,
  catalog = [],
}: {
  post: CommunityPost;
  go: Go;
  catalog?: ArchiveRecord[];
}) {
  const record = catalog.find((r) => r.id === p.recordId);
  return (
    <article
      className={`community-row ${p.status === "hidden" ? "is-hidden" : ""}`}
    >
      <a
        href={"#/post/" + p.id}
        onClick={(e) => {
          e.preventDefault();
          go("/post/" + p.id);
        }}
      >
        <div className="community-row-label">
          <span>{postLabel(p)}</span>
          {p.locked && <LockKeyhole size={12} aria-label="댓글 잠김" />}
          {p.status === "hidden" && <span>숨김</span>}
        </div>
        <div className="community-row-title">
          {p.title}
          {p.commentCount > 0 && (
            <b aria-label={`댓글 ${p.commentCount}개`}>[{p.commentCount}]</b>
          )}
        </div>
        <div className="community-row-meta">
          <span>{p.author}</span>
          <RoleTag role={p.authorRole} />
          <time>{dateLabel(p.date)}</time>
          {p.likes > 0 && <span>추천 {p.likes}</span>}
        </div>
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

export function CommunityBoard({
  c,
  go,
  notify,
  catalog,
  params,
}: { catalog: ArchiveRecord[]; params: URLSearchParams } & Base) {
  const category = params.get("category") || "전체",
    sort = params.get("sort") || "latest",
    query = params.get("q") || "",
    page = Math.max(1, Number(params.get("page")) || 1);
  const [searchOpen, setSearchOpen] = useState(!!query),
    [search, setSearch] = useState(query),
    [showNotices, setShowNotices] = useState(true);
  useEffect(() => setSearch(query), [query]);
  const state = useLoad<Feed>(
    () => api.feed({ category, sort, query, page }),
    [category, sort, query, page, c.revision],
  );
  const param = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    if (key !== "page") next.delete("page");
    go("/board?" + next, true, key !== "page");
  };
  return (
    <main className="community-board">
      <div className="community-memberbar">
        {c.profile ? (
          <button onClick={() => go("/account")}>
            <span>{c.profile.nickname}</span>
            <RoleTag role={c.profile.role} />
            <ChevronRight size={14} />
          </button>
        ) : (
          <button onClick={() => go("/auth")}>
            <LogIn size={15} />
            <span>로그인 / 회원가입</span>
          </button>
        )}
        <div>
          {staff(c.profile) && (
            <button onClick={() => go("/admin")}>
              <ShieldCheck size={14} />
              관리
            </button>
          )}
          <button
            onClick={() => go("/notifications")}
            aria-label={`알림 ${(c.account?.notifications || []).filter((n) => !n.read).length}개`}
          >
            <Bell size={17} />
            {(c.account?.notifications || []).some((n) => !n.read) && (
              <i className="unread-dot" />
            )}
          </button>
        </div>
      </div>
      <div className="community-categories" aria-label="커뮤니티 말머리">
        {["전체", "자료 이야기", "자유글", "질문", "동문소식", "공지"].map(
          (label) => (
            <Button
              key={label}
              variant="ghost"
              aria-pressed={category === label}
              className={category === label ? "chosen" : ""}
              onPress={() => param("category", label)}
            >
              {label}
            </Button>
          ),
        )}
      </div>
      {category !== "공지" && !!state.data?.notices.length && (
        <section className="community-notices" aria-label="고정 공지">
          <div>
            <button
              className="notice-toggle"
              onClick={() => setShowNotices((v) => !v)}
              aria-expanded={showNotices}
            >
              <Pin size={13} />
              공지{" "}
              <ChevronDown
                size={13}
                style={{
                  transform: showNotices ? undefined : "rotate(-90deg)",
                }}
              />
            </button>
            <button onClick={() => param("category", "공지")}>전체 보기</button>
          </div>
          {showNotices &&
            state.data.notices.map((p) => (
              <a
                key={p.id}
                href={"#/post/" + p.id}
                onClick={(e) => {
                  e.preventDefault();
                  go("/post/" + p.id);
                }}
              >
                <span>공지</span>
                <strong>{p.title}</strong>
              </a>
            ))}
        </section>
      )}
      <div className="community-toolbar">
        <div>
          {[
            ["latest", "최신글"],
            ["popular", "추천순"],
          ].map(([value, label]) => (
            <button
              key={value}
              className={sort === value ? "selected" : ""}
              aria-pressed={sort === value}
              onClick={() => param("sort", value)}
            >
              {label}
            </button>
          ))}
        </div>
        <div>
          <Button
            isIconOnly
            variant="ghost"
            aria-label="게시글 검색"
            onPress={() => setSearchOpen((v) => !v)}
          >
            <Search size={18} />
          </Button>
          <Button
            size="sm"
            onPress={() => go(c.profile ? "/write" : "/auth?next=%2Fwrite")}
          >
            <Pencil size={15} />
            글쓰기
          </Button>
        </div>
      </div>
      {(searchOpen || query) && (
        <form
          className="community-search"
          onSubmit={(e) => {
            e.preventDefault();
            param("q", search.trim());
          }}
        >
          <SearchField
            value={search}
            onChange={setSearch}
            aria-label="게시글 검색어"
          >
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input
                placeholder="제목, 내용, 닉네임 검색"
                maxLength={100}
              />
              <SearchField.ClearButton aria-label="검색어 지우기" />
            </SearchField.Group>
          </SearchField>
          <Button type="submit" variant="secondary">
            검색
          </Button>
        </form>
      )}
      <LoadState state={state} />
      {!state.error && state.data && (
        <>
          {state.data.posts.length ? (
            <div className="community-posts">
              {state.data.posts.map((p) => (
                <PostRow key={p.id} post={p} catalog={catalog} go={go} />
              ))}
            </div>
          ) : (
            !state.loading && (
              <Empty
                title={query ? "검색 결과가 없어요" : "아직 등록된 글이 없어요"}
              >
                {query
                  ? "다른 검색어로 찾아보세요."
                  : "첫 이야기를 남겨보세요."}
              </Empty>
            )
          )}
          {state.data.total > 20 && (
            <nav className="community-pagination" aria-label="게시글 페이지">
              <Button
                isIconOnly
                variant="outline"
                aria-label="이전 게시글 페이지"
                isDisabled={page === 1}
                onPress={() => param("page", String(page - 1))}
              >
                <ChevronLeft size={18} />
              </Button>
              <span>
                {page} / {Math.ceil(state.data.total / 20)}
              </span>
              <Button
                isIconOnly
                variant="outline"
                aria-label="다음 게시글 페이지"
                isDisabled={page >= Math.ceil(state.data.total / 20)}
                onPress={() => param("page", String(page + 1))}
              >
                <ChevronRight size={18} />
              </Button>
            </nav>
          )}
        </>
      )}
      <PreviewNote c={c} go={go} />
    </main>
  );
}

export function AuthScreen({
  c,
  go,
  notify,
  params,
}: Base & { params: URLSearchParams }) {
  const [mode, setMode] = useState(
      c.recovery ? "reset" : ["forgot", "reset"].includes(params.get("mode") || "") ? params.get("mode")! : emailSignupEnabled && params.get("mode") === "join" ? "join" : "login",
    ),
    [emailOpen, setEmailOpen] = useState(!kakaoEnabled || ["forgot", "reset"].includes(params.get("mode") || "")),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [repeat, setRepeat] = useState(""),
    [nickname, setNickname] = useState(""),
    [admissionYear, setAdmissionYear] = useState(""),
    [cohort, setCohort] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (c.recovery) setMode("reset");
  }, [c.recovery]);
  const next = safeReturnPath(params.get("next"));
  const finish = () =>
    go(
      next?.startsWith("/") &&
        !next.startsWith("//") &&
        !next.startsWith("/auth")
        ? next
        : "/board",
      true,
    );
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "join") {
        if (!emailSignupEnabled) throw Error("이메일 회원가입은 준비 중입니다. 카카오 로그인을 이용해 주세요.");
        if (!/^[가-힣a-zA-Z0-9_]{2,16}$/.test(nickname))
          throw Error(
            "닉네임은 한글, 영문, 숫자, 밑줄 2~16자로 입력해 주세요.",
          );
        if (password !== repeat) throw Error("비밀번호가 일치하지 않아요.");
        const affiliation = parseAffiliation(admissionYear, cohort);
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              nickname,
              admission_year: affiliation.admissionYear,
              cohort: affiliation.cohort,
            },
            emailRedirectTo: authRedirect(),
          },
        });
        if (error) throw error;
        if (data.session) {
          await c.refresh();
          finish();
        } else {
          setMessage(
            "이메일로 보낸 인증 링크를 눌러 가입을 완료해 주세요. 관리자 승인 없이 이용할 수 있습니다.",
          );
          setPassword("");
          setRepeat("");
        }
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(
          email.trim(),
          { redirectTo: authRedirect(true) },
        );
        if (error) throw error;
        setMessage("가입된 이메일이라면 비밀번호 재설정 안내가 발송됩니다.");
      } else if (mode === "reset") {
        if (password !== repeat) throw Error("비밀번호가 일치하지 않아요.");
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        c.setRecovery(false);
        history.replaceState(
          history.state,
          "",
          location.pathname + location.hash,
        );
        notify("비밀번호를 변경했어요.");
        finish();
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        await c.refresh();
        finish();
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  if (c.profile?.profileComplete === false) return <ProfileSetup c={c} go={go} next={next} />;
  return (
    <main className="community-auth">
      <Header
        title={
          mode === "join"
            ? "회원가입"
            : mode === "forgot"
              ? "비밀번호 찾기"
              : mode === "reset"
                ? "비밀번호 재설정"
                : "로그인"
        }
        go={go}
      />
      <div className="community-auth-content">
        <span className="community-eyebrow">VOKU On</span>
        <h1>
          {mode === "join"
            ? "반가워요. 함께 이야기해요."
            : mode === "forgot"
              ? "다시 만날 준비를 해요."
              : mode === "reset"
                ? "새 비밀번호를 설정하세요."
                : "우리의 이야기를 이어가요."}
        </h1>
        <p>
          {mode === "join"
            ? "누구나 가입할 수 있어요. 이메일 확인 후 바로 이용하세요."
            : "방송의 기억과 오늘의 안부가 모이는 곳."}
        </p>
        {!c.live && (
          <div className="community-preview-auth">
            <strong>지금은 화면 체험 중입니다</strong>
            <p>
              회원 서버 연결 전으로 실제 계정은 생성되지 않습니다. 아래 예시
              계정으로 일반 회원과 운영자의 기능을 확인할 수 있어요.
            </p>
            <div>
              <Button
                variant="secondary"
                onPress={async () => {
                  await c.previewLogin("member");
                  finish();
                }}
              >
                일반 회원으로 체험
              </Button>
              <Button
                variant="outline"
                onPress={async () => {
                  await c.previewLogin("admin");
                  go("/admin", true);
                }}
              >
                운영자로 체험
              </Button>
            </div>
          </div>
        )}
        {c.profile && mode !== "reset" && (
          <div className="community-signed-in">
            <span>
              {c.profile.nickname}님으로 {c.live ? "로그인" : "체험"} 중
            </span>
            <button onClick={() => void c.logout()}>로그아웃</button>
          </div>
        )}
        {c.live && kakaoEnabled && !c.profile && mode !== "reset" && (
          <KakaoEntry busy={busy} onPress={() => {
            setBusy(true); setError("");
            void signInWithKakao(next).catch((e) => { setError(errorText(e)); setBusy(false); });
          }} />
        )}
        {c.live && kakaoEnabled && !c.profile && !emailOpen && !c.recovery && (
          <button className="community-email-toggle" onClick={() => { setEmailOpen(true); setMode("login"); }}>기존 이메일 계정으로 로그인</button>
        )}
        {(emailOpen || c.recovery) && <>
        <form onSubmit={submit} className="community-form">
          {mode !== "reset" && (
            <TextField
              isRequired
              type="email"
              value={email}
              onChange={setEmail}
              isDisabled={!c.live}
            >
              <Label>이메일</Label>
              <Input
                autoComplete="email"
                placeholder="name@example.com"
                maxLength={254}
              />
            </TextField>
          )}
          {mode === "join" && (
            <TextField
              isRequired
              value={nickname}
              onChange={setNickname}
              isDisabled={!c.live}
            >
              <Label>닉네임</Label>
              <Input
                placeholder="한글, 영문, 숫자, 밑줄 2~16자"
                maxLength={16}
                autoComplete="nickname"
              />
            </TextField>
          )}
          {mode === "join" && (
            <AffiliationFields
              year={admissionYear}
              cohort={cohort}
              onYearChange={setAdmissionYear}
              onCohortChange={setCohort}
              disabled={!c.live || busy}
            />
          )}
          {mode !== "forgot" && (
            <TextField
              isRequired
              type="password"
              value={password}
              onChange={setPassword}
              isDisabled={!c.live}
            >
              <Label>{mode === "reset" ? "새 비밀번호" : "비밀번호"}</Label>
              <Input
                minLength={mode === "login" ? undefined : 10}
                maxLength={72}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                placeholder={
                  mode === "login" ? "비밀번호 입력" : "10자 이상 입력"
                }
              />
            </TextField>
          )}
          {(mode === "join" || mode === "reset") && (
            <TextField
              isRequired
              type="password"
              value={repeat}
              onChange={setRepeat}
              isDisabled={!c.live}
            >
              <Label>비밀번호 확인</Label>
              <Input autoComplete="new-password" maxLength={72} />
            </TextField>
          )}
          {message && (
            <p className="community-success" role="status">
              {message}
            </p>
          )}
          <ErrorLine text={error || c.error} />
          <Button fullWidth type="submit" isDisabled={!c.live || busy}>
            {busy
              ? "처리 중…"
              : mode === "join"
                ? "가입하기"
                : mode === "forgot"
                  ? "재설정 메일 받기"
                  : mode === "reset"
                    ? "비밀번호 변경"
                    : "로그인"}
          </Button>
        </form>
        <div className="community-auth-links">
          {mode !== "login" && (
            <button
              onClick={() => {
                setMode("login");
                setError("");
                setMessage("");
              }}
            >
              로그인으로
            </button>
          )}
          {mode === "login" && (
            <>
              {emailSignupEnabled && <button
                onClick={() => {
                  setMode("join");
                  setError("");
                }}
              >
                회원가입
              </button>}
              <button
                onClick={() => {
                  setMode("forgot");
                  setError("");
                }}
              >
                비밀번호 찾기
              </button>
            </>
          )}
        </div>
        </>}
        {!emailOpen && <ErrorLine text={error || c.error} />}
      </div>
    </main>
  );
}

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
type Operation = {
  title: string;
  action: Action;
  payload: Record<string, unknown>;
  description?: string;
  reason?: boolean;
};
function OperationDialog({
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
function PostMenu({
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
export function CommunityPostScreen({
  c,
  go,
  notify,
  id,
  catalog,
}: Base & { id: string; catalog: ArchiveRecord[] }) {
  const state = useLoad<Thread>(() => api.thread(id), [id, c.revision]);
  const [report, setReport] = useState<{ commentId?: string } | null>(null),
    [operation, setOperation] = useState<Operation | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const p = state.data?.post,
    record = catalog.find((r) => r.id === p?.recordId);
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
      <Header title="커뮤니티" go={go}>
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
            <div className="community-body">{p.body}</div>
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
            <Button variant="outline" onPress={() => go("/board")}>
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
          if (operation?.action === "post_delete") go("/board", true);
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

export function CommunityComposer({
  c,
  go,
  notify,
  catalog,
  params,
}: Base & { catalog: ArchiveRecord[]; params: URLSearchParams }) {
  const edit = params.get("edit") || "",
    isNotice = params.get("notice") === "1";
  return (
    <main>
      <Header
        title={edit ? "글 수정" : isNotice ? "공지 작성" : "글쓰기"}
        go={go}
      />
      <LoginGate c={c} go={go}>
        <ComposerForm
          key={`${c.profile?.id}-${edit}`}
          c={c}
          go={go}
          notify={notify}
          catalog={catalog}
          edit={edit}
          isNotice={isNotice}
        />
      </LoginGate>
    </main>
  );
}
function ComposerForm({
  c,
  go,
  notify,
  catalog,
  edit,
  isNotice,
}: Base & { catalog: ArchiveRecord[]; edit: string; isNotice: boolean }) {
  const draftKey = `voku-community-draft:${c.live ? "live" : "preview"}:${c.profile!.id}:${edit || "new"}`;
  const initial = () => {
    const empty = { title: "", body: "", category: "일상", recordId: "" };
    try {
      const value = JSON.parse(localStorage.getItem(draftKey) || "null");
      return value &&
        ["title", "body", "category", "recordId"].every(
          (k) => typeof value[k] === "string",
        )
        ? {
            title: value.title.slice(0, 100),
            body: value.body.slice(0, 10000),
            category: categories.includes(value.category)
              ? value.category
              : "일상",
            recordId: value.recordId,
          }
        : empty;
    } catch {
      return empty;
    }
  };
  const [draft, setDraft] = useState(initial),
    [notice, setNotice] = useState(isNotice && staff(c.profile)),
    [attachOpen, setAttachOpen] = useState(false),
    [query, setQuery] = useState(""),
    [attachmentLimit, setAttachmentLimit] = useState(20),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [ready, setReady] = useState(!edit),
    [saved, setSaved] = useState(true);
  useEffect(() => {
    if (!edit) return;
    let active = true;
    api
      .thread(edit)
      .then(({ post }) => {
        if (!active) return;
        if (post.authorId !== c.profile?.id)
          throw Error("본인의 글만 수정할 수 있습니다.");
        setDraft({
          title: post.title,
          body: post.body,
          category: post.category,
          recordId: post.recordId || "",
        });
        setNotice(post.pinned);
        setReady(true);
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      });
    return () => {
      active = false;
    };
  }, [edit]);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify(draft));
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }, [draft, draftKey, ready]);
  useEffect(() => setAttachmentLimit(20), [query]);
  const attachmentResults = catalog.filter((r) =>
    query
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .every((q) =>
        normalize(
          `${r.title} ${r.en} ${r.year} ${r.term}학기 ${r.issue}회`,
        ).includes(normalize(q)),
      ),
  );
  const attached = catalog.find((r) => r.id === draft.recordId),
    set = (part: Record<string, string>) =>
      setDraft((d: typeof draft) => ({ ...d, ...part }));
  return (
    <>
      <form
        className="community-compose community-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const result = await c.action(
              "post_save",
              {
                ...draft,
                title: draft.title.trim(),
                body: draft.body.trim(),
                ...(edit ? { id: edit } : { notice }),
              },
              edit ? "글을 수정했어요." : "글을 등록했어요.",
            );
            try {
              localStorage.removeItem(draftKey);
            } catch {
              /* The server save already succeeded. */
            }
            go("/post/" + result.postId, true);
          } catch (e) {
            setError(errorText(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="community-compose-by">
          <strong>{c.profile?.nickname}</strong>
          <span>{saved ? "임시 저장됨" : "임시 저장 공간 부족"}</span>
        </div>
        {!c.live && (
          <p className="community-help">
            체험 글은 이 브라우저에만 저장됩니다.
          </p>
        )}
        <Choice
          label="말머리"
          value={draft.category}
          change={(category) => set({ category })}
          options={categories.map((v) => ({
            id: v,
            label: v === "일상" ? "자유글" : v,
          }))}
        />
        {staff(c.profile) && !edit && (
          <CheckField checked={notice} change={setNotice}>
            공지로 등록하고 목록 위에 고정
          </CheckField>
        )}
        <TextField
          isRequired
          value={draft.title}
          onChange={(title) => set({ title })}
        >
          <Label>제목</Label>
          <Input maxLength={100} placeholder="제목을 입력해 주세요" />
        </TextField>
        <TextField
          isRequired
          value={draft.body}
          onChange={(body) => set({ body })}
        >
          <Label>내용</Label>
          <TextArea
            rows={10}
            maxLength={10000}
            placeholder="방송실의 기억, 오늘의 안부를 편하게 남겨주세요."
          />
        </TextField>
        <span className="community-count">
          {draft.body.length.toLocaleString()} / 10,000
        </span>
        {attached ? (
          <div className="community-attached">
            <FileText size={18} />
            <span>
              {attached.year} · {attached.title} {attached.issue}회
            </span>
            <Button
              variant="ghost"
              isIconOnly
              aria-label="첨부 큐시트 해제"
              onPress={() => set({ recordId: "" })}
            >
              <X size={17} />
            </Button>
          </div>
        ) : (
          <Button variant="outline" onPress={() => setAttachOpen(true)}>
            <FileText size={17} />
            큐시트 연결
          </Button>
        )}
        <ErrorLine text={error} />
        <Button type="submit" fullWidth isDisabled={busy || !ready}>
          {busy ? "저장 중…" : edit ? "수정 완료" : "등록하기"}
        </Button>
        <p className="community-help">
          다른 사람의 개인정보와 권리를 존중해 주세요.
        </p>
      </form>
      <Dialog
        title="함께 읽을 큐시트"
        open={attachOpen}
        close={() => setAttachOpen(false)}
      >
        <SearchField
          value={query}
          onChange={setQuery}
          aria-label="프로그램 또는 연도 검색"
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="프로그램 또는 연도 검색" />
            <SearchField.ClearButton aria-label="검색어 지우기" />
          </SearchField.Group>
        </SearchField>
        <div className="community-attachment-results">
          {attachmentResults.slice(0, attachmentLimit).map((r) => (
            <button
              key={r.id}
              onClick={() => {
                set({ recordId: r.id });
                setAttachOpen(false);
              }}
            >
              <span>
                <strong>
                  {r.title} {r.issue}회
                </strong>
                <small>
                  {r.year}년 {r.term}학기 · {r.pages}쪽
                </small>
              </span>
              <ChevronRight size={16} />
            </button>
          ))}
          {attachmentResults.length > attachmentLimit && (
            <Button
              variant="ghost"
              fullWidth
              onPress={() => setAttachmentLimit((n) => n + 20)}
            >
              더 보기 ({attachmentLimit} / {attachmentResults.length})
            </Button>
          )}
          {!attachmentResults.length && <Empty title="검색 결과가 없어요" />}
        </div>
      </Dialog>
    </>
  );
}

export function CommunityAccount({
  c,
  go,
  notify,
  notifications = false,
}: Base & { notifications?: boolean }) {
  const [tab, setTab] = useState("posts"),
    [nickname, setNickname] = useState(c.profile?.nickname || ""),
    [admissionYear, setAdmissionYear] = useState(
      c.profile?.admissionYear?.toString() || "",
    ),
    [cohort, setCohort] = useState(c.profile?.cohort?.toString() || ""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    setNickname(c.profile?.nickname || "");
    setAdmissionYear(c.profile?.admissionYear?.toString() || "");
    setCohort(c.profile?.cohort?.toString() || "");
  }, [
    c.profile?.id,
    c.profile?.nickname,
    c.profile?.admissionYear,
    c.profile?.cohort,
  ]);
  const a = c.account,
    run = async (fn: () => Promise<unknown>) => {
      setBusy(true);
      setError("");
      try {
        await fn();
      } catch (e) {
        setError(errorText(e));
      } finally {
        setBusy(false);
      }
    };
  return (
    <main className="community-account">
      <Header title={notifications ? "알림" : "내 정보"} go={go} />
      {c.loading ? (
        <div className="community-loading">
          <Spinner />
        </div>
      ) : !a ? (
        <LoginGate c={c} go={go}>
          <span />
        </LoginGate>
      ) : (
        <>
          {notifications ? (
            <>
              <div className="community-section-heading">
                <h2>내 글과 댓글의 새 소식</h2>
                <button
                  onClick={() =>
                    void run(() => c.action("read_notifications", {}))
                  }
                >
                  모두 읽음
                </button>
              </div>
              {a.notifications.length ? (
                a.notifications.map((n) => (
                  <button
                    key={n.id}
                    className={`community-notification ${n.read ? "" : "unread"}`}
                    onClick={() => {
                      void run(() => c.action("read_notifications", {}));
                      go("/post/" + n.postId);
                    }}
                  >
                    <Bell size={17} />
                    <span>
                      {n.text}
                      <small>{localDate(n.date)}</small>
                    </span>
                    <ChevronRight size={16} />
                  </button>
                ))
              ) : (
                <Empty title="새로운 알림이 없어요">
                  내 글이나 댓글에 답글이 달리면 알려드려요.
                </Empty>
              )}
            </>
          ) : (
            <>
              <section className="community-profile">
                <span className="community-avatar community-own-avatar">
                  {a.profile.nickname[0]}
                  {a.avatarUrl && <img src={a.avatarUrl} alt="내 카카오 프로필 사진" referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.hidden = true; }} />}
                </span>
                <div>
                  <h1>{a.profile.nickname}</h1>
                  <RoleTag role={a.profile.role} />
                  {affiliationLabel(a.profile) && (
                    <p className="community-affiliation-label">
                      {affiliationLabel(a.profile)}
                    </p>
                  )}
                  <p>
                    {dateLabel(a.profile.joinedAt)} 가입 ·{" "}
                    {c.live ? "회원" : "예시 계정"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  onPress={() =>
                    void run(async () => {
                      await c.logout();
                      go("/board");
                    })
                  }
                >
                  로그아웃
                </Button>
              </section>
              {suspended(a.profile) && (
                <p className="community-restriction">
                  이용 제한 · {localDate(a.profile.suspendedUntil!)}까지
                  <br />
                  {a.profile.suspensionReason}
                </p>
              )}
              <div className="community-categories" aria-label="내 활동 분류">
                {[
                  ["posts", "내 글"],
                  ["comments", "내 댓글"],
                  ["saved", "스크랩"],
                  ["reports", "내 신고"],
                  ["blocked", "숨긴 회원"],
                  ["settings", "내 설정"],
                ].map(([id, label]) => (
                  <Button
                    key={id}
                    variant="ghost"
                    className={tab === id ? "chosen" : ""}
                    aria-pressed={tab === id}
                    onPress={() => setTab(id)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              {(tab === "posts" || tab === "saved") &&
                (a[tab].length ? (
                  a[tab].map((p) => <PostRow key={p.id} post={p} go={go} />)
                ) : (
                  <Empty
                    title={
                      tab === "posts"
                        ? "아직 작성한 글이 없어요"
                        : "스크랩한 글이 없어요"
                    }
                  />
                ))}
              {tab === "comments" &&
                (a.comments.length ? (
                  a.comments.map((comment) => (
                    <button
                      key={comment.id}
                      className="community-activity"
                      onClick={() => go("/post/" + comment.postId)}
                    >
                      <span>
                        {comment.body}
                        <small>{localDate(comment.date)}</small>
                      </span>
                      <ChevronRight size={16} />
                    </button>
                  ))
                ) : (
                  <Empty title="아직 작성한 댓글이 없어요" />
                ))}
              {tab === "reports" &&
                (a.reports.length ? (
                  a.reports.map((r) => (
                    <div className="community-my-report" key={r.id}>
                      <span className="community-status">
                        {r.status === "open"
                          ? "확인 대기"
                          : r.status === "resolved"
                            ? "조치 완료"
                            : "반려"}
                      </span>
                      <strong>{r.title}</strong>
                      <p>{r.reason}</p>
                      {r.resolution && <p>처리 결과: {r.resolution}</p>}
                    </div>
                  ))
                ) : (
                  <Empty title="접수한 신고가 없어요" />
                ))}
              {tab === "blocked" &&
                (a.blocked.length ? (
                  a.blocked.map((p) => (
                    <div className="community-blocked" key={p.id}>
                      <strong>{p.nickname}</strong>
                      <Button
                        variant="outline"
                        size="sm"
                        isDisabled={busy}
                        onPress={() =>
                          void run(() =>
                            c.action(
                              "block",
                              { userId: p.id, value: false },
                              "숨김을 해제했어요.",
                            ),
                          )
                        }
                      >
                        숨김 해제
                      </Button>
                    </div>
                  ))
                ) : (
                  <Empty title="숨긴 회원이 없어요" />
                ))}
              {tab === "settings" && (
                <form
                  className="community-form community-settings"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(() =>
                      c.action(
                        "profile",
                        {
                          nickname: nickname.trim(),
                          ...parseAffiliation(admissionYear, cohort),
                        },
                        "회원정보를 저장했어요.",
                      ),
                    );
                  }}
                >
                  <TextField isRequired value={nickname} onChange={setNickname}>
                    <Label>닉네임</Label>
                    <Input minLength={2} maxLength={16} />
                  </TextField>
                  <AffiliationFields
                    year={admissionYear}
                    cohort={cohort}
                    onYearChange={setAdmissionYear}
                    onCohortChange={setCohort}
                    disabled={busy || suspended(a.profile)}
                  />
                  <Button
                    type="submit"
                    isDisabled={busy || suspended(a.profile)}
                  >
                    회원정보 저장
                  </Button>
                  {c.live && a.profile.providers.includes("email") && (
                    <Button
                      variant="outline"
                      onPress={() => go("/auth?mode=forgot")}
                    >
                      비밀번호 재설정
                    </Button>
                  )}
                </form>
              )}
              {staff(a.profile) && (
                <div className="community-admin-door">
                  <Button
                    variant="outline"
                    fullWidth
                    onPress={() => go("/admin")}
                  >
                    <ShieldCheck size={18} />
                    운영 관리 <ArrowRight size={17} />
                  </Button>
                </div>
              )}
            </>
          )}
          <ErrorLine text={error} />
        </>
      )}
      <PreviewNote c={c} go={go} />
    </main>
  );
}

export function CommunityAdmin({ c, go, notify }: Base) {
  if (c.loading)
    return (
      <main>
        <Header title="운영 관리" go={go} />
        <div className="community-loading">
          <Spinner />
        </div>
      </main>
    );
  if (!staff(c.profile))
    return (
      <main>
        <Header title="운영 관리" go={go} />
        <Empty title="운영 권한이 필요합니다">
          운영진 계정으로 로그인해 주세요.
        </Empty>
        <div className="community-admin-door">
          <Button fullWidth onPress={() => go("/auth?next=%2Fadmin")}>
            로그인
          </Button>
        </div>
      </main>
    );
  return <AdminPanel c={c} go={go} notify={notify} />;
}
function AdminPanel({ c, go, notify }: Base) {
  const [tab, setTab] = useState("reports"),
    [query, setQuery] = useState(""),
    [search, setSearch] = useState(""),
    [operation, setOperation] = useState<Operation | null>(null),
    [selectedReport, setSelectedReport] = useState<Report | null>(null),
    [member, setMember] = useState<Profile | null>(null),
    [days, setDays] = useState("7"),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const state = useLoad<AdminData>(() => api.admin(query), [query, c.revision]);
  const d = state.data;
  const suspend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!member) return;
    setBusy(true);
    setError("");
    try {
      await c.action(
        "suspend",
        { userId: member.id, days: Number(days), reason: reason.trim() },
        "회원 이용을 제한했어요.",
      );
      setMember(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="community-admin">
      <Header title="운영 관리" go={go} />
      <section className="community-admin-heading">
        <span>
          <ShieldCheck size={20} />
          VOKU On 운영실
        </span>
        <p>신고를 확인하고, 함께 읽을 공간을 관리합니다.</p>
        <div>
          <strong>
            {d?.stats.pendingReports || 0}
            <small>대기 신고</small>
          </strong>
          <strong>
            {d?.stats.pinnedPosts || 0}
            <small>고정 공지</small>
          </strong>
          <strong>
            {d?.stats.suspendedMembers || 0}
            <small>이용 제한</small>
          </strong>
        </div>
      </section>
      <div className="community-categories" aria-label="운영 관리 분류">
        {[
          ["reports", "신고함"],
          ["posts", "글·공지"],
          ["members", "회원"],
          ["audit", "처리 기록"],
        ].map(([id, label]) => (
          <Button
            key={id}
            variant="ghost"
            aria-pressed={tab === id}
            className={tab === id ? "chosen" : ""}
            onPress={() => {
              setTab(id);
              setQuery("");
              setSearch("");
            }}
          >
            {label}
          </Button>
        ))}
      </div>
      {(tab === "members" || tab === "posts") && (
        <form
          className="community-search"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(search.trim());
          }}
        >
          <Input
            aria-label={
              tab === "members"
                ? "회원 닉네임·학번·기수 검색"
                : "게시글 제목 검색"
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              tab === "members" ? "닉네임·학번·기수 검색" : "게시글 제목 검색"
            }
            maxLength={100}
          />
          <Button type="submit" variant="secondary">
            검색
          </Button>
        </form>
      )}
      {tab === "posts" && (
        <div className="community-section-heading">
          <span>최근 게시글 · 최대 100개</span>
          <Button size="sm" onPress={() => go("/write?notice=1")}>
            <Pencil size={15} />
            공지 작성
          </Button>
        </div>
      )}
      <LoadState state={state} />
      {d && !state.error && (
        <>
          {tab === "reports" &&
            (d.reports.length ? (
              d.reports.map((r) => (
                <button
                  className="community-report-row"
                  key={r.id}
                  onClick={() => setSelectedReport(r)}
                >
                  <span
                    className={`community-status ${r.status === "open" ? "pending" : ""}`}
                  >
                    {r.status === "open"
                      ? "확인 대기"
                      : r.status === "resolved"
                        ? "조치 완료"
                        : "반려"}
                  </span>
                  <strong>
                    {r.commentId ? "[댓글] " : ""}
                    {r.title}
                  </strong>
                  <p>
                    {r.reason} · {r.reporter} · {dateLabel(r.date)}
                  </p>
                  <ChevronRight size={16} />
                </button>
              ))
            ) : (
              <Empty title="접수된 신고가 없어요">
                신고가 들어오면 대상 내용과 사유를 여기에서 확인합니다.
              </Empty>
            ))}
          {tab === "posts" &&
            (d.posts.length ? (
              d.posts.map((p) => (
                <div className="community-admin-post" key={p.id}>
                  <PostRow post={p} go={go} />
                  <PostMenu
                    post={p}
                    c={c}
                    go={go}
                    setOperation={setOperation}
                    report={() => go("/post/" + p.id)}
                  />
                </div>
              ))
            ) : (
              <Empty title="등록된 글이 없어요" />
            ))}
          {tab === "members" &&
            (d.members.length ? (
              d.members.map((m) => (
                <div className="community-member-row" key={m.id}>
                  <div>
                    <strong>{m.nickname}</strong>
                    <RoleTag role={m.role} />
                    {affiliationLabel(m) && (
                      <p className="community-affiliation-label">
                        {affiliationLabel(m)}
                      </p>
                    )}
                    <p>
                      {suspended(m)
                        ? `이용 제한 · ${localDate(m.suspendedUntil!)}`
                        : `${dateLabel(m.joinedAt)} 가입`}
                    </p>
                    {suspended(m) && <small>{m.suspensionReason}</small>}
                  </div>
                  {m.id !== c.profile?.id &&
                    m.role !== "admin" &&
                    (m.role === "member" || c.profile?.role === "admin") && (
                      <Dropdown>
                        <Button
                          isIconOnly
                          variant="ghost"
                          aria-label={`${m.nickname} 회원 관리`}
                        >
                          <MoreHorizontal size={20} />
                        </Button>
                        <Dropdown.Popover className="community-menu">
                          <Dropdown.Menu
                            onAction={(key) => {
                              if (key === "suspend") {
                                setMember(m);
                                setReason("");
                                setError("");
                              }
                              if (key === "restore")
                                setOperation({
                                  title: "이용 제한 해제",
                                  action: "restore_member",
                                  payload: { userId: m.id },
                                });
                              if (key === "role")
                                setOperation({
                                  title:
                                    m.role === "member"
                                      ? "운영진 권한 부여"
                                      : "운영진 권한 회수",
                                  description: `${m.nickname}님의 공지·신고·회원 관리 권한을 변경합니다.`,
                                  action: "set_role",
                                  payload: {
                                    userId: m.id,
                                    role:
                                      m.role === "member"
                                        ? "moderator"
                                        : "member",
                                  },
                                });
                            }}
                          >
                            {suspended(m) ? (
                              <Dropdown.Item
                                id="restore"
                                textValue="이용 제한 해제"
                              >
                                <Label>이용 제한 해제</Label>
                              </Dropdown.Item>
                            ) : (
                              <Dropdown.Item
                                id="suspend"
                                textValue="이용 제한"
                                variant="danger"
                              >
                                <Label>이용 제한</Label>
                              </Dropdown.Item>
                            )}
                            {c.profile?.role === "admin" && (
                              <Dropdown.Item
                                id="role"
                                textValue="운영진 권한 변경"
                              >
                                <Label>
                                  {m.role === "member"
                                    ? "운영진 지정"
                                    : "운영진 해제"}
                                </Label>
                              </Dropdown.Item>
                            )}
                          </Dropdown.Menu>
                        </Dropdown.Popover>
                      </Dropdown>
                    )}
                </div>
              ))
            ) : (
              <Empty title="검색 결과가 없어요" />
            ))}
          {tab === "audit" &&
            (d.audit.length ? (
              d.audit.map((a) => (
                <div className="community-audit-row" key={a.id}>
                  <div>
                    <strong>{actionNames[a.action] || a.action}</strong>
                    <time>{localDate(a.date)}</time>
                  </div>
                  <p>
                    {a.actor} · {a.target}
                  </p>
                  {a.reason && <small>{a.reason}</small>}
                </div>
              ))
            ) : (
              <Empty title="아직 처리 기록이 없어요">
                공지 설정, 신고 처리, 회원 제재 기록이 남습니다.
              </Empty>
            ))}
        </>
      )}
      <Dialog
        title="신고 상세"
        open={!!selectedReport}
        close={() => setSelectedReport(null)}
      >
        {selectedReport && (
          <div className="community-report-detail">
            <span className="community-status">{selectedReport.reason}</span>
            <h3>{selectedReport.title}</h3>
            <blockquote>{selectedReport.body}</blockquote>
            <p>{selectedReport.detail || "추가 설명 없음"}</p>
            <small>
              신고자 {selectedReport.reporter} ·{" "}
              {localDate(selectedReport.date)}
            </small>
            {selectedReport.status === "open" ? (
              <div className="community-dialog-actions">
                <Button
                  variant="outline"
                  onPress={() => {
                    setOperation({
                      title: "신고 반려",
                      action: "resolve_report",
                      payload: { id: selectedReport.id, decision: "dismiss" },
                      reason: true,
                    });
                    setSelectedReport(null);
                  }}
                >
                  반려
                </Button>
                <Button
                  onPress={() => {
                    setOperation({
                      title: "신고 대상 숨김",
                      action: "resolve_report",
                      payload: { id: selectedReport.id, decision: "hide" },
                      reason: true,
                    });
                    setSelectedReport(null);
                  }}
                >
                  숨김 처리
                </Button>
              </div>
            ) : (
              <p>처리 결과: {selectedReport.resolution}</p>
            )}
          </div>
        )}
      </Dialog>
      <Dialog
        title="회원 이용 제한"
        open={!!member}
        close={() => setMember(null)}
      >
        <form className="community-form" onSubmit={suspend}>
          <p>
            <strong>{member?.nickname}</strong>님의 글·댓글 작성과 활동을
            제한합니다.
          </p>
          <Choice
            label="제한 기간"
            value={days}
            change={setDays}
            options={[
              { id: "1", label: "1일" },
              { id: "7", label: "7일" },
              { id: "30", label: "30일" },
              { id: "36500", label: "영구 (100년)" },
            ]}
          />
          <TextField isRequired value={reason} onChange={setReason}>
            <Label>제한 사유</Label>
            <TextArea rows={3} minLength={2} maxLength={500} />
          </TextField>
          <ErrorLine text={error} />
          <Button
            type="submit"
            fullWidth
            isDisabled={busy || reason.trim().length < 2}
          >
            이용 제한
          </Button>
        </form>
      </Dialog>
      <OperationDialog
        operation={operation}
        close={() => setOperation(null)}
        c={c}
      />
      <PreviewNote c={c} go={go} />
    </main>
  );
}

export function CommunityMenu({
  c,
  go,
  close,
}: {
  c: Community;
  go: Go;
  close: () => void;
}) {
  const visit = (path: string) => {
    close();
    go(path);
  };
  return (
    <div className="community-menu-account">
      <div>
        <span className="community-avatar">
          {c.profile?.nickname[0] || "V"}
        </span>
        <span>
          <strong>{c.profile?.nickname || "반가워요, VOKU On"}</strong>
          <small>
            {c.profile
              ? `${roleLabel(c.profile.role)}${c.live ? "" : " · 화면 체험"}`
              : "로그인하면 이야기를 남길 수 있어요."}
          </small>
        </span>
      </div>
      <Button
        fullWidth
        variant="secondary"
        onPress={() => visit(c.profile ? "/account" : "/auth")}
      >
        {c.profile ? "내 정보 · 내 활동" : "로그인 / 회원가입"}
      </Button>
      <div className="menu-links">
        <button onClick={() => visit("/notifications")}>
          알림 <Bell size={17} />
        </button>
        {staff(c.profile) && (
          <button onClick={() => visit("/admin")}>
            운영 관리 <ShieldCheck size={17} />
          </button>
        )}
        {!c.live && (
          <button onClick={() => visit("/auth")}>
            체험 계정 전환 <ChevronRight size={17} />
          </button>
        )}
      </div>
    </div>
  );
}
