import { safeReturnPath } from "./oauth.ts";

export const isCommunityList = (path: string) =>
  safeReturnPath(path) === path && /^\/(home|board|account|notifications|admin|search|saved)(\?|$)/.test(path);

const personalScreen = (path: string) => /^\/(account|saved|notifications|search)(\?|$)/.test(path);

/** Carry the menu entry screen through personal tabs without nesting return URLs. */
export function personalEntryPath(destination: string, source: string) {
  const [path, query = ""] = destination.split("?");
  const params = new URLSearchParams(query);
  const previous = new URLSearchParams(source.split("?")[1]).get("back");
  const origin = personalScreen(source) ? previous || "/home" : source;
  params.set("back", safeReturnPath(origin));
  return path + "?" + params;
}

export function personalReturnPath(params: URLSearchParams) {
  return params.has("back") ? safeReturnPath(params.get("back")) : "/home";
}

export function listReturnLabel(path: string) {
  if (/^\/search(?:\?|$)/.test(path)) return "검색 결과로 돌아가기";
  if (/^\/saved(?:\?|$)/.test(path)) return "저장 목록으로 돌아가기";
  if (/^\/notifications(?:\?|$)/.test(path)) return "알림으로 돌아가기";
  if (/^\/account(?:\?|$)/.test(path)) return "내 활동으로 돌아가기";
  if (/^\/home(?:\?|$)/.test(path)) return "홈으로 돌아가기";
  if (/^\/admin(?:\?|$)/.test(path)) return "관리자 페이지로 돌아가기";
  if (/^\/archive(?:\?|$)/.test(path)) return "자료 목록으로 돌아가기";
  if (/^\/board(?:\?|$)/.test(path)) return "커뮤니티로 돌아가기";
  return "목록으로 돌아가기";
}

export function withList(path: string, list: string) {
  if (!isCommunityList(list) && !/^\/archive(?:\?|$)/.test(list)) return path;
  if (safeReturnPath(list) !== list) return path;
  const [base, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  params.set("list", list);
  return base + "?" + params;
}

export function readerListPath(value: string | null) {
  return value && safeReturnPath(value) === value &&
    (isCommunityList(value) || /^\/archive(?:\?|$)/.test(value)) ? value : undefined;
}

export function adminEntryPath(source: string) {
  const path = safeReturnPath(source);
  return /^\/admin(?:\?|$)/.test(path)
    ? path
    : "/admin?" + new URLSearchParams({ back: path });
}

export function adminReturnPath(params: URLSearchParams) {
  const path = safeReturnPath(params.get("back"));
  return /^\/admin(?:\?|$)/.test(path) ? "/board" : path;
}

export function communityReturnPath(
  source: string,
  previous?: string,
): string | undefined {
  if (isCommunityList(source)) return source;
  // Home is also a list origin. Retain it through linked archives and writing.
  if (
    /^\/(post\/|read\/|write(?:\?|$)|auth(?:\?|$))/.test(source) &&
    previous &&
    isCommunityList(previous)
  )
    return previous;
}

export function pageNumber(value: string | null) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 1 && n <= 2147483647 ? n : 1;
}

export function composerPath(list: string, category: string) {
  return "/write?" + new URLSearchParams({ category, list });
}

export function composerReturn(params: URLSearchParams, previous?: string) {
  const list = params.get("list");
  if (list && isCommunityList(list)) return list;
  return previous && isCommunityList(previous) ? previous : "/board";
}
