export type ArchiveRecord = {
  id: string;
  year: number;
  term: number;
  title: string;
  en: string;
  slug: string;
  issue: string;
  pages: number;
  start: number;
};
export type CuePage = {
  id: string;
  page: number;
  image: string;
  width: number;
  height: number;
  previewHash?: string;
};
export type Manifest = {
  dataset: string;
  source: string;
  revision: string;
  documents: number;
  pages: number;
  years: number[];
  featured: string[];
  cachedPages: number;
};
export type Category = "일상" | "추억" | "음악" | "질문" | "동문소식";
export type Post = {
  id: string;
  category: Category;
  title: string;
  body: string;
  author: string;
  date: string;
  likes: number;
  views: number;
  demo?: boolean;
  recordId?: string;
  commentCount?: number;
};
export type Comment = {
  id: string;
  author: string;
  body: string;
  date: string;
  demo?: boolean;
  parentId?: string;
};
export type Draft = {
  category: Category;
  title: string;
  body: string;
  recordId: string;
};
export type UserState = {
  version: 1;
  nickname: string;
  posts: Post[];
  comments: Record<string, Comment[]>;
  likes: string[];
  saved: string[];
  progress: Record<string, number>;
  draft: Draft;
};
export const SOURCE =
  "https://huggingface.co/datasets/NewTypeCola/VOKU-Archive";
export const categories: Category[] = [
  "일상",
  "추억",
  "음악",
  "질문",
  "동문소식",
];
export const emptyDraft = (): Draft => ({
  category: "일상",
  title: "",
  body: "",
  recordId: "",
});
export const emptyState = (): UserState => ({
  version: 1,
  nickname: "",
  posts: [],
  comments: {},
  likes: [],
  saved: [],
  progress: {},
  draft: emptyDraft(),
});
export const STORAGE_KEY = "voku-on14-v1";
export const normalize = (s: string) =>
  s.normalize("NFC").toLowerCase().replace(/\s/g, "");
export function uid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // LAN previews use HTTP, where randomUUID may be unavailable. getRandomValues
  // also works outside a secure context and keeps UUIDs cryptographically random.
  // https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export function loadState(): UserState {
  const base = emptyState();
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!v || v.version !== 1) return base;
    const str = (s: unknown, max: number): s is string =>
      typeof s === "string" && s.length <= max;
    const ids = (a: unknown) =>
      Array.isArray(a) ? a.filter((x) => str(x, 180)).slice(0, 2000) : [];
    const comments: UserState["comments"] = {};
    for (const [key, values] of Object.entries(v.comments || {})) {
      if (
        ["__proto__", "constructor", "prototype"].includes(key) ||
        !Array.isArray(values)
      )
        continue;
      comments[key] = values
        .filter(
          (x) =>
            x &&
            str(x.id, 180) &&
            str(x.author, 16) &&
            str(x.body, 2000) &&
            str(x.date, 40),
        )
        .slice(0, 1000);
    }
    const progress = Object.fromEntries(
      Object.entries(v.progress || {}).filter(
        ([k, n]) =>
          k.startsWith("voku_") &&
          Number.isInteger(n) &&
          Number(n) > 0 &&
          Number(n) < 1000,
      ),
    ) as Record<string, number>;
    const posts = Array.isArray(v.posts)
      ? v.posts
          .filter(
            (p: Post) =>
              p &&
              str(p.id, 180) &&
              str(p.title, 100) &&
              str(p.body, 10000) &&
              str(p.author, 16) &&
              str(p.date, 40) &&
              categories.includes(p.category) &&
              Number.isFinite(p.likes) &&
              Number.isFinite(p.views),
          )
          .slice(0, 500)
      : [];
    const d = v.draft;
    const draft =
      d &&
      categories.includes(d.category) &&
      str(d.title, 100) &&
      str(d.body, 10000) &&
      str(d.recordId, 180)
        ? d
        : emptyDraft();
    return {
      ...base,
      nickname: str(v.nickname, 16) ? v.nickname : "",
      posts,
      comments,
      progress,
      draft,
      saved: ids(v.saved),
      likes: ids(v.likes),
    };
  } catch {
    return base;
  }
}
export function persist(state: UserState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
export const dateLabel = (date: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Seoul",
  })
    .format(new Date(date))
    .replace(/\s/g, "")
    .replace(/\.$/, "");
