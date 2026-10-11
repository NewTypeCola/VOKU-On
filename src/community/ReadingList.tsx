import { useEffect, useRef, useState } from "react";
import { api } from "./client";
import { pageNumber } from "./navigation";
import { Pagination } from "./Pagination";
import { Empty, LoadState, PostRow, useLoad, type Base } from "./shared";
import type { ArchiveRecord } from "../data";

export function ReadingList({
  c,
  go,
  id,
  returnTo,
  catalog,
}: Pick<Base, "c" | "go"> & {
  id: string;
  returnTo: string;
  catalog: ArchiveRecord[];
}) {
  const params = new URLSearchParams(
    returnTo.startsWith("/board") ? returnTo.split("?")[1] : "",
  );
  const [page, setPage] = useState(pageNumber(params.get("page")));
  useEffect(() => setPage(pageNumber(params.get("page"))), [returnTo]);
  const section = useRef<HTMLElement>(null);
  const movedPage = useRef(false);
  const category = params.get("category") || "전체",
    sort = params.get("sort") || "latest",
    query = params.get("q") || "";
  const state = useLoad(
    () => api.feed({ category, sort, query, page }),
    [category, sort, query, page, c.revision],
  );
  useEffect(() => {
    if (!state.loading && movedPage.current) {
      section.current?.scrollIntoView({ block: "start", behavior: "instant" });
      movedPage.current = false;
    }
  }, [state.loading]);
  const contextGo: typeof go = (path) => {
    // Explicit list context survives direct linking/reloads and pagination here.
    const context = new URLSearchParams(params);
    context.set("page", String(state.data?.page || page));
    go(path + "?list=" + encodeURIComponent("/board?" + context));
  };
  return (
    <section
      ref={section}
      className="community-reading-list"
      aria-label="다른 게시글 이어 읽기"
    >
      <div className="community-reading-heading">
        <h2>다른 글 이어 읽기</h2>
        <p>
          {query ? `‘${query}’ 검색 결과` : category} ·{" "}
          {sort === "popular" ? "추천순" : "최신글"}
        </p>
      </div>
      <LoadState state={state} />
      {!state.error && state.data && (
        <>
          {state.data.posts.map((p) => (
            <PostRow
              key={p.id}
              post={p}
              go={contextGo}
              catalog={catalog}
              active={p.id === id}
            />
          ))}
          {!state.data.posts.length && (
            <Empty title="이 목록에 다른 글이 없어요" />
          )}
          <Pagination
            page={state.data.page || page}
            total={state.data.total}
            disabled={state.loading}
            change={(n) => {
              movedPage.current = true;
              setPage(n);
            }}
            label="이어 읽기 페이지"
          />
        </>
      )}
    </section>
  );
}
