import { uuid, headers, failure, loadPublicPost, shareImage } from "../../server/postShare.js";

// Old shared links remain usable. Images still recheck publication every time.
export async function onRequest({ request, params, env }) {
  if (!["GET", "HEAD"].includes(request.method)) return failure("허용되지 않는 요청입니다.", 405);
  const id = String(params.id || "");
  if (!uuid.test(id)) return failure("글을 찾을 수 없습니다.", 404);
  const result = await loadPublicPost(env, id);
  if (!result.post) return failure("글을 찾을 수 없거나 공개되지 않은 글입니다.", result.status);
  if (new URL(request.url).searchParams.get("image") === "1") return shareImage(result, request);
  return new Response(null, { status: 302, headers: { ...headers, Location: new URL("/p/" + result.post.publicCode, request.url).href } });
}
