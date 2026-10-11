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
