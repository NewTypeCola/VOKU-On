import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Button,
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
  MessageCircle,
  Paperclip,
  Pencil,
  Search,
  ThumbsUp,
  X,
  ZoomIn,
  RotateCcw,
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

const positions = new Map<string, number>();
function go(path: string, replace = false, keepScroll = false) {
  positions.set(location.hash, window.scrollY);
  const hash = "#" + path;
  if (keepScroll) positions.set(hash, window.scrollY);
  else if (!replace) positions.set(hash, 0);
  history[replace ? "replaceState" : "pushState"]({ voku: true }, "", hash);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}
function useRoute() {
  const [hash, setHash] = useState(location.hash || "#/board");
  useEffect(() => {
    const update = () => setHash(location.hash || "#/board");
    window.addEventListener("hashchange", update);
    window.addEventListener("popstate", update);
    return () => {
      window.removeEventListener("hashchange", update);
      window.removeEventListener("popstate", update);
    };
  }, []);
  useLayoutEffect(() => {
    const id = requestAnimationFrame(() =>
      window.scrollTo({ top: positions.get(hash) || 0, behavior: "instant" }),
    );
    return () => cancelAnimationFrame(id);
  }, [hash]);
  const [path, query = ""] = hash.slice(1).split("?");
  return { path, params: new URLSearchParams(query), hash };
}
const back = (fallback = "/board") => {
  if (history.state?.voku) history.back();
  else go(fallback);
};

