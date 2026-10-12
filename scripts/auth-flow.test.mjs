import test from 'node:test';
import assert from 'node:assert/strict';
import { authScreenPath, prepareAuthEntry, readAuthReturn, clearAuthReturn, savePendingEmail, readPendingEmail, emailCooldown, pendingExternalAuth, readExternalAuth, passwordError, hasRecovery, saveRecovery } from '../src/community/authFlow.ts';
import { safeReturnPath, readOAuthError } from '../src/community/oauth.ts';
function storage() { const values = new Map(); return { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k), values }; }
const now = 1700000000000;
test('auth entry retains category, page, post and separate cancel destination across OAuth reloads', () => {
  const store = storage(), list = '/board?category=%EC%B6%94%EC%96%B5&page=2';
  const entry = prepareAuthEntry('/auth?next=%2Fwrite%3Fcategory%3D%25EC%25B6%2594%25EC%2596%25B5', list, 612, list, 0, store, now);
  const p = new URLSearchParams(entry.split('?')[1]);
  assert.equal(p.get('next'), '/write?category=%EC%B6%94%EC%96%B5');
  assert.equal(p.get('back'), list);
  assert.equal(readAuthReturn(store, now + 30000).positions[list], 612);
  prepareAuthEntry('/auth', '/post/abc-123', 930, list, 612, store, now);
  assert.deepEqual(readAuthReturn(store, now + 40000), { next:'/post/abc-123', back:'/post/abc-123', positions:{'/post/abc-123':930,[list]:612}, list, createdAt:now });
  clearAuthReturn(store); assert.equal(readAuthReturn(store, now), null);
});
test('return paths reject external, auth-loop and malformed destinations', () => {
  const store = storage();
  const p = new URLSearchParams(authScreenPath('email', '//evil.example', '/auth?next=/auth').split('?')[1]);
  assert.equal(p.get('next'), '/board'); assert.equal(p.get('back'), '/board');
  for (const path of ['/board#//evil.example', '/board\u0000x', '/board?x=\\evil', '/not-a-route', '/'+'a'.repeat(5000)]) assert.equal(safeReturnPath(path), '/board');
  assert.equal(safeReturnPath('/search?q=방송'), '/search?q=방송');
  prepareAuthEntry('/auth', '/board', -10, undefined, 0, store, now);
  assert.equal(readAuthReturn(store, now).positions['/board'], 0);
  store.setItem('voku-auth-return-v2', JSON.stringify({next:'https://evil.example',back:'/board',createdAt:now}));
  assert.equal(readAuthReturn(store, now), null);
});
test('stale return locations and pending emails expire and corrupt or blocked storage is tolerated', () => {
  const store = storage();
  prepareAuthEntry('/auth', '/board?page=3', 410, undefined, 0, store, now);
  assert.equal(readAuthReturn(store, now + 3600000), null);
  savePendingEmail({email:'qa@example.invalid',kind:'signup',sentAt:now}, store);
  assert.equal(readPendingEmail(store, now + 3600000), null);
  store.setItem('voku-auth-return-v2', '{'); assert.equal(readAuthReturn(store, now), null);
  const blocked = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); }, removeItem() { throw Error('blocked'); } };
  assert.doesNotThrow(() => prepareAuthEntry('/auth','/board',0,undefined,0,blocked,now));
  assert.equal(readAuthReturn(blocked, now), null);
  assert.equal(readPendingEmail(blocked, now), null);
});
test('confirmation state resumes after reload without a password and resend has a 60 second cooldown', () => {
  const store = storage();
  const pending = {email:'qa@example.invalid',kind:'recovery',sentAt:now};
  savePendingEmail(pending, store);
  assert.deepEqual(readPendingEmail(store, now + 15000), pending);
  assert.equal(emailCooldown(pending, now),60);
  assert.equal(emailCooldown(pending, now + 59999),1);
  assert.equal(emailCooldown(pending, now + 60000),0);
  assert.deepEqual(Object.keys(JSON.parse([...store.values.values()][0])).sort(),['email','kind','sentAt']);
  savePendingEmail(null,store); assert.equal(readPendingEmail(store,now),null);
});
test('OAuth provider markers expire and provider errors do not disclose descriptions or tokens', () => {
  const store=storage();
  pendingExternalAuth('google',store,now); assert.equal(readExternalAuth(store,now+5000),'google');
  assert.equal(readExternalAuth(store,now+3600000),null);
  pendingExternalAuth(null,store); assert.equal(readExternalAuth(store,now),null);
  assert.match(readOAuthError('?error=access_denied&error_description=private','', 'google'), /Google.*취소/);
  assert.match(readOAuthError('?error=access_denied&error_code=otp_expired',''), /인증 링크.*만료/);
  assert.doesNotMatch(readOAuthError('?error=server_error&error_description=private-token',''), /private/);
});
test('password validation handles minimum length, mismatch and UTF-8 byte limit', () => {
  assert.match(passwordError('short','short'),/10자/);
  assert.match(passwordError('test-password','different'),/일치/);
  assert.equal(passwordError('가'.repeat(24),'가'.repeat(24)), '');
  assert.match(passwordError('가'.repeat(25),'가'.repeat(25)),/너무 길/);
  assert.equal(passwordError('A'.repeat(72),'A'.repeat(72)), '');
  assert.match(passwordError('A'.repeat(73),'A'.repeat(73)), /너무 길/);
});

test('password reset screen resumes only for the same user within its time limit', () => {
  const store = storage();
  saveRecovery('member-a',store,now);
  assert.equal(hasRecovery('member-a',store,now+15000),true);
  assert.equal(hasRecovery('member-b',store,now+15000),false);
  assert.equal(hasRecovery(undefined,store,now+15000),false);
  assert.equal(hasRecovery('member-a',store,now+3600000),false);
  saveRecovery(null,store); assert.equal(hasRecovery('member-a',store,now),false);
});
