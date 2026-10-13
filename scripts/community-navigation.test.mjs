import test from 'node:test';
import assert from 'node:assert/strict';
import { adminEntryPath, adminReturnPath, communityReturnPath, composerReturn, pageNumber, isCommunityList, personalEntryPath, personalReturnPath, profileSettingsPath, profileReturnFromSettings, listReturnLabel, readerListPath, withList } from '../src/community/navigation.ts';
import { canManageBoard } from '../src/community/types.ts';
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
  assert.equal(communityReturnPath('/home', board), '/home');
  assert.equal(communityReturnPath('/post/123', 'https://example.com'), undefined);
});

test('invalid page links cannot produce fractional offsets or out-of-range RPC integers', () => {
  for (const value of [null,'','NaN','-1','0','1.5','Infinity','2147483648']) assert.equal(pageNumber(value), 1);
  assert.equal(pageNumber('6'), 6);
});

test('search and saved lists survive posts, comment anchors, reader and sign-in round trips', () => {
  for (const list of ['/search?q=방송실&back=%2Fhome', '/saved?tab=posts&back=%2Fboard', '/account?tab=comments&page=3', '/account?tab=saved&saved=records&back=%2Fboard', '/notifications?page=2']) {
    const post = withList('/post/abc?comment=def', list);
    const params = new URLSearchParams(post.split('?')[1]);
    assert.equal(params.get('comment'), 'def');
    assert.equal(params.get('list'), list);
    assert.equal(communityReturnPath(list), list);
    assert.equal(communityReturnPath('/read/voku_1980?from=abc', list), list);
    assert.equal(communityReturnPath('/auth?next=%2Fpost%2Fabc', list), list);
    assert.equal(composerReturn(new URLSearchParams({ list })), list);
  }
});

test('personal tabs retain their menu entry without creating a return loop', () => {
  const origin = '/board?category=질문&page=2';
  const account = personalEntryPath('/account?tab=comments', origin);
  const saved = personalEntryPath('/saved?tab=posts', account);
  const settings = personalEntryPath('/account?tab=settings', saved);
  for (const route of [account, saved, settings]) {
    assert.equal(personalReturnPath(new URLSearchParams(route.split('?')[1])), origin);
  }
  assert.equal(new URLSearchParams(saved.split('?')[1]).get('tab'), 'posts');
  assert.equal(personalReturnPath(new URLSearchParams()), '/home');
  assert.equal(personalReturnPath(new URLSearchParams(personalEntryPath('/saved', '/account').split('?')[1])), '/home');
});

test('reader return context accepts precise archive, search and saved routes and rejects unsafe destinations', () => {
  for (const list of ['/home?rank=episodes', '/archive?year=1994&program=music&page=2', '/search?q=1994', '/saved?tab=records']) {
    assert.equal(readerListPath(list), list);
    assert.equal(new URLSearchParams(withList('/read/voku_1994_1_music_01', list).split('?')[1]).get('list'), list);
  }
  for (const list of ['//example.com', 'https://example.com', '/saved#bad', '/search\\bad', '/auth', '/unknown']) {
    assert.equal(readerListPath(list), undefined);
    assert.equal(isCommunityList(list), false);
    assert.equal(withList('/post/abc', list), '/post/abc');
  }
});

test('return button names describe the actual list destination', () => {
  assert.equal(listReturnLabel('/search?q=방송실'), '검색 결과로 돌아가기');
  assert.equal(listReturnLabel('/saved?tab=posts'), '저장 목록으로 돌아가기');
  assert.equal(listReturnLabel('/account?tab=comments&page=4'), '프로필로 돌아가기');
  assert.equal(listReturnLabel('/notifications?page=2'), '알림으로 돌아가기');
});

test('editing a profile preserves its selected tab, page, saved filter and original entry', () => {
  for (const source of ['/account?tab=comments&page=3&back=%2Fboard', '/account?tab=saved&saved=posts&back=%2Fhome', '/account?tab=reports&back=%2Fboard']) {
    const edit = new URLSearchParams(profileSettingsPath(source).split('?')[1]);
    assert.equal(edit.get('tab'), 'settings');
    assert.equal(profileReturnFromSettings(edit), source);
    assert.equal(personalReturnPath(edit), personalReturnPath(new URLSearchParams(source.split('?')[1])));
  }
});

