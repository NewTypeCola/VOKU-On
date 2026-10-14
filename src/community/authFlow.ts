import { safeReturnPath } from "./oauth.ts";

export type AuthMode = "login" | "email" | "join" | "confirm" | "forgot" | "reset" | "profile";
export type AuthReturn = {
  next: string;
  back: string;
  positions: Record<string, number>;
  list?: string;
  createdAt: number;
};
export type PendingEmail = { email: string; kind: "signup" | "recovery"; sentAt: number };
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const returnKey = "voku-auth-return-v2";
const pendingKey = "voku-auth-email-v1";
const recoveryKey = "voku-auth-recovery-v1";
export const externalAuthKey = "voku-auth-external-v1";
const lifetime = 60 * 60 * 1000;

function storage(): StorageLike | undefined {
  try { return globalThis.sessionStorage; } catch { return undefined; }
}
function read(key: string, store = storage()): unknown {
  try { return JSON.parse(store?.getItem(key) || "null"); } catch { return null; }
}
function write(key: string, value: unknown, store = storage()) {
  try {
    if (value === null) store?.removeItem(key);
    else store?.setItem(key, JSON.stringify(value));
  } catch { /* URL return paths still work when session storage is unavailable. */ }
}
function recent(value: unknown, now: number): value is number {
  return typeof value === "number" && value <= now && now - value < lifetime;
}
const safeScroll = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.min(value, 10000000) : 0;

export function authScreenPath(mode: AuthMode, next: string, back = next) {
  return "/auth?" + new URLSearchParams({ mode, next: safeReturnPath(next), back: safeReturnPath(back) });
}

export function prepareAuthEntry(
  target: string, source: string, scroll: number, list?: string,
  listScroll = 0, store = storage(), now = Date.now(),
) {
  const params = new URLSearchParams(target.split("?")[1]);
  const next = safeReturnPath(params.get("next") || source);
  const back = safeReturnPath(params.get("back") || source);
  const context: AuthReturn = {
    next, back, createdAt: now,
    positions: { [back]: safeScroll(scroll), [next]: next === back ? safeScroll(scroll) : 0 },
  };
  if (list && /^\/(home|board|account|notifications)(\?|$)/.test(list) && safeReturnPath(list) === list) {
    context.list = list;
    context.positions[list] = list === source ? safeScroll(scroll) : safeScroll(listScroll);
  }
  write(returnKey, context, store);
  params.set("next", next);
  params.set("back", back);
  return "/auth?" + params;
}

export function readAuthReturn(store = storage(), now = Date.now()): AuthReturn | null {
  const value = read(returnKey, store) as Partial<AuthReturn> | null;
  if (!value || !recent(value.createdAt, now) || typeof value.next !== "string" || typeof value.back !== "string") return null;
  if (safeReturnPath(value.next) !== value.next || safeReturnPath(value.back) !== value.back) return null;
  const positions: Record<string, number> = {};
  for (const [path, top] of Object.entries(value.positions || {})) {
    if (safeReturnPath(path) === path) positions[path] = safeScroll(top);
  }
  const list = value.list && /^\/(home|board|account|notifications)(\?|$)/.test(value.list) && safeReturnPath(value.list) === value.list ? value.list : undefined;
  return { next: value.next, back: value.back, createdAt: value.createdAt, positions, list };
}
export function clearAuthReturn(store = storage()) { write(returnKey, null, store); }

export function savePendingEmail(value: PendingEmail | null, store = storage()) { write(pendingKey, value, store); }
export function isPendingEmail(value: unknown, now = Date.now()): value is PendingEmail {
  if (!value || typeof value !== "object") return false;
  const pending = value as Partial<PendingEmail>;
  return recent(pending.sentAt, now) && typeof pending.email === "string" && !!pending.email.trim() && pending.email.length <= 254 &&
    (pending.kind === "signup" || pending.kind === "recovery");
}
export function readPendingEmail(store = storage(), now = Date.now()): PendingEmail | null {
  const value = read(pendingKey, store);
  return isPendingEmail(value, now) ? value : null;
}
export function emailCooldown(pending: PendingEmail | null, now = Date.now()) {
  return pending ? Math.max(0, Math.ceil((pending.sentAt + 60000 - now) / 1000)) : 0;
}
export function pendingExternalAuth(provider: "google" | "kakao" | null, store = storage(), now = Date.now()) {
  write(externalAuthKey, provider ? { provider, createdAt: now } : null, store);
}
export function readExternalAuth(store = storage(), now = Date.now()): "google" | "kakao" | null {
  const value = read(externalAuthKey, store) as { provider?: string; createdAt?: number } | null;
  return value && recent(value.createdAt, now) && (value.provider === "google" || value.provider === "kakao") ? value.provider : null;
}
// This only resumes the reset screen. Supabase still validates the session and password update.
export function saveRecovery(userId: string | null, store = storage(), now = Date.now()) {
  write(recoveryKey, userId ? { userId, createdAt: now } : null, store);
}
export function hasRecovery(userId: string | undefined, store = storage(), now = Date.now()) {
  const value = read(recoveryKey, store) as { userId?: string; createdAt?: number } | null;
  return !!userId && value?.userId === userId && recent(value.createdAt, now);
}
export function passwordError(password: string, repeat: string) {
  if (password.length < 10) return "비밀번호는 10자 이상 입력해 주세요.";
  if (new TextEncoder().encode(password).length > 72) return "비밀번호가 너무 길어요. 영문·숫자는 72자, 한글은 24자 이내로 입력해 주세요.";
  return password !== repeat ? "비밀번호가 일치하지 않아요." : "";
}
