import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode, type RefObject } from "react";
import { Button, Modal } from "@heroui/react";
import { Bell, Bookmark, ChevronRight, FileText, LogOut, Settings, ShieldCheck, UserRound, X } from "lucide-react";
import type { Community } from "./community/useCommunity";
import { affiliationLabel } from "./community/affiliation";
import { canManageBoard } from "./community/types";
import { adminEntryPath, personalEntryPath } from "./community/navigation";
import { errorText } from "./community/client";
import { allowCommunityLeave } from "./community/navigationGuard";
import "./menu.css";
import { studyEnabled } from "./ux/tracker";

// Move a viewport-sized layer, not the full length of a board or archive page.
// The real content stays mounted, including inputs and the current reading state.
export function MenuSurface({ open, currentRoute, covered = false, children }: { open: boolean; currentRoute: string; covered?: boolean; children: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const previousRoute = useRef(currentRoute);
  useLayoutEffect(() => {
    const page = frame.current, view = viewport.current;
    if (!page || !view) return;
    const restore = () => {
      delete view.dataset.menuOpen;
      delete view.dataset.menuActive;
      page.style.removeProperty("height");
      view.style.removeProperty("top");
      view.scrollTop = 0;
    };
    // Let route restoration use the new page's natural height immediately.
    if (previousRoute.current !== currentRoute || covered) {
      previousRoute.current = currentRoute;
      restore();
      return;
    }
    let animationFrame = 0;
    let fallback = 0;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finish = (event: TransitionEvent) => {
      if (event.target === view && event.propertyName === "transform") restore();
    };
    if (open) {
      if (!view.dataset.menuActive) {
        const bounds = page.getBoundingClientRect();
        const offset = Math.max(0, -bounds.top);
        page.style.height = `${bounds.height}px`;
        view.style.top = `${offset}px`;
        view.dataset.menuActive = "true";
        view.scrollTop = offset;
      }
      if (reduced) view.dataset.menuOpen = "true";
      else {
        // Allow the bounded layer to be painted before its compositor transition.
        animationFrame = requestAnimationFrame(() => {
          animationFrame = requestAnimationFrame(() => { view.dataset.menuOpen = "true"; });
        });
      }
    } else if (view.dataset.menuActive) {
      if (reduced || !view.dataset.menuOpen) restore();
      else {
        delete view.dataset.menuOpen;
        view.addEventListener("transitionend", finish);
        fallback = window.setTimeout(restore, parseFloat(getComputedStyle(view).transitionDuration) * 1000 + 100);
      }
    }
    return () => {
      cancelAnimationFrame(animationFrame);
      clearTimeout(fallback);
      view.removeEventListener("transitionend", finish);
    };
  }, [open, currentRoute, covered]);
  return (
    <div className="app-frame" ref={frame}>
      <div className="menu-page-viewport" ref={viewport}>
        <div className="app-shell" inert={open}>
          {children}
        </div>
      </div>
    </div>
  );
}

type Props = {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
  community: Community;
  currentPath: string;
  currentRoute: string;
  go: (path: string) => void;
  about: () => void;
  notify: (message: string) => void;
};

export default function SiteMenu({ open, setOpen, triggerRef, community: c, currentPath, currentRoute, go, about, notify }: Props) {
  const [skipExit, setSkipExit] = useState(false);
  useLayoutEffect(() => { if (open) setSkipExit(false); }, [open]);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const logoutPending = useRef(false);
  const avatarUrl = c.account?.avatarUrl || "";
  const [preparedAvatar, setPreparedAvatar] = useState("");
  const [visibleAvatar, setVisibleAvatar] = useState("");
  useEffect(() => {
    if (!avatarUrl) return;
    let cancelled = false;
    const image = new Image();
    image.referrerPolicy = "no-referrer";
    image.src = avatarUrl;
    void image.decode().then(() => { if (!cancelled) setPreparedAvatar(avatarUrl); }).catch(() => {});
    return () => { cancelled = true; };
  }, [avatarUrl]);
  // Prepare the photo while closed; never swap a fallback for a photo mid-reveal.
  useLayoutEffect(() => {
    if (!open) setVisibleAvatar(preparedAvatar === avatarUrl ? preparedAvatar : "");
  }, [open, preparedAvatar, avatarUrl]);

  // A browser history action should never leave an old menu over a new screen.
  useEffect(() => {
    if (!open) return;
    const close = () => { setSkipExit(true); setOpen(false); };
    window.addEventListener("hashchange", close);
    window.addEventListener("popstate", close);
    return () => {
      window.removeEventListener("hashchange", close);
      window.removeEventListener("popstate", close);
    };
  }, [open, setOpen]);
  const dismiss = () => {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
  };
  const logout = async () => {
    if (logoutPending.current || !allowCommunityLeave()) return;
    logoutPending.current = true;
    setLoggingOut(true);
    setLogoutError("");
    try {
      await c.logout();
      dismiss();
      notify("로그아웃했어요.");
    } catch (error) {
      setLogoutError(errorText(error));
    } finally {
      logoutPending.current = false;
      setLoggingOut(false);
    }
  };
  const visit = (path: string) => {
    // Re-selecting the current screen just closes the menu without resetting scroll.
    if ("#" + path === currentRoute) { dismiss(); return; }
    if (!allowCommunityLeave()) return;
    setSkipExit(true);
    setOpen(false);
    go(path);
  };
  const link = (path: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    visit(path);
  };
  const unread = c.account?.unreadNotificationCount || 0;
  const affiliation = c.profile ? affiliationLabel(c.profile) : "";
  const personalPath = (path: string) => personalEntryPath(path, currentRoute.slice(1));
  const profilePath = c.profile ? personalPath("/account") : `/auth?next=${encodeURIComponent(currentRoute.slice(1))}`;

  // Destination screens/dialogs must never wait for the menu's closing animation.
  if (skipExit && !open) return null;
  return (
    <Modal.Backdrop isOpen={open} onOpenChange={(next) => next ? setOpen(true) : dismiss()} variant="transparent" className="site-menu-backdrop">
      <Modal.Container size="full" placement="center" className="site-menu-container">
        <Modal.Dialog className="site-menu-dialog" id="site-menu" aria-label="전체 메뉴">
          <button type="button" className="menu-page-return" aria-label="메뉴 닫고 본문으로 돌아가기" tabIndex={-1} onClick={dismiss} />
          <header className="site-menu-header">
            <Modal.Heading>{studyEnabled ? "UX 테스트 버전" : "VOKU On"}</Modal.Heading>
            <Modal.CloseTrigger className="site-menu-close" aria-label="메뉴 닫기" autoFocus><X size={23} /></Modal.CloseTrigger>
          </header>
          <div className="site-menu-panel">
            <div className="site-menu-scroll">
              <Button variant="ghost" className={`site-menu-profile ${c.profile ? "" : "is-guest"}`} isDisabled={c.loading} onPress={() => visit(profilePath)}
                aria-label={c.profile ? `${c.profile.nickname} · 내 프로필` : "로그인 / 회원가입"}>
                <span className="site-menu-avatar" aria-hidden="true">
                  {c.profile?.nickname[0] || <UserRound size={22} />}
                  {visibleAvatar && visibleAvatar === avatarUrl && <img src={visibleAvatar} alt="" referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.hidden = true; }} />}
                </span>
                <span className="site-menu-profile-text">
                  <strong>{c.loading ? "불러오는 중" : c.profile?.nickname || "로그인 / 회원가입"}</strong>
                  <small>{c.profile ? <>{affiliation && <>{affiliation}<br /></>}내 프로필</> : "이야기를 나누려면 로그인"}</small>
                </span>
                <ChevronRight size={17} aria-hidden="true" />
              </Button>

              <nav className="site-menu-primary" aria-label="주요 화면">
                {[["/home", "홈"], ["/archive", "큐시트 찾기"], ["/board", "커뮤니티"]].map(([path, label]) => (
                  <a key={path} href={`#${path}`} onClick={link(path)} aria-current={currentPath === path || (path === "/board" && currentPath === "/news") ? "page" : undefined}>
                    <span>{label}</span>
                  </a>
                ))}
              </nav>

              <nav className="site-menu-personal" aria-label="내 메뉴">
                {c.profile && <a href={"#" + personalPath("/account")} onClick={link(personalPath("/account"))}><FileText size={19} aria-hidden="true" /><span>내 활동</span></a>}
                <a href={"#" + personalPath("/saved")} onClick={link(personalPath("/saved"))}><Bookmark size={19} aria-hidden="true" /><span>저장한 글·자료</span></a>
                {c.profile && <a href={"#" + personalPath("/notifications")} onClick={link(personalPath("/notifications"))}>
                  <Bell size={19} aria-hidden="true" /><span>알림</span>
                  {unread > 0 && <span className="site-menu-unread" aria-label={`읽지 않은 알림 ${unread}개`}>{unread > 99 ? "99+" : unread}</span>}
                </a>}
                {c.profile && <a href={"#" + personalPath("/account?tab=settings")} onClick={link(personalPath("/account?tab=settings"))}><Settings size={19} aria-hidden="true" /><span>내 설정</span></a>}
                {c.account && <button type="button" onClick={logout} disabled={loggingOut} aria-busy={loggingOut}><LogOut size={19} aria-hidden="true" /><span>{loggingOut ? "로그아웃 중…" : "로그아웃"}</span></button>}
                {logoutError && <p className="site-menu-error" role="alert">{logoutError}</p>}
              </nav>

              {!c.loading && canManageBoard(c.profile) && <nav className="site-menu-staff" aria-label="게시판 관리">
                <a href={"#" + adminEntryPath(currentRoute.slice(1))} onClick={link(adminEntryPath(currentRoute.slice(1)))} aria-current={currentPath === "/admin" ? "page" : undefined}><ShieldCheck size={19} aria-hidden="true" /><span>관리자 페이지</span><ChevronRight size={17} aria-hidden="true" /></a>
              </nav>}

              <div className="site-menu-bottom">
                {studyEnabled && c.profile?.role === "admin" && <a href="#/ux-log" onClick={link("/ux-log")}>UX 방문 로그 보기<ChevronRight size={14} aria-hidden="true" /></a>}
                <button type="button" onClick={() => { setSkipExit(true); setOpen(false); about(); }}>이용 안내 · 자료 출처<ChevronRight size={14} aria-hidden="true" /></button>
                {!c.live && <>
                  <a href="#/auth" onClick={link("/auth")}>체험 계정 전환</a>
                  <small>커뮤니티 화면 체험 중</small>
                </>}
              </div>
            </div>
          </div>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
