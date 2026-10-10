// Return locations are app routes, never arbitrary redirects.
export const oauthReturnKey = "voku-kakao-return";
export function safeReturnPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\r\n]/.test(value)) return "/board";
  const path = value.split("?")[0];
  return /^\/(?:board|home|archive|write|account|saved|notifications|admin|post\/[a-zA-Z0-9-]+|read\/voku_[a-z0-9_]+)$/.test(path) ? value : "/board";
}
export function readOAuthError(search: string, hash: string): string {
  const query = new URLSearchParams(search);
  const fragment = new URLSearchParams(hash.replace(/^#/, ""));
  const code = query.get("error") || fragment.get("error");
  if (!code) return "";
  return code === "access_denied"
    ? "카카오 로그인이 취소되었어요. 다시 시도할 수 있습니다."
    : "카카오 로그인 연결을 완료하지 못했어요. 다시 시도해 주세요.";
}


export function safeKakaoAvatar(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port ||
      !['kakaocdn.net', 'kakaocdn.com'].some(domain => url.hostname === domain || url.hostname.endsWith('.' + domain))) return null;
    url.protocol = 'https:';
    return url.href;
  } catch { return null; }
}
