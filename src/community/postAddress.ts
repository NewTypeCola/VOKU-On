// Database relationships continue to use UUIDs. Only public routes use this code.
export const isPostCode = (value: string) => /^[A-Za-z0-9_-]{10}$/.test(value);
export const postPath = (post: { id: string; publicCode?: string }) =>
  "/post/" + (post.publicCode && isPostCode(post.publicCode) ? post.publicCode : post.id);

/** The router keeps return context in history, not in the public post address. */
export function routeHref(route: string) {
  const [path, query = ""] = route.split("?");
  const ref = path.startsWith("/post/") ? path.slice(6) : "";
  if (!isPostCode(ref)) return "/#" + route;
  const comment = new URLSearchParams(query).get("comment");
  return "/p/" + ref + (comment ? "?" + new URLSearchParams({ comment }) : "");
}

type RouteLocation = { pathname: string; search: string; hash: string };
export function currentRoute(at: RouteLocation = location, state = history.state): string {
  if (at.hash.startsWith("#/")) return at.hash.slice(1);
  const match = /^\/p\/([A-Za-z0-9_-]{10})\/?$/.exec(at.pathname);
  if (!match) return "/home";
  const fallback = "/post/" + match[1] + at.search;
  // Keep the original logical route when shortening an old UUID link, without
  // remounting the thread or losing scroll, focus and return context.
  if (state?.canonicalUrl === routeHref(fallback) && typeof state?.canonicalRoute === "string"
    && /^\/post\/[A-Za-z0-9_-]+(?:\?|$)/.test(state.canonicalRoute)) return state.canonicalRoute;
  return fallback;
}

export function canonicalizePost(post: { id: string; publicCode?: string }) {
  if (!post.publicCode || !isPostCode(post.publicCode)) return;
  const route = currentRoute();
  const [path, query = ""] = route.split("?");
  if (!["/post/" + post.id, postPath(post)].includes(path)) return;
  const url = routeHref(postPath(post) + (query ? "?" + query : ""));
  history.replaceState({ ...history.state, canonicalRoute: route, canonicalUrl: url }, "", url);
}
