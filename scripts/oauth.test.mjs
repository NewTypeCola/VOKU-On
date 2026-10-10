import test from 'node:test';
import assert from 'node:assert/strict';
import { safeReturnPath, readOAuthError, safeKakaoAvatar } from '../src/community/oauth.ts';

test('OAuth returns to a permitted internal post or archive route only',()=>{
  assert.equal(safeReturnPath('/post/7f8bf130-abcd-4567-8901-112233445566'),'/post/7f8bf130-abcd-4567-8901-112233445566');
  assert.equal(safeReturnPath('/archive?year=2018&term=2'),'/archive?year=2018&term=2');
  for(const path of ['//evil.example','https://evil.example','/\\evil.example','/auth?next=//evil.example','/board\n',null]) assert.equal(safeReturnPath(path),'/board');
});
test('OAuth cancellation and provider errors are safe Korean messages',()=>{
  assert.match(readOAuthError('?error=access_denied&error_description=untrusted',''),/취소/);
  assert.match(readOAuthError('','#error=server_error&error_description=private-token'),/완료하지 못/);
  assert.equal(readOAuthError('?code=one-time-code',''),'');
});

test('Kakao photos accept only provider CDN URLs and upgrade legacy HTTP links',()=>{
  assert.equal(safeKakaoAvatar('http://k.kakaocdn.net/dn/photo/img.jpg'),'https://k.kakaocdn.net/dn/photo/img.jpg');
  for(const url of ['https://evil.example/a.jpg','https://k.kakaocdn.net.evil.example/a','data:image/svg+xml,bad','javascript:alert(1)','https://user:pass@k.kakaocdn.net/a',null]) assert.equal(safeKakaoAvatar(url),null);
});
