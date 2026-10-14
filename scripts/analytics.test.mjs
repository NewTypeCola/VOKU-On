import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  acquisition,
  activeDelta,
  routeInfo,
  validIdentity,
  VISITOR_MS,
} from "../src/analytics/model.ts";
import { collectUsage } from "../server/usageCollector.js";
const env = {
  USAGE_INGEST_KEY: "a".repeat(64),
  VITE_SUPABASE_URL: "https://example.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  CF_PAGES_COMMIT_SHA: "abc123",
};
const body = () => ({
  v: 1,
  visitor: randomUUID(),
  session: randomUUID(),
  events: [{ id: randomUUID(), name: "page_view" }],
});
const request = (
  data = body(),
  headers = {},
  url = "https://voku.pages.dev/api/usage",
) =>
  new Request(url, {
    method: "POST",
    headers: {
      Origin: "https://voku.pages.dev",
      "Content-Type": "application/json",
      "CF-Connecting-IP": "192.0.2.1",
      "User-Agent": "Mobile test browser",
      ...headers,
    },
    body: JSON.stringify(data),
  });
test("Cloudflare routes send usage collection and erasure to Functions", () => {
  const routes = JSON.parse(readFileSync(new URL("../public/_routes.json", import.meta.url), "utf8"));
  const matches = (pattern, path) => new RegExp("^" + pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replaceAll("\\*", ".*") + "$").test(path);
  for (const path of ["/api/usage", "/api/usage/erase", "/share/post/example", "/p/example"]) {
    assert.ok(routes.include.some(pattern => matches(pattern, path)), path + " must invoke Functions");
    assert.ok(!routes.exclude.some(pattern => matches(pattern, path)), path + " must not bypass Functions");
  }
  assert.ok(!routes.include.some(pattern => matches(pattern, "/assets/app.js")));
});
test("acquisition and route classification never retain raw query/referrer/profile details", () => {
  const source = acquisition(
    "https://www.google.com/search?q=private-email@example.com",
    "?code=secret&utm_campaign=private-name",
    "voku.pages.dev",
  );
  assert.deepEqual(source, { source: "google", campaign: "none" });
  assert.deepEqual(acquisition("", "?utm_campaign=alumni", "voku.pages.dev"), {
    source: "direct",
    campaign: "alumni",
  });
  const route = routeInfo("/search?q=private-email@example.com");
  assert.equal(route.route, "search");
  assert.ok(!JSON.stringify(route).includes("private"));
  assert.equal(
    routeInfo("/read/voku_1994_1_gwanggyo_music_walk_01?token=secret").record,
    "voku_1994_1_gwanggyo_music_walk_01",
  );
});
test("reading time excludes hidden, idle and suspended-tab gaps; browser identity expires", () => {
  assert.equal(activeDelta(1200, 200, true, 1000), 1000);
  assert.equal(activeDelta(1200, 200, false, 1000), 0);
  assert.equal(activeDelta(61001, 60000, true, 0), 0);
  assert.equal(activeDelta(50000, 0, true, 50000), 2000);
  const now = Date.now();
  assert.equal(
    validIdentity(
      { id: randomUUID(), at: now - VISITOR_MS - 1 },
      now,
      VISITOR_MS,
    ),
    false,
  );
  assert.equal(
    validIdentity({ id: "fingerprint", at: now }, now, VISITOR_MS),
    false,
  );
});
test("collector rejects cross-origin, oversized, malformed and unconfigured requests before upstream", async () => {
  const forbidden = () => {
    throw Error("must not call upstream");
  };
  assert.equal(
    (
      await collectUsage(
        { request: request(body(), { Origin: "https://evil.example" }), env },
        forbidden,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await collectUsage(
        { request: request({ junk: "a".repeat(32769) }), env },
        forbidden,
      )
    ).status,
    413,
  );
  assert.equal(
    (await collectUsage({ request: request({ v: 1 }), env }, forbidden)).status,
    400,
  );
  assert.equal(
    (
      await collectUsage(
        { request: request(), env: { ...env, USAGE_INGEST_KEY: "" } },
        forbidden,
      )
    ).status,
    503,
  );
});
test("edge derives context, hides IP/UA and secrets, forwards auth only to the fixed Supabase origin", async () => {
  let sent;
  const data = body();
  data.automated = true;
  const res = await collectUsage(
    {
      request: request(data, { Authorization: "Bearer " + "x".repeat(30) }),
      env,
    },
    async (url, args) => {
      sent = { url, args };
      return Response.json({ accepted: 1, rejected: 0, duplicate: 0 });
    },
  );
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("Cache-Control"), "no-store");
  const params = JSON.parse(sent.args.body);
  assert.equal(params.p_context.environment, "production");
  assert.equal(params.p_context.bot, true);
  assert.equal(params.p_context.device, "mobile");
  assert.match(params.p_context.rateKey, /^[a-f0-9]{64}$/);
  assert.ok(!JSON.stringify(params.p_context).includes("192.0.2.1"));
  assert.equal(
    sent.url,
    "https://example.supabase.co/rest/v1/rpc/usage_ingest",
  );
  assert.equal(sent.args.headers.Authorization, "Bearer " + "x".repeat(30));
  assert.ok(!(await res.text()).includes(env.USAGE_INGEST_KEY));
});
test("preview and robots never become production real traffic and failures remain recoverable", async () => {
  let context;
  const req = request(
    body(),
    { Origin: "https://preview.voku.pages.dev", "User-Agent": "Googlebot" },
    "https://preview.voku.pages.dev/api/usage",
  );
  await collectUsage({ request: req, env }, async (_u, args) => {
    context = JSON.parse(args.body).p_context;
    return Response.json({ accepted: 1 });
  });
  assert.equal(context.environment, "preview");
  assert.equal(context.bot, true);
  assert.equal(
    (
      await collectUsage(
        { request: request(), env },
        async () => new Response("", { status: 401 }),
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await collectUsage({ request: request(), env }, async () => {
        throw Error("network with secret");
      })
    ).status,
    503,
  );
});
test("erasure exposes no event data and remains same-origin only", async () => {
  const visitor = randomUUID();
  let args;
  const res = await collectUsage(
    {
      request: request(
        { visitor },
        {},
        "https://voku.pages.dev/api/usage/erase",
      ),
      env,
    },
    async (_url, r) => {
      args = JSON.parse(r.body);
      return Response.json(null);
    },
  );
  assert.deepEqual(args, { p_key: env.USAGE_INGEST_KEY, p_visitor: visitor });
  assert.deepEqual(await res.json(), { erased: true });
});
