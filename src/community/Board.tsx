import { Button, SearchField } from "@heroui/react";
import {
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LogIn,
  Pencil,
  Pin,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { archiveCatalog } from "../archiveCatalog";
import { type ArchiveRecord } from "../data";
import { api } from "./client";
import {
  Empty,
  LoadState,
  PostRow,
  PreviewNote,
  RoleTag,
  useLoad,
  type Base,
} from "./shared";
import { staff, type Feed } from "./types";

export function CommunityBoard({
  c,
  go,
  notify,
  catalog,
  params,
}: { catalog: ArchiveRecord[]; params: URLSearchParams } & Base) {
  const category = params.get("category") || "전체",
    sort = params.get("sort") || "latest",
    query = params.get("q") || "",
    page = Math.max(1, Number(params.get("page")) || 1);
  const [searchOpen, setSearchOpen] = useState(!!query),
    [search, setSearch] = useState(query),
    [showNotices, setShowNotices] = useState(true);
  useEffect(() => setSearch(query), [query]);
  const state = useLoad<Feed>(
    () => api.feed({ category, sort, query, page }),
    [category, sort, query, page, c.revision],
  );
  useEffect(() => {
    if (state.data?.posts.some(post => post.recordId)) void archiveCatalog.load();
  }, [state.data]);
  const param = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    if (key !== "page") next.delete("page");
    go("/board?" + next, true, key !== "page");
  };
  return (
    <main className="community-board">
      <div className="community-memberbar">
        {c.profile ? (
          <button onClick={() => go("/account")}>
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
          {staff(c.profile) && (
            <button onClick={() => go("/admin")}>
              <ShieldCheck size={14} />
              관리
            </button>
          )}
          <button
            onClick={() => go("/notifications")}
            aria-label={`알림 ${(c.account?.notifications || []).filter((n) => !n.read).length}개`}
          >
            <Bell size={17} />
            {(c.account?.notifications || []).some((n) => !n.read) && (
              <i className="unread-dot" />
            )}
          </button>
        </div>
      </div>
      <div className="community-categories" aria-label="커뮤니티 말머리">
        {["전체", "자료 이야기", "자유글", "질문", "동문소식", "공지"].map(
          (label) => (
            <Button
              key={label}
              variant="ghost"
              aria-pressed={category === label}
              className={category === label ? "chosen" : ""}
              onPress={() => param("category", label)}
            >
              {label}
            </Button>
          ),
        )}
      </div>
      {category !== "공지" && !!state.data?.notices.length && (
        <section className="community-notices" aria-label="고정 공지">
          <div>
            <button
              className="notice-toggle"
              onClick={() => setShowNotices((v) => !v)}
              aria-expanded={showNotices}
            >
              <Pin size={13} />
              공지{" "}
              <ChevronDown
                size={13}
                style={{
                  transform: showNotices ? undefined : "rotate(-90deg)",
                }}
              />
            </button>
            <button onClick={() => param("category", "공지")}>전체 보기</button>
          </div>
          {showNotices &&
            state.data.notices.map((p) => (
              <a
                key={p.id}
                href={"#/post/" + p.id}
                onClick={(e) => {
                  e.preventDefault();
                  go("/post/" + p.id);
                }}
              >
                <span>공지</span>
                <strong>{p.title}</strong>
              </a>
            ))}
        </section>
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
            onPress={() => setSearchOpen((v) => !v)}
          >
            <Search size={18} />
          </Button>
          <Button
            size="sm"
            onPress={() => go(c.profile ? "/write" : "/auth?next=%2Fwrite")}
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
          {state.data.posts.length ? (
            <div className="community-posts">
              {state.data.posts.map((p) => (
                <PostRow key={p.id} post={p} catalog={catalog} go={go} />
              ))}
            </div>
          ) : (
            !state.loading && (
              <Empty
                title={query ? "검색 결과가 없어요" : "아직 등록된 글이 없어요"}
              >
                {query
                  ? "다른 검색어로 찾아보세요."
                  : "첫 이야기를 남겨보세요."}
              </Empty>
            )
          )}
          {state.data.total > 20 && (
            <nav className="community-pagination" aria-label="게시글 페이지">
              <Button
                isIconOnly
                variant="outline"
                aria-label="이전 게시글 페이지"
                isDisabled={page === 1}
                onPress={() => param("page", String(page - 1))}
              >
                <ChevronLeft size={18} />
              </Button>
              <span>
                {page} / {Math.ceil(state.data.total / 20)}
              </span>
              <Button
                isIconOnly
                variant="outline"
                aria-label="다음 게시글 페이지"
                isDisabled={page >= Math.ceil(state.data.total / 20)}
                onPress={() => param("page", String(page + 1))}
              >
                <ChevronRight size={18} />
              </Button>
            </nav>
          )}
        </>
      )}
      <PreviewNote c={c} go={go} />
    </main>
  );
}
