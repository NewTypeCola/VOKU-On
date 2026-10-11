import test from "node:test";
import assert from "node:assert/strict";
import { validatePostText } from "../src/community/composerFields.ts";
import { emptyPostDraft, readDraftText } from "../src/community/drafts.ts";

test("empty or whitespace-only submissions identify the field to focus", () => {
  assert.ok(validatePostText("  \n", "안부").title);
  assert.equal(validatePostText("  \n", "안부").body, "");
  assert.equal(validatePostText("제목", " \n\t").title, "");
  assert.ok(validatePostText("제목", " \n\t").body);
  assert.deepEqual(validatePostText("  제목  ", "첫 줄\n둘째 줄"), { title: "", body: "" });
});

test("restored over-limit text is rejected without silently truncating the draft", () => {
  assert.deepEqual(validatePostText("가".repeat(100), "나".repeat(10000)), { title: "", body: "" });
  assert.match(validatePostText("가".repeat(101), "나").title, /100자/);
  assert.match(validatePostText("가", "나".repeat(10001)).body, /10,000자/);
});

test("new drafts use plain text while existing formatted drafts keep their content and format", () => {
  assert.equal(emptyPostDraft().bodyFormat, "plain");
  const draft = { ...emptyPostDraft(), title: "추억", body: "**방송실**\n- 사진 이야기", bodyFormat: "markdown", isSecret: true, recordId: "cue-id" };
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  try {
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => JSON.stringify(draft) } });
    assert.deepEqual(readDraftText("draft"), draft);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "localStorage", descriptor);
    else delete globalThis.localStorage;
  }
});
