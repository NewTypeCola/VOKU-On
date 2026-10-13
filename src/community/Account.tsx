import { Button } from "@heroui/react";
import { LogOut, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ErrorState, LoadingState } from "../ScreenFeedback";
import { affiliationLabel } from "./affiliation";
import { errorText } from "./client";
import { ActivityList } from "./Activity";
import { ProfileSettings } from "./ProfileSettings";
import { allowCommunityLeave } from "./navigationGuard";
import { adminEntryPath, pageNumber, listReturnLabel, personalReturnPath, personalEntryPath, withList } from "./navigation";
import { commentPath } from "./reading";
import { Empty, ErrorLine, Header, localDate, LoginGate, PreviewNote, RoleTag, type Base } from "./shared";
import { canManageBoard, suspended, type ActivityKind, type CommunityNotification } from "./types";

export function CommunityAccount({ c, go, notifications = false, params }: Base & { notifications?: boolean; params: URLSearchParams }) {
  const requested = params.get("tab") || "posts";
  const tab = ["posts", "comments", "saved", "reports", "blocked", "settings"].includes(requested) ? requested : "posts";
  const settings = tab === "settings" || tab === "blocked";
  const returnTo = personalReturnPath(params);
  const list = (notifications ? "/notifications" : "/account") + (params.size ? "?" + params : "");
  const changeTab = (nextTab: string) => {
    const next = new URLSearchParams(params); next.set("tab", nextTab); next.delete("page");
    go("/account?" + next, true);
  };
  useEffect(() => {
    if (!notifications && tab === "saved") go(personalEntryPath("/saved?tab=posts", list), true, false, true);
  }, [notifications, tab, list, go]);
  useEffect(() => { if (notifications && c.profile) void c.refreshLatest(); }, [notifications, c.profile?.id, c.refreshLatest]);
  const page = pageNumber(params.get("page"));
  const activityKind: ActivityKind | null = notifications ? "notifications" : tab === "posts" || tab === "comments" ? tab : null;
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const run = async (fn: () => Promise<unknown>) => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError("");
    try { await fn(); } catch (e) { setError(errorText(e)); }
    finally { pending.current = false; setBusy(false); }
  };
  const changePage = (nextPage: number) => {
    const next = new URLSearchParams(params); next.set("page", String(nextPage));
    go((notifications ? "/notifications?" : "/account?") + next);
  };
  const a = c.account;
  return <main className="community-account personal-renewed" data-community-ready={!activityKind && !c.loading && !!a}>
    <Header title={notifications ? "알림" : settings ? "내 설정" : "내 활동"} go={go} backLabel={listReturnLabel(returnTo)} onBack={() => go(returnTo, false, false, true)} />
    {c.loading ? <LoadingState>내 정보를 불러오는 중</LoadingState>
    : c.error && !a ? <ErrorState message={c.error} retry={() => void c.refreshLatest()} />
    : !a ? <LoginGate c={c} go={go}><span /></LoginGate>
    : <>
      {notifications ? <>
        <div className="community-section-heading">
          <h2>내 글과 댓글의 새 소식</h2>
          <button disabled={busy || !a.unreadNotificationCount} onClick={() => void run(() => c.action("read_notifications", {}))}>모두 읽음</button>
        </div>
        <ActivityList key={`${a.profile.id}/notifications/${page}`} c={c} go={go} kind="notifications" page={page} changePage={changePage} busy={busy}
          openNotification={(n: CommunityNotification) => void run(async () => {
            if (!n.read) await c.action("read_notifications", { id: n.id });
            go(withList(commentPath(n.postId, n.commentId), list));
          })} />
      </> : <>
        {settings && <section className="community-profile personal-profile-summary">
          <span className="community-avatar community-own-avatar">{a.profile.nickname[0]}{a.avatarUrl && <img src={a.avatarUrl} alt="내 프로필 사진" referrerPolicy="no-referrer" onError={event => { event.currentTarget.hidden = true; }} />}</span>
          <div><h1>{a.profile.nickname}</h1><RoleTag role={a.profile.role} />{affiliationLabel(a.profile) && <p>{affiliationLabel(a.profile)}</p>}</div>
        </section>}
        {suspended(a.profile) && <p className="community-restriction">이용 제한 · {localDate(a.profile.suspendedUntil!)}까지<br />{a.profile.suspensionReason}</p>}
        {!settings && <div className="community-categories community-account-tabs" role="group" aria-label="내 활동 분류">
          {[["posts", "내 글"], ["comments", "내 댓글"], ["reports", "문제 알린 내역"]].map(([id, label]) => <Button key={id} variant="ghost" className={tab === id ? "chosen" : ""} aria-pressed={tab === id} onPress={() => changeTab(id)}>{label}</Button>)}
        </div>}
        {activityKind && <ActivityList key={`${a.profile.id}/${activityKind}/${page}`} c={c} go={go} kind={activityKind} page={page} changePage={changePage} busy={busy} openNotification={() => {}} />}
        {tab === "reports" && (a.reports.length ? a.reports.map(r => <div className="community-my-report" key={r.id}>
          <span className="community-status">{r.status === "open" ? "확인 대기" : r.status === "resolved" ? "조치 완료" : "검토 완료"}</span>
          <strong>{r.title}</strong><p>{localDate(r.date)} · {r.reason}</p>
          {r.detail && <p>{r.detail}</p>}{r.resolution && <p>처리 결과: {r.resolution}</p>}
          <Button variant="ghost" onPress={() => go(withList(commentPath(r.postId, r.commentId), list))}>원문 보기</Button>
        </div>) : <Empty title="문제를 알린 내역이 없어요">글이나 댓글의 더보기 메뉴에서 문제를 알려주시면 여기에서 처리 결과를 확인할 수 있어요.</Empty>)}
        {tab === "settings" && <ProfileSettings key={a.profile.id} c={c} go={go} list={list} />}
        {settings && !!a.blocked.length && <section className="personal-legacy-blocks">
          <h2>이전에 숨긴 회원</h2><p className="community-help">예전에 숨긴 회원의 글과 댓글을 다시 표시할 수 있어요.</p>
          {a.blocked.map(p => <div className="community-blocked" key={p.id}><strong>{p.nickname}</strong><Button variant="outline" size="sm" isDisabled={busy} onPress={() => void run(() => c.action("block", { userId: p.id, value: false }, "숨김을 해제했어요."))}>숨김 해제</Button></div>)}
        </section>}
        {tab === "blocked" && <Button variant="ghost" onPress={() => changeTab("settings")}>내 설정으로 돌아가기</Button>}
        {settings && canManageBoard(a.profile) && <div className="community-admin-door"><Button variant="outline" fullWidth onPress={() => go(adminEntryPath(list))}><ShieldCheck size={18} />관리자 페이지</Button></div>}
        {settings && <div className="personal-account-bottom"><Button variant="ghost" isDisabled={busy} onPress={() => {
          if (allowCommunityLeave()) void run(async () => { await c.logout(); go(returnTo, false, false, true); });
        }}><LogOut size={17} />{busy ? "처리 중…" : "로그아웃"}</Button></div>}
      </>}
      <ErrorLine text={error || c.error} />
    </>}
    <PreviewNote c={c} go={go} />
  </main>;
}
