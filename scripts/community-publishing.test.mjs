import test from "node:test";
import assert from "node:assert/strict";
import {
  inlineParts,
  safeLink,
} from "../src/community/formatting.ts";
import { checkPhotoFile } from "../src/community/photoFiles.ts";
import { onRequest } from "../functions/share/[id].js";
import { postShell, excerpt } from "../server/postShare.js";
const id = "10000000-0000-4000-8000-000000000001";
const post = {
  id,
  publicCode: "Ab3k9Pq2_x",
  title: '\"><script>alert(1)</script>',
  body: "**방송실**\n- 함께 읽어요\n[자료](https://example.com)",
  bodyFormat: "markdown",
  status: "published",
  photos: [
    {
      path: "20000000-0000-4000-8000-000000000001/30000000-0000-4000-8000-000000000001.jpg",
    },
  ],
};
const env = {
  VITE_SUPABASE_URL: "https://example.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
};
const request = (suffix = "") => ({
  request: new Request("https://voku.pages.dev/share/" + id + suffix),
  params: { id },
  env,
});

test("legacy formatted posts only accept safe links and preserve literal HTML as text", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,x",
    "//evil.com",
    "https://user:pass@example.com",
    "file:///tmp/test",
  ])
    assert.equal(safeLink(url), null);
  assert.equal(
    safeLink("https://example.com/한글"),
    "https://example.com/%ED%95%9C%EA%B8%80",
  );
  const parts = inlineParts(
    '**굵게** [링크](https://example.com) <img onerror="x"> [위험](javascript:alert)',
  );
  assert.equal(parts[0].type, "bold");
  assert.equal(parts[2].type, "link");
  assert.ok(parts.some((p) => p.type === "text" && p.text.includes("<img")));
  assert.ok(
    parts.some((p) => p.type === "text" && p.text.includes("javascript")),
  );
});
test("photo inputs reject executable formats, empty files and oversized originals", () => {
  for (const type of ["image/svg+xml", "text/html", "image/gif", "image/heic"])
    assert.throws(() => checkPhotoFile({ type, size: 50 }), /JPG/);
  for (const size of [0, 16 * 1024 * 1024])
    assert.throws(() => checkPhotoFile({ type: "image/jpeg", size }), /15MB/);
  checkPhotoFile({ type: "image/png", size: 100 });
  checkPhotoFile({ type: "image/webp", size: 100 });
});
test("short-address app HTML escapes metadata and retains the app without redirecting to a UUID", () => {
  const shell = '<html><head><title>Original</title><meta name="description" content="original"></head><body><div id="root"></div><script src="/assets/app.js"></script></body></html>';
  const url = "https://voku.pages.dev/p/" + post.publicCode;
  const html = postShell(shell, post, url);
  assert.ok(!html.includes("<script>alert(1)"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("?image=1"));
  assert.ok(!html.includes("location.replace"));
  assert.ok(!html.includes(id));
  assert.ok(html.includes('/assets/app.js'));
  assert.equal(html.match(/<title>/g).length, 1);
  assert.equal(html.match(/name="description"/g).length, 1);
  assert.equal(excerpt(post.body, post.bodyFormat), "방송실 함께 읽어요 자료");
  assert.ok(postShell(shell, { ...post, photos: [] }, url).includes("/icons/voku-on-512.png"));
  const literal = postShell(shell, { ...post, title: "$& $` $'", body: "$&" }, url);
  assert.ok(literal.includes("$&amp; $` $&#39;"));
  assert.equal(literal.match(/id="root"/g).length, 1);
});
test("share handler uses public read credentials and never records a crawler view", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (url, init) => {
    calls++;
    assert.ok(url.endsWith("/rpc/community_post"));
    assert.equal(init.headers.apikey, env.VITE_SUPABASE_PUBLISHABLE_KEY);
    assert.ok(!init.headers.Authorization);
    return Response.json({ post });
  });
  const response = await onRequest(request());
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "https://voku.pages.dev/p/" + post.publicCode);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(calls, 1);
  assert.equal(await response.text(), "");
});
test("private, deleted, invalid and unavailable posts never reveal preview content", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ post: { ...post, status: "hidden" } }),
  );
  assert.equal((await onRequest(request())).status, 404);
  for (const privacy of [{isSecret:true},{readable:false}]) {
    globalThis.fetch.mock.mockImplementation(async () => Response.json({post:{...post,...privacy}}));
    assert.equal((await onRequest(request())).status,404);
    assert.equal((await onRequest(request('?image=1'))).status,404);
  }
  assert.equal(
    (await onRequest({ ...request(), params: { id: "<script>" } })).status,
    404,
  );
  assert.equal((await onRequest({ ...request(), env: {} })).status, 503);
  globalThis.fetch.mock.mockImplementation(async () => {
    throw Error("offline");
  });
  assert.equal((await onRequest(request())).status, 503);
});
test("share image proxy checks publication and private storage access before serving image bytes", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (url) => {
    calls++;
    if (url.includes("/rpc/")) return Response.json({ post });
    if (url.includes("?token="))
      return new Response(new Uint8Array([82, 73, 70, 70]), {
        headers: { "Content-Type": "image/jpeg" },
      });
    return Response.json({
      signedURL:
        "/object/sign/community-photos/" + post.photos[0].path + "?token=test",
    });
  });
  const response = await onRequest(request("?image=1"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "image/jpeg");
  assert.equal(calls, 3);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});