test('profile settings cannot return to unsafe targets or form an editor loop', () => {
  for (const source of ['https://example.com', '/admin', '/account?tab=settings', '/account?tab=blocked', '/account?editFrom=%2Faccount']) {
    assert.equal(profileReturnFromSettings(new URLSearchParams({editFrom: source, back:'/board'})), '/account?back=%2Fboard');
  }
});

test('board administration retains filters through reading and writing, then returns to its entry screen', () => {
  const origin = '/board?category=질문&page=2';
  const entry = adminEntryPath(origin);
  const list = entry + '&q=방송&filter=hidden&page=3';
  assert.equal(adminReturnPath(new URLSearchParams(entry.split('?')[1])), origin);
  assert.equal(adminEntryPath(list), list);
  for (const path of ['/post/123', '/read/voku_1980?from=123', '/write?notice=1']) {
    assert.equal(communityReturnPath(path, list), list);
  }
  assert.equal(composerReturn(new URLSearchParams({list})), list);
  for (const back of ['https://example.com', '//example.com', '/admin?back=/admin', '/auth', '/board#external', '/unknown']) {
    assert.equal(adminReturnPath(new URLSearchParams({back})), '/board');
  }
});

test('admin menu and page accept only active, complete staff profiles', () => {
  const profile = { role: 'admin', profileComplete: true, suspendedUntil: null };
  assert.equal(canManageBoard(null), false);
  assert.equal(canManageBoard(profile), true);
  assert.equal(canManageBoard({...profile, role: 'moderator'}), true);
  assert.equal(canManageBoard({...profile, role: 'member'}), false);
  assert.equal(canManageBoard({...profile, profileComplete: false}), false);
  assert.equal(canManageBoard({...profile, suspendedUntil: new Date(Date.now() + 86400000).toISOString()}), false);
  assert.equal(canManageBoard({...profile, suspendedUntil: '2000-01-01T00:00:00Z'}), true);
});

test('returning to the app refreshes once; hidden tabs and disposed listeners never refresh', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const browser = new EventTarget(), page = new EventTarget();
  page.visibilityState = 'visible';
  let calls = 0;
  const dispose = refreshOnReturn(() => calls++, page, browser);
  // A focus notification while already here must not start a new load.
  browser.dispatchEvent(new Event('focus'));
  page.dispatchEvent(new Event('visibilitychange'));
  t.mock.timers.tick(250);
  assert.equal(calls, 0);
  browser.dispatchEvent(new Event('blur'));
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

test('repeated session confirmation is quiet, while login, recovery and permission refresh remain active', async () => {
  const { needsAuthRefresh } = await import('../src/community/authRefresh.ts');
  assert.equal(needsAuthRefresh('SIGNED_IN', 'member', 'member', false), false);
  assert.equal(needsAuthRefresh('SIGNED_IN', null, 'member', false), true);
  assert.equal(needsAuthRefresh('SIGNED_IN', 'member', 'other', false), true);
  assert.equal(needsAuthRefresh('SIGNED_IN', 'member', 'member', true), true);
  for (const event of ['INITIAL_SESSION', 'SIGNED_OUT', 'PASSWORD_RECOVERY', 'TOKEN_REFRESHED', 'USER_UPDATED']) {
    assert.equal(needsAuthRefresh(event, 'member', 'member', false), true, event);
  }
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

test('writing from a cue sheet retains the exact reader and a separate list for the published post', async () => {
  const { readerComposerPath, composerList } = await import('../src/community/navigation.ts');
  const id = 'voku_2011_1_morning_01';
  const list = '/archive?year=2011&term=1&program=morning&page=2';
  const source = '/read/' + id + '?' + new URLSearchParams({resume:'1', list});
  const params = new URLSearchParams(readerComposerPath(id, source, list).split('?')[1]);
  assert.equal(params.get('record'), id);
  assert.equal(composerReturn(params), source);
  assert.equal(composerList(params), list);
  for (const back of ['https://example.com', '//example.com', '/read/x#bad', '/write?back=/write', '/read/']) {
    assert.equal(composerReturn(new URLSearchParams({back, list})), list);
  }
  const safe = new URLSearchParams(readerComposerPath(id, '/read/another', 'https://example.com').split('?')[1]);
  assert.equal(safe.get('back'), '/read/' + id + '?resume=1');
  assert.equal(safe.get('list'), '/archive');
});
