import { ArrowRight, ChevronDown, ChevronUp, Pause, Play } from "lucide-react";
import { useRef, useState } from "react";
import { PostThumbnail } from "../community/PostThumbnail";
import type { Go } from "../community/shared";
import { postLabel } from "../community/types";
import { rankHomePosts, type HomeFeed, type PopularOrder } from "./feed";
import { HomeLink, postPath, postTitle } from "./HomeLink";
import { PopularEpisodes } from "./PopularEpisodes";
import { useAutoAdvance } from "./useAutoAdvance";

const RANKING_INTERVAL_MS = 25_000;
const modes = [
  { id: "views", label: "많이 본 글" },
  { id: "comments", label: "댓글 많은 글" },
  { id: "episodes", label: "인기 큐시트" },
] as const;

export function PopularStories({ feed, loading, retry, go, params }: {
  feed?: HomeFeed; loading: boolean; retry: () => void; go: Go; params: URLSearchParams;
}) {
  const selected = params.get("rank");
  const activeMode = selected === "comments" || selected === "episodes" ? selected : "views";
  const showEpisodes = selected === "episodes";
  const order: PopularOrder = selected === "comments" ? "comments" : "views";
  const expanded = params.get("popular") === "more";
  const tabBar = useRef<HTMLDivElement>(null);
  const [episodesReady, setEpisodesReady] = useState(false);
  const ranked = showEpisodes ? [] : rankHomePosts(feed?.feed?.posts || [], order);
  const change = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    next.delete("period");
    Object.entries(changes).forEach(([key, value]) => value === null ? next.delete(key) : next.set(key, value));
    if (changes.rank === "episodes" && !showEpisodes) setEpisodesReady(false);
    go("/home" + (next.size ? "?" + next.toString() : ""), true, true);
  };
  const autoplay = useAutoAdvance<HTMLElement>({
    interval: RANKING_INTERVAL_MS, itemKey: activeMode, visibilityRef: tabBar,
    enabled: !!feed?.feed && !loading && !feed.error && !expanded && (!showEpisodes || episodesReady),
    advance: () => change({ rank: modes[(modes.findIndex((mode) => mode.id === activeMode) + 1) % modes.length].id, popular: null }),
  });
  return <section ref={autoplay.ref} className="home-corner home-popular-corner" aria-labelledby="home-popular" {...autoplay.interaction}>
    <header className="home-popular-heading">
      <h2 id="home-popular">인기 이야기</h2>
      <div className="home-popular-tools"><span className="home-period">최근 7일</span>
        <button type="button" className="home-ranking-toggle" aria-label={autoplay.playing ? "인기 콘텐츠 자동 넘김 멈추기" : "인기 콘텐츠 자동 넘김 시작하기"}
          onClick={autoplay.toggle}>{autoplay.playing ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}</button>
      </div>
    </header>
    <div ref={tabBar} className="home-ranking-tabs" role="group" aria-label="인기 콘텐츠 선택">
      {modes.map((mode) => <button type="button" key={mode.id} aria-pressed={activeMode === mode.id}
        onClick={() => { autoplay.restart(); change({ rank: mode.id, popular: null }); }}>
        {mode.label}
        {activeMode === mode.id && <span className="home-ranking-progress" aria-hidden="true"><span key={autoplay.cycle}
          style={{ animationDuration: `${RANKING_INTERVAL_MS}ms`, animationPlayState: autoplay.running ? "running" : "paused" }} /></span>}
      </button>)}
    </div>
    <div className="home-ranking-content" key={activeMode}>
    {showEpisodes ? <PopularEpisodes feed={feed} loading={loading} retry={retry} go={go} onReady={setEpisodesReady} />
      : loading && !feed ? <div className="home-loading" role="status" aria-label="인기글을 불러오는 중"><span /><span /><span /></div>
      : feed?.error ? <div className="home-corner-state" role="status"><p>인기글을 불러오지 못했어요.</p><button type="button" onClick={retry}>다시 불러오기 <ArrowRight size={15} /></button></div>
        : !ranked.length ? <p className="home-corner-state">최근 7일 동안 작성된 글에 {order === "views" ? "조회가" : "댓글이"} 모이면 여기에 소개할게요.</p>
          : <>
            <ol className="home-ranking-list">{ranked.slice(0, expanded ? 10 : 5).map((post, index) => <li key={post.id} className={index === 0 ? "is-first" : undefined}>
              <HomeLink path={postPath(post)} go={go} className="home-ranking-link">
                <span className="home-rank" aria-label={`${index + 1}위`}>{index + 1}</span>
                <div className="home-ranking-copy">
                  <div className="home-story-labels"><span>{postLabel(post)}</span>{post.demo && <span className="home-sample">예시</span>}</div>
                  <h3>{postTitle(post)}</h3>
                  <div className="home-ranking-counts">
                    <strong>{order === "views" ? `조회 ${post.views.toLocaleString()}` : `댓글 ${post.commentCount.toLocaleString()}`}</strong>
                    <span>{order === "views" ? `댓글 ${post.commentCount.toLocaleString()}` : `조회 ${post.views.toLocaleString()}`}</span>
                    {post.likes > 0 && <span>추천 {post.likes.toLocaleString()}</span>}
                  </div>
                </div>
                {index === 0 && post.photos?.[0] && <PostThumbnail photo={post.photos[0]} count={post.photos.length} />}
              </HomeLink>
            </li>)}</ol>
            {ranked.length > 5 && <button type="button" className="home-ranking-expand" aria-expanded={expanded} onClick={() => { autoplay.restart(); change({ popular: expanded ? null : "more" }); }}>
              {expanded ? "5개만 보기" : `인기글 ${Math.min(10, ranked.length)}개 보기`}{expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>}
          </>}
    {!showEpisodes && !feed?.error && feed?.limited && <p className="home-feed-limit">최근 {feed.feed?.posts.length || 0}개 글 안에서 집계했어요.</p>}
    </div>
  </section>;
}