function IconButton({
  label,
  children,
  onPress,
  active = false,
}: {
  label: string;
  children: ReactNode;
  onPress: () => void;
  active?: boolean;
}) {
  return (
    <Button
      isIconOnly
      variant="ghost"
      className={`icon-button ${active ? "active" : ""}`}
      aria-label={label}
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
function Footer({ about }: { about: () => void }) {
  return (
    <footer>
      <span className="footer-logo">
        VOKU <b>On</b>
      </span>
      <p>우리의 방송, 계속되는 이야기</p>
      <button onClick={about}>이용 안내 · 자료 출처</button>
      <span className="footer-note">커뮤니티 체험 버전</span>
    </footer>
  );
}

export default function App() {
  const route = useRoute();
  const [catalog, setCatalog] = useState<ArchiveRecord[]>([]);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [user, setUser] = useState(loadState);
  const [notice, setNotice] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [nickname, setNickname] = useState(user.nickname);
  useEffect(() => setNickname(user.nickname), [user.nickname]);
  const storageFailed = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    Promise.all(
      ["/data/catalog.json", "/data/manifest.json"].map(async (url) => {
        const r = await fetch(url, { signal: controller.signal });
        if (!r.ok) throw Error();
        return r.json();
      }),
    )
      .then(([c, m]) => {
        setCatalog(c);
        setManifest(m);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError("자료 목록을 불러오지 못했어요.");
      });
    return () => controller.abort();
  }, [reload]);
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
  const posts = useMemo(() => [...user.posts, ...demoPosts], [user.posts]);
  const comments = (id: string) => [
    ...seedComments(id),
    ...(user.comments[id] || []),
  ];
  const toggle = (key: "saved" | "likes", id: string) => {
    const exists = user[key].includes(id);
    setUser((s) => ({
      ...s,
      [key]: exists ? s[key].filter((x) => x !== id) : [...s[key], id],
    }));
    if (key === "saved")
      setNotice(exists ? "스크랩을 해제했어요." : "스크랩에 담았어요.");
  };
  const addComment = (id: string, body: string, parentId?: string) => {
    const comment: Comment = {
      id: uid(),
      author: user.nickname || "방문자",
      body: body.trim(),
      date: new Date().toISOString(),
      ...(parentId ? { parentId } : {}),
    };
    setUser((s) => ({
      ...s,
      comments: { ...s.comments, [id]: [...(s.comments[id] || []), comment] },
    }));
    setNotice("이 브라우저에 댓글을 저장했어요.");
  };
  const recordId = route.path.startsWith("/read/")
    ? decodeURIComponent(route.path.slice(6))
    : "";
  const record = catalog.find((r) => r.id === recordId);
  const post = route.path.startsWith("/post/")
    ? posts.find((p) => p.id === route.path.slice(6))
    : null;
  const detail =
    !!recordId ||
    route.path.startsWith("/post/") ||
    route.path === "/write" ||
    route.path === "/search";
  const tab =
    route.path === "/archive"
      ? "archive"
      : route.path === "/news"
        ? "news"
        : route.path === "/saved"
          ? "saved"
          : "board";
  useEffect(() => {
    document.title = `${record?.title || post?.title || { archive: "아카이브", news: "동문소식", saved: "스크랩", board: "자유게시판" }[tab]} · VOKU On`;
  }, [record, post, tab]);
  const openRecord = (r: ArchiveRecord) => go("/read/" + r.id);
  const writeWith = (id: string) => {
    setUser((s) => ({ ...s, draft: { ...s.draft, recordId: id } }));
    go("/write");
  };

  return (
    <div className="app-shell">
      {!detail && (
        <header className="site-header">
          <button
            className="brand"
            onClick={() => go("/board")}
            aria-label="VOKU On 홈"
          >
            VOKU{" "}
            <span>
              On
              <i />
            </span>
          </button>
          <div className="header-actions">
            <IconButton label="통합 검색" onPress={() => go("/search")}>
              <Search size={23} />
            </IconButton>
            <IconButton label="전체 메뉴" onPress={() => setMenuOpen(true)}>
              <Menu size={25} />
            </IconButton>
          </div>
        </header>
      )}
      {error ? (
        <Empty
          title={error}
          body="인터넷 연결을 확인한 후 다시 시도해 주세요."
          action={
            <Button onPress={() => setReload((v) => v + 1)}>다시 시도</Button>
          }
        />
      ) : !manifest ? (
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
                manifest={manifest}
                user={user}
                toggle={() => toggle("saved", record.id)}
                updateProgress={(n) =>
                  setUser((s) =>
                    s.progress[record.id] === n
                      ? s
                      : { ...s, progress: { ...s.progress, [record.id]: n } },
                  )
                }
                comments={comments(record.id)}
                addComment={(body, parent) =>
                  addComment(record.id, body, parent)
                }
                write={() => writeWith(record.id)}
                about={() => setInfoOpen(true)}
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
          {route.path.startsWith("/post/") &&
            (post ? (
              <PostDetail
                post={post}
                record={catalog.find((r) => r.id === post.recordId)}
                user={user}
                comments={comments(post.id)}
                addComment={(body, parent) => addComment(post.id, body, parent)}
                toggle={(key) => toggle(key, post.id)}
                openRecord={openRecord}
              />
            ) : (
              <Empty
                title="글을 찾을 수 없어요"
                body="이 브라우저에서 작성한 글만 확인할 수 있어요."
                action={<Button onPress={() => go("/board")}>목록으로</Button>}
              />
            ))}
          {route.path === "/write" && (
            <Composer
              user={user}
              catalog={catalog}
              update={setUser}
              notify={setNotice}
            />
          )}
          {route.path === "/search" && (
            <GlobalSearch
              catalog={catalog}
              posts={posts}
              openRecord={openRecord}
            />
          )}
        </>
      ) : (
        <>
          <Tabs
            selectedKey={tab}
            onSelectionChange={(key) => go("/" + String(key))}
            variant="secondary"
            className="site-tabs"
          >
            <Tabs.ListContainer className="site-tab-container">
              <Tabs.List aria-label="주요 메뉴">
                {[
                  ["board", "자유게시판"],
                  ["archive", "아카이브"],
                  ["news", "동문소식"],
                  ["saved", "스크랩"],
                ].map(([id, label]) => (
                  <Tabs.Tab key={id} id={id}>
                    {label}
                    <Tabs.Indicator />
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs.ListContainer>
            <Tabs.Panel id="board">
              <Board
                route={route}
                posts={posts.filter((p) => p.category !== "동문소식")}
                user={user}
                comments={comments}
                about={() => setInfoOpen(true)}
              />
            </Tabs.Panel>
            <Tabs.Panel id="archive">
              <Archive
                catalog={catalog}
                manifest={manifest}
                route={route}
                saved={user.saved}
                openRecord={openRecord}
              />
            </Tabs.Panel>
            <Tabs.Panel id="news">
              <Board
                route={route}
                news
                posts={posts.filter((p) => p.category === "동문소식")}
                user={user}
                comments={comments}
                about={() => setInfoOpen(true)}
              />
            </Tabs.Panel>
            <Tabs.Panel id="saved">
              <Saved
                catalog={catalog}
                posts={posts}
                user={user}
                openRecord={openRecord}
                comments={comments}
              />
            </Tabs.Panel>
          </Tabs>
          <Footer about={() => setInfoOpen(true)} />
        </>
      )}

      <Dialog
        title="전체 메뉴"
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        className="menu-dialog"
      >
        <p className="dialog-intro">다시 만나 반가워요.</p>
        <div className="menu-links">
          {[
            ["/board", "자유게시판"],
            ["/archive", "큐시트 아카이브"],
            ["/news", "동문소식"],
            ["/saved", "내 스크랩"],
          ].map(([path, label]) => (
            <button
              key={path}
              onClick={() => {
                setMenuOpen(false);
                go(path);
              }}
            >
              {label}
              <ChevronRight size={18} />
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setUser((s) => ({ ...s, nickname: nickname.trim() }));
            setMenuOpen(false);
            setNotice("닉네임을 저장했어요.");
          }}
        >
          <TextField value={nickname} onChange={setNickname}>
            <Label>이 브라우저에서 쓸 닉네임</Label>
            <Input maxLength={16} placeholder="방문자" />
          </TextField>
          <Button fullWidth type="submit" variant="secondary">
            닉네임 저장
          </Button>
        </form>
        <button
          className="text-link"
          onClick={() => {
            setMenuOpen(false);
            setInfoOpen(true);
          }}
        >
          이용 안내 · 자료 출처
        </button>
      </Dialog>
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
          <h3>커뮤니티는 체험 중이에요</h3>
          <p>
            목록의 예시 글과 반응 수는 화면 체험용입니다. 작성한
            글·댓글·공감·스크랩은 이 브라우저에만 저장되며, 다른 이용자에게
            전송되지 않습니다. 브라우저 데이터를 지우면 사라집니다.
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
    </div>
  );
}

function Board({
  posts,
  user,
  comments,
  about,
  route,
  news = false,
}: {
  route: ReturnType<typeof useRoute>;
  posts: Post[];
  user: UserState;
  comments: (id: string) => Comment[];
  about: () => void;
  news?: boolean;
}) {
  const category = route.params.get("category") || "전체";
  const sort = route.params.get("sort") || "latest";
  const query = route.params.get("q") || "";
  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(route.params);
    if (value) next.set(key, value);
    else next.delete(key);
    go(route.path + (next.size ? "?" + next : ""), true, true);
  };
  const setCategory = (value: string) => setParam("category", value);
  const setSort = (value: string) => setParam("sort", value);
  const setQuery = (value: string) => setParam("q", value);
  const [searchOpen, setSearchOpen] = useState(false);
  const visible = posts
    .filter(
      (p) =>
        (category === "전체" || p.category === category) &&
        normalize(p.title + p.body + p.author).includes(normalize(query)),
    )
    .sort((a, b) =>
      sort === "popular"
        ? b.likes +
          Number(user.likes.includes(b.id)) -
          (a.likes + Number(user.likes.includes(a.id)))
        : b.date.localeCompare(a.date),
    );
  return (
    <main>
      <section className="board-section">
        <h1 className="sr-only">{news ? "동문소식" : "자유게시판"}</h1>
        {!news && (
          <div className="category-tabs" aria-label="게시글 분류">
            {["전체", "일상", "추억", "음악", "질문"].map((c) => (
              <Button
                key={c}
                variant="ghost"
                className={category === c ? "chosen" : ""}
                aria-pressed={category === c}
                onPress={() => setCategory(c)}
              >
                {c}
              </Button>
            ))}
          </div>
        )}
        <div className="list-toolbar">
          <div className="sort-options">
            <button
              className={sort === "latest" ? "selected" : ""}
              onClick={() => setSort("latest")}
              aria-pressed={sort === "latest"}
            >
              최신순
            </button>
            <span>·</span>
            <button
              className={sort === "popular" ? "selected" : ""}
              onClick={() => setSort("popular")}
              aria-pressed={sort === "popular"}
            >
              공감순
            </button>
          </div>
          <div className="list-actions">
            <IconButton
              label="게시판 검색"
              onPress={() => setSearchOpen((v) => !v)}
            >
              <Search size={19} />
            </IconButton>
            <Button
              className="write-button"
              size="sm"
              onPress={() => go("/write")}
            >
              <Pencil size={15} /> 글쓰기
            </Button>
          </div>
        </div>
        {(searchOpen || query) && (
          <div className="inline-search">
            <SearchBox
              value={query}
              onChange={setQuery}
              label="제목, 내용, 닉네임 검색"
              autoFocus
            />
          </div>
        )}
        {visible.length ? (
          <div className="post-list">
            {visible.map((p) => (
              <PostRow key={p.id} post={p} count={comments(p.id).length} />
            ))}
          </div>
        ) : (
          <Empty
            title="아직 글이 없어요"
            body={
              query ? "다른 검색어로 찾아보세요." : "첫 이야기를 남겨보세요."
            }
            action={
              <Button variant="secondary" onPress={() => go("/write")}>
                글쓰기
              </Button>
            }
          />
        )}
        <div className="list-end">
          <button className="demo-label" onClick={about}>
            예시 게시판 · 이용 안내
          </button>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            맨 위로 <ArrowUp size={14} />
          </button>
        </div>
      </section>
    </main>
  );
}
function PostRow({ post: p, count }: { post: Post; count: number }) {
  const lastWord = p.title.slice(p.title.lastIndexOf(" ") + 1);
  const titleEnd = [...lastWord].slice(-8).join("");
  const titleStart = p.title.slice(0, p.title.length - titleEnd.length);
  return (
    <a
      className="post-row"
      href={"#/post/" + p.id}
      onClick={(e) => {
        e.preventDefault();
        go("/post/" + p.id);
      }}
    >
      <div className="post-row-main">
        <div className="post-title">
          <span className="post-category">{p.category}</span>
          <span>
            {count > 0 ? (
              <>
                {titleStart}
                <span className="title-tail">
                  {titleEnd}
                  <span
                    className="comment-count"
                    aria-label={`댓글 ${count}개`}
                  >
                    [{count}]
                  </span>
                </span>
              </>
            ) : (
              p.title
            )}
          </span>
        </div>
        <div className="post-meta">
          <span>{p.author}</span>
          <i />
          {dateLabel(p.date)}
          <span className="meta-views">조회 {p.views}</span>
          {!p.demo && <span className="local-label">내 글</span>}
        </div>
      </div>
    </a>
  );
}

function Archive({
  catalog,
  manifest,
  route,
  saved,
  openRecord,
}: {
  catalog: ArchiveRecord[];
  manifest: Manifest;
  route: ReturnType<typeof useRoute>;
  saved: string[];
  openRecord: (r: ArchiveRecord) => void;
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
  const inYear = filterArchive(catalog, "", year);
  const inTerm = filterArchive(catalog, "", year, term);
  const programs = [...new Set(inTerm.map((r) => r.slug))]
    .map((slug) => {
      const records = inTerm.filter((r) => r.slug === slug);
      return { slug, title: records[0].title, count: records.length };
    })
    .sort((a, b) => a.title.localeCompare(b.title, "ko"));
  const selectedProgram = programs.find((p) => p.slug === program);
  const all = filterArchive(catalog, query, year, term, program).sort(
    (a, b) =>
      b.year - a.year ||
      b.term - a.term ||
      a.title.localeCompare(b.title, "ko") ||
      a.issue.localeCompare(b.issue, "ko", { numeric: true }),
  );
  const currentPage = Math.min(
    Math.max(1, Number(route.params.get("page")) || 1),
    Math.max(1, Math.ceil(all.length / 20)),
  );
  const maxPage = Math.max(1, Math.ceil(all.length / 20));
  const years = [...manifest.years].sort((a, b) => b - a);
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
    <main className="archive-main">
      <h1 className="sr-only">큐시트 아카이브</h1>
      <div className="archive-search">
        <SearchBox
          value={query}
          onChange={(q) => update({ q, program: q ? "" : program }, true, true)}
          label="프로그램 이름 검색"
        />
      </div>
      {(year || term || program) && (
        <nav className="archive-path" aria-label="아카이브 탐색 경로">
          <button onClick={() => go("/archive")}>전체 연도</button>
          {year && (
            <>
              <ChevronRight size={14} />
              <button
                aria-current={!term ? "page" : undefined}
                onClick={() => update({ term: "", program: "", q: "" })}
              >
                {year}년
              </button>
            </>
          )}
          {term && (
            <>
              <ChevronRight size={14} />
              <button
                aria-current={!program ? "page" : undefined}
                onClick={() => update({ program: "", q: "" })}
              >
                {term}학기
              </button>
            </>
          )}
        </nav>
      )}
      <section className="archive-results" aria-label={heading}>
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
                        className="year-option"
                        aria-label={`${y}년 자료`}
                        onPress={() =>
                          update({ year: String(y), term: "", program: "" })
                        }
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
}: {
  title: string;
  children?: ReactNode;
  fallback?: string;
}) {
  return (
    <header className="detail-header">
      <IconButton label="뒤로" onPress={() => back(fallback)}>
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
        <span>함께 읽는 큐시트</span>
        <strong>{record.title}</strong>
        <p>
          {recordLabel(record)} · {record.pages}쪽
        </p>
      </div>
      <ChevronRight size={19} />
    </button>
  );
}

function PostDetail({
  post,
  record,
  user,
  comments,
  addComment,
  toggle,
  openRecord,
}: {
  post: Post;
  record?: ArchiveRecord;
  user: UserState;
  comments: Comment[];
  addComment: (s: string, parent?: string) => void;
  toggle: (k: "saved" | "likes") => void;
  openRecord: (r: ArchiveRecord) => void;
}) {
  return (
    <main>
      <DetailHeader
        title={post.category === "동문소식" ? "동문소식" : "자유게시판"}
      >
        <IconButton
          label={user.saved.includes(post.id) ? "스크랩 해제" : "글 스크랩"}
          active={user.saved.includes(post.id)}
          onPress={() => toggle("saved")}
        >
          <Bookmark
            size={21}
            fill={user.saved.includes(post.id) ? "currentColor" : "none"}
          />
        </IconButton>
      </DetailHeader>
      <article className="post-detail">
        <div className="article-kicker">
          <span>{post.category}</span>
          {post.demo && (
            <Chip size="sm" variant="soft">
              예시 글
            </Chip>
          )}
        </div>
        <h1>{post.title}</h1>
        <div className="author-line">
          <span className="avatar-text">{post.author.slice(0, 1)}</span>
          <div>
            <strong>{post.author}</strong>
            <p>
              {dateLabel(post.date)} · 조회 {post.views}
            </p>
          </div>
        </div>
        <div className="post-body">{post.body}</div>
        {record && (
          <Attachment record={record} open={() => openRecord(record)} />
        )}
        <div className="post-reactions">
          <Button
            variant="outline"
            className={user.likes.includes(post.id) ? "reacted" : ""}
            aria-pressed={user.likes.includes(post.id)}
            onPress={() => toggle("likes")}
          >
            <ThumbsUp size={17} />
            공감 {post.likes + Number(user.likes.includes(post.id))}
          </Button>
          <Button
            variant="outline"
            className={user.saved.includes(post.id) ? "reacted" : ""}
            onPress={() => toggle("saved")}
            aria-pressed={user.saved.includes(post.id)}
          >
            <Bookmark size={17} />
            스크랩
          </Button>
        </div>
      </article>
      <Comments
        id={post.id}
        items={comments}
        nickname={user.nickname}
        add={addComment}
      />
      <div className="back-to-list">
        <Button variant="outline" onPress={() => back("/board")}>
          <ChevronLeft size={17} />
          목록으로
        </Button>
      </div>
    </main>
  );
}

function Comments({
  id,
  items,
  nickname,
  add,
}: {
  id: string;
  items: Comment[];
  nickname: string;
  add: (s: string, parent?: string) => void;
}) {
  const [body, setBody] = useState("");
  const [reply, setReply] = useState<Comment | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const arranged = items
    .filter((x) => !x.parentId)
    .flatMap((c) => [c, ...items.filter((x) => x.parentId === c.id)]);
  return (
    <section className="comments" id={"comments-" + id}>
      <div className="comments-heading">
        <h2>
          댓글 <b>{items.length}</b>
        </h2>
        <span>서로에게 다정한 한마디</span>
      </div>
      {arranged.map((c) => (
        <div className={`comment ${c.parentId ? "reply" : ""}`} key={c.id}>
          <div className="comment-top">
            <strong>
              {c.parentId && <span className="reply-arrow">↳ </span>}
              {c.author}
            </strong>
            {c.demo && <span className="sample-mark">예시</span>}
            <time>{dateLabel(c.date)}</time>
          </div>
          <p>{c.body}</p>
          {!c.parentId && (
            <button
              className="reply-button"
              onClick={() => {
                setReply(c);
                field.current?.focus();
              }}
            >
              답글
            </button>
          )}
        </div>
      ))}
      {!items.length && <p className="no-comments">첫 이야기를 남겨주세요.</p>}
      <form
        className="comment-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!body.trim()) return;
          add(body, reply?.id);
          setBody("");
          setReply(null);
        }}
      >
        <div className="comment-writing-as">
          <strong>{nickname || "방문자"}</strong>
          <span>이 브라우저에 저장</span>
        </div>
        {reply && (
          <div className="replying-to">
            {reply.author}님에게 답글
            <IconButton label="답글 취소" onPress={() => setReply(null)}>
              <X size={15} />
            </IconButton>
          </div>
        )}
        <TextArea
          ref={field}
          aria-label="댓글 내용"
          placeholder="함께 나누고 싶은 이야기를 남겨주세요."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={2000}
          rows={3}
        />
        <div className="comment-submit">
          <span>{body.length.toLocaleString()} / 2,000</span>
          <Button size="sm" type="submit" isDisabled={!body.trim()}>
            등록
          </Button>
        </div>
      </form>
    </section>
  );
}

function Reader({
  record,
  manifest,
  user,
  toggle,
  updateProgress,
  comments,
  addComment,
  write,
  about,
}: {
  record: ArchiveRecord;
  manifest: Manifest;
  user: UserState;
  toggle: () => void;
  updateProgress: (n: number) => void;
  comments: Comment[];
  addComment: (s: string, parent?: string) => void;
  write: () => void;
  about: () => void;
}) {
  const [pages, setPages] = useState<CuePage[]>([]),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0),
    [current, setCurrent] = useState(1);
  const [jumpOpen, setJumpOpen] = useState(false),
    [jump, setJump] = useState("1");
  const [scale, setScale] = useState(1);
  const viewport = useRef<HTMLDivElement>(null);
  const zoomAnchor = useRef<{ page: string; ratio: number; y: number } | null>(
    null,
  );
  const changeScale = () => {
    const y = 140;
    const figures = [...document.querySelectorAll<HTMLElement>(".cue-page")];
    const figure = figures.find((el) => el.getBoundingClientRect().bottom > y);
    if (figure) {
      const rect = figure.getBoundingClientRect();
      zoomAnchor.current = {
        page: figure.id,
        ratio: Math.max(0, (y - rect.top) / rect.height),
        y,
      };
    }
    setScale((s) => (s === 1 ? 2 : 1));
  };
  useLayoutEffect(() => {
    const anchor = zoomAnchor.current;
    if (!anchor) return;
    const figure = document.getElementById(anchor.page);
    if (figure) {
      const rect = figure.getBoundingClientRect();
      window.scrollTo({
        top: window.scrollY + rect.top + rect.height * anchor.ratio - anchor.y,
        behavior: "instant",
      });
    }
    if (viewport.current)
      viewport.current.scrollLeft =
        (viewport.current.scrollWidth - viewport.current.clientWidth) / 2;
    zoomAnchor.current = null;
  }, [scale]);
  const resume = useRef(user.progress[record.id] || 1);
  const progressFn = useRef(updateProgress);
  progressFn.current = updateProgress;
  useEffect(() => {
    const controller = new AbortController();
    setPages([]);
    setError("");
    getPages(record, manifest, controller.signal, refresh > 0)
      .then(setPages)
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(
            e.name === "TimeoutError"
              ? "연결이 오래 걸리고 있어요. 다시 시도해 주세요."
              : e.message,
          );
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
        if (document.querySelector(".modal__dialog")) return;
        const anchor = Math.min(window.innerHeight * 0.35, 220);
        const el =
          figures.find((e) => e.getBoundingClientRect().bottom > anchor) ||
          figures[figures.length - 1];
        if (!el) return;
        const n = Number(el.dataset.page);
        setCurrent(n);
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
    document
      .getElementById(`cue-page-${n}`)
      ?.scrollIntoView({ block: "start", behavior: "instant" });
    setCurrent(n);
    updateProgress(n);
  };
  const saved = user.saved.includes(record.id);
  return (
    <main className="reader">
      <DetailHeader title={record.title} fallback="/archive">
        <button
          className="page-position"
          onClick={() => {
            setJump(String(current));
            setJumpOpen(true);
          }}
          aria-label={`현재 ${current}쪽, 전체 ${record.pages}쪽. 페이지 이동`}
        >
          <b>{current}</b>
          <span>/ {record.pages}</span>
          <ChevronDown size={13} />
        </button>
        <IconButton
          label={saved ? "큐시트 스크랩 해제" : "큐시트 스크랩"}
          active={saved}
          onPress={toggle}
        >
          <Bookmark size={20} fill={saved ? "currentColor" : "none"} />
        </IconButton>
      </DetailHeader>
      <h1 className="sr-only">{record.title}</h1>
      <div className="reader-tools">
        <p>{recordLabel(record)}</p>
        <Button
          variant="ghost"
          className="reader-zoom"
          aria-pressed={scale === 2}
          onPress={changeScale}
          isDisabled={!pages.length}
        >
          {scale === 1 ? <ZoomIn size={18} /> : <RotateCcw size={17} />}
          {scale === 1 ? "2배 확대" : "화면 맞춤"}
        </Button>
      </div>
      {resume.current > 1 && pages.length > 0 && (
        <button className="resume-link" onClick={() => jumpTo(resume.current)}>
          읽던 {resume.current}쪽부터 이어 읽기 <ArrowRight size={15} />
        </button>
      )}
      {scale === 2 && (
        <p className="zoom-hint" role="status">
          좌우로 밀어 읽을 수 있어요. 아래로 내리면 다음 쪽이 이어집니다.
        </p>
      )}
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
      <div
        className="cue-viewport"
        ref={viewport}
        tabIndex={scale === 2 ? 0 : undefined}
        role="region"
        aria-label="큐시트 연속 열람"
      >
        <div className="cue-pages" style={{ width: `${scale * 100}%` }}>
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
              <PageImage
                page={p}
                title={`${record.title}, ${p.page}쪽`}
                eager={i < 2}
                retry={() => setRefresh((v) => v + 1)}
              />
            </figure>
          ))}
        </div>
      </div>
      {pages.length > 0 && (
        <>
          <div className="reader-end">
            <span className="end-mark">
              <Check size={17} />
            </span>
            <p>총 {record.pages}쪽 · 원고의 마지막입니다.</p>
            <div>
              <Button variant="outline" onPress={toggle}>
                <Bookmark size={16} fill={saved ? "currentColor" : "none"} />
                {saved ? "스크랩 해제" : "스크랩"}
              </Button>
              <Button variant="secondary" onPress={write}>
                <Pencil size={16} />이 원고로 이야기 쓰기
              </Button>
            </div>
          </div>
          <div className="source-line">
            <a href={SOURCE} target="_blank" rel="noreferrer">
              자료 출처: VOKU Archive <ExternalLink size={12} />
            </a>
            <button onClick={about}>권리·출처 안내</button>
          </div>
          <Comments
            id={record.id}
            items={comments}
            nickname={user.nickname}
            add={addComment}
          />
          <div className="back-to-list">
            <Button variant="outline" onPress={() => back("/archive")}>
              <ChevronLeft size={16} />
              자료 목록
            </Button>
          </div>
        </>
      )}
      <Dialog
        title="페이지 이동"
        open={jumpOpen}
        onClose={() => setJumpOpen(false)}
      >
        <form
          className="jump-form"
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number(jump);
            if (Number.isInteger(n) && n >= 1 && n <= record.pages) {
              setJumpOpen(false);
              requestAnimationFrame(() => jumpTo(n));
            }
          }}
        >
          <TextField>
            <Label>이동할 페이지 (1–{record.pages})</Label>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={record.pages}
              value={jump}
              onChange={(e) => setJump(e.target.value)}
              autoFocus
              required
            />
          </TextField>
          <Button
            type="submit"
            fullWidth
            isDisabled={
              !pages.length ||
              !Number.isInteger(Number(jump)) ||
              Number(jump) < 1 ||
              Number(jump) > record.pages
            }
          >
            이동
          </Button>
        </form>
      </Dialog>
    </main>
  );
}
function PageImage({
  page,
  title,
  eager,
  retry,
}: {
  page: CuePage;
  title: string;
  eager: boolean;
  retry: () => void;
}) {
  const [failed, setFailed] = useState(false);
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
    <img
      className="cue-image"
      src={page.image}
      width={page.width}
      height={page.height}
      alt={title}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

function Composer({
  user,
  catalog,
  update,
  notify,
}: {
  user: UserState;
  catalog: ArchiveRecord[];
  update: React.Dispatch<React.SetStateAction<UserState>>;
  notify: (s: string) => void;
}) {
  const [name, setName] = useState(user.nickname),
    [attachOpen, setAttachOpen] = useState(false),
    [q, setQ] = useState(""),
    [message, setMessage] = useState("");
  const draft = user.draft;
  const setDraft = (p: Partial<typeof draft>) =>
    update((s) => ({ ...s, draft: { ...s.draft, ...p } }));
  const attached = catalog.find((r) => r.id === draft.recordId);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !draft.title.trim() || !draft.body.trim()) {
      setMessage("닉네임, 제목, 내용을 모두 입력해 주세요.");
      return;
    }
    const post: Post = {
      id: uid(),
      author: name.trim(),
      category: draft.category,
      title: draft.title.trim(),
      body: draft.body.trim(),
      date: new Date().toISOString(),
      likes: 0,
      views: 0,
      ...(draft.recordId ? { recordId: draft.recordId } : {}),
    };
    update((s) => ({
      ...s,
      nickname: name.trim(),
      posts: [post, ...s.posts],
      draft: emptyDraft(),
    }));
    notify("이 브라우저에 글을 저장했어요.");
    go("/post/" + post.id, true);
  };
  return (
    <main>
      <DetailHeader title="이야기 쓰기">
        <span className="draft-label">자동 저장</span>
      </DetailHeader>
      <form className="composer" onSubmit={submit}>
        <p className="local-notice">
          <Info size={16} />
          <span>작성한 글은 이 브라우저에만 저장됩니다.</span>
        </p>
        <Picker
          label="게시판 분류"
          visibleLabel
          value={draft.category}
          onChange={(category) => setDraft({ category: category as Category })}
          options={categories.map((c) => ({
            id: c,
            label: c === "일상" ? "자유게시판 · 일상" : c,
          }))}
        />
        <TextField isRequired value={name} onChange={setName}>
          <Label>닉네임</Label>
          <Input placeholder="어떤 이름으로 이야기할까요?" maxLength={16} />
        </TextField>
        <TextField
          isRequired
          value={draft.title}
          onChange={(title) => setDraft({ title })}
        >
          <Label>제목</Label>
          <Input placeholder="제목을 입력해 주세요" maxLength={100} />
        </TextField>
        <TextField
          isRequired
          value={draft.body}
          onChange={(body) => setDraft({ body })}
        >
          <Label>내용</Label>
          <TextArea
            placeholder="반가운 안부, 방송실의 추억, 함께 듣고 싶은 노래… 편하게 남겨주세요."
            rows={9}
            maxLength={10000}
          />
        </TextField>
        <div className="composer-count">
          {draft.body.length.toLocaleString()} / 10,000
        </div>
        {attached ? (
          <div className="attached-composer">
            <FileText size={18} />
            <span>
              {attached.title} · {attached.year}년
            </span>
            <IconButton
              label="첨부 큐시트 해제"
              onPress={() => setDraft({ recordId: "" })}
            >
              <X size={17} />
            </IconButton>
          </div>
        ) : (
          <Button
            variant="outline"
            className="attach-button"
            onPress={() => setAttachOpen(true)}
          >
            <Paperclip size={17} />
            큐시트 첨부
          </Button>
        )}
        {message && (
          <p role="alert" className="form-error">
            {message}
          </p>
        )}
        <Button type="submit" fullWidth className="submit-post">
          등록하기
        </Button>
        <p className="draft-hint">작성 중인 내용은 자동으로 임시 저장돼요.</p>
      </form>
      <Dialog
        title="함께 읽을 큐시트"
        open={attachOpen}
        onClose={() => setAttachOpen(false)}
      >
        <SearchBox value={q} onChange={setQ} label="프로그램 또는 연도 검색" />
        <div className="attachment-results">
          {filterArchive(catalog, q)
            .slice(0, 12)
            .map((r) => (
              <RecordRow
                key={r.id}
                record={r}
                onClick={() => {
                  setDraft({ recordId: r.id });
                  setAttachOpen(false);
                }}
              />
            ))}
          {!filterArchive(catalog, q).length && (
            <p className="no-comments">검색 결과가 없어요.</p>
          )}
        </div>
      </Dialog>
    </main>
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
        <h1>내 스크랩</h1>
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
                아카이브 둘러보기 <ArrowRight size={16} />
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
          title="아직 스크랩한 글이 없어요"
          body="마음에 남는 이야기의 스크랩을 눌러보세요."
          action={
            <Button variant="secondary" onPress={() => go("/board")}>
              이야기 둘러보기
            </Button>
          }
        />
      )}
      <p className="saved-note">스크랩은 이 브라우저에 저장돼요.</p>
    </main>
  );
}
function GlobalSearch({
  catalog,
  posts,
  openRecord,
}: {
  catalog: ArchiveRecord[];
  posts: Post[];
  openRecord: (r: ArchiveRecord) => void;
}) {
  const [query, setQuery] = useState("");
  const records = query.trim() ? filterArchive(catalog, query) : [];
  const foundPosts = query.trim()
    ? posts.filter((p) =>
        normalize(p.title + p.body).includes(normalize(query)),
      )
    : [];
  return (
    <main>
      <DetailHeader title="통합 검색" />
      <div className="global-search">
        <SearchBox
          value={query}
          onChange={setQuery}
          label="프로그램, 연도, 이야기 검색"
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
                이야기 <span>{foundPosts.length}</span>
              </h2>
            </div>
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
            {!foundPosts.length && (
              <p className="no-comments">일치하는 이야기가 없어요.</p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
