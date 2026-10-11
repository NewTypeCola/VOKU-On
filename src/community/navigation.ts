export const isCommunityList = (path: string) =>
  /^\/(board|account|notifications)(\?|$)/.test(path);

export function communityReturnPath(
  source: string,
  previous?: string,
): string | undefined {
  if (isCommunityList(source)) return source;
  // Retain the list through a post's linked archive page, editing and login.
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
