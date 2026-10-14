import { studyEnabled } from "../ux/config";
import { ArrowRight, ChevronRight, FileText, MessageCircle, Pencil, ThumbsUp } from "lucide-react";
import { useState, type ReactNode } from "react";
import { dateLabel } from "../data";
import { api } from "../community/client";
import { composerPath } from "../community/navigation";
import { PostThumbnail } from "../community/PostThumbnail";
import { isNewPost } from "../community/reading";
import type { Go } from "../community/shared";
import { useLoad } from "../community/useLoad";
import { postLabel, type CommunityPost } from "../community/types";
import type { Community } from "../community/useCommunity";
import { homeSections, loadHomeFeeds, type HomeFeed } from "./feed";
import { BannerCarousel } from "./BannerCarousel";
import { bannerView } from "./banner";
import { invalidateBannerReads, loadBanners } from "./bannerClient";
import { PopularStories } from "./PopularStories";
import { boardPath, currentHomePath, HomeLink, postPath, postTitle as title } from "./HomeLink";
import { localPhotoExample, localPhotoExamples } from "./examples";
import { useHomeTabSwipe } from "./useHomeTabSwipe";
import type { HomeSwipeDestination, HomeSwipeTarget } from "./tabSwipe";
import "./home.css";

function SectionHeading({ id, children, more, path, go, description }: {
  id: string; children: ReactNode; more: string; path: string; go: Go; description?: string;
}) {
  return <header className="home-corner-heading">
    <div><h2 id={id}>{children}</h2>{description && <p>{description}</p>}</div>
    <HomeLink path={path} go={go} className="home-more" label={more}>
      더보기 <ChevronRight size={15} aria-hidden="true" />
    </HomeLink>
  </header>;
}

function Reactions({ post }: { post: CommunityPost }) {
  return <span className="home-reactions">
    <span aria-label={`추천 ${post.likes}개`}><ThumbsUp size={13} aria-hidden="true" />{post.likes}</span>
    <span aria-label={`댓글 ${post.commentCount}개`}><MessageCircle size={13} aria-hidden="true" />{post.commentCount}</span>
  </span>;
}

function StoryRow({ post, go, compact = false }: { post: CommunityPost; go: Go; compact?: boolean }) {
  return <li className="home-story">
    <HomeLink path={postPath(post)} go={go} className={`home-story-link${compact ? " is-compact" : ""}`}>
      <div className="home-story-copy">
        <div className="home-story-labels">
          {!compact && <span>{postLabel(post)}</span>}
          {post.demo && <span className="home-sample">예시</span>}
          {post.recordId && <span className="home-linked"><FileText size={12} aria-hidden="true" />큐시트</span>}
          {isNewPost(post.date) && <span className="home-new">새글</span>}
        </div>
        <h3>{title(post)}</h3>
        <div className="home-story-meta">
          <span className="home-byline"><span>{post.author}</span><time dateTime={post.date}>{dateLabel(post.date)}</time></span>
          <Reactions post={post} />
        </div>
      </div>
      {post.photos?.[0] && <PostThumbnail photo={post.photos[0]} count={post.photos.length} />}
    </HomeLink>
  </li>;
}

function StoryList({ posts, go, compact }: { posts: CommunityPost[]; go: Go; compact?: boolean }) {
  return <ul className="home-story-list">{posts.map((post) => <StoryRow key={post.id} post={post} go={go} compact={compact} />)}</ul>;
}

function CornerState({ feed, loading, retry, empty, children, hasPosts }: {
  feed?: HomeFeed; loading: boolean; retry: () => void; empty: string; children: ReactNode; hasPosts: boolean;
}) {
  if (loading && !feed) return <div className="home-loading" role="status" aria-label="게시글을 불러오는 중">
    <span /><span /><span />
  </div>;
  if (feed?.error) return <div className="home-corner-state" role="status">
    <p>글을 불러오지 못했어요.</p><button type="button" onClick={retry}>다시 불러오기 <ArrowRight size={15} /></button>
  </div>;
  if (!hasPosts) return <p className="home-corner-state">{empty}</p>;
  return <>{children}</>;
}

