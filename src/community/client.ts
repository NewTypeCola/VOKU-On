import { createReadCache } from "../readCache";
import { createClient } from "@supabase/supabase-js";
import { preview } from "./preview";
import { oauthReturnKey, safeReturnPath, safeKakaoAvatar } from "./oauth";
import { pendingExternalAuth } from "./authFlow";
import type {
  Account,
  Action,
  ActivityKind,
  ActivityPage,
  AdminData,
  Feed,
  FeedQuery,
  ReadingQuery,
  ReadingFeed,
  Thread,
} from "./types";

const env = (import.meta as ImportMeta & { env: Record<string, string> }).env;
const url = env.VITE_SUPABASE_URL || "";
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
function publicKey(value: string) {
  if (value.startsWith("sb_publishable_")) return true;
  try {
    return JSON.parse(atob(value.split(".")[1])).role === "anon";
  } catch {
    return false;
  }
}
export const configurationError =
  (url || key) &&
  (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url) || !publicKey(key))
    ? "Supabase 공개 연결 설정을 확인해 주세요. 관리자 비밀 키는 브라우저에 넣지 않습니다."
    : "";
// Capture before the SDK exchanges the code and removes it from the URL.
export const hasAuthCallback = new URLSearchParams(location.search).has("code");
export const supabase =
  url && key && !configurationError
    ? createClient(url, key, {
        auth: {
          flowType: "pkce",
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;
export const live = !!supabase;
export const kakaoEnabled = env.VITE_KAKAO_LOGIN_ENABLED === "true";
export const googleEnabled = env.VITE_GOOGLE_LOGIN_ENABLED === "true";
export const emailSignupEnabled = env.VITE_EMAIL_SIGNUP_ENABLED === "true";
export async function signInWithProvider(provider: "kakao" | "google", next = "/board") {
  if (!supabase || !(provider === "kakao" ? kakaoEnabled : googleEnabled)) throw Error("이 로그인 방법은 준비 중입니다. 다른 방법을 이용해 주세요.");
  try { sessionStorage.setItem(oauthReturnKey, safeReturnPath(next)); } catch { /* storage may be restricted */ }
  pendingExternalAuth(provider);
  try {
    const { error } = await supabase.auth.signInWithOAuth({
    provider,
    // Supabase appends `scopes` to Kakao's default email/image scopes.
    // Passing the provider's singular `scope` replaces that list, so a non-Biz
    // app requests only the optional nickname/photo consent configured in Kakao.
    options: { redirectTo: authRedirect(), ...(provider === "kakao" ? { queryParams: { scope: "profile_nickname,profile_image" } } : {}) },
    });
    if (error) throw error;
  } catch (error) {
    pendingExternalAuth(null);
    try { sessionStorage.removeItem(oauthReturnKey); } catch { /* restricted storage */ }
    throw error;
  }
}
export const errorText = (error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : (error as { message?: string })?.message ||
        "요청을 처리하지 못했어요. 다시 시도해 주세요.";
  if (/community_nickname_unique|duplicate key/i.test(message))
    return "이미 사용 중인 닉네임입니다. 다른 닉네임을 입력해 주세요.";
  if (/provider is not enabled|Unsupported provider/i.test(message))
    return "이 로그인 방법은 준비 중입니다. 다른 방법을 이용해 주세요.";
  if (/Invalid login credentials/i.test(message))
    return "이메일 또는 비밀번호를 확인해 주세요.";
  if (/Email not confirmed/i.test(message))
    return "이메일 인증을 먼저 완료해 주세요.";
  if (/User already registered/i.test(message))
    return "이미 가입한 이메일입니다. 로그인을 이용해 주세요.";
  if (/expired|invalid.*(token|otp)|token.*invalid/i.test(message))
    return "인증번호나 링크가 만료되었거나 올바르지 않아요. 최신 메일을 확인하거나 다시 받아 주세요.";
  if (/PKCE|code verifier|flow state/i.test(message))
    return "인증을 시작한 브라우저에서 다시 열어 주세요. 이메일 인증은 메일의 인증번호로도 진행할 수 있어요.";
  if (/Email address not authorized|Error sending|SMTP/i.test(message))
    return "인증 메일을 보내지 못했어요. 잠시 후 다시 시도하거나 다른 로그인 방법을 이용해 주세요.";
  if (/Auth session missing|session_not_found/i.test(message))
    return "인증 시간이 지났어요. 로그인하거나 인증 메일을 다시 받아 주세요.";
  if (/same_password/i.test(message)) return "기존 비밀번호와 다른 비밀번호를 입력해 주세요.";
  if (/Database error saving new user/i.test(message))
    return "닉네임이 이미 사용 중이거나 가입 정보를 저장하지 못했어요. 다른 닉네임으로 시도해 주세요.";
  if (/rate limit/i.test(message))
    return "요청이 많습니다. 잠시 후 다시 시도해 주세요.";
  if (/fetch|network/i.test(message))
    return "서버에 연결하지 못했어요. 연결 상태를 확인하고 다시 시도해 주세요.";
  return message;
};
async function rpc<T>(
  name: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (!supabase) throw Error("회원 서버 연결이 필요합니다.");
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw Error(errorText(error));
  return data as T;
}
// Reads are shared only in this tab. Identity changes and every write invalidate them.
const feedReads = createReadCache<Feed>(5000);
const readingReads = createReadCache<ReadingFeed>(5000);
const accountReads = createReadCache<Account>();
export function invalidateCommunityReads() {
  feedReads.clear();
  readingReads.clear();
  accountReads.clear();
}
export const api = {
  feed: (q: FeedQuery = {}) => {
    const params = {
      p_category: q.category === "전체" ? "" : q.category || "",
      p_sort: q.sort || "latest",
      p_query: q.query || "",
      p_page: q.page || 1,
      p_linked: !!q.linked,
    };
    return feedReads.read(JSON.stringify(params), () => live
      ? rpc<Feed>("community_feed", params)
      : preview.feed({ ...q, category: params.p_category }));
  },
  reading: (q: ReadingQuery) => {
    const params = { p_id: q.id, p_category: q.category === "전체" ? "" : q.category || "",
      p_sort: q.sort || "latest", p_query: q.query || "", p_start: q.start ?? null, p_linked: !!q.linked };
    return readingReads.read(JSON.stringify(params), () => live
      ? rpc<ReadingFeed>("community_reading", params) : preview.reading(q));
  },
  thread: (id: string) =>
    live ? rpc<Thread>("community_post", { p_id: id }) : preview.thread(id),
  recordView: async (id: string, visitor: string) => {
    const count = await (live ? rpc<number>("community_post_view", { p_id: id, p_visitor: visitor }) : preview.recordView(id, visitor));
    feedReads.clear();
    return count;
  },
  activity: (kind: ActivityKind, page: number) => live
    ? rpc<ActivityPage>("community_activity", { p_kind: kind, p_page: page })
    : preview.activity(kind, page),
  account: async (): Promise<Account | null> => {
    if (!supabase) return preview.account();
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    if (error) throw error;
    if (!session) return null;
    const account = await accountReads.read(session.user.id, () => rpc<Account>("community_account"));
    const identity = session.user.identities?.find((item) => item.provider === "kakao");
    // The provider photo stays on the current user's account screen. It is
    // never copied to public profiles, posts, or other users' API responses.
    return { ...account, avatarUrl: safeKakaoAvatar(identity?.identity_data?.avatar_url) };
  },
  admin: (query = "") =>
    live
      ? rpc<AdminData>("community_admin", { p_query: query })
      : preview.admin(query),
  action: async (action: Action, payload: Record<string, unknown>) => {
    invalidateCommunityReads();
    try {
      return await (live
        ? action === "read_notifications"
          ? rpc<{ postId?: string; commentId?: string }>("community_read_notifications", { p_id: payload.id ?? null })
          : rpc<{ postId?: string; commentId?: string }>("community_action", { p_action: action, p_payload: payload })
        : preview.action(action, payload));
    } finally {
      // A read started during the write must not survive its completion.
      invalidateCommunityReads();
    }
  },
};
export const authRedirect = (recovery = false) =>
  `${location.origin}${location.pathname}${recovery ? "?auth=recovery" : ""}`;
