import test from 'node:test';
import assert from 'node:assert/strict';
import { communityReturnPath, pageNumber } from '../src/community/navigation.ts';
import { refreshOnReturn } from '../src/community/refreshOnReturn.ts';

test('post, attached archive, edit and login retain the originating list; unrelated visits do not', () => {
  const board = '/board?category=음악&q=방송&page=3&sort=popular';
  assert.equal(communityReturnPath(board), board);
  for (const path of ['/post/123','/read/voku_1980?from=123','/write?edit=123','/auth?next=%2Fpost%2F123']) {
    assert.equal(communityReturnPath(path, board), board);
  }
  const ownComments = '/account?tab=comments&page=6';
  assert.equal(communityReturnPath(ownComments, board), ownComments);
  assert.equal(communityReturnPath('/notifications?page=3'), '/notifications?page=3');
  assert.equal(communityReturnPath('/post/direct'), undefined);
  assert.equal(communityReturnPath('/home', board), undefined);
  assert.equal(communityReturnPath('/post/123', 'https://example.com'), undefined);
});

test('invalid page links cannot produce fractional offsets or out-of-range RPC integers', () => {
  for (const value of [null,'','NaN','-1','0','1.5','Infinity','2147483648']) assert.equal(pageNumber(value), 1);
  assert.equal(pageNumber('6'), 6);
});

test('returning to the app refreshes once; hidden tabs and disposed listeners never refresh', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const browser = new EventTarget(), page = new EventTarget();
  page.visibilityState = 'visible';
  let calls = 0;
  const dispose = refreshOnReturn(() => calls++, page, browser);
  browser.dispatchEvent(new Event('focus'));
  page.dispatchEvent(new Event('visibilitychange'));
  t.mock.timers.tick(250);
  assert.equal(calls, 1);
  browser.dispatchEvent(new Event('focus'));
  page.visibilityState = 'hidden';
  page.dispatchEvent(new Event('visibilitychange'));
  browser.dispatchEvent(new Event('online'));
  t.mock.timers.tick(1000);
  assert.equal(calls, 1);
  page.visibilityState = 'visible';
  page.dispatchEvent(new Event('visibilitychange'));
  t.mock.timers.tick(250);
  assert.equal(calls, 2);
  browser.dispatchEvent(new Event('online'));
  t.mock.timers.tick(250);
  assert.equal(calls, 3);
  browser.dispatchEvent(new Event('focus'));
  dispose();
  browser.dispatchEvent(new Event('focus'));
  t.mock.timers.tick(1000);
  assert.equal(calls, 3);
});

test('compose links preserve category and exact board context, while unsafe return targets are rejected', async () => {
  const { composerPath, composerReturn } = await import('../src/community/navigation.ts');
  const list='/board?category=질문&q=방송&linked=1&page=2&sort=popular';
  const path=composerPath(list,'질문');
  const params=new URLSearchParams(path.split('?')[1]);
  assert.equal(params.get('category'),'질문');
  assert.equal(composerReturn(params),list);
  assert.equal(composerReturn(new URLSearchParams('list=https://example.com')),'/board');
  assert.equal(composerReturn(new URLSearchParams(),list),list);
});
