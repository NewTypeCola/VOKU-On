import { PostMenu } from "./shared";
import {
  Button,
  Dropdown,
  Input,
  Label,
  Spinner,
  TextArea,
  TextField,
} from "@heroui/react";
import { ChevronRight, MoreHorizontal, Pencil, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { dateLabel } from "../data";
import { affiliationLabel } from "./affiliation";
import { api, errorText } from "./client";
import {
  Choice,
  Dialog,
  Empty,
  ErrorLine,
  Header,
  LoadState,
  localDate,
  OperationDialog,
  PostRow,
  PreviewNote,
  RoleTag,
  useLoad,
  type Base,
  type Operation,
} from "./shared";
import {
  staff,
  suspended,
  type AdminData,
  type Profile,
  type Report,
} from "./types";

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