export default function Home({ c, go, params, swipePreview, swipeNavigate }: {
  c: Community; go: Go; params: URLSearchParams;
  swipePreview: (target: HomeSwipeTarget | null) => void;
  swipeNavigate: (path: HomeSwipeDestination, scrollTop: number) => void;
}) {
  const swipeRef = useHomeTabSwipe(swipePreview, swipeNavigate);
  const state = useLoad(() => loadHomeFeeds(api.feed, localPhotoExamples.length), [c.profile?.id, c.profile?.role], c.revision);
  const banners = useLoad(() => loadBanners(), [], c.revision);
  const [bannerImageFailed, setBannerImageFailed] = useState(false);
  const sections = homeSections(state.data, localPhotoExamples);
  const corner = (key: "popular" | "memories" | "news" | "latest") => ({
    feed: state.data?.[key], loading: state.loading, retry: state.retry,
  });
  const notice = sections.notices[0];
  return <main ref={swipeRef} className="home-main home-discover" data-community-ready={!state.loading && !c.loading}>
    <h1 className="sr-only">VOKU On 홈 — 동문들의 이야기와 방송의 기억</h1>

    <section className="home-welcome" aria-label="이야기 배너와 공지">
      <BannerCarousel key={banners.data?.map(b => `${b.id}:${b.version}`).join(",") || "empty"} go={go} banners={bannerImageFailed ? [] : banners.data?.map(bannerView)} imageError={() => setBannerImageFailed(true)} />
      {(banners.error || bannerImageFailed) && <div className="home-banner-error" role="status">배너를 불러오지 못했어요. <button type="button" onClick={() => { invalidateBannerReads(); setBannerImageFailed(false); banners.retry(); }}>다시 불러오기</button></div>}
      {notice && <div className="home-notice">
        <HomeLink path={boardPath("공지")} go={go} className="home-notice-label" label="공지 전체 보기">공지</HomeLink>
        <HomeLink path={postPath(notice)} go={go} className="home-notice-title">
          <span>{notice.demo && "[예시] "}{title(notice)}</span><ChevronRight size={16} aria-hidden="true" />
        </HomeLink>
      </div>}
    </section>

    <PopularStories {...corner("popular")} go={go} params={params} />

    <section className="home-corner home-photo-corner" aria-labelledby="home-photos">
      <SectionHeading id="home-photos" more="추억 게시글 더보기" path={boardPath("추억")} go={go}
        description="한 장의 사진으로 다시 만나는 그때">사진으로 보는 추억</SectionHeading>
      <CornerState {...corner("memories")} hasPosts={!!sections.photos.length} empty="추억 글에 사진을 올리면 이곳에도 함께 보여요.">
        <ul className={`home-photo-grid${sections.photos.length === 1 ? " is-single" : ""}`}>{sections.photos.map((post) => {
          const example = localPhotoExample(post.id);
          return <li key={post.id}>
            <HomeLink path={postPath(post)} go={go} className="home-photo-link">
              {example ? <span className="community-thumbnail"><img src={example.exampleImage} alt={example.imageAlt} loading="lazy" width="1448" height="1086" /></span>
                : <PostThumbnail photo={post.photos![0]} count={post.photos!.length} />}
              <div className="home-photo-copy">
                {post.demo && <span className="home-sample">{example ? "로컬 예시" : "예시"}</span>}
                <h3>{title(post)}</h3>
                <span className="home-photo-author">{example ? "사진 예시" : post.author}</span>
                {!example && <Reactions post={post} />}
              </div>
            </HomeLink>
          </li>;
        })}</ul>
      </CornerState>
    </section>

    <section className="home-corner" aria-labelledby="home-news">
      <SectionHeading id="home-news" more="동문 소식 더보기" path={boardPath("동문소식")} go={go}
        description="오랜만의 안부부터 새로운 소식까지">동문 소식</SectionHeading>
      <CornerState {...corner("news")} hasPosts={!!sections.news.length} empty="반가운 근황이나 함께 나눌 소식을 기다립니다.">
        <StoryList posts={sections.news} go={go} compact />
      </CornerState>
    </section>

    <section className="home-corner" aria-labelledby="home-latest">
      <SectionHeading id="home-latest" more="최근 올라온 글 더보기" path={boardPath()} go={go}>최근 올라온 글</SectionHeading>
      <CornerState {...corner("latest")} hasPosts={!!sections.latest.length} empty="아직 공개된 글이 없어요. 첫 이야기를 남겨보세요.">
        <StoryList posts={sections.latest} go={go} />
      </CornerState>
      <HomeLink path={boardPath()} go={go} className="home-board-link">커뮤니티 전체 보기 <ArrowRight size={17} aria-hidden="true" /></HomeLink>
    </section>

    <section className="home-writing-invite" aria-label="이야기 남기기">
      <div><h2>짧은 안부도 반가워요</h2><p>{studyEnabled ? "실험 버전에서는 글쓰기가 제한돼요." : "오늘의 이야기, 편하게 남겨주세요."}</p></div>
      <HomeLink path={composerPath(currentHomePath(), "자유글")} go={go} className="home-write-link"><Pencil size={16} aria-hidden="true" />글쓰기</HomeLink>
    </section>
  </main>;
}
