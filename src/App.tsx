import {
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";
import {
  Button,
  Dropdown,
  Tabs,
  SearchField,
  Select,
  ListBox,
  Modal,
  TextField,
  Input,
  Label,
  TextArea,
  Chip,
  Spinner,
} from "@heroui/react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bookmark,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  Menu,
  Paperclip,
  Search,
  ThumbsUp,
  X,
  RotateCw,
  Share2,
  ExternalLink,
  Radio,
  Info,
} from "lucide-react";
import {
  categories,
  demoPosts,
  seedComments,
  loadState,
  persist,
  uid,
  dateLabel,
  recordLabel,
  normalize,
  filterArchive,
  getPages,
  emptyDraft,
  SOURCE,
  type ArchiveRecord,
  type Manifest,
  type Post,
  type Comment,
  type UserState,
  type Category,
  type CuePage,
} from "./data";

import TimeRing from "./TimeRing";
import { archiveCatalog } from "./archiveCatalog";
import { preloadTimeRing } from "./timeRingRuntime";
import BrandLogo from "./BrandLogo";
import SiteMenu, { MenuSurface } from "./SiteMenu";
import { useCommunity } from "./community/useCommunity";
import {
  api as communityApi,
  errorText as communityErrorText,
  live as communityLive,
} from "./community/client";
import {
  CommunityBoard,
  CommunityPostScreen,
  CommunityComposer,
  AuthScreen,
  CommunityAccount,
  CommunityAdmin,
} from "./community/Community";
import CuePageSurface from "./CuePageSurface";
import { episodeLink } from "./readerGeometry";
import { communityReturnPath, isCommunityList } from "./community/navigation";
import "./reader.css";

import { allowCommunityLeave } from "./community/navigationGuard";
import type { HomeSwipeDestination, HomeSwipeTarget } from "./home/tabSwipe";

const Home = lazy(() => import("./home/Home"));
const LocalPhotoPost = lazy(() => import("./home/LocalPhotoPost").then((module) => ({ default: module.LocalPhotoPost })));
const homeLoading = <div className="archive-loading" role="status"><Spinner size="sm" aria-label="홈을 불러오는 중" /></div>;

const positions = new Map<string, number>();
function go(path: string, replace = false, keepScroll = false, restoreScroll = false) {
  positions.set(location.hash, window.scrollY);
  const hash = "#" + path;
  if (keepScroll) positions.set(hash, window.scrollY);
  else if (!replace && !restoreScroll) positions.set(hash, 0);
  const communityReturn = communityReturnPath(location.hash.slice(1), history.state?.communityReturn);
  history[replace ? "replaceState" : "pushState"]({ voku: true, communityReturn }, "", hash);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}
function swipeNavigate(path: HomeSwipeDestination, scrollTop: number) {
  positions.set("#" + path, scrollTop);
  go(path, false, false, true);
}
function useRoute() {
  const [hash, setHash] = useState(location.hash || "#/home");
  const currentHash = useRef(hash);
  useEffect(() => {
    const previousRestoration = history.scrollRestoration;
    history.scrollRestoration = "manual";
    const update = () => {
      const nextHash = location.hash || "#/home";
      if (currentHash.current === nextHash) return;
      if (!allowCommunityLeave()) { history.replaceState(history.state, "", currentHash.current); return; }
      positions.set(currentHash.current, window.scrollY);
      currentHash.current = nextHash;
      setHash(currentHash.current);
    };
    window.addEventListener("hashchange", update);
    window.addEventListener("popstate", update);
    return () => {
      window.removeEventListener("hashchange", update);
      window.removeEventListener("popstate", update);
      history.scrollRestoration = previousRestoration;
    };
  }, []);
  useLayoutEffect(() => {
    const top = positions.get(hash) || 0;
    // A lazy screen and its asynchronous list must exist before restoring scroll.
    const waitsForList = top > 0 && isCommunityList(hash.slice(1));
    let frame = 0;
    let observer: MutationObserver | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const stop = () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      clearTimeout(timeout);
      for (const event of ["wheel", "touchstart", "pointerdown", "keydown"]) window.removeEventListener(event, stop);
    };
    const restore = () => {
      if (waitsForList && !document.querySelector('[data-community-ready="true"]')) return;
      window.scrollTo({ top, behavior: "instant" });
      stop();
    };
    if (waitsForList) {
      observer = new MutationObserver(() => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(restore);
      });
      observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-community-ready"] });
      timeout = setTimeout(stop, 15000);
      for (const event of ["wheel", "touchstart", "pointerdown", "keydown"]) window.addEventListener(event, stop, { passive: true });
    }
    frame = requestAnimationFrame(restore);
    return stop;
  }, [hash]);
  const [path, query = ""] = hash.slice(1).split("?");
  return { path, params: new URLSearchParams(query), hash };
}
const back = (fallback = "/home") => {
  if (history.state?.voku) history.back();
  else go(fallback);
};

