import {
  Button,
  Input,
  Label,
  Spinner,
  TextField,
} from "@heroui/react";
import { ArrowRight, Bell, ChevronRight, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { dateLabel } from "../data";
import { AffiliationFields } from "./AffiliationFields";
import { affiliationLabel, parseAffiliation } from "./affiliation";
import { errorText } from "./client";
import {
  Empty,
  ErrorLine,
  Header,
  localDate,
  LoginGate,
  PostRow,
  PreviewNote,
  RoleTag,
  type Base,
} from "./shared";
import { staff, suspended } from "./types";

export function CommunityAccount({
  c,
  go,
  notify,
  notifications = false,
  initialTab = "posts",
}: Base & { notifications?: boolean; initialTab?: string }) {
  const selectedTab = ["posts", "comments", "saved", "reports", "blocked", "settings"].includes(initialTab) ? initialTab : "posts";
  const [tab, setTab] = useState(selectedTab),
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
  useEffect(() => { setTab(selectedTab); }, [selectedTab]);
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
