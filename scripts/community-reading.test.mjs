import test from "node:test";
import assert from "node:assert/strict";
import {
  pageWindow,
  isNewPost,
  commentPath,
} from "../src/community/reading.ts";
import {
  allowCommunityLeave,
  setCommunityLeaveGuard,
} from "../src/community/navigationGuard.ts";
test("mobile page windows remain bounded at first, middle and last pages", () => {
  assert.deepEqual(pageWindow(1, 2), [1, 2]);
  assert.deepEqual(pageWindow(8, 10), [7, 8, 9]);
  assert.deepEqual(pageWindow(10, 10), [8, 9, 10]);
});
test("new badges expire after exactly 24 hours and reject future or invalid dates", () => {
  const now = Date.parse("2026-10-11T04:00:00Z");
  assert.equal(isNewPost("2026-10-10T04:00:01Z", now), true);
  assert.equal(isNewPost("2026-10-10T04:00:00Z", now), false);
  assert.equal(isNewPost("2026-10-12", now), false);
  assert.equal(isNewPost("invalid", now), false);
});
test("notification links retain comment anchors and older notifications stay valid", () => {
  assert.equal(commentPath("post", "reply"), "/post/post?comment=reply");
  assert.equal(commentPath("post", null), "/post/post");
});
test("draft navigation guard blocks unfinished work and removes only its own registration", () => {
  const clear = setCommunityLeaveGuard(() => false);
  assert.equal(allowCommunityLeave(), false);
  const next = setCommunityLeaveGuard(() => true);
  clear();
  assert.equal(allowCommunityLeave(), true);
  next();
  assert.equal(allowCommunityLeave(), true);
});

test('compact reading windows clamp around an anchor and page without exposing invalid offsets', async () => {
  const { readingStart } = await import('../src/community/reading.ts');
  assert.equal(readingStart(27,19),17);
  assert.equal(readingStart(27,26),22);
  assert.equal(readingStart(2,1),0);
  assert.equal(readingStart(0,-1),0);
  assert.equal(readingStart(27,19,22),22);
});
test('post and comment timestamps include two-digit years and Korean time across date boundaries', async () => {
  const { commentDateTime } = await import('../src/community/reading.ts');
  assert.equal(commentDateTime('2026-10-10T15:05:00Z'),'26.10.11 00:05');
  assert.equal(commentDateTime('2026-10-11T05:39:00Z'),'26.10.11 14:39');
  assert.equal(commentDateTime('2026-12-31T15:05:00Z'),'27.01.01 00:05');
});
test('six board subjects and linked archives keep independent labels, including legacy music', async () => {
  const { boardCategories, writingCategory, boardCategory } = await import('../src/community/categories.ts');
  const { postLabel } = await import('../src/community/types.ts');
  assert.deepEqual(boardCategories,['전체','자유글','추억','질문','동문소식','공지']);
  assert.equal(writingCategory('음악'),'일상');
  assert.equal(boardCategory('음악'),'자유글');
  assert.equal(postLabel({category:'추억',recordId:'voku_link',pinned:false}),'추억');
});
