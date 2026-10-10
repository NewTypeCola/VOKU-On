import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode, type RefObject } from "react";
import { Button, Modal } from "@heroui/react";
import { Bell, Bookmark, ChevronRight, FileText, ShieldCheck, UserRound, X } from "lucide-react";
import type { Community } from "./community/useCommunity";
import { affiliationLabel } from "./community/affiliation";
import { roleLabel, staff } from "./community/types";
import "./menu.css";

// Transform the real page, retaining its DOM, scroll position, and reading state.
export function MenuSurface({ open, children }: { open: boolean; children: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!open || !frame.current || !surface.current) return;
    const measure = () => {
      if (!frame.current || !surface.current) return;
      const offset = Math.max(0, -frame.current.getBoundingClientRect().top);
      surface.current.style.setProperty("--menu-scroll-offset", `${offset}px`);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [open]);
  return (
    <div className="app-frame" ref={frame}>
      <div className="app-shell" ref={surface} data-menu-open={open || undefined} inert={open}>
        {children}
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
};

export default function SiteMenu({ open, setOpen, triggerRef, community: c, currentPath, currentRoute, go, about }: Props) {
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
    const close = () => setOpen(false);
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
  const visit = (path: string) => {
    setOpen(false);
    // Re-selecting the current screen just closes the menu without resetting scroll.
    if ("#" + path !== currentRoute) go(path);
  };
  const link = (path: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    visit(path);
  };
  const unread = c.account?.notifications.filter((item) => !item.read).length || 0;
  const affiliation = c.profile ? affiliationLabel(c.profile) : "";
  const profilePath = c.profile ? "/account?tab=settings" : `/auth?next=${encodeURIComponent(currentRoute.slice(1))}`;

  return (
    <Modal.Backdrop isOpen={open} onOpenChange={(next) => next ? setOpen(true) : dismiss()} variant="transparent" className="site-menu-backdrop">
      <Modal.Container size="full" placement="center" className="site-menu-container">
        <Modal.Dialog className="site-menu-dialog" id="site-menu" aria-label="전체 메뉴">
          <button type="button" className="menu-page-return" aria-label="메뉴 닫고 본문으로 돌아가기" tabIndex={-1} onClick={dismiss} />
          <div className="site-menu-panel">
            <header className="site-menu-header">
              <Modal.Heading>전체 메뉴</Modal.Heading>
              <Modal.CloseTrigger className="site-menu-close" aria-label="메뉴 닫기" autoFocus><X size={23} /></Modal.CloseTrigger>
            </header>
            <div className="site-menu-scroll">
              <Button variant="ghost" className={`site-menu-profile ${c.profile ? "" : "is-guest"}`} isDisabled={c.loading} onPress={() => visit(profilePath)}
                aria-label={c.profile ? `${c.profile.nickname} · 내 정보 수정` : "로그인 / 회원가입"}>
                <span className="site-menu-avatar" aria-hidden="true">
                  {c.profile?.nickname[0] || <UserRound size={22} />}
                  {visibleAvatar && visibleAvatar === avatarUrl && <img src={visibleAvatar} alt="" referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.hidden = true; }} />}
                </span>
                <span className="site-menu-profile-text">
                  <strong>{c.loading ? "불러오는 중" : c.profile?.nickname || "로그인 / 회원가입"}</strong>
                  <small>{c.profile ? affiliation || "내 정보 수정" : "이야기를 나누려면 로그인"}</small>
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
                {c.profile && <a href="#/account" onClick={link("/account")}><FileText size={19} aria-hidden="true" /><span>내 활동</span></a>}
                <a href="#/saved" onClick={link("/saved")}><Bookmark size={19} aria-hidden="true" /><span>저장한 글·자료</span></a>
                {c.profile && <a href="#/notifications" onClick={link("/notifications")}>
                  <Bell size={19} aria-hidden="true" /><span>알림</span>
                  {unread > 0 && <span className="site-menu-unread" aria-label={`읽지 않은 알림 ${unread}개`}>{unread > 99 ? "99+" : unread}</span>}
                </a>}
              </nav>

              {staff(c.profile) && <nav className="site-menu-staff" aria-label="운영 메뉴">
                <a href="#/admin" onClick={link("/admin")}><ShieldCheck size={19} aria-hidden="true" /><span>운영 관리</span><small>{roleLabel(c.profile!.role)}</small></a>
              </nav>}

              <div className="site-menu-bottom">
                <button type="button" onClick={() => { setOpen(false); about(); }}>이용 안내 · 자료 출처<ChevronRight size={14} aria-hidden="true" /></button>
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
