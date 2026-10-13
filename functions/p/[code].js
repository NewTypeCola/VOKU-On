import { code, headers, failure, loadPublicPost, shareImage, postShell } from "../../server/postShare.js";

export async function onRequest({ request, params, env }) {
  if (!["GET", "HEAD"].includes(request.method)) return failure("허용되지 않는 요청입니다.", 405);
  const reference = String(params.code || "");
  if (!code.test(reference)) return failure("글을 찾을 수 없습니다.", 404);
  const url = new URL(request.url);
  const result = await loadPublicPost(env, reference, true);
  if (url.searchParams.get("image") === "1") return result.post
    ? shareImage(result, request) : failure("사진을 찾을 수 없습니다.", result.status);
  try {
    // Always serve the app, including private/hidden posts. Only the signed-in
    // client's existing read RPC may reveal their content after authentication.
    const shell = await env.ASSETS.fetch(new Request(new URL("/", url), { method: "GET" }));
    if (!shell.ok) return failure("잠시 후 다시 시도해 주세요.", 503);
    const html = postShell(await shell.text(), result.post, url.origin + "/p/" + reference);
    return new Response(request.method === "HEAD" ? null : html, {
      headers: { ...headers, "Content-Type": "text/html; charset=utf-8" },
    });
  } catch { return failure("잠시 후 다시 시도해 주세요.", 503); }
}
