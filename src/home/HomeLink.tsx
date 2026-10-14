import { postPath as publicPostPath, routeHref } from "../community/postAddress";
import type { MouseEvent, ReactNode } from "react";
import type { Go } from "../community/shared";
import type { CommunityPost } from "../community/types";
import { localPhotoExample } from "./examples";

export const boardPath = (category = "전체", sort = "latest") =>
  "/board?" + new URLSearchParams({ category, sort });
export const currentHomePath = () => /^\/home(?:\?|$)/.test(location.hash.slice(1))
  ? location.hash.slice(1) : "/home";
export const postPath = (post: CommunityPost) => {
  const route = localPhotoExample(post.id) ? "/home-example/" + post.id : publicPostPath(post);
  return `${route}?list=${encodeURIComponent(currentHomePath())}`;
};
export const postTitle = (post: CommunityPost) =>
  post.demo ? post.title.replace(/^\[예시\]\s*/, "") : post.title;

export function HomeLink({ path, go, children, className, label }: {
  path: string; go: Go; children: ReactNode; className?: string; label?: string;
}) {
  if (!path) return <div className={className}>{children}</div>;
  if (path.startsWith("https://")) return <a href={path} target="_blank" rel="noopener noreferrer" className={className} aria-label={label}>{children}</a>;
  const follow = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    go(path);
  };
  return <a href={routeHref(path)} onClick={follow} className={className} aria-label={label}>{children}</a>;
}
