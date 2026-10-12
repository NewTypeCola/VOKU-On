import { Button, SearchField } from "@heroui/react";
import {
  Bell,
  ChevronRight,
  LogIn,
  Pencil,
  FileText,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { archiveCatalog } from "../archiveCatalog";
import { type ArchiveRecord } from "../data";
import { api } from "./client";
import { boardCategories, boardCategory } from "./categories";
import { Pagination } from "./Pagination";
import { personalEntryPath, adminEntryPath, pageNumber, composerPath } from "./navigation";
import { NoticeBanners } from "./NoticeBanners";
import {
  Empty,
  LoadState,
  PostRow,
  PreviewNote,
  RoleTag,
  useLoad,
  type Base,
} from "./shared";
import { canManageBoard, type Feed } from "./types";

export function CommunityBoard({
  c,
  go,
  notify,
  catalog,
  params,
}: { catalog: ArchiveRecord[]; params: URLSearchParams } & Base) {
  const category = boardCategory(params.get("category")),
    linked =
      params.get("linked") === "1" || params.get("category") === "자료 이야기",
    sort = params.get("sort") || "latest",
    query = params.get("q") || "",
    page = pageNumber(params.get("page"));
  const [searchOpen, setSearchOpen] = useState(!!query),
    [search, setSearch] = useState(query);
  const searchInput = useRef<HTMLInputElement>(null);
  const searchRequested = useRef(false);
  useEffect(() => {
    if (searchOpen && searchRequested.current) {
      searchInput.current?.focus();
      searchRequested.current = false;
    }
  }, [searchOpen]);
  useEffect(() => setSearch(query), [query]);
  const state = useLoad<Feed>(
    () => api.feed({ category, sort, query, page, linked }),
    [category, sort, query, page, linked, c.profile?.id, c.profile?.role], c.revision,
  );
  useEffect(() => {
    if (state.data?.posts.some((post) => post.recordId))
      void archiveCatalog.load();
  }, [state.data]);
  const param = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    next.set("category", category);
    if (linked) next.set("linked", "1");
    next.set(key, value);
    if (key !== "page") next.delete("page");
    go("/board?" + next, false, key !== "page");
  };
  const write = () => {
    const path = composerPath("/board" + (params.size ? "?" + params : ""), category);
    go(c.profile ? path : "/auth?next=" + encodeURIComponent(path));
  };
  return (
    <main
      className="community-board"
      data-community-ready={!state.loading && !!state.data}
    >
      <div className="community-memberbar">
        {c.profile ? (
          <button onClick={() => go(personalEntryPath("/account", location.hash.slice(1)))}>
            <span>{c.profile.nickname}</span>
            <RoleTag role={c.profile.role} />
            <ChevronRight size={14} />
          </button>
        ) : (
          <button onClick={() => go("/auth")}>
            <LogIn size={15} />
            <span>로그인 / 회원가입</span>
          </button>
        )}
        <div>
          {!c.loading && canManageBoard(c.profile) && (
            <button onClick={() => go(adminEntryPath("/board?" + params.toString()))}>
              <ShieldCheck size={14} />
              관리
            </button>
          )}
          <button
            onClick={() => go(personalEntryPath("/notifications", location.hash.slice(1)))}
            aria-label={`알림 ${c.account?.unreadNotificationCount || 0}개`}
          >
            <Bell size={17} />
            {!!c.account?.unreadNotificationCount && (
              <i className="unread-dot" />
            )}
          </button>
        </div>
      </div>
      <div className="community-categories" aria-label="커뮤니티 말머리">
        {boardCategories.map((label) => (
          <Button
            key={label}
            variant="ghost"
            aria-pressed={category === label}
            className={category === label ? "chosen" : ""}
            onPress={() => param("category", label)}
          >
            {label}
          </Button>
        ))}
      </div>
      {category !== "공지" && !!state.data?.notices.length && (
        <NoticeBanners notices={state.data.notices} go={go} />
      )}
      <div className="community-toolbar">
        <div>
          {[
            ["latest", "최신글"],
            ["popular", "추천순"],
          ].map(([value, label]) => (
            <button
              key={value}
              className={sort === value ? "selected" : ""}
              aria-pressed={sort === value}
              onClick={() => param("sort", value)}
            >
              {label}
            </button>
          ))}
        </div>
        <div>
          <Button
            isIconOnly
            variant="ghost"
            aria-label="게시글 검색"
            onPress={() => {
              if (searchOpen || query) {
                searchInput.current?.focus();
                return;
              }
              searchRequested.current = true;
              setSearchOpen(true);
            }}
          >
            <Search size={18} />
          </Button>
          <Button
            size="sm"
            onPress={write}
          >
            <Pencil size={15} />
            글쓰기
          </Button>
        </div>
      </div>
      {(searchOpen || query) && (
        <form
          className="community-search"
          onSubmit={(e) => {
            e.preventDefault();
            param("q", search.trim());
          }}
        >
          <SearchField
            value={search}
            onChange={setSearch}
            aria-label="게시글 검색어"
          >
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input
                ref={searchInput}
                placeholder="제목, 내용, 닉네임 검색"
                maxLength={100}
              />
              <SearchField.ClearButton aria-label="검색어 지우기" />
            </SearchField.Group>
          </SearchField>
          <Button type="submit" variant="secondary">
            검색
          </Button>
        </form>
      )}
      <LoadState state={state} />
      {!state.error && state.data && (
        <>
          <div className="community-result-count" role="status">
            <span>
              {query ? `‘${query}’ 검색 결과` : category}{" "}
              <strong>{state.data.total.toLocaleString()}개</strong>
            </span>
            <div className="community-result-actions">
              {query && (
                <button onClick={() => param("q", "")}>검색 해제</button>
              )}
              <button
                className="community-linked-filter"
                aria-pressed={linked}
                onClick={() => param("linked", linked ? "0" : "1")}
              >
                <FileText size={14} />
                큐시트 연결글
              </button>
            </div>
          </div>
          {state.data.posts.length ? (
            <div className="community-posts">
              {state.data.posts.map((p) => (
                <PostRow key={p.id} post={p} catalog={catalog} go={go} />
              ))}
            </div>
          ) : (
            !state.loading && (
              <Empty
                title={query ? "검색 결과가 없어요" : linked ? "큐시트가 연결된 글이 없어요" : "아직 등록된 글이 없어요"}
                action={<Button variant="secondary" onPress={query ? () => param("q", "") : linked ? () => param("linked", "0") : write}>
                  {query ? "검색 해제" : linked ? "연결글 필터 해제" : "첫 글 쓰기"}
                </Button>}
              >
                {query
                  ? "다른 검색어로 찾아보세요."
                  : linked ? "필터를 해제하면 다른 글도 볼 수 있어요." : "첫 이야기를 남겨보세요."}
              </Empty>
            )
          )}
          <Pagination
            page={state.data.page || page}
            total={state.data.total}
            disabled={state.loading}
            change={(n) => param("page", String(n))}
          />
        </>
      )}
      <PreviewNote c={c} go={go} />
    </main>
  );
}
