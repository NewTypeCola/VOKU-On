import test from 'node:test';
import assert from 'node:assert/strict';
import { notificationDetails } from '../src/community/personal.ts';
import { authScreenPath } from '../src/community/authFlow.ts';

test('notification detail follows currently readable rows, never stale cached private content', () => {
  const original = { id: 'n', postId: 'p', commentId: 'c', text: '답글 소식', date: '', read: false, postTitle: 'old secret', excerpt: 'old private reply' };
  assert.deepEqual(notificationDetails([original], [], [{id:'c',post_id:'p',body:'hidden'}])[0], {...original, postTitle:undefined, excerpt:undefined});
  const readable = notificationDetails([original], [{id:'p',title:'공개 글'}], [{id:'c',post_id:'p',body:'반가워요\n 다시 만나요'}])[0];
  assert.equal(readable.postTitle, '공개 글');
  assert.equal(readable.excerpt, '반가워요 다시 만나요');
  assert.equal(readable.read, false);
  assert.equal(original.excerpt, 'old private reply');
});
test('deleted replies and mismatched post IDs cannot be shown in notification previews', () => {
  const n = {id:'n',postId:'p',commentId:'c',text:'소식',date:'',read:true};
  const posts = [{id:'p',title:'원글'}];
  assert.equal(notificationDetails([n],posts,[])[0].excerpt, undefined);
  assert.equal(notificationDetails([n],posts,[{id:'c',post_id:'another',body:'다른 글'}])[0].excerpt, undefined);
  assert.equal(notificationDetails([n],posts,[{id:'c',post_id:'p',body:'가'.repeat(300)}])[0].excerpt.length, 140);
});
test('password reset explicitly retains settings and its original menu entry', () => {
  const source = '/account?tab=settings&back=%2Fboard%3Fcategory%3D%25EC%25B6%2594%25EC%2596%25B5';
  const route = authScreenPath('forgot', source, source);
  const params = new URLSearchParams(route.split('?')[1]);
  assert.equal(params.get('next'),source);
  assert.equal(params.get('back'),source);
});
