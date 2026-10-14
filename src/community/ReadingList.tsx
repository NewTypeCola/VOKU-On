import { studyAutoScroll } from "../ux/signals";
import { postPath, routeHref } from "./postAddress";
import { Button } from "@heroui/react";
import { ChevronLeft, ChevronRight, FileText, LockKeyhole } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "./client";
import { boardCategory } from "./categories";
import { Empty, LoadState, useLoad, type Base } from "./shared";
import { postLabel } from "./types";
import type { ArchiveRecord } from "../data";

export function ReadingList({
  c,
  go,
  id,
  returnTo,
  pinned = false,
}: Pick<Base, "c" | "go"> & {
  id: string;
  returnTo: string;
  catalog: ArchiveRecord[];
  pinned?: boolean;
}) {
  const params = new URLSearchParams(
    returnTo.startsWith("/board") ? returnTo.split("?")[1] : "",
  );
  const [start, setStart] = useState<number>();
  const section = useRef<HTMLElement>(null);
  const moved = useRef(false);
  const category = pinned ? "공지" : boardCategory(params.get("category"));
  const sort = params.get("sort") || "latest";
  const query = pinned ? "" : params.get("q") || "";
  const linked =
    !pinned &&
    (params.get("linked") === "1" || params.get("category") === "자료 이야기");
  const state = useLoad(
    () =>
      api.reading({
        id,
        category,
        sort,
        query,
        linked,
        start: start === undefined ? undefined : Math.max(0, start),
      }),
    [id, category, sort, query, linked, start, c.profile?.id, c.profile?.role], c.revision,
  );
  useEffect(() => {
    if (!state.loading && moved.current) {
      studyAutoScroll("scroll.jump");
      section.current?.scrollIntoView({ block: "start", behavior: "instant" });
      moved.current = false;
    }
  }, [state.loading]);
  const page = state.data;
  return (
    <section
      ref={section}
      className="community-reading-list"
      aria-label="다른 게시글 이어 읽기"
    >
      <div className="community-reading-heading">
        <h2>다른 글 이어 읽기</h2>
        <p>
          {query ? `‘${query}’ 검색 결과` : category}
          {linked ? " · 큐시트 연결글" : ""} ·{" "}
          {sort === "popular" ? "추천순" : "최신글"}
        </p>
      </div>
      <LoadState state={state} />
      {!state.error && page && (
        <>
          <div className="community-reading-rows">
            {page.posts.map((post) => {
              const path = `${postPath(post)}?list=${encodeURIComponent(returnTo)}`;
              const active = post.id === id;
              return (
                <a
                  className={`community-reading-row${active ? " is-current" : ""}`}
                  key={post.id}
                  href={routeHref(path)}
                  aria-current={active ? "page" : undefined}
                  onClick={(event) => {
                    if (event.metaKey || event.ctrlKey || event.shiftKey)
                      return;
                    event.preventDefault();
                    go(path);
                  }}
                >
                  <small>{active ? "읽는 중" : postLabel(post)}</small>
                  <span className="community-reading-title">{post.title}</span>
                  <span className="community-reading-markers">
                    {post.isSecret && (
                      <LockKeyhole size={13} aria-label="비밀글" />
                    )}
                    {post.recordId && (
                      <FileText size={13} aria-label="큐시트 연결" />
                    )}
                    {post.commentCount > 0 && (
                      <b aria-label={`댓글 ${post.commentCount}개`}>
                        [{post.commentCount}]
                      </b>
                    )}
                  </span>
                </a>
              );
            })}
          </div>
          {!page.posts.length ? (
            <Empty title="이 목록에 다른 글이 없어요" />
          ) : (
            <nav
              className="community-reading-controls"
              aria-label="이어 읽기 목록 이동"
            >
              <Button
                variant="ghost"
                isIconOnly
                aria-label="이전 게시글 5개"
                isDisabled={state.loading || page.start === 0}
                onPress={() => {
                  moved.current = true;
                  // Retain the requested position so reversing at an edge
                  // returns to the same five rows rather than shifting them.
                  setStart((current) => (current ?? page.start) - 5);
                }}
              >
                <ChevronLeft size={20} />
              </Button>
              <span aria-live="polite">
                {page.start + 1}–{Math.min(page.start + 5, page.total)} /{" "}
                {page.total}
              </span>
              <Button
                variant="ghost"
                isIconOnly
                aria-label="다음 게시글 5개"
                isDisabled={state.loading || page.start + 5 >= page.total}
                onPress={() => {
                  moved.current = true;
                  setStart((current) => (current ?? page.start) + 5);
                }}
              >
                <ChevronRight size={20} />
              </Button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
