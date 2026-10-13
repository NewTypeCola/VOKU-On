import test from 'node:test';
import assert from 'node:assert/strict';
import { currentRoute, routeHref, postPath, canonicalizePost } from '../src/community/postAddress.ts';
import { safeReturnPath } from '../src/community/oauth.ts';
import { shareLink } from '../src/share.ts';
import { onRequest } from '../functions/p/[code].js';
const id = '10000000-0000-4000-8000-000000000001';
const publicCode = 'Ab3k9Pq2_x';
const post = {id, publicCode, title: '공개 제목', body: '공개 본문', status: 'published', photos: []};
const origin = 'https://voku.pages.dev';
const shell = '<html><head><title>VOKU On</title></head><body><div id="root"></div><script src="/assets/app.js"></script></body></html>';
const context = (suffix = '') => ({request: new Request(origin + '/p/' + publicCode + suffix), params: {code: publicCode}, env: {
  VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  ASSETS: { fetch: async req => { assert.equal(req.url, origin + '/'); assert.equal(req.headers.get('authorization'), null); return new Response(shell); } },
}});

test('public routes are compact while history retains list and comment return context', () => {
  const route = postPath(post) + '?list=%2Fboard%3Fpage%3D3';
  assert.equal(routeHref(route), '/p/' + publicCode);
  assert.equal(safeReturnPath(route), route);
  assert.equal(currentRoute(new URL(origin + routeHref(route)), {canonicalRoute: route, canonicalUrl: routeHref(route)}), route);
  assert.equal(currentRoute(new URL(origin + routeHref(route)), null), '/post/' + publicCode);
  const commentRoute = route + '&comment=abc';
  assert.equal(routeHref(commentRoute), '/p/' + publicCode + '?comment=abc');
  assert.equal(currentRoute(new URL(origin + '/p/' + publicCode + '?comment=abc'), null), '/post/' + publicCode + '?comment=abc');
  assert.equal(routeHref('/board?page=3'), '/#/board?page=3');
  assert.equal(routeHref('/post/' + id), '/#/post/' + id);
  assert.equal(currentRoute(new URL(origin + '/#/post/' + id), null), '/post/' + id);
  assert.equal(currentRoute(new URL(origin + '/p/' + publicCode), {canonicalUrl: '/p/another123', canonicalRoute: '/post/other'}), '/post/' + publicCode);
});
test('canonical replacement preserves the current thread, comment, return state and history entry', t => {
  const route = '/post/' + id + '?comment=abc&list=%2Fboard';
  globalThis.location = new URL(origin + '/#' + route);
  t.after(() => { delete globalThis.location; delete globalThis.history; });
  let changed;
  globalThis.history = {state: {voku: true, communityReturn: '/board?page=3'}, replaceState: (state, _, url) => {changed = {state, url};}};
  canonicalizePost(post);
  assert.equal(changed.url, '/p/' + publicCode + '?comment=abc');
  assert.equal(changed.state.communityReturn, '/board?page=3');
  assert.equal(changed.state.voku, true);
  assert.equal(currentRoute(new URL(origin + changed.url), changed.state), route);
});
test('share invokes the native sheet immediately and cancellation does not copy', async () => {
  const calls = [];
  const data = {title: '제목', url: origin + '/p/' + publicCode};
  const result = shareLink(data, {share: async value => {calls.push(value);}, clipboard: {writeText: async () => {throw Error('must not copy');}}});
  assert.deepEqual(calls, [data]);
  assert.equal(await result, 'shared');
  assert.equal(await shareLink(data, {share: async () => {throw {name: 'AbortError'};}, clipboard: {writeText: async () => {assert.fail('cancelled share must not copy');}}}), 'cancelled');
});
test('unsupported or failed native sharing copies once; copy failure only returns feedback', async () => {
  const data = {url: origin + '/p/' + publicCode};
  let copies = 0;
  const clipboard = {writeText: async text => {copies++; assert.equal(text, data.url);}};
  assert.equal(await shareLink(data, {clipboard}), 'copied');
  assert.equal(await shareLink(data, {share: async () => {throw Error('unsupported');}, clipboard}), 'copied');
  assert.equal(copies, 2);
  assert.equal(await shareLink(data, {clipboard: {writeText: async () => {throw Error('denied');}}}), 'failed');
  assert.equal(await shareLink(data, {}), 'failed');
});
test('short-address HTTP GET and HEAD serve the actual app with public metadata and no session forwarding', async t => {
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.ok(url.endsWith('/rpc/community_post_by_code'));
    assert.deepEqual(JSON.parse(init.body), {p_code: publicCode});
    assert.equal(init.headers.Authorization, undefined);
    return Response.json({post});
  });
  const response = await onRequest(context());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const html = await response.text();
  assert.ok(html.includes('공개 제목'));
  assert.ok(html.includes('/assets/app.js'));
  assert.ok(!html.includes(id));
  const head = context(); head.request = new Request(head.request, {method: 'HEAD'});
  assert.equal(await (await onRequest(head)).text(), '');
});
test('private or unavailable short addresses retain a login-capable app but reveal no metadata or image', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({post: {...post, isSecret: true}}));
  for (const flags of [{isSecret: true}, {status:'hidden'}, {status:'deleted'}, {readable:false}, {publicCode:'different1'}]) {
    globalThis.fetch.mock.mockImplementation(async () => Response.json({post: {...post, ...flags}}));
    const response = await onRequest(context());
    const html = await response.text();
    assert.ok(html.includes('/assets/app.js'));
    assert.ok(!html.includes(post.title));
    assert.ok(!html.includes(post.body));
    assert.equal((await onRequest(context('?image=1'))).status, 404);
  }
  globalThis.fetch.mock.mockImplementation(async () => {throw Error('offline');});
  assert.ok((await (await onRequest(context())).text()).includes('/assets/app.js'));
  assert.equal((await onRequest({...context(), params: {code: '../bad'}})).status, 404);
  const method = context(); method.request = new Request(method.request, {method:'POST'});
  assert.equal((await onRequest(method)).status, 405);
});
