import { ArrowRight, ChevronRight } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import { archiveCatalog } from "../archiveCatalog";
import type { Go } from "../community/shared";
import { rankHomeEpisodes, recentHomePosts, type HomeFeed } from "./feed";
import { currentHomePath, HomeLink } from "./HomeLink";

export function PopularEpisodes({ feed, loading, retry, go, onReady }: {
  feed?: HomeFeed; loading: boolean; retry: () => void; go: Go; onReady?: (ready: boolean) => void;
}) {
  const archive = useSyncExternalStore(archiveCatalog.subscribe, archiveCatalog.getSnapshot);
  const posts = feed?.feed?.posts || [];
  const hasLinks = recentHomePosts(posts).some((post) => !!post.recordId);
  useEffect(() => { if (hasLinks) void archiveCatalog.load(); }, [hasLinks]);
  const episodes = rankHomeEpisodes(posts, archive.catalog).slice(0, 3);
  const failed = !!feed?.error || (hasLinks && !!archive.error);
  const pending = (loading && !feed) || (hasLinks && !archive.manifest && !archive.error);
  useEffect(() => { onReady?.(!pending && !failed); }, [pending, failed, onReady]);
  const retryAll = () => { retry(); if (hasLinks) void archiveCatalog.load(); };
  return <div className="home-episode-panel" role="region" aria-label="인기 큐시트 목록" data-home-episodes-ready={!pending}>
    {failed ? <div className="home-corner-state" role="status"><p>큐시트 회차를 불러오지 못했어요.</p><button type="button" onClick={retryAll}>다시 불러오기 <ArrowRight size={15} /></button></div>
      : pending ? <div className="home-loading" role="status" aria-label="인기 큐시트를 불러오는 중"><span /><span /></div>
        : !episodes.length ? <p className="home-corner-state">최근 7일 동안 공개글에 연결된 큐시트가 아직 없어요.</p>
          : <ol className="home-episode-list">{episodes.map(({ record, postCount, demoCount }, index) => <li key={record.id}>
            <HomeLink path={`/read/${encodeURIComponent(record.id)}?list=${encodeURIComponent(currentHomePath())}`} go={go} className="home-episode-link">
              <span className="home-episode-rank" aria-label={`${index + 1}위`}>{index + 1}</span>
              <div className="home-episode-copy">
                <h3>{record.title} <span>{record.issue}회</span></h3>
                <p><span>{record.year}년 · {record.term}학기</span><strong>연결글 {postCount}개</strong></p>
                {demoCount > 0 && <span className="home-sample">{demoCount === postCount ? "예시 글 연결" : "예시 글 포함"}</span>}
              </div>
              <ChevronRight size={17} aria-hidden="true" />
            </HomeLink>
          </li>)}</ol>}
    {!failed && feed?.limited && <p className="home-feed-limit">최근 {feed.feed?.posts.length || 0}개 글 안에서 집계했어요.</p>}
  </div>;
}
