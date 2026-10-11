import type { CommunityPost, Feed, FeedQuery } from "../community/types";
import type { ArchiveRecord } from "../data";

export type HomeFeed = { feed: Feed | null; error: string; limited?: boolean };
export type HomeFeeds = Record<"popular" | "memories" | "news" | "latest", HomeFeed>;
export type PopularOrder = "views" | "comments";
export const HOME_POPULAR_DAYS = 7;
const DAY = 86_400_000;
const PAGE_SIZE = 20;
const MAX_HOME_PAGES = 10;
type FeedReader = (query?: FeedQuery) => Promise<Feed>;

export const homeVisible = (post: CommunityPost) =>
  post.status === "published" && !post.isSecret && post.readable !== false;
const discoverable = (post: CommunityPost) => homeVisible(post) && !post.pinned;
const uniquePosts = (posts: CommunityPost[]) => [...new Map(posts.map((post) => [post.id, post])).values()];

async function recentRankingFeed(read: FeedReader): Promise<HomeFeed> {
  // Reuse the existing visibility-aware RPC. Read beyond the first page so an
  // older, frequently read post can outrank newly written posts. Bound the work
  // for local review; larger communities should aggregate this server-side.
  const first = await read();
  const cutoff = Date.now() - HOME_POPULAR_DAYS * DAY;
  const posts = [...first.posts];
  let page = 1, last = first;
  const stillRecent = () => !!last.posts.length && Date.parse(last.posts.at(-1)!.date) >= cutoff;
  while (page < MAX_HOME_PAGES && page * PAGE_SIZE < first.total && stillRecent()) {
    const next = await read({ page: page + 1 });
    if (next.page !== undefined && next.page !== page + 1) break;
    posts.push(...next.posts);
    last = next;
    page += 1;
  }
  return {
    feed: { ...first, posts: uniquePosts(posts).filter((post) => Date.parse(post.date) >= cutoff) },
    error: "",
    limited: page * PAGE_SIZE < first.total && stillRecent(),
  };
}

async function photoFeed(read: FeedReader, sampleCount: number): Promise<HomeFeed> {
  const first = await read({ category: "추억" });
  const posts = [...first.posts];
  const needed = Math.max(0, 4 - sampleCount);
  let page = 1;
  while (page < MAX_HOME_PAGES && page * PAGE_SIZE < first.total
    && posts.filter((post) => discoverable(post) && post.photos?.length).length < needed) {
    const next = await read({ category: "추억", page: page + 1 });
    if (!next.posts.length || (next.page !== undefined && next.page !== page + 1)) break;
    posts.push(...next.posts);
    page += 1;
  }
  return { feed: { ...first, posts: uniquePosts(posts) }, error: "" };
}

export async function loadHomeFeeds(read: FeedReader, sampleCount = 0): Promise<HomeFeeds> {
  const jobs: [keyof HomeFeeds, Promise<HomeFeed>][] = [
    ["popular", recentRankingFeed(read)],
    ["memories", photoFeed(read, sampleCount)],
    ["news", read({ category: "동문소식" }).then((feed) => ({ feed, error: "" }))],
    ["latest", read().then((feed) => ({ feed, error: "" }))],
  ];
  const results = await Promise.allSettled(jobs.map(([, job]) => job));
  return Object.fromEntries(results.map((result, i) => [
    jobs[i][0], result.status === "fulfilled"
      ? result.value : { feed: null, error: result.reason instanceof Error ? result.reason.message : "게시글을 불러오지 못했어요." },
  ])) as HomeFeeds;
}

export function recentHomePosts(posts: CommunityPost[], now = Date.now()) {
  return uniquePosts(posts).filter((post) => {
    const date = Date.parse(post.date);
    return discoverable(post) && date >= now - HOME_POPULAR_DAYS * DAY && date <= now;
  });
}

export function rankHomePosts(posts: CommunityPost[], order: PopularOrder, now = Date.now()) {
  const metric = order === "comments" ? "commentCount" : "views";
  const secondary = order === "comments" ? "views" : "commentCount";
  // G7 filters by creation date, then orders cumulative views/comments:
  // modules/_bundled/sirsoft-board/src/Repositories/BoardRepository.php#getPopularPosts
  // These are NOT views or comments that happened only during the last seven days.
  return recentHomePosts(posts, now).filter((post) => post[metric] > 0)
    .sort((a, b) => b[metric] - a[metric] || b[secondary] - a[secondary]
    || b.likes - a.likes || Date.parse(b.date) - Date.parse(a.date) || b.id.localeCompare(a.id));
}

export type PopularEpisode = { record: ArchiveRecord; postCount: number; demoCount: number; latestMention: number };

export function rankHomeEpisodes(posts: CommunityPost[], catalog: ArchiveRecord[], now = Date.now()): PopularEpisode[] {
  const records = new Map(catalog.map((record) => [record.id, record]));
  const episodes = new Map<string, PopularEpisode>();
  for (const post of recentHomePosts(posts, now)) {
    const record = post.recordId ? records.get(post.recordId) : undefined;
    if (!record) continue;
    const item = episodes.get(record.id) || { record, postCount: 0, demoCount: 0, latestMention: 0 };
    item.postCount += 1;
    if (post.demo) item.demoCount += 1;
    item.latestMention = Math.max(item.latestMention, Date.parse(post.date));
    episodes.set(record.id, item);
  }
  // Count unique public posts with an explicit attachment, not guessed mentions
  // in prose or comments. Resolve only records in the preserved archive catalog.
  return [...episodes.values()].sort((a, b) => b.postCount - a.postCount
    || b.latestMention - a.latestMention || a.record.id.localeCompare(b.record.id));
}

export function homeSections(feeds: HomeFeeds | null, localPhotoExamples: CommunityPost[] = []) {
  const candidates = (key: keyof HomeFeeds) => (feeds?.[key].feed?.posts || []).filter(discoverable);
  const photos = [...candidates("memories").filter((post) => !!post.photos?.length), ...localPhotoExamples].slice(0, 4);
  const news = candidates("news").slice(0, 3);
  // Latest always means chronological order, even when a post appears above.
  const latest = candidates("latest").slice(0, 5);
  const noticeFeed = feeds?.latest.feed || feeds?.popular.feed || feeds?.news.feed || feeds?.memories.feed;
  const notices = (noticeFeed?.notices || []).filter((post) => homeVisible(post) && post.pinned);
  return { photos, news, latest, notices };
}
