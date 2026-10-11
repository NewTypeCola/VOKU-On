const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const excerpt = (body, format) =>
  (format === "markdown"
    ? body
        .replace(/\*\*([^*\n]+)\*\*/g, "$1")
        .replace(/\[([^\]\n]+)\]\(https?:\/\/[^\s)]+\)/g, "$1")
        .replace(/^- /gm, "")
    : body
  )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
const headers = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex",
};
const failure = (message, status) =>
  new Response(message, {
    status,
    headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" },
  });
export function renderShare(post, url, nonce) {
  const target = "/#/post/" + post.id;
  const image = post.photos?.length
    ? url + "?image=1"
    : new URL("/icons/voku-on-512.png", url).href;
  const description = excerpt(post.body, post.bodyFormat);
  return `<!doctype html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(post.title)} · VOKU On</title><meta name="description" content="${escape(description)}"><meta property="og:type" content="article"><meta property="og:site_name" content="VOKU On"><meta property="og:title" content="${escape(post.title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${escape(url)}"><meta property="og:image" content="${escape(image)}"><meta name="twitter:card" content="summary_large_image"><link rel="canonical" href="${escape(url)}"></head><body><h1>${escape(post.title)}</h1><p>${escape(description)}</p><a href="${target}">VOKU On에서 글 읽기</a><script nonce="${nonce}">location.replace(${JSON.stringify(target)})</script></body></html>`;
}
export async function onRequest({ request, params, env }) {
  if (!["GET", "HEAD"].includes(request.method))
    return failure("허용되지 않는 요청입니다.", 405);
  const id = String(params.id || "");
  if (!uuid.test(id)) return failure("글을 찾을 수 없습니다.", 404);
  const base = env.VITE_SUPABASE_URL?.replace(/\/$/, "");
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(base || "") || !key)
    return failure("잠시 후 다시 시도해 주세요.", 503);
  const url = new URL(request.url);
  try {
    // Public credentials only; the read RPC enforces published status. Crawlers
    // do not call the view-count RPC and never receive a member's session.
    const result = await fetch(base + "/rest/v1/rpc/community_post", {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ p_id: id }),
      signal: AbortSignal.timeout(8000),
    });
    if (!result.ok)
      return failure(
        "글을 찾을 수 없거나 공개되지 않은 글입니다.",
        result.status >= 500 ? 503 : 404,
      );
    const { post } = await result.json();
    if (!post || post.id !== id || post.status !== "published" || post.isSecret || post.readable === false)
      return failure("공개되지 않은 글입니다.", 404);
    if (url.searchParams.get("image") === "1") {
      const photo = post.photos?.[0];
      if (!photo || !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/i.test(photo.path))
        return failure("사진을 찾을 수 없습니다.", 404);
      const signed = await fetch(
        base + "/storage/v1/object/sign/community-photos/" + photo.path,
        {
          method: "POST",
          headers: { apikey: key, "Content-Type": "application/json" },
          body: JSON.stringify({ expiresIn: 60 }),
          signal: AbortSignal.timeout(8000),
        },
      );
      if (!signed.ok) return failure("사진을 불러올 수 없습니다.", 404);
      const { signedURL } = await signed.json();
      if (
        typeof signedURL !== "string" ||
        !signedURL.startsWith("/object/sign/community-photos/")
      )
        return failure("사진을 불러올 수 없습니다.", 502);
      const response = await fetch(base + "/storage/v1" + signedURL, {
        signal: AbortSignal.timeout(8000),
      });
      if (
        !response.ok ||
        !response.headers.get("Content-Type")?.startsWith("image/jpeg")
      )
        return failure("사진을 불러올 수 없습니다.", 404);
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > 2097152)
        return failure("사진 크기를 확인해 주세요.", 502);
      return new Response(request.method === "HEAD" ? null : bytes, {
        headers: { ...headers, "Content-Type": "image/jpeg" },
      });
    }
    const nonce = crypto.randomUUID();
    return new Response(
      request.method === "HEAD"
        ? null
        : renderShare(post, url.origin + "/share/" + id, nonce),
      {
        headers: {
          ...headers,
          "Content-Type": "text/html; charset=utf-8",
          "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'`,
        },
      },
    );
  } catch {
    return failure(
      "연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.",
      503,
    );
  }
}
