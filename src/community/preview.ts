import { demoPosts, seedComments, loadState, normalize } from "../data";
import { affiliationLabel, parseAffiliation } from "./affiliation";
import {
  staff,
  suspended,
  type Profile,
  type CommunityPost,
  type CommunityComment,
  type FeedQuery,
  type Account,
  type Report,
  type Audit,
  type Action,
  type ActivityKind,
  type ActivityPage,
  type CommunityNotification,
} from "./types";

// This adapter is a labelled, isolated UI sandbox. It never authenticates real users.
const KEY = "voku-community-preview-v1";
const SESSION = "voku-community-preview-role";
const uuid = () =>
  crypto.randomUUID?.() ||
  `preview-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const now = () => new Date().toISOString();
const member: Profile = {
  id: "preview-member",
  nickname: "방송실산책",
  profileComplete: true,
  providers: [],
  admissionYear: 2018,
  cohort: 93,
  role: "member",
  joinedAt: "2026-10-10T00:00:00Z",
  suspendedUntil: null,
  suspensionReason: "",
};
const admin: Profile = {
  ...member,
  id: "preview-admin",
  nickname: "VOKU운영팀",
  role: "admin",
};
type Store = {
  members: Profile[];
  posts: CommunityPost[];
  comments: CommunityComment[];
  likes: Record<string, string[]>;
  saved: Record<string, string[]>;
  blocked: Record<string, string[]>;
  reports: Report[];
  audit: Audit[];
  notifications: (CommunityNotification & { userId: string })[];
};
function seed(): Store {
  const legacy = loadState();
  const members = [
    member,
    admin,
    ...demoPosts.map((p) => ({
      ...member,
      id: `author-${p.id}`,
      nickname: p.author,
    })),
  ];
  const posts: CommunityPost[] = [
    ...legacy.posts.map((p) => ({ ...p, demo: true, authorId: member.id })),
    ...demoPosts.map((p) => ({ ...p, authorId: `author-${p.id}` })),
  ].map((p) => ({
    ...p,
    authorRole: "member",
    pinned: false,
    locked: false,
    status: "published",
    commentCount: 0,
    liked: false,
    bookmarked: false,
  }));
  posts.unshift({
    id: "preview-notice",
    category: "일상",
    title: "처음 오셨다면, 커뮤니티 이용 안내",
    body: "VOKU On은 방송의 기억과 오늘의 안부를 나누는 공간입니다.\n\n1. 서로를 존중하며 이야기해 주세요.\n2. 전화번호·주소 등 다른 사람의 개인정보를 올리지 말아 주세요.\n3. 원고에 관한 글에는 큐시트를 연결하면 함께 읽기 편합니다.\n4. 문제가 있는 글과 댓글은 신고해 주세요. 운영진이 확인합니다.\n\n이 공지는 기능 확인을 위한 예시입니다. 정식 운영 공지는 관리자가 직접 작성합니다.",
    author: admin.nickname,
    authorId: admin.id,
    authorRole: "admin",
    date: now(),
    likes: 0,
    views: 0,
    pinned: true,
    locked: false,
    status: "published",
    commentCount: 0,
    liked: false,
    bookmarked: false,
    demo: true,
  });
  const comments: CommunityComment[] = demoPosts.flatMap((p) =>
    seedComments(p.id).map((c, i) => ({
      ...c,
      authorId: `author-${demoPosts[(i + 2) % demoPosts.length].id}`,
      authorRole: "member",
      postId: p.id,
      status: "published",
    })),
  );
  return {
    members,
    posts,
    comments,
    likes: {},
    saved: { [member.id]: legacy.saved },
    blocked: {},
    reports: [],
    audit: [],
    notifications: [],
  };
}
let store: Store;
try {
  const value = JSON.parse(localStorage.getItem(KEY) || "null");
  store = value?.posts && value?.members && value?.reports ? value : seed();
} catch {
  store = seed();
}
store.members = store.members.map((m) => ({
  ...m,
  profileComplete: m.profileComplete ?? true,
  providers: m.providers ?? [],
  admissionYear: m.admissionYear ?? null,
  cohort: m.cohort ?? null,
}));
let current = sessionStorage.getItem(SESSION) || "";
const persist = () => localStorage.setItem(KEY, JSON.stringify(store));
const profile = () => store.members.find((m) => m.id === current) || null;
const requireMember = () => {
  const m = profile();
  if (!m) throw Error("로그인 후 이용해 주세요.");
  if (suspended(m)) throw Error("이용이 제한된 계정입니다.");
  return m;
};
const post = (p: CommunityPost): CommunityPost => ({
  ...p,
  author: store.members.find((m) => m.id === p.authorId)?.nickname || p.author,
  likes:
    p.likes +
    Object.values(store.likes).filter((ids) => ids.includes(p.id)).length,
  liked: !!store.likes[current]?.includes(p.id),
  bookmarked: !!store.saved[current]?.includes(p.id),
  commentCount: store.comments.filter(
    (c) => c.postId === p.id && c.status === "published",
  ).length,
});
const addLog = (action: string, target: string, reason = "") =>
  store.audit.unshift({
    id: uuid(),
    actor: profile()!.nickname,
    action,
    target,
    reason,
    date: now(),
  });
export const preview = {
  profile,
  login(role: "member" | "admin") {
    current = role === "admin" ? admin.id : member.id;
    sessionStorage.setItem(SESSION, current);
  },
  logout() {
    current = "";
    sessionStorage.removeItem(SESSION);
  },
  async feed(q: FeedQuery = {}) {
    const all = store.posts
      .filter(
        (p) =>
          p.status === "published" &&
          (p.pinned || !store.blocked[current]?.includes(p.authorId)),
      )
      .map(post);
    const filtered = all
      .filter(
        (p) =>
          (!p.pinned || q.category === "공지" || !!q.query) &&
          (!q.category ||
            q.category === "전체" ||
            (q.category === "공지"
              ? p.pinned
              : q.category === "자료 이야기"
                ? !!p.recordId
                : q.category === "자유글"
                  ? p.category === "일상" && !p.recordId
                  : p.category === q.category)) &&
          normalize(p.title + p.body + p.author).includes(
            normalize(q.query || ""),
          ),
      )
      .sort(
        (a, b) =>
          (q.sort === "popular" ? b.likes - a.likes : 0) ||
          b.date.localeCompare(a.date),
      );
    return {
      posts: filtered.slice(((q.page || 1) - 1) * 20, (q.page || 1) * 20),
      notices: all.filter((p) => p.pinned).slice(0, 3),
      total: filtered.length,
    };
  },
  async thread(id: string) {
    const p = store.posts.find(
      (p) =>
        p.id === id &&
        p.status !== "deleted" &&
        (p.status === "published" || staff(profile())),
    );
    if (!p) throw Error("글을 찾을 수 없거나 공개되지 않은 글입니다.");
    return {
      post: post(p),
      comments: store.comments
        .filter(
          (c) =>
            c.postId === id && !store.blocked[current]?.includes(c.authorId),
        )
        .map((c) => ({
          ...c,
          body:
            c.status === "published"
              ? c.body
              : c.status === "hidden"
                ? "운영진이 숨긴 댓글입니다."
                : "삭제된 댓글입니다.",
        })),
    };
  },
  async account(): Promise<Account | null> {
    const p = profile();
    if (!p) return null;
    return {
      profile: p,
      posts: store.posts
        .filter((x) => x.authorId === p.id && x.status === "published")
        .map(post),
      comments: store.comments.filter(
        (c) => c.authorId === p.id && c.status === "published",
      ),
      saved: store.posts
        .filter(
          (x) => store.saved[p.id]?.includes(x.id) && x.status === "published",
        )
        .map(post),
      notifications: store.notifications.filter((n) => n.userId === p.id),
      unreadNotificationCount: store.notifications.filter((n) => n.userId === p.id && !n.read).length,
      blocked: store.members
        .filter((m) => store.blocked[p.id]?.includes(m.id))
        .map((m) => ({ id: m.id, nickname: m.nickname })),
      reports: store.reports.filter((r) => r.reporter === p.nickname),
    };
  },
  async activity(kind: ActivityKind, requestedPage: number): Promise<ActivityPage> {
    const p = profile();
    if (!p) throw Error("로그인이 필요합니다.");
    const newest = (a: {date: string; id: string}, b: {date: string; id: string}) =>
      b.date.localeCompare(a.date) || b.id.localeCompare(a.id);
    const paginate = <T,>(items: T[]) => {
      const page = Math.min(Math.max(1, requestedPage), Math.max(1, Math.ceil(items.length / 20)));
      return { items: items.slice((page - 1) * 20, page * 20), total: items.length, page, pageSize: 20 };
    };
    if (kind === "posts") return { kind, ...paginate(store.posts
      .filter(x => x.authorId === p.id && x.status === "published").sort(newest).map(post)) };
    if (kind === "comments") return { kind, ...paginate(store.comments
      .filter(c => c.authorId === p.id && c.status === "published" && store.posts.some(x => x.id === c.postId && x.status === "published")).sort(newest)) };
    return { kind, ...paginate(store.notifications.filter(n => n.userId === p.id).sort(newest)) };
  },
  async admin(query = "") {
    if (!staff(profile())) throw Error("운영 권한이 필요합니다.");
    return {
      stats: {
        pendingReports: store.reports.filter((r) => r.status === "open").length,
        pinnedPosts: store.posts.filter(
          (p) => p.pinned && p.status === "published",
        ).length,
        suspendedMembers: store.members.filter(suspended).length,
      },
      reports: store.reports,
      members: store.members.filter((m) =>
        normalize(
          `${m.nickname} ${m.admissionYear || ""} ${affiliationLabel(m)}`,
        ).includes(normalize(query)),
      ),
      posts: store.posts
        .filter(
          (p) =>
            p.status !== "deleted" &&
            normalize(p.title).includes(normalize(query)),
        )
        .map(post),
      audit: store.audit,
    };
  },
  async action(action: Action, d: Record<string, any>) {
    const m = action === "read_notifications" ? profile() : requireMember();
    if (!m) throw Error("로그인이 필요합니다.");
    const isStaff = staff(m);
    const p = store.posts.find((p) => p.id === (d.postId || d.id));
    let postId: string | undefined = d.postId;
    const requireStaff = () => {
      if (!isStaff) throw Error("운영 권한이 필요합니다.");
    };
    const validPost = () => {
      if (
        !p ||
        p.status === "deleted" ||
        (p.status !== "published" && !isStaff)
      )
        throw Error("글을 찾을 수 없습니다.");
      return p;
    };
    const toggle = (
      table: Record<string, string[]>,
      id: string,
      value: boolean,
    ) => {
      table[m.id] = value
        ? [...new Set([...(table[m.id] || []), id])]
        : (table[m.id] || []).filter((x) => x !== id);
    };
    if (action === "profile") {
      if (!/^[가-힣a-zA-Z0-9_]{2,16}$/.test(d.nickname))
        throw Error("닉네임은 한글, 영문, 숫자, 밑줄 2~16자로 입력해 주세요.");
      if (
        store.members.some(
          (x) =>
            x.id !== m.id &&
            x.nickname.toLowerCase() === d.nickname.toLowerCase(),
        )
      )
        throw Error("이미 사용 중인 닉네임입니다.");
      const affiliation = parseAffiliation(
        String(
          ("admissionYear" in d ? d.admissionYear : m.admissionYear) ?? "",
        ),
        String(("cohort" in d ? d.cohort : m.cohort) ?? ""),
      );
      m.nickname = d.nickname;
      Object.assign(m, affiliation);
    } else if (action === "post_save") {
      if (
        !d.title?.trim() ||
        !d.body?.trim() ||
        d.title.length > 100 ||
        d.body.length > 10000
      )
        throw Error("제목과 내용을 확인해 주세요.");
      if (d.id) {
        const item = validPost();
        if (item.authorId !== m.id)
          throw Error("본인의 글만 수정할 수 있습니다.");
        Object.assign(item, {
          title: d.title,
          body: d.body,
          category: d.category,
          recordId: d.recordId,
          updatedAt: now(),
        });
        postId = item.id;
      } else {
        if (d.notice) requireStaff();
        postId = uuid();
        store.posts.unshift({
          id: postId,
          author: m.nickname,
          authorId: m.id,
          authorRole: m.role,
          title: d.title,
          body: d.body,
          category: d.category,
          recordId: d.recordId,
          date: now(),
          likes: 0,
          views: 0,
          pinned: !!d.notice,
          locked: false,
          status: "published",
          commentCount: 0,
          liked: false,
          bookmarked: false,
          demo: true,
        });
      }
    } else if (["suspend", "restore_member", "set_role"].includes(action)) {
      requireStaff();
      const target = store.members.find((x) => x.id === d.userId);
      if (
        !target ||
        target.id === m.id ||
        target.role === "admin" ||
        (target.role === "moderator" && m.role !== "admin")
      )
        throw Error("이 회원에 대한 관리 권한이 없습니다.");
      if (action === "set_role") {
        if (m.role !== "admin" || !["member", "moderator"].includes(d.role))
          throw Error("관리자 권한이 필요합니다.");
        target.role = d.role;
      } else if (action === "suspend") {
        if (!d.reason?.trim()) throw Error("제한 사유를 입력해 주세요.");
        target.suspendedUntil = new Date(
          Date.now() + d.days * 86400000,
        ).toISOString();
        target.suspensionReason = d.reason;
      } else {
        target.suspendedUntil = null;
        target.suspensionReason = "";
      }
      addLog(action, target.nickname, d.reason);
    } else if (action === "read_notifications")
      store.notifications
        .filter((n) => n.userId === m.id && (d.id == null || n.id === d.id))
        .forEach((n) => (n.read = true));
    else if (action === "block") {
      if (
        d.userId === m.id ||
        store.members.find((x) => x.id === d.userId)?.role !== "member"
      )
        throw Error("본인이나 운영진은 차단할 수 없습니다.");
      toggle(store.blocked, d.userId, d.value);
    } else if (action === "resolve_report") {
      requireStaff();
      const r = store.reports.find((r) => r.id === d.id);
      if (!r || r.status !== "open") throw Error("이미 처리한 신고입니다.");
      if (!d.reason?.trim()) throw Error("처리 사유를 입력해 주세요.");
      if (d.decision === "hide") {
        const target = r.commentId
          ? store.comments.find((c) => c.id === r.commentId)
          : store.posts.find((p) => p.id === r.postId);
        if (target) target.status = "hidden";
      }
      r.status = d.decision === "hide" ? "resolved" : "dismissed";
      r.resolution = d.reason;
      addLog("report_" + d.decision, r.title, d.reason);
    } else {
      const item = validPost();
      if (action === "post_delete") {
        if (item.authorId !== m.id)
          throw Error("본인의 글만 삭제할 수 있습니다.");
        item.status = "deleted";
      } else if (
        ["post_pin", "post_lock", "post_visibility"].includes(action)
      ) {
        requireStaff();
        if (action === "post_pin") item.pinned = d.value;
        else if (action === "post_lock") item.locked = d.value;
        else {
          if (!d.reason?.trim()) throw Error("처리 사유를 입력해 주세요.");
          item.status = d.value ? "hidden" : "published";
        }
        addLog(action, item.title, d.reason);
      } else if (action === "comment_save") {
        if (item.locked) throw Error("댓글 작성이 잠긴 글입니다.");
        if (!d.body?.trim() || d.body.length > 2000)
          throw Error("댓글 내용을 확인해 주세요.");
        if (d.id) {
          const c = store.comments.find(
            (c) =>
              c.id === d.id &&
              c.postId === item.id &&
              c.authorId === m.id &&
              c.status === "published",
          );
          if (!c) throw Error("본인의 댓글만 수정할 수 있습니다.");
          c.body = d.body;
        } else {
          if (
            d.parentId &&
            !store.comments.some(
              (c) =>
                c.id === d.parentId &&
                c.postId === item.id &&
                !c.parentId &&
                c.status === "published",
            )
          )
            throw Error("답글을 달 수 없는 댓글입니다.");
          store.comments.push({
            id: uuid(),
            postId: item.id,
            author: m.nickname,
            authorId: m.id,
            authorRole: m.role,
            parentId: d.parentId,
            body: d.body,
            date: now(),
            status: "published",
            demo: true,
          });
          if (item.authorId !== m.id)
            store.notifications.unshift({
              id: uuid(),
              userId: item.authorId,
              postId: item.id,
              text: `${m.nickname}님이 댓글을 남겼습니다.`,
              date: now(),
              read: false,
            });
        }
      } else if (action === "comment_delete") {
        const c = store.comments.find(
          (c) => c.id === d.id && c.postId === item.id,
        );
        if (!c || (c.authorId !== m.id && !isStaff))
          throw Error("댓글을 삭제할 권한이 없습니다.");
        c.status = c.authorId === m.id ? "deleted" : "hidden";
        if (c.authorId !== m.id) addLog("comment_hide", c.id, d.reason);
      } else if (action === "like") {
        if (item.authorId === m.id)
          throw Error("본인의 글에는 추천할 수 없습니다.");
        toggle(store.likes, item.id, d.value);
      } else if (action === "bookmark") toggle(store.saved, item.id, d.value);
      else if (action === "report") {
        if (
          store.reports.some(
            (r) =>
              r.reporter === m.nickname &&
              r.postId === item.id &&
              r.commentId === d.commentId,
          )
        )
          throw Error("이미 접수한 신고입니다.");
        const c = store.comments.find(
          (c) => c.id === d.commentId && c.postId === item.id,
        );
        store.reports.unshift({
          id: uuid(),
          postId: item.id,
          commentId: d.commentId,
          targetAuthorId: c?.authorId || item.authorId,
          title: item.title,
          body: c?.body || item.body,
          reporter: m.nickname,
          reason: d.reason,
          detail: d.detail || "",
          status: "open",
          date: now(),
        });
      } else throw Error("지원하지 않는 요청입니다.");
    }
    persist();
    return { postId };
  },
};
