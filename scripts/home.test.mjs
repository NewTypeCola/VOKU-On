import test from 'node:test';
import assert from 'node:assert/strict';
import { homeSections, loadHomeFeeds, rankHomeEpisodes, rankHomePosts, recentHomePosts } from '../src/home/feed.ts';
import { communityReturnPath, composerPath, composerReturn } from '../src/community/navigation.ts';

const now = Date.parse('2026-10-11T12:00:00Z');
const day = 86_400_000;
const post = (id, extra = {}) => ({
  id, title: id, date: new Date(now - day).toISOString(), category: '추억',
  status: 'published', pinned: false, isSecret: false, readable: true,
  likes: 0, views: 1, commentCount: 0, ...extra,
});
const feed = (posts = [], extra = {}) => ({ posts, notices: [], total: posts.length, page: 1, ...extra });

test('home ranking keeps the seven-day boundary and excludes secrets, notices, unreadable and future posts', () => {
  const valid = post('boundary', { date: new Date(now - 7 * day).toISOString() });
  const posts = [valid, valid, post('old', { date: new Date(now - 7 * day - 1).toISOString() }),
    post('future', { date: new Date(now + 1).toISOString() }), post('invalid', { date: 'invalid' }),
    post('secret', { isSecret: true }), post('unreadable', { readable: false }),
    post('hidden', { status: 'hidden' }), post('deleted', { status: 'deleted' }), post('notice', { pinned: true })];
  assert.deepEqual(recentHomePosts(posts, now).map(p => p.id), ['boundary']);
});

test('views and comments rank independently, use stable ties, and never fill slots with zero reactions', () => {
  const posts = [post('views', { views: 10 }), post('comments', { views: 1, commentCount: 10 }),
    post('tie-a', { views: 1, commentCount: 2 }), post('tie-b', { views: 1, commentCount: 2 }),
    post('liked', { views: 1, commentCount: 2, likes: 1 }), post('zero', { views: 0 })];
  assert.deepEqual(rankHomePosts(posts, 'views', now).map(p => p.id), ['views', 'comments', 'liked', 'tie-b', 'tie-a']);
  assert.deepEqual(rankHomePosts(posts, 'comments', now).map(p => p.id), ['comments', 'liked', 'tie-b', 'tie-a']);
  assert.deepEqual(rankHomePosts(posts.toReversed(), 'views', now).map(p => p.id), rankHomePosts(posts, 'views', now).map(p => p.id));
});

test('popular cue sheets count unique public attachments and resolve only verified catalog records', () => {
  const a = post('one', { recordId: 'a', demo: true });
  const result = rankHomeEpisodes([a, a, post('two', { recordId: 'a' }),
    post('three', { recordId: 'b', date: new Date(now).toISOString() }),
    post('missing', { recordId: 'not-in-catalog' }), post('private', { recordId: 'b', isSecret: true }),
    post('text-only', { body: 'a 회차를 언급합니다' })], [{ id: 'a' }, { id: 'b' }], now);
  assert.deepEqual(result.map(e => [e.record.id, e.postCount, e.demoCount]), [['a', 2, 1], ['b', 1, 0]]);
});

test('ranking reads beyond page one, deduplicates overlaps and stops after the seven-day window', async t => {
  t.mock.method(Date, 'now', () => now);
  const calls = [];
  const first = Array.from({ length: 20 }, (_, i) => post(`first-${i}`));
  const loaded = await loadHomeFeeds(async (q = {}) => {
    if (q.category) return feed();
    const page = q.page || 1;
    calls.push(page);
    return page === 1 ? feed(first, { total: 60 }) : feed([first[0], post('older-hit', { views: 100 }), post('too-old', { date: new Date(now - 8 * day).toISOString() })], { total: 60, page });
  });
  assert.equal(calls.filter(page => page === 2).length, 1);
  assert.ok(!calls.includes(3));
  assert.equal(loaded.popular.feed.posts.length, 21);
  assert.equal(rankHomePosts(loaded.popular.feed.posts, 'views', now)[0].id, 'older-hit');
  assert.equal(loaded.popular.limited, false);
});

test('home ranking bounds requests at ten pages and reports incomplete candidate coverage', async t => {
  t.mock.method(Date, 'now', () => now);
  const pages = [];
  const loaded = await loadHomeFeeds(async (q = {}) => {
    if (q.category) return feed();
    const page = q.page || 1;
    pages.push(page);
    return feed(Array.from({ length: 20 }, (_, i) => post(`${page}-${i}`)), { total: 250, page });
  });
  assert.equal(Math.max(...pages), 10);
  assert.equal(loaded.popular.feed.posts.length, 200);
  assert.equal(loaded.popular.limited, true);
});

test('photo discovery continues to older pages until four real photo posts are available', async t => {
  t.mock.method(Date, 'now', () => now);
  const calls = [];
  const loaded = await loadHomeFeeds(async (q = {}) => {
    if (q.category !== '추억') return feed();
    calls.push(q.page || 1);
    return q.page === 2 ? feed(Array.from({ length: 4 }, (_, i) => post(`photo-${i}`, { photos: [{ id: `${i}` }] })), { total: 60, page: 2 })
      : feed(Array.from({ length: 20 }, (_, i) => post(`text-${i}`)), { total: 60 });
  });
  assert.deepEqual(calls, [1, 2]);
  assert.equal(homeSections(loaded).photos.length, 4);
});

test('a failed corner does not hide successful sections, and a later retry can recover', async t => {
  t.mock.method(Date, 'now', () => now);
  let fail = true;
  const read = async (q = {}) => {
    if (fail && q.category === '동문소식') throw new Error('network unavailable');
    return feed([post('public')]);
  };
  const partial = await loadHomeFeeds(read);
  assert.match(partial.news.error, /network/);
  assert.equal(partial.latest.feed.posts[0].id, 'public');
  fail = false;
  assert.equal((await loadHomeFeeds(read)).news.error, '');
});

test('home sections prefer real photos, keep latest ordering, and exclude private posts from every corner', () => {
  const visible = post('real', { photos: [{ id: 'photo' }] });
  const privatePost = post('secret', { isSecret: true, photos: [{ id: 'hidden' }] });
  const posts = [visible, privatePost, post('next')];
  const sections = homeSections(Object.fromEntries(['popular', 'memories', 'news', 'latest'].map(key => [key, {
    feed: feed(posts, { notices: [post('notice', { pinned: true }), post('secret-notice', { pinned: true, isSecret: true })] }), error: '',
  }])), Array.from({ length: 4 }, (_, i) => post(`local-${i}`)));
  assert.deepEqual(sections.photos.map(p => p.id), ['real', 'local-0', 'local-1', 'local-2']);
  assert.deepEqual(sections.latest.map(p => p.id), ['real', 'next']);
  assert.deepEqual(sections.news.map(p => p.id), ['real', 'next']);
  assert.deepEqual(sections.notices.map(p => p.id), ['notice']);
  assert.deepEqual(homeSections(null).photos, []);
});

test('home rank and expanded context survives posts, attached archives and writing; external targets cannot replace it', () => {
  const origin = '/home?rank=comments&popular=more';
  for (const route of ['/post/a', '/read/record?from=a', '/write?edit=a']) assert.equal(communityReturnPath(route, origin), origin);
  const params = new URLSearchParams(composerPath(origin, '자유글').split('?')[1]);
  assert.equal(composerReturn(params), origin);
  assert.equal(composerReturn(new URLSearchParams('list=//example.com/home')), '/board');
  assert.equal(communityReturnPath('/post/a', '/homeevil'), undefined);
});