export const recordLabel = (r: ArchiveRecord) =>
  `${r.year}년 ${r.term}학기 · ${r.issue}회`;
const date = (time: string) => `2026-10-10T${time}:00+09:00`;
export const demoPosts: Post[] = [
  {
    id: "sample-1",
    category: "추억",
    title: "큐시트 한 장에 방송실이 생각나네요",
    body: "오랜만에 광교음악산책 큐시트를 펼쳐봤어요.\n\n손으로 꾹꾹 적은 글씨와 곡 사이의 작은 표시들. 종이 한 장인데도 방송 시작 전의 분주했던 공기가 떠오르네요.\n\n원고를 읽는 동안만큼은 다시 방송실에 앉아 있는 기분이었습니다. 여러분도 기억나는 프로그램이 있나요?",
    author: "오후의주파수",
    date: date("09:12"),
    likes: 24,
    views: 186,
    demo: true,
    recordId: "voku_1994_1_gwanggyo_music_walk_01",
  },
  {
    id: "sample-2",
    category: "일상",
    title: "방송 시작 10초 전, 무슨 생각 했어요?",
    body: "저는 첫 문장만 머릿속으로 계속 읽었어요.\n\n큐사인 떨어지면 그제야 숨이 쉬어졌던 것 같기도 하고요. 지금 생각하면 그 몇 초가 참 길었는데! 다들 방송 직전의 루틴이 있었나요?",
    author: "큐사인",
    date: date("09:04"),
    likes: 18,
    views: 142,
    demo: true,
  },
  {
    id: "sample-3",
    category: "음악",
    title: "가을 아침에 듣기 좋은 곡, 하나씩 놓고 가요",
    body: "아침저녁으로 공기가 제법 선선해졌네요.\n\n학교 가는 길에 듣던 노래가 문득 생각나서요. 오늘의 첫 곡으로 고르고 싶은 노래, 한 곡씩 알려주세요. 이유도 같이 적어주시면 더 좋고요 :)",
    author: "페이더올려",
    date: date("08:56"),
    likes: 12,
    views: 98,
    demo: true,
  },
  {
    id: "sample-4",
    category: "질문",
    title: "프로그램 이름이 기억 안 나도 자료를 찾을 수 있나요?",
    body: "2004년 봄에 했던 아침 방송을 찾아보고 싶어요.\n\n정확한 프로그램 이름이 기억나지 않는데 연도와 학기만으로도 찾을 수 있을까요?",
    author: "다시듣기",
    date: date("08:41"),
    likes: 3,
    views: 62,
    demo: true,
  },
  {
    id: "sample-5",
    category: "추억",
    title: "모닝커피 읽다가 진짜 커피 한 잔 내려왔어요",
    body: "2011년 모닝커피 원고를 읽고 있어요.\n\n페이지를 천천히 내려 읽다 보니 한 편의 방송을 듣는 기분이네요. 주말 오전에 커피와 함께 읽기 좋습니다.",
    author: "한잔더",
    date: date("08:28"),
    likes: 9,
    views: 87,
    demo: true,
    recordId: "voku_2011_1_morning_coffee_01",
  },
  {
    id: "sample-6",
    category: "일상",
    title: "안녕하세요. 오랜만에 인사 남깁니다 :)",
    body: "자료들이 이렇게 모여 있는 걸 보니 반갑네요.\n\n이름이 익숙한 프로그램도 있고, 처음 보는 원고도 있고요. 시간 날 때 조금씩 읽어보려고 합니다. 모두 반가워요!",
    author: "녹음버튼",
    date: date("08:16"),
    likes: 16,
    views: 111,
    demo: true,
  },
  {
    id: "sample-7",
    category: "음악",
    title: "선곡표 쓰던 시간도 참 좋았는데",
    body: "한 곡을 넣었다 뺐다 하며 방송 흐름을 고민하던 시간이 생각나요.\n\n앞 곡의 마지막과 다음 곡의 첫 부분이 잘 이어지면 괜히 혼자 뿌듯해지고요. 지금도 플레이리스트를 만들 때 그 습관이 남아 있네요.",
    author: "8시40분",
    date: date("07:58"),
    likes: 6,
    views: 59,
    demo: true,
  },
  {
    id: "sample-8",
    category: "추억",
    title: "손글씨 원고는 자꾸 천천히 읽게 돼요",
    body: "시가 있는 오후를 한 장씩 읽었습니다.\n\n줄마다 조금씩 다른 글씨를 보면 원고를 쓰던 사람의 호흡이 느껴지는 것 같아요. 이번 주말에는 다른 연도도 찾아봐야겠어요.",
    author: "종이위라디오",
    date: date("07:44"),
    likes: 8,
    views: 72,
    demo: true,
    recordId: "voku_1998_1_an_afternoon_with_poetry_01",
  },
  {
    id: "sample-9",
    category: "질문",
    title: "읽던 원고를 따로 모아둘 수 있나요?",
    body: "마음에 드는 자료를 다음에도 이어 읽고 싶어요.\n\n처음부터 다시 찾지 않아도 되는 방법이 있으면 알려주세요!",
    author: "초록불",
    date: date("07:30"),
    likes: 2,
    views: 38,
    demo: true,
  },
  {
    id: "sample-news",
    category: "동문소식",
    title: "동문들의 반가운 소식을 기다립니다",
    body: "다시 만난 동기 이야기, 후배에게 전하고 싶은 안부, 함께 나누고 싶은 근황을 남겨주세요.\n\n이 글은 게시판 구성을 보여주는 예시입니다. 실제 행사나 모임 일정은 등록되어 있지 않습니다.",
    author: "VOKU On",
    date: date("07:00"),
    likes: 0,
    views: 0,
    demo: true,
  },
];
const seeds: Record<string, [string, string][]> = {
  "sample-1": [
    ["녹음버튼", "손글씨를 보니까 원고 고쳐 쓰던 기억이 나네요."],
    ["라디오산책", "저도 천천히 읽고 있어요. 반가운 자료네요 :)"],
    ["초록불", "이런 원고가 남아 있어서 참 다행이에요."],
  ],
  "sample-2": [
    ["페이더올려", "첫 곡 제대로 들어갔나, 그것만 생각했어요 ㅋㅋ"],
    ["종이비행기", "물 한 모금 마시고 심호흡이요!"],
  ],
  "sample-3": [["한잔더", "오늘은 잔잔한 피아노 연주곡으로 시작했어요."]],
  "sample-4": [
    [
      "아카이브산책",
      "상단 큐시트 찾기에서 연도와 학기를 고르면 프로그램을 찾아볼 수 있어요.",
    ],
  ],
  "sample-6": [["큐사인", "반갑습니다. 자주 놀러 오세요 :)"]],
  "sample-9": [
    [
      "아카이브산책",
      "원고 위의 저장 버튼을 눌러보세요. 전체 메뉴의 저장한 글·자료에서 다시 열 수 있어요.",
    ],
  ],
};
export const seedComments = (id: string): Comment[] =>
  (seeds[id] || []).map(([author, body], i) => ({
    id: `${id}-comment-${i}`,
    author,
    body,
    date: date("09:20"),
    demo: true,
  }));
export function filterArchive(
  catalog: ArchiveRecord[],
  query = "",
  year = "",
  term = "",
  program = "",
) {
  const q = normalize(query);
  return catalog.filter(
    (r) =>
      (!year || String(r.year) === year) &&
      (!term || String(r.term) === term) &&
      (!program || r.slug === program) &&
      (!q ||
        normalize(`${r.title} ${r.en} ${r.year} ${r.issue}회`).includes(q)),
  );
}
export { getPages } from "./cuePages";
