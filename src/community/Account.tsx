import { commentPath } from "./reading";
import {
  Button,
  Input,
  Label,
  Spinner,
  TextField,
} from "@heroui/react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { dateLabel } from "../data";
import { AffiliationFields } from "./AffiliationFields";
import { affiliationLabel, parseAffiliation } from "./affiliation";
import { errorText } from "./client";
import { ActivityList } from "./Activity";
import { adminEntryPath, pageNumber, listReturnLabel, personalReturnPath, personalEntryPath, withList } from "./navigation";
import {
  Empty,
  ErrorLine,
  Header,
  localDate,
  LoginGate,
  PreviewNote,
  RoleTag,
  type Base,
} from "./shared";
import { canManageBoard, suspended, type ActivityKind, type CommunityNotification } from "./types";

export function CommunityAccount({
  c,
  go,
  notify,
  notifications = false,
  params,
}: Base & { notifications?: boolean; params: URLSearchParams }) {
  const initialTab = params.get("tab") || "posts";
  const tab = ["posts", "comments", "saved", "reports", "blocked", "settings"].includes(initialTab) ? initialTab : "posts";
  const settings = ["settings", "reports", "blocked"].includes(tab);
  const returnTo = personalReturnPath(params);
  const list = (notifications ? "/notifications" : "/account") + (params.size ? "?" + params : "");
  const changeTab = (nextTab: string) => {
    const next = new URLSearchParams(params);
    next.set("tab", nextTab);
    next.delete("page");
    go("/account?" + next, true);
  };
  useEffect(() => {
    if (!notifications && tab === "saved") go(personalEntryPath("/saved?tab=posts", list), true, false, true);
  }, [notifications, tab, list, go]);
  const page = pageNumber(params.get("page"));
  const activityKind: ActivityKind | null = notifications ? "notifications" : tab === "posts" || tab === "comments" ? tab : null;
  const [nickname, setNickname] = useState(c.profile?.nickname || ""),
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
  useEffect(() => {
    if (notifications && c.profile) void c.refreshLatest();
  }, [notifications, c.profile?.id, c.refreshLatest]);
  const changePage = (nextPage: number) => {
    const next = new URLSearchParams(params);
    next.set("page", String(nextPage));
    go((notifications ? "/notifications?" : "/account?") + next);
  };
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
    <main className="community-account" data-community-ready={!activityKind && !c.loading && !!a}>
      <Header title={notifications ? "알림" : settings ? "내 설정" : "내 활동"} go={go}
        backLabel={listReturnLabel(returnTo)} onBack={() => go(returnTo, false, false, true)} />
      {c.loading ? (
        <div className="community-loading">
          <Spinner />
        </div>
      ) : c.error && !a ? (
        <div className="community-state"><ErrorLine text={c.error} /><Button variant="outline" onPress={() => void c.refreshLatest()}>다시 불러오기</Button></div>
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
                <button disabled={busy || !a.unreadNotificationCount}
                  onClick={() =>
                    void run(() => c.action("read_notifications", {}))
                  }
                >
                  모두 읽음
                </button>
              </div>
              <ActivityList key={`${a.profile.id}/notifications/${page}`} c={c} go={go} kind="notifications" page={page} changePage={changePage} busy={busy}
                openNotification={(n: CommunityNotification) => void run(async () => {
                  if (!n.read) await c.action("read_notifications", { id: n.id });
                  go(withList(commentPath(n.postId, n.commentId), list));
                })} />
              <ErrorLine text={c.error} />
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
                {settings && <Button
                  variant="ghost"
                  onPress={() =>
                    void run(async () => {
                      await c.logout();
                      go(returnTo, false, false, true);
                    })
                  }
                >
                  로그아웃
                </Button>}
              </section>
              {suspended(a.profile) && (
                <p className="community-restriction">
                  이용 제한 · {localDate(a.profile.suspendedUntil!)}까지
                  <br />
                  {a.profile.suspensionReason}
                </p>
              )}
              <nav className="community-personal-links" aria-label="내 메뉴 바로가기">
                {settings ? <Button variant="ghost" onPress={() => changeTab("posts")}>내 활동 <ArrowRight size={15} /></Button>
                  : <Button variant="ghost" onPress={() => changeTab("settings")}>내 설정 <ArrowRight size={15} /></Button>}
                <Button variant="ghost" onPress={() => go(personalEntryPath("/saved?tab=posts", list))}>저장한 글·자료 <ArrowRight size={15} /></Button>
              </nav>
              <div className="community-categories community-account-tabs" role="group" aria-label={settings ? "내 설정 분류" : "내 활동 분류"}>
                {(settings ? [
                  ["settings", "프로필"],
                  ["reports", "내 신고"],
                  ["blocked", "숨긴 회원"],
                ] : [
                  ["posts", "내 글"],
                  ["comments", "내 댓글"],
                ]).map(([id, label]) => (
                  <Button
                    key={id}
                    variant="ghost"
                    className={tab === id ? "chosen" : ""}
                    aria-pressed={tab === id}
                    onPress={() => changeTab(id)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              {activityKind && <ActivityList key={`${a.profile.id}/${activityKind}/${page}`} c={c} go={go} kind={activityKind} page={page} changePage={changePage} busy={busy} openNotification={() => {}} />}
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
              {settings && canManageBoard(a.profile) && (
                <div className="community-admin-door">
                  <Button
                    variant="outline"
                    fullWidth
                    onPress={() => go(adminEntryPath("/account?" + params.toString()))}
                  >
                    <ShieldCheck size={18} />
                    관리자 페이지 <ArrowRight size={17} />
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