function IconButton({
  label,
  children,
  onPress,
  active = false,
  expanded,
  controls,
  buttonRef,
}: {
  label: string;
  children: ReactNode;
  onPress: () => void;
  active?: boolean;
  expanded?: boolean;
  controls?: string;
  buttonRef?: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <Button
      isIconOnly
      variant="ghost"
      className={`icon-button ${active ? "active" : ""}`}
      aria-label={label}
      aria-expanded={expanded}
      aria-controls={controls}
      aria-haspopup={controls ? "dialog" : undefined}
      ref={buttonRef}
      onPress={onPress}
    >
      {children}
    </Button>
  );
}
function SearchBox({
  value,
  onChange,
  label,
  autoFocus = false,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  autoFocus?: boolean;
}) {
  return (
    <SearchField
      aria-label={label}
      value={value}
      onChange={onChange}
      className="search-box"
    >
      <SearchField.Group>
        <SearchField.SearchIcon />
        <SearchField.Input placeholder={label} autoFocus={autoFocus} />
        <SearchField.ClearButton aria-label="검색어 지우기" />
      </SearchField.Group>
    </SearchField>
  );
}
function Picker({
  label,
  value,
  onChange,
  options,
  visibleLabel = false,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  options: { id: string; label: string }[];
  visibleLabel?: boolean;
  disabled?: boolean;
}) {
  return (
    <Select
      aria-label={label}
      value={value || "all"}
      onChange={(v) => onChange(String(v) === "all" ? "" : String(v))}
      className="picker"
      isDisabled={disabled}
    >
      {visibleLabel && <Label>{label}</Label>}
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover className="picker-popover">
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
function Dialog({
  title,
  open,
  onClose,
  children,
  className = "",
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Modal.Backdrop
      isOpen={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <Modal.Container placement="center" size="sm">
        <Modal.Dialog className={`voku-dialog ${className}`}>
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
function Empty({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <Search size={28} />
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}
function Footer({
  about,
  reader = false,
  headerRef,
}: {
  about: () => void;
  reader?: boolean;
  headerRef?: RefObject<HTMLElement | null>;
}) {
  const [headerVisible, setHeaderVisible] = useState(Boolean(headerRef));
  useLayoutEffect(() => {
    const header = headerRef?.current;
    if (!header) return;
    const bounds = header.getBoundingClientRect();
    setHeaderVisible(bounds.bottom > 0 && bounds.top < window.innerHeight);
    const observer = new IntersectionObserver(([entry]) => {
      setHeaderVisible(entry.isIntersecting);
    });
    observer.observe(header);
    return () => observer.disconnect();
  }, [headerRef]);

  return (
    <footer
      className="site-footer"
      data-header-visible={headerVisible || undefined}
      aria-hidden={headerVisible || undefined}
      inert={headerVisible}
    >
      <BrandLogo onHome={() => go("/home")} small />
      <button className="footer-info" onClick={about}>
        {reader ? "권리·출처 안내" : "이용 안내 · 자료 출처"}
      </button>
      {!communityLive && <span className="footer-note">커뮤니티 화면 체험 중</span>}
    </footer>
  );
}

export default function App() {
  const route = useRoute();
  const { catalog, manifest, error } = useSyncExternalStore(archiveCatalog.subscribe, archiveCatalog.getSnapshot);
  const needsArchive = !["/home", "/board", "/news", "/auth", "/account", "/notifications", "/admin"].includes(route.path)
    && !route.path.startsWith("/post/") && !route.path.startsWith("/home-example/");
  const [user, setUser] = useState(loadState);
  const [notice, setNotice] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [archiveYear, setArchiveYear] = useState(2019);
  const [infoOpen, setInfoOpen] = useState(false);
  const [swipeTarget, setSwipeTarget] = useState<HomeSwipeTarget | null>(null);
  const siteHeaderRef = useRef<HTMLElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const community = useCommunity(setNotice);
  useEffect(() => {
    if (community.recovery && route.path !== "/auth") go("/auth?mode=reset");
    else if (community.profile?.profileComplete === false && route.path !== "/auth")
      go(`/auth?mode=profile&next=${encodeURIComponent(route.path + (route.params.size ? "?" + route.params.toString() : ""))}`, true);
  }, [community.recovery, community.profile?.profileComplete, route.path, route.params]);
  const storageFailed = useRef(false);
  useEffect(() => {
    if (needsArchive || swipeTarget === "archive") void archiveCatalog.load();
  }, [needsArchive, swipeTarget]);
  useEffect(() => {
    if (!persist(user) && !storageFailed.current) {
      storageFailed.current = true;
      setNotice("저장 공간이 부족해 변경 내용이 유지되지 않을 수 있어요.");
    }
  }, [user]);
  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(""), 3800);
    return () => clearTimeout(t);
  }, [notice]);
  const posts = community.homePosts;
  const comments = (id: string): Comment[] =>
    community.live ? [] : seedComments(id);
  const toggle = (key: "saved" | "likes", id: string) => {
    const exists = user[key].includes(id);
    setUser((s) => ({
      ...s,
      [key]: exists ? s[key].filter((x) => x !== id) : [...s[key], id],
    }));
    if (key === "saved")
      setNotice(exists ? "저장을 해제했어요." : "저장한 글·자료에 담았어요.");
  };
  const recordId = route.path.startsWith("/read/")
    ? decodeURIComponent(route.path.slice(6))
    : "";
  const record = catalog.find((r) => r.id === recordId);
  const post = route.path.startsWith("/post/")
    ? posts.find((p) => p.id === route.path.slice(6))
    : null;
  const homeExampleId = route.path.startsWith("/home-example/") ? route.path.slice("/home-example/".length) : "";
  const readerHomeReturn = route.params.get("list") || "";
  const detail =
    !!recordId ||
    !!homeExampleId ||
    route.path.startsWith("/post/") ||
    route.path === "/write" ||
    route.path === "/search" ||
    route.path === "/saved" ||
    ["/auth", "/account", "/notifications", "/admin"].includes(route.path);
  const tab =
    route.path === "/archive"
      ? "archive"
      : ["/board", "/news"].includes(route.path)
        ? "board"
        : "home";
  useLayoutEffect(() => { if (tab !== "home" || detail) setSwipeTarget(null); }, [tab, detail]);
  useEffect(() => {
    // The thread owns its title after loading, including posts outside the home feed.
    if (route.path.startsWith("/post/")) return;
    document.title = `${record?.title || post?.title || { "/saved": "저장한 글·자료", "/write": "글쓰기", "/auth": "로그인·회원가입", "/account": "내 정보", "/notifications": "알림", "/admin": "관리자 페이지", "/search": "통합 검색" }[route.path] || { archive: "큐시트 찾기", board: "커뮤니티", home: "홈" }[tab]} · VOKU On`;
  }, [record, post, tab, route.path]);
  // Warm the optional 3D module after the first screen, before the archive is opened.
  // Readers keep the network available for their first scan.
  useEffect(() => {
    if (detail || tab !== "home" || !manifest) return;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || "")) return;
    const warm = () => { void preloadTimeRing().catch(() => {}); };
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(warm, { timeout: 1500 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(warm, 700);
    return () => window.clearTimeout(id);
  }, [detail, tab, manifest]);
  const openRecord = (r: ArchiveRecord) => go("/read/" + r.id);

  return (
    <MenuSurface open={menuOpen}>
      {!detail && (
        <header className="site-header" ref={siteHeaderRef}>
          <BrandLogo onHome={() => go("/home")} />
          <div className="header-actions">
            <IconButton label="통합 검색" onPress={() => go("/search")}>
              <Search size={23} />
            </IconButton>
            <IconButton label="전체 메뉴" onPress={() => setMenuOpen(true)} expanded={menuOpen} controls="site-menu" buttonRef={menuTriggerRef}>
              <Menu size={25} />
            </IconButton>
          </div>
        </header>
      )}
      {needsArchive && route.path !== "/archive" && error ? (
        <Empty
          title={error}
          body="인터넷 연결을 확인한 후 다시 시도해 주세요."
          action={
            <Button onPress={() => void archiveCatalog.load()}>다시 시도</Button>
          }
        />
      ) : needsArchive && route.path !== "/archive" && !manifest ? (
        <div className="loading">
          <Spinner />
          <p>방송의 기록을 불러오는 중</p>
        </div>
      ) : detail ? (
        <>
          {recordId &&
            (record ? (
              <Reader
                key={record.id}
                record={record}
                manifest={manifest!}
                user={user}
                toggle={() => toggle("saved", record.id)}
                updateProgress={(n) =>
                  setUser((s) =>
                    s.progress[record.id] === n
                      ? s
                      : { ...s, progress: { ...s.progress, [record.id]: n } },
                  )
                }
                about={() => setInfoOpen(true)}
                notify={setNotice}
                returnPostId={route.params.get("from") || undefined}
                returnHomePath={/^\/home(?:\?|$)/.test(readerHomeReturn) ? readerHomeReturn : undefined}
              />
            ) : (
              <Empty
                title="자료를 찾을 수 없어요"
                body="아카이브에서 다른 원고를 찾아보세요."
                action={
                  <Button onPress={() => go("/archive")}>아카이브</Button>
                }
              />
            ))}
          {route.path.startsWith("/post/") && (
            <CommunityPostScreen
              key={route.path}
              c={community}
              go={go}
              notify={setNotice}
              id={route.path.slice(6)}
              catalog={catalog}
              params={route.params}
              returnTo={history.state?.communityReturn}
            />
          )}
          {homeExampleId && <Suspense fallback={homeLoading}><LocalPhotoPost key={homeExampleId} id={homeExampleId} go={go} params={route.params} /></Suspense>}
          {route.path === "/auth" && (
            <AuthScreen
              c={community}
              go={go}
              notify={setNotice}
              params={route.params}
            />
          )}
          {route.path === "/account" && (
            <CommunityAccount c={community} go={go} notify={setNotice} params={route.params} />
          )}
          {route.path === "/notifications" && (
            <CommunityAccount
              c={community}
              go={go}
              notify={setNotice}
              notifications
              params={route.params}
            />
          )}
          {route.path === "/admin" && (
            <CommunityAdmin c={community} go={go} notify={setNotice} params={route.params} />
          )}
          {route.path === "/saved" && (
            <>
              <DetailHeader title="저장한 글·자료" />
              <Saved
                catalog={catalog}
                posts={community.account?.saved || []}
                user={{
                  ...user,
                  saved: [
                    ...user.saved.filter((id) => id.startsWith("voku_")),
                    ...(community.account?.saved.map((p) => p.id) || []),
                  ],
                }}
                openRecord={openRecord}
                comments={comments}
              />
            </>
          )}
          {route.path === "/write" && (
            <CommunityComposer
              c={community}
              go={go}
              notify={setNotice}
              catalog={catalog}
              params={route.params}
            />
          )}
          {route.path === "/search" && (
            <GlobalSearch catalog={catalog} openRecord={openRecord} />
          )}
        </>
      ) : (
        <>
          <Tabs
            selectedKey={tab}
            onSelectionChange={(key) => go("/" + String(key))}
            variant="secondary"
            className="site-tabs"
            data-home-swipe-target={tab === "home" ? swipeTarget || undefined : undefined}
          >
            <Tabs.ListContainer className="site-tab-container">
              <Tabs.List aria-label="주요 메뉴">
                {[
                  ["archive", "큐시트 찾기"],
                  ["home", "홈"],
                  ["board", "커뮤니티"],
                ].map(([id, label]) => (
                  <Tabs.Tab key={id} id={id}
                    onPointerEnter={id === "archive" ? () => { void preloadTimeRing().catch(() => {}); } : undefined}
                    onFocus={id === "archive" ? () => { void preloadTimeRing().catch(() => {}); } : undefined}
                  >
                    {label}
                    <Tabs.Indicator />
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs.ListContainer>
            <Tabs.Panel id="home" data-home-tab-panel="home">
              <Suspense fallback={homeLoading}>
              <Home
                key={community.profile?.id || "visitor"}
                c={community}
                go={go}
                params={route.params}
                swipePreview={setSwipeTarget}
                swipeNavigate={swipeNavigate}
              />
              </Suspense>
            </Tabs.Panel>
            <Tabs.Panel id="archive" data-home-tab-panel="archive" shouldForceMount={tab === "home" && swipeTarget === "archive"}>
              {manifest ? <Archive
                catalog={catalog}
                manifest={manifest!}
                route={tab === "archive" ? route : { path: "/archive", params: new URLSearchParams(), hash: "#/archive" }}
                saved={user.saved}
                openRecord={openRecord}
                focusedYear={archiveYear}
                onFocusYear={setArchiveYear}
                menuOpen={menuOpen}
              /> : error ? <Empty title={error} body="인터넷 연결을 확인한 후 다시 시도해 주세요."
                action={<Button onPress={() => void archiveCatalog.load()}>다시 시도</Button>} />
                : <div className="loading"><Spinner /><p>방송의 기록을 불러오는 중</p></div>}
            </Tabs.Panel>
            <Tabs.Panel id="board" data-home-tab-panel="board" shouldForceMount={tab === "home" && swipeTarget === "board"}>
              <CommunityBoard
                c={community}
                go={go}
                notify={setNotice}
                catalog={catalog}
                params={tab === "board" ? route.params : new URLSearchParams()}
              />
            </Tabs.Panel>
          </Tabs>
          <Footer about={() => setInfoOpen(true)} headerRef={siteHeaderRef} />
        </>
      )}

      <SiteMenu
        open={menuOpen}
        setOpen={setMenuOpen}
        triggerRef={menuTriggerRef}
        community={community}
        currentPath={route.path}
        currentRoute={route.hash}
        go={go}
        about={() => setInfoOpen(true)}
      />
      <Dialog
        title="VOKU On 이용 안내"
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
      >
        <div className="info-body">
          <p>
            VOKU의 방송 원고를 읽고, 그때와 지금의 이야기를 나누는 공간입니다.
          </p>
          <h3>실제 아카이브 자료</h3>
          <p>
            1988–2019년의 큐시트·방송 원고 5,330건을 연결했습니다. 자료는 VOKU
            Archive의 공개 이미지이며, 세로로 이어 읽을 수 있습니다.
          </p>
          <a href={SOURCE} target="_blank" rel="noreferrer">
            Hugging Face에서 원본 보기 <ExternalLink size={14} />
          </a>
          <h3>
            {community.live ? "회원 커뮤니티" : "커뮤니티는 화면 체험 중이에요"}
          </h3>
          <p>
            {community.live
              ? "커뮤니티 글·댓글·추천·스크랩은 로그인 계정에 연결해 서버에 저장됩니다. 운영진은 공지와 신고, 이용 제한을 관리합니다. 큐시트 책갈피와 읽던 위치는 이 브라우저에 저장됩니다."
              : "예시 계정으로 회원과 운영자의 기능을 확인하는 화면 체험입니다. 예시 글·댓글과 작성한 체험 데이터는 이 브라우저에만 저장되며 실제 계정이 만들어지거나 다른 사용자에게 전송되지 않습니다."}
          </p>
          <h3>자료 출처와 권리</h3>
          <p>
            자료 출처: VOKU Archive. 공개 페이지의 Viewer 미리보기를 변경 없이
            표시합니다. CC BY 4.0의 적용 범위와 원고의 별도 권리는 원본 고지를
            따릅니다.
          </p>
          <a
            href="/licenses/VOKU-Archive-rights.md"
            target="_blank"
            rel="noreferrer"
          >
            자료의 권리·출처 고지 <ExternalLink size={14} />
          </a>
        </div>
      </Dialog>
      <div
        role="status"
        aria-live="polite"
        className={`toast ${notice ? "show" : ""}`}
      >
        {notice && (
          <>
            <Check size={17} />
            {notice}
          </>
        )}
      </div>
    </MenuSurface>
  );
}

function PostRow({
  post: p,
  count,
  record,
}: {
  post: Post;
  count: number;
  record?: ArchiveRecord;
}) {
  const label = p.recordId
    ? "자료 이야기"
    : p.category === "동문소식"
      ? "동문소식"
      : p.category === "질문"
        ? "질문"
        : "자유글";
  return (
    <article className="post-row">
      <a
        className="post-link"
        href={"#/post/" + p.id}
        onClick={(e) => {
          e.preventDefault();
          go("/post/" + p.id);
        }}
      >
        <div className="row-kicker">
          <span>{label}</span>
          {p.demo && <span>예시</span>}
        </div>
        <div className="post-title">
          {p.title}
          {count > 0 && (
            <span className="comment-count" aria-label={`댓글 ${count}개`}>
              [{count}]
            </span>
          )}
        </div>
        <div className="post-meta">
          <span>{p.author}</span>
          <i />
          {dateLabel(p.date)}
        </div>
      </a>
      {record && (
        <button className="row-record" onClick={() => go("/read/" + record.id)}>
          <FileText size={14} />
          <span>
            {record.year} · {record.title} {record.issue}회
          </span>
          <ChevronRight size={14} />
        </button>
      )}
    </article>
  );
}

function Archive({
  catalog,
  manifest,
  route,
  saved,
  openRecord,
  focusedYear,
  onFocusYear,
  menuOpen,
}: {
  catalog: ArchiveRecord[];
  manifest: Manifest;
  route: ReturnType<typeof useRoute>;
  saved: string[];
  openRecord: (r: ArchiveRecord) => void;
  focusedYear: number;
  onFocusYear: (year: number) => void;
  menuOpen: boolean;
}) {
  const query = route.params.get("q") || "";
  const year = route.params.get("year") || "";
  const term = route.params.get("term") || "";
  const program = route.params.get("program") || "";
  const update = (
    values: Record<string, string>,
    replace = false,
    keepScroll = false,
  ) => {
    const next = new URLSearchParams(route.params);
    next.delete("page");
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const destination = "/archive" + (next.size ? "?" + next : "");
    if (values.page) {
      const top =
        document.querySelector(".archive-results")?.getBoundingClientRect()
          .top || 0;
      positions.set("#" + destination, Math.max(0, top + window.scrollY - 56));
    } else if (!keepScroll) {
      positions.set("#" + destination, 0);
    }
    go(destination, replace, keepScroll);
  };
  const inYear = useMemo(
    () => filterArchive(catalog, "", year),
    [catalog, year],
  );
  const inTerm = useMemo(
    () => filterArchive(catalog, "", year, term),
    [catalog, year, term],
  );
  const programs = useMemo(() => {
    const grouped = new Map<
      string,
      { slug: string; title: string; count: number }
    >();
    for (const record of inTerm) {
      const entry = grouped.get(record.slug);
      if (entry) entry.count++;
      else
        grouped.set(record.slug, {
          slug: record.slug,
          title: record.title,
          count: 1,
        });
    }
    return [...grouped.values()].sort((a, b) =>
      a.title.localeCompare(b.title, "ko"),
    );
  }, [inTerm]);
  useEffect(() => {
    if (year && manifest.years.includes(Number(year)))
      onFocusYear(Number(year));
  }, [year, manifest.years, onFocusYear]);
  const selectedProgram = programs.find((p) => p.slug === program);
  const all = useMemo(
    () =>
      filterArchive(catalog, query, year, term, program).sort(
        (a, b) =>
          b.year - a.year ||
          b.term - a.term ||
          a.title.localeCompare(b.title, "ko") ||
          a.issue.localeCompare(b.issue, "ko", { numeric: true }),
      ),
    [catalog, query, year, term, program],
  );
  const currentPage = Math.min(
    Math.max(1, Number(route.params.get("page")) || 1),
    Math.max(1, Math.ceil(all.length / 20)),
  );
  const maxPage = Math.max(1, Math.ceil(all.length / 20));
  const ringYears = useMemo(
    () => [...manifest.years].sort((a, b) => a - b),
    [manifest.years],
  );
  const years = [...ringYears].reverse();
  const decades = [...new Set(years.map((y) => Math.floor(y / 10) * 10))];
  const isResults = !!query || !!program;
  const heading = query
    ? "검색 결과"
    : program
      ? selectedProgram?.title || "회차 선택"
      : term
        ? "프로그램 선택"
        : year
          ? "학기 선택"
          : "연도별 찾기";
  return (
    <main
      className={`archive-main ${!year && !isResults ? "archive-overview" : "archive-detail"}`}
    >
      <h1 className="sr-only">큐시트 찾기</h1>
      {!year && !isResults && (
        <TimeRing
          catalog={catalog}
          years={ringYears}
          year={focusedYear}
          onYearChange={onFocusYear}
          onOpenRecord={openRecord}
          covered={menuOpen}
        />
      )}
      {(year || term || program || query) && (
        <nav className="archive-path" aria-label="아카이브 탐색 경로">
          <button type="button" onClick={() => go("/archive")}>
            <span className="archive-path-dot" aria-hidden="true" />
            전체 연도
          </button>
          {year && (
            <>
              <ChevronRight size={14} aria-hidden="true" />
              <button
                type="button"
                aria-current={!term ? "page" : undefined}
                onClick={() => update({ term: "", program: "", q: "" })}
              >
                <span className="archive-path-dot" aria-hidden="true" />
                {year}년
              </button>
            </>
          )}
          {term && (
            <>
              <ChevronRight size={14} aria-hidden="true" />
              <button
                type="button"
                aria-current={!program ? "page" : undefined}
                onClick={() => update({ program: "", q: "" })}
              >
                <span className="archive-path-dot" aria-hidden="true" />
                {term}학기
              </button>
            </>
          )}
        </nav>
      )}
      <section
        id="archive-directory"
        className="archive-results"
        aria-label={heading}
      >
        <div className="results-heading">
          <h2>{heading}</h2>
          <span>
            {isResults
              ? `${all.length.toLocaleString()}건`
              : term
                ? `${programs.length}개 프로그램`
                : year
                  ? `${inYear.length}건`
                  : `전체 ${manifest.documents.toLocaleString()}건`}
          </span>
        </div>
        {query && (
          <p className="search-scope">
            <strong>“{query}”</strong> ·{" "}
            {year
              ? `${year}년${term ? ` ${term}학기` : ""}에서 검색`
              : "전체 연도에서 검색"}
            {program ? ` · ${selectedProgram?.title || program}` : ""}
          </p>
        )}
        {!isResults && !year && (
          <div className="year-directory">
            {decades.map((decade) => (
              <section
                key={decade}
                className="decade-group"
                aria-label={`${decade}년대`}
              >
                <h3>{decade}년대</h3>
                <div className="year-grid">
                  {years
                    .filter((y) => Math.floor(y / 10) * 10 === decade)
                    .map((y) => (
                      <Button
                        key={y}
                        variant="outline"
                        className={`year-option ${focusedYear === y ? "is-ring-selected" : ""}`}
                        aria-current={focusedYear === y ? "true" : undefined}
                        aria-label={`${y}년 자료`}
                        onPress={() => {
                          onFocusYear(y);
                          update({ year: String(y), term: "", program: "" });
                        }}
                      >
                        <strong>{y}</strong>
                      </Button>
                    ))}
                </div>
              </section>
            ))}
          </div>
        )}
        {!isResults && year && !term && (
          <div className="browse-list">
            {[...new Set(inYear.map((r) => r.term))].sort().map((t) => {
              const records = inYear.filter((r) => r.term === t);
              return (
                <Button
                  key={t}
                  variant="ghost"
                  className="browse-row"
                  onPress={() => update({ term: String(t), program: "" })}
                >
                  <span>
                    <strong>{t}학기</strong>
                    <span>
                      {new Set(records.map((r) => r.slug)).size}개 프로그램 ·
                      원고 {records.length}건
                    </span>
                  </span>
                  <ChevronRight size={19} />
                </Button>
              );
            })}
          </div>
        )}
        {!isResults && year && term && (
          <div className="browse-list">
            {programs.map((p) => (
              <Button
                key={p.slug}
                variant="ghost"
                className="browse-row"
                onPress={() => update({ program: p.slug })}
              >
                <span>
                  <strong>{p.title}</strong>
                  <span>원고 {p.count}건</span>
                </span>
                <ChevronRight size={19} />
              </Button>
            ))}
          </div>
        )}
        {isResults &&
          (all.length ? (
            all
              .slice((currentPage - 1) * 20, currentPage * 20)
              .map((r) => (
                <RecordRow
                  key={r.id}
                  record={r}
                  saved={saved.includes(r.id)}
                  episodeOnly={!!program && !query}
                  onClick={() => openRecord(r)}
                />
              ))
          ) : (
            <Empty
              title="조건에 맞는 원고가 없어요"
              body="검색어를 바꾸거나 전체 연도에서 찾아보세요."
              action={
                <Button variant="secondary" onPress={() => go("/archive")}>
                  전체 연도로
                </Button>
              }
            />
          ))}
        {isResults && maxPage > 1 && (
          <div className="pagination">
            <Button
              isIconOnly
              variant="outline"
              aria-label="이전 자료 목록"
              isDisabled={currentPage <= 1}
              onPress={() => update({ page: String(currentPage - 1) }, true)}
            >
              <ChevronLeft size={18} />
            </Button>
            <span>
              <b>{currentPage}</b> / {maxPage}
            </span>
            <Button
              isIconOnly
              variant="outline"
              aria-label="다음 자료 목록"
              isDisabled={currentPage >= maxPage}
              onPress={() => update({ page: String(currentPage + 1) }, true)}
            >
              <ChevronRight size={18} />
            </Button>
          </div>
        )}
      </section>
    </main>
  );
}
function RecordRow({
  record: r,
  saved = false,
  episodeOnly = false,
  onClick,
}: {
  record: ArchiveRecord;
  saved?: boolean;
  episodeOnly?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`record-row ${episodeOnly ? "episode-row" : ""}`}
      onClick={onClick}
    >
      <div>
        <strong>
          {episodeOnly ? (
            `${r.issue}회`
          ) : (
            <>
              {r.title} <span>{r.issue}회</span>
            </>
          )}
        </strong>
        <p>
          {episodeOnly
            ? `${r.pages}쪽`
            : `${r.year}년 · ${r.term}학기 · ${r.pages}쪽`}
        </p>
      </div>
      {saved ? (
        <Bookmark size={18} className="saved-icon" fill="currentColor" />
      ) : (
        <ChevronRight size={18} />
      )}
    </button>
  );
}

function DetailHeader({
  title,
  children,
  fallback,
  backLabel = "뒤로",
  onBack,
}: {
  title: string;
  children?: ReactNode;
  fallback?: string;
  backLabel?: string;
  onBack?: () => void;
}) {
  return (
    <header className="detail-header">
      <IconButton label={backLabel} onPress={onBack || (() => back(fallback))}>
        <ArrowLeft size={22} />
      </IconButton>
      <span>{title}</span>
      <div className="detail-header-actions">{children}</div>
    </header>
  );
}
function Attachment({
  record,
  open,
}: {
  record: ArchiveRecord;
  open: () => void;
}) {
  return (
    <button className="attachment" onClick={open}>
      <div className="attachment-icon">
        <FileText size={24} strokeWidth={1.4} />
      </div>
      <div>
        <span>이 이야기의 방송 원고</span>
        <strong>{record.title}</strong>
        <p>
          {recordLabel(record)} · {record.pages}쪽
        </p>
      </div>
      <ChevronRight size={19} />
    </button>
  );
}

function Reader({
  record,
  manifest,
  user,
  toggle,
  updateProgress,
  about,
  notify,
  returnPostId,
  returnHomePath,
}: {
  record: ArchiveRecord;
  manifest: Manifest;
  user: UserState;
  toggle: () => void;
  updateProgress: (n: number) => void;
  about: () => void;
  notify: (message: string) => void;
  returnPostId?: string;
  returnHomePath?: string;
}) {
  const [pages, setPages] = useState<CuePage[]>([]),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0),
    [current, setCurrent] = useState(1);
  const [imageLimit, setImageLimit] = useState(1);
  const [loadingPages, setLoadingPages] = useState(true);
  const [jumpOpen, setJumpOpen] = useState(false);
  const jumpOpenRef = useRef(jumpOpen);
  jumpOpenRef.current = jumpOpen;
  const [rotations, setRotations] = useState<Record<string, number>>({});
  const [shareOpen, setShareOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const rotationAnchor = useRef<number | null>(null);
  const activePage = useRef<number | null>(null);
  useLayoutEffect(() => {
    const page = rotationAnchor.current;
    if (page === null) return;
    document
      .getElementById(`cue-page-${page}`)
      ?.scrollIntoView({ block: "start", behavior: "instant" });
    rotationAnchor.current = null;
  }, [rotations]);
  const rotateCurrent = () => {
    const page = pages.find((p) => p.page === current);
    if (!page) return;
    rotationAnchor.current = current;
    activePage.current = current;
    setRotations((previous) => ({
      ...previous,
      [page.id]: ((previous[page.id] || 0) + 90) % 360,
    }));
  };
  const url = episodeLink(location.href, record.id);
  const copyLink = async () => {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      // Local Wi-Fi HTTP has no Clipboard API. Retain a user-gesture fallback.
      const input = document.createElement("textarea");
      input.value = url;
      input.style.cssText =
        "position:fixed;left:0;top:0;opacity:0;font-size:16px";
      input.readOnly = true;
      const focused = document.activeElement as HTMLElement | null;
      document.body.append(input);
      input.select();
      input.setSelectionRange(0, url.length);
      let copied = false;
      try {
        copied = document.execCommand("copy");
      } catch {
        /* Manual copy below. */
      }
      input.remove();
      focused?.focus({ preventScroll: true });
      return copied;
    }
  };
  const shareRecord = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      if (navigator.share) {
        try {
          await navigator.share({
            title: `${record.title} ${record.issue}회 · VOKU On`,
            url,
          });
          return;
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") return;
        }
      }
      if (await copyLink()) notify("회차 링크를 복사했어요.");
      else setShareOpen(true);
    } finally {
      setSharing(false);
    }
  };
  const resume = useRef(user.progress[record.id] || 1);
  const progressFn = useRef(updateProgress);
  progressFn.current = updateProgress;
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    setLoadingPages(true);
    getPages(record, manifest, controller.signal, refresh > 0, (available) => {
      if (!controller.signal.aborted) setPages(available);
    })
      .then((available) => {
        if (!controller.signal.aborted) setPages(available);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(
            e.name === "TimeoutError"
              ? "연결이 오래 걸리고 있어요. 다시 시도해 주세요."
              : e.message,
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingPages(false);
      });
    return () => controller.abort();
  }, [record, manifest, refresh]);
  useEffect(() => {
    if (!pages.length) return;
    let timer = 0;
    const figures = [...document.querySelectorAll<HTMLElement>(".cue-page")];
    let frame = 0;
    let hasScrolled = false;
    const calculate = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (jumpOpenRef.current || document.querySelector(".modal__dialog"))
          return;
        // A rotated sheet can be shorter than the viewport. Keep the explicitly
        // chosen sheet while it is fully visible, even if the document cannot scroll further.
        const selected = figures.find((e) => Number(e.dataset.page) === activePage.current);
        const selectedBounds = selected?.getBoundingClientRect();
        const toolbarBottom = document.querySelector(".reader-tools")?.getBoundingClientRect().bottom || 100;
        if (selectedBounds && selectedBounds.top >= toolbarBottom - 1 && selectedBounds.bottom <= window.innerHeight + 1) {
          const n = activePage.current!;
          setCurrent(n);
          window.clearTimeout(timer);
          if (hasScrolled) timer = window.setTimeout(() => progressFn.current(n), 300);
          return;
        }
        activePage.current = null;
        const anchor = Math.min(window.innerHeight * 0.35, 220);
        const el =
          figures.find((e) => e.getBoundingClientRect().bottom > anchor) ||
          figures[figures.length - 1];
        if (!el) return;
        const n = Number(el.dataset.page);
        setCurrent(n);
        // Fast scrolling may skip an unloaded, lazy image. Always unblock the visible sheet.
        setImageLimit((previous) => Math.max(previous, n));
        window.clearTimeout(timer);
        if (hasScrolled)
          timer = window.setTimeout(() => progressFn.current(n), 300);
      });
    };
    const observer = new IntersectionObserver(calculate, {
      threshold: [0, 0.25, 0.5, 0.75, 1],
    });
    figures.forEach((el) => observer.observe(el));
    const onScroll = () => {
      hasScrolled = true;
      calculate();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", calculate);
    calculate();
    return () => {
      observer.disconnect();
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", calculate);
    };
  }, [pages]);
  const jumpTo = (n: number) => {
    activePage.current = n;
    setImageLimit((previous) => Math.max(previous, n));
    document
      .getElementById(`cue-page-${n}`)
      ?.scrollIntoView({ block: "start", behavior: "instant" });
    setCurrent(n);
    updateProgress(n);
  };
  const saved = user.saved.includes(record.id);
  return (
    <main className="reader">
      <DetailHeader
        title={record.title}
        fallback={returnPostId ? "/post/" + returnPostId : returnHomePath || "/archive"}
        onBack={returnHomePath && !returnPostId ? () => go(returnHomePath, false, false, true) : undefined}
        backLabel={
          returnPostId ? "게시글로 돌아가기" : returnHomePath ? "홈으로 돌아가기" : "자료 목록으로 돌아가기"
        }
      >
        <Dropdown isOpen={jumpOpen} onOpenChange={setJumpOpen}>
          <Button
            variant="ghost"
            className="page-position"
            aria-label={`현재 ${current}쪽, 전체 ${record.pages}쪽. 페이지 이동`}
            isDisabled={!pages.length}
          >
            <b>{current}</b>
            <span>/ {record.pages}</span>
            <ChevronDown size={14} />
          </Button>
          <Dropdown.Popover placement="bottom end" className="reader-page-menu">
            <Dropdown.Menu
              aria-label="이동할 페이지"
              selectionMode="single"
              selectedKeys={[String(current)]}
              onAction={(key) => {
                setJumpOpen(false);
                requestAnimationFrame(() => jumpTo(Number(key)));
              }}
            >
              {pages.map((page) => (
                <Dropdown.Item
                  key={page.id}
                  id={String(page.page)}
                  textValue={`${page.page}쪽`}
                >
                  <Label>{page.page}쪽</Label>
                  <Dropdown.ItemIndicator />
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
        <Button
          variant="ghost"
          isIconOnly
          className="reader-action"
          aria-label="회차 링크 공유"
          isDisabled={sharing}
          onPress={() => void shareRecord()}
        >
          <Share2 size={18} />
        </Button>
        <IconButton
          label={saved ? "큐시트 저장 해제" : "큐시트 저장"}
          active={saved}
          onPress={toggle}
        >
          <Bookmark size={20} fill={saved ? "currentColor" : "none"} />
        </IconButton>
      </DetailHeader>
      <h1 className="sr-only">{record.title}</h1>
      <div className="reader-tools">
        <p>{recordLabel(record)}</p>
        <div className="reader-tool-actions">
          {(returnPostId || returnHomePath) && (
            <Button
              variant="ghost"
              className="reader-return"
              onPress={() => returnPostId ? back("/post/" + returnPostId) : go(returnHomePath!, false, false, true)}
            >
              <ArrowLeft size={14} />
              {returnPostId ? "글로 돌아가기" : "홈으로"}
            </Button>
          )}
          <Button
            variant="ghost"
            isIconOnly
            className="reader-action"
            aria-label={`${current}쪽 시계 방향으로 90도 회전`}
            onPress={rotateCurrent}
            isDisabled={!pages.length}
          >
            <RotateCw size={19} />
          </Button>
        </div>
      </div>
      {resume.current > 1 && pages.some((page) => page.page === resume.current) && (
        <button className="resume-link" onClick={() => jumpTo(resume.current)}>
          읽던 {resume.current}쪽부터 이어 읽기 <ArrowRight size={15} />
        </button>
      )}
      <p id="cue-gesture-help" className="sr-only">
        두 손가락으로 이 페이지만 확대하거나 축소할 수 있습니다. 확대 후 밀어서
        읽으세요. 키보드에서는 더하기와 빼기로 확대·축소, 방향키로 이동, 숫자
        0으로 화면에 맞춥니다.
      </p>
      {!pages.length && !error && (
        <div className="loading">
          <Spinner />
          <p>원고 이미지를 불러오는 중</p>
        </div>
      )}
      {error && (
        <div className="reader-error">
          <p>{error}</p>
          <Button variant="secondary" onPress={() => setRefresh((v) => v + 1)}>
            다시 불러오기
          </Button>
          <a href={SOURCE} target="_blank" rel="noreferrer">
            원본 자료 보기 <ExternalLink size={14} />
          </a>
        </div>
      )}
      <div className="cue-viewport" role="region" aria-label="큐시트 연속 열람">
        <div className="cue-pages">
          {pages.map((p, i) => (
            <figure
              className="cue-page"
              data-page={p.page}
              id={`cue-page-${p.page}`}
              key={p.id}
            >
              <figcaption className={i === 0 ? "sr-only" : ""}>
                {p.page}쪽 / {record.pages}쪽
              </figcaption>
              <CuePageSurface
                width={p.width}
                height={p.height}
                angle={rotations[p.id] || 0}
                page={p.page}
                onActive={() => { activePage.current = p.page; setCurrent(p.page); setImageLimit((previous) => Math.max(previous, p.page)); }}
              >
                <PageImage
                  key={`${p.id}:${refresh}`}
                  page={p}
                  title={`${record.title}, ${p.page}쪽`}
                  enabled={p.page <= imageLimit}
                  eager={p.page === 1 || p.page === current}
                  onSettled={() => setImageLimit((previous) => Math.max(previous, p.page + 1))}
                  retry={() => setRefresh((v) => v + 1)}
                />
              </CuePageSurface>
            </figure>
          ))}
        </div>
      </div>
      {loadingPages && pages.length > 0 && (
        <p className="reader-loading-more" role="status">다음 페이지 불러오는 중 · {pages.length} / {record.pages}쪽</p>
      )}
      {pages.length > 0 && !loadingPages && (
        <>
          <div className="reader-end">
            <span className="record-stamp">
              {record.year} · {record.term}학기
            </span>
            <p>
              {record.title} {record.issue}회 · 총 {record.pages}쪽
            </p>
          </div>
          <div className="back-to-list">
            <Button
              variant="outline"
              onPress={() =>
                returnPostId
                  ? back("/post/" + returnPostId)
                  : returnHomePath ? go(returnHomePath, false, false, true) : go(
                      `/archive?year=${record.year}&term=${record.term}&program=${encodeURIComponent(record.slug)}`,
                    )
              }
            >
              <ChevronLeft size={16} />
              {returnPostId
                ? "읽던 이야기로 돌아가기"
                : returnHomePath ? "홈으로 돌아가기" : "같은 프로그램의 다른 회차"}
            </Button>
          </div>
          <Footer about={about} reader />
        </>
      )}
      <Dialog
        title="회차 링크"
        open={shareOpen}
        onClose={() => setShareOpen(false)}
      >
        <TextField className="reader-share-field" isReadOnly>
          <Label>아래 주소를 복사해 공유하세요</Label>
          <Input
            value={url}
            readOnly
            onFocus={(event) => event.target.select()}
          />
        </TextField>
      </Dialog>
    </main>
  );
}
function PageImage({
  page,
  title,
  eager,
  enabled,
  onSettled,
  retry,
}: {
  page: CuePage;
  title: string;
  eager: boolean;
  enabled: boolean;
  onSettled: () => void;
  retry: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  if (!enabled) return <div className="cue-image-placeholder" aria-label={`${page.page}쪽 로딩 대기`} style={{ aspectRatio: `${page.width}/${page.height}` }} />;
  return failed ? (
    <div
      className="image-error"
      style={{ aspectRatio: `${page.width}/${page.height}` }}
    >
      <FileText />
      <p>이 페이지를 불러오지 못했어요.</p>
      <Button variant="outline" onPress={retry}>
        이미지 다시 불러오기
      </Button>
    </div>
  ) : (
    <div className="cue-image-frame" aria-busy={!loaded}>
      {!loaded && <span className="cue-image-status" role="status">{page.page}쪽 불러오는 중</span>}
      <img
        className="cue-image"
        src={page.image}
        width={page.width}
        height={page.height}
        alt={title}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "low"}
        decoding="async"
        draggable={false}
        onLoad={() => { setLoaded(true); onSettled(); }}
        onError={() => { setFailed(true); onSettled(); }}
      />
    </div>
  );
}

function Saved({
  catalog,
  posts,
  user,
  openRecord,
  comments,
}: {
  catalog: ArchiveRecord[];
  posts: Post[];
  user: UserState;
  openRecord: (r: ArchiveRecord) => void;
  comments: (id: string) => Comment[];
}) {
  const [tab, setTab] = useState("records");
  const records = [...user.saved]
    .reverse()
    .map((id) => catalog.find((r) => r.id === id))
    .filter((r): r is ArchiveRecord => !!r);
  const savedPosts = [...user.saved]
    .reverse()
    .map((id) => posts.find((p) => p.id === id))
    .filter((p): p is Post => !!p);
  return (
    <main className="saved-main">
      <div className="archive-heading">
        <h1>다시 읽을 기록</h1>
        <p>다시 읽고 싶은 기록과 이야기를 모아요.</p>
      </div>
      <div className="saved-tabs">
        <Button
          variant="ghost"
          className={tab === "records" ? "chosen" : ""}
          aria-pressed={tab === "records"}
          onPress={() => setTab("records")}
        >
          큐시트 {records.length}
        </Button>
        <Button
          variant="ghost"
          className={tab === "posts" ? "chosen" : ""}
          aria-pressed={tab === "posts"}
          onPress={() => setTab("posts")}
        >
          게시글 {savedPosts.length}
        </Button>
      </div>
      {tab === "records" ? (
        records.length ? (
          records.map((r) => (
            <div key={r.id}>
              <RecordRow record={r} saved onClick={() => openRecord(r)} />
              {user.progress[r.id] && (
                <span className="saved-progress">
                  {user.progress[r.id]} / {r.pages}쪽 읽는 중
                </span>
              )}
            </div>
          ))
        ) : (
          <Empty
            title="다시 펼칠 원고를 담아보세요"
            body="큐시트의 책갈피 버튼을 누르면 여기에 모여요."
            action={
              <Button variant="secondary" onPress={() => go("/archive")}>
                큐시트 찾기 <ArrowRight size={16} />
              </Button>
            }
          />
        )
      ) : savedPosts.length ? (
        savedPosts.map((p) => (
          <PostRow key={p.id} post={p} count={comments(p.id).length} />
        ))
      ) : (
        <Empty
          title="아직 저장한 글이 없어요"
          body="마음에 남는 이야기의 저장 버튼을 눌러보세요."
          action={
            <Button variant="secondary" onPress={() => go("/board")}>
              커뮤니티 둘러보기
            </Button>
          }
        />
      )}
      <p className="saved-note">
        큐시트는 이 브라우저에, 게시글은{" "}
        {communityLive ? "로그인 계정에" : "체험 계정에"} 저장합니다.
      </p>
    </main>
  );
}
function GlobalSearch({
  catalog,
  openRecord,
}: {
  catalog: ArchiveRecord[];
  openRecord: (r: ArchiveRecord) => void;
}) {
  const [query, setQuery] = useState("");
  const records = query.trim() ? filterArchive(catalog, query) : [];
  const [foundPosts, setFoundPosts] = useState<Post[]>([]);
  const [postTotal, setPostTotal] = useState(0);
  const [postLoading, setPostLoading] = useState(false);
  const [postError, setPostError] = useState("");
  useEffect(() => {
    let active = true;
    setFoundPosts([]);
    setPostTotal(0);
    setPostError("");
    if (!query.trim()) {
      setPostLoading(false);
      return;
    }
    setPostLoading(true);
    const timer = setTimeout(() => {
      communityApi
        .feed({ query: query.trim().slice(0, 100) })
        .then((result) => {
          if (active) {
            setFoundPosts(result.posts.slice(0, 5));
            setPostTotal(result.total);
          }
        })
        .catch((error) => {
          if (active) setPostError(communityErrorText(error));
        })
        .finally(() => {
          if (active) setPostLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);
  return (
    <main>
      <DetailHeader title="통합 검색" />
      <div className="global-search">
        <SearchBox
          value={query}
          onChange={setQuery}
          label="프로그램, 연도, 게시글 검색"
          autoFocus
        />
        {!query.trim() ? (
          <div className="search-suggestions">
            <h2>이런 기록을 찾아보세요</h2>
            {["광교음악산책", "모닝커피", "1994", "방송실"].map((q) => (
              <button key={q} onClick={() => setQuery(q)}>
                <Search size={15} />
                {q}
                <ArrowRight size={15} />
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className="results-heading">
              <h2>
                큐시트 <span>{records.length}</span>
              </h2>
              {records.length > 5 && (
                <button
                  onClick={() => go("/archive?q=" + encodeURIComponent(query))}
                >
                  전체 보기 <ChevronRight size={13} />
                </button>
              )}
            </div>
            {records.slice(0, 5).map((r) => (
              <RecordRow key={r.id} record={r} onClick={() => openRecord(r)} />
            ))}
            {!records.length && (
              <p className="no-comments">일치하는 큐시트가 없어요.</p>
            )}
            <div className="results-heading search-posts-heading">
              <h2>
                커뮤니티 <span>{postLoading ? "…" : postTotal}</span>
              </h2>
              {postTotal > 5 && (
                <button
                  onClick={() =>
                    go(
                      "/board?q=" +
                        encodeURIComponent(query.trim().slice(0, 100)),
                    )
                  }
                >
                  전체 보기 <ChevronRight size={13} />
                </button>
              )}
            </div>
            {postLoading && (
              <p className="no-comments">커뮤니티를 검색하고 있어요.</p>
            )}
            {postError && (
              <p className="community-error" role="alert">
                {postError}
              </p>
            )}
            {foundPosts.map((p) => (
              <a
                key={p.id}
                className="search-post"
                href={"#/post/" + p.id}
                onClick={(e) => {
                  e.preventDefault();
                  go("/post/" + p.id);
                }}
              >
                <strong>{p.title}</strong>
                <span>
                  {p.category} · {p.author}
                </span>
              </a>
            ))}
            {!postLoading && !postError && !foundPosts.length && (
              <p className="no-comments">일치하는 게시글이 없어요.</p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
