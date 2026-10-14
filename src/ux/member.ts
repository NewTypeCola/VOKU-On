import type { Account, Action, CommunityComment, CommunityPost } from "../community/types";

export const studyWriteMessage = "UX 테스트 버전에서는 글·댓글 등록과 정보 변경을 할 수 없어요.";
const key = "voku-ux-member-v1";
type State = { loggedIn: boolean; joined: string; saved: string[]; records: string[]; likes: string[]; commentLikes: string[] };
type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;

/** A tab-local UI identity. Never an Auth user, JWT or shared community profile. */
export function createStudyMember(storage?: Storage) {
  const empty = (): State => ({ loggedIn: false, joined: new Date().toISOString(), saved: [], records: [], likes: [], commentLikes: [] });
  let state = empty();
  try {
    const saved = JSON.parse(storage?.getItem(key) || "null");
    if (saved && typeof saved.loggedIn === "boolean" && typeof saved.joined === "string" &&
      ["saved", "records", "likes", "commentLikes"].every(k => Array.isArray(saved[k]) && saved[k].length <= 100 && saved[k].every((id: unknown) => typeof id === "string" && id.length < 160))) state = saved;
  } catch { /* A blocked sessionStorage falls back to memory. */ }
  const listeners = new Set<() => void>();
  const persist = () => { try { storage?.setItem(key, JSON.stringify(state)); } catch { /* memory only */ } };
  const publish = () => { persist(); listeners.forEach(fn => fn()); };
  const toggle = (items: string[], id: string, value: boolean) => value ? [...new Set([...items, id])].slice(-100) : items.filter(item => item !== id);
  return {
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    login() { state.loggedIn = true; publish(); },
    logout() { state = empty(); publish(); },
    savedIds: () => state.loggedIn ? [...state.saved] : [],
    account(saved: CommunityPost[] = []): Account | null {
      if (!state.loggedIn) return null;
      return {
        profile: { id: "ux-test-member", nickname: "체험 회원", introduction: "UX 테스트용 프로필입니다.", profileComplete: true, providers: ["kakao"], admissionYear: null, cohort: null, role: "member", joinedAt: state.joined, suspendedUntil: null, suspensionReason: "" },
        posts: [], comments: [], saved, archiveSaved: [...state.records], notifications: [], unreadNotificationCount: 0, blocked: [], reports: [],
      };
    },
    post(post: CommunityPost): CommunityPost {
      const liked = state.loggedIn && state.likes.includes(post.id);
      return { ...post, liked, likes: post.likes + (liked ? 1 : 0), bookmarked: state.loggedIn && state.saved.includes(post.id) };
    },
    comment(comment: CommunityComment): CommunityComment {
      const liked = state.loggedIn && state.commentLikes.includes(comment.id);
      return { ...comment, liked, likes: (comment.likes || 0) + (liked ? 1 : 0) };
    },
    action(action: Action, payload: Record<string, unknown>): { postId?: string; commentId?: string } {
      if (!state.loggedIn) throw Error("체험 회원으로 로그인해 주세요.");
      const sourceId = action === "comment_like" ? payload.id : payload.postId;
      const id = typeof sourceId === "string" ? sourceId : "";
      if (action === "read_notifications") return {};
      if (["like", "bookmark", "comment_like"].includes(action) && id) {
        const field = action === "like" ? "likes" : action === "bookmark" ? "saved" : "commentLikes";
        state[field] = toggle(state[field], id, payload.value === undefined ? !state[field].includes(id) : !!payload.value);
      } else if (action === "archive_bookmark" && Array.isArray(payload.ids)) {
        for (const record of payload.ids) if (typeof record === "string") state.records = toggle(state.records, record, !!payload.value);
      } else throw Error(studyWriteMessage);
      persist();
      return {};
    },
  };
}

let storage: Storage | undefined;
try { storage = typeof sessionStorage === "undefined" ? undefined : sessionStorage; } catch { /* memory only */ }
export const studyMember = createStudyMember(storage);

const readRpcs = new Set(["community_feed", "community_reading", "community_post", "community_post_by_code", "community_account", "home_banners", "community_home"]);
/** Last boundary: even a stale admin session cannot publish from the study client. */
export function studySupabaseFetch(fetcher: typeof fetch): typeof fetch {
  return (input, init) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
    const path = url.pathname;
    const rpc = path.match(/^\/rest\/v1\/rpc\/([^/]+)$/)?.[1];
    const allowed = rpc ? readRpcs.has(rpc) :
      path.startsWith("/auth/v1/") ? (method === "GET" || (method === "POST" && ["/auth/v1/token", "/auth/v1/logout"].includes(path))) :
      method === "GET" || method === "HEAD" || (method === "POST" && path.startsWith("/storage/v1/object/sign/"));
    if (!allowed) return Promise.reject(Error(studyWriteMessage));
    return fetcher(input, init);
  };
}
