import { createClient } from "@supabase/supabase-js";
import { preview } from "./preview";
import { oauthReturnKey, safeReturnPath, safeKakaoAvatar } from "./oauth";
import type {
  Account,
  Action,
  AdminData,
  Feed,
  FeedQuery,
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
export const emailSignupEnabled = env.VITE_EMAIL_SIGNUP_ENABLED === "true";
export async function signInWithKakao(next = "/board") {
  if (!supabase || !kakaoEnabled) throw Error("카카오 로그인 연결을 준비 중입니다.");
  sessionStorage.setItem(oauthReturnKey, safeReturnPath(next));
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "kakao",
    // Supabase appends `scopes` to Kakao's default email/image scopes.
    // Passing the provider's singular `scope` replaces that list, so a non-Biz
    // app requests only the optional nickname/photo consent configured in Kakao.
    options: { redirectTo: authRedirect(), queryParams: { scope: "profile_nickname,profile_image" } },
  });
  if (error) { sessionStorage.removeItem(oauthReturnKey); throw error; }
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
    return "카카오 로그인을 준비 중입니다. 잠시 후 다시 시도해 주세요.";
  if (/Invalid login credentials/i.test(message))
    return "이메일 또는 비밀번호를 확인해 주세요.";
  if (/Email not confirmed/i.test(message))
    return "이메일 인증을 먼저 완료해 주세요.";
  if (/User already registered/i.test(message))
    return "이미 가입한 이메일입니다. 로그인을 이용해 주세요.";
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
export const api = {
  feed: (q: FeedQuery = {}) =>
    live
      ? rpc<Feed>("community_feed", {
          p_category: q.category || "",
          p_sort: q.sort || "latest",
          p_query: q.query || "",
          p_page: q.page || 1,
        })
      : preview.feed(q),
  thread: (id: string) =>
    live ? rpc<Thread>("community_post", { p_id: id }) : preview.thread(id),
  account: async (): Promise<Account | null> => {
    if (!supabase) return preview.account();
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    if (error) throw error;
    if (!session) return null;
    const account = await rpc<Account>("community_account");
    const identity = session.user.identities?.find((item) => item.provider === "kakao");
    // The provider photo stays on the current user's account screen. It is
    // never copied to public profiles, posts, or other users' API responses.
    return { ...account, avatarUrl: safeKakaoAvatar(identity?.identity_data?.avatar_url) };
  },
  admin: (query = "") =>
    live
      ? rpc<AdminData>("community_admin", { p_query: query })
      : preview.admin(query),
  action: (action: Action, payload: Record<string, unknown>) =>
    live
      ? rpc<{ postId?: string }>("community_action", {
          p_action: action,
          p_payload: payload,
        })
      : preview.action(action, payload),
};
export const authRedirect = (recovery = false) =>
  `${location.origin}${location.pathname}${recovery ? "?auth=recovery" : ""}`;
