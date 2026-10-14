// Return locations are app routes, never arbitrary redirects.
// Keep reading the old key so a Kakao sign-in started before an update can finish.
export const oauthReturnKey = "voku-kakao-return";
export function safeReturnPath(value: unknown): string {
  if (typeof value !== "string" || value.length > 4096 || !value.startsWith("/") || value.startsWith("//") || /[\\\x00-\x1f\x7f#]/.test(value)) return "/board";
  const path = value.split("?")[0];
  return /^\/(?:board|home|archive|search|write|account|saved|notifications|admin|ux-log|post\/[a-zA-Z0-9_-]+|read\/voku_[a-z0-9_]+)$/.test(path) ? value : "/board";
}
export function readOAuthError(search: string, hash: string, provider?: string): string {
  const query = new URLSearchParams(search);
  const fragment = new URLSearchParams(hash.replace(/^#/, ""));
  const code = query.get("error_code") || fragment.get("error_code") || query.get("error") || fragment.get("error");
  if (!code) return "";
  if (["otp_expired", "flow_state_expired", "flow_state_not_found"].includes(code))
    return "인증 링크가 만료되었거나 이미 사용되었어요. 인증 메일을 다시 받아 주세요.";
  const name = provider === "kakao" ? "카카오 로그인" : provider === "google" ? "Google 로그인" : "인증";
  return code === "access_denied"
    ? `${name}이 취소되었어요. 다시 시도할 수 있습니다.`
    : `${name}을 완료하지 못했어요. 다시 시도해 주세요.`;
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
