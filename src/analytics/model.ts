export const VISITOR_KEY = "voku-usage-browser-v1";
export const SESSION_KEY = "voku-usage-session-v1";
export const OPT_OUT_KEY = "voku-usage-opt-out";
export const TEST_KEY = "voku-usage-test";
export const SESSION_MS = 30 * 60_000;
export const VISITOR_MS = 180 * 86_400_000;
export const ID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
export const RECORD = /^voku_[a-z0-9_]{1,175}$/;
export function routeInfo(path: string) {
  const clean = path.split("?")[0];
  const segment = clean.split("/")[1];
  const route =
    (
      { read: "reader", "home-example": "example", p: "post" } as Record<
        string,
        string
      >
    )[segment] ||
    ([
      "home",
      "archive",
      "board",
      "news",
      "post",
      "write",
      "search",
      "auth",
      "account",
      "notifications",
      "admin",
      "saved",
    ].includes(segment)
      ? segment
      : "other");
  const record =
    route === "reader" && RECORD.test(clean.slice(6))
      ? clean.slice(6)
      : undefined;
  return { route, record, key: clean };
}
export function acquisition(referrer: string, search: string, host: string) {
  let source = "direct";
  try {
    const from = new URL(referrer).hostname;
    source = from === host ? "internal" : "other";
    for (const name of [
      "google",
      "naver",
      "daum",
      "kakao",
      "youtube",
      "instagram",
      "facebook",
      "github",
      "huggingface",
    ]) {
      if (new RegExp(`(^|\\.)${name}\\.(com|co\\.kr|co|net)$`).test(from))
        source = name;
    }
  } catch {
    /* No referrer; never persist the raw URL. */
  }
  const campaign = new URLSearchParams(search).get("utm_campaign") || "";
  return {
    source,
    campaign: ["launch", "alumni", "qr", "newsletter"].includes(campaign)
      ? campaign
      : "none",
  };
}
export function activeDelta(
  now: number,
  previous: number,
  visible: boolean,
  lastInput: number,
) {
  return visible && now - lastInput < 60_000
    ? Math.max(0, Math.min(2000, now - previous))
    : 0;
}
export function validIdentity(
  value: unknown,
  now: number,
  maxAge: number,
): value is { id: string; at: number; last: number; seq: number } {
  const x = value as { id?: string; at?: number; last?: number } | null;
  return (
    !!x &&
    typeof x.id === "string" &&
    ID.test(x.id) &&
    typeof x.at === "number" &&
    x.at <= now &&
    now - x.at < maxAge
  );
}
