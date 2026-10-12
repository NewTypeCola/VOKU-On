import { safeReturnPath } from "./oauth.ts";

export const isCommunityList = (path: string) =>
  /^\/(home|board|account|notifications|admin)(\?|$)/.test(path);

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
