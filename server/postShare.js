export const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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
export const headers = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex",
};
export const failure = (message, status) =>
  new Response(message, {
    status,
    headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" },
  });
export const code = /^[A-Za-z0-9_-]{10}$/;
export async function loadPublicPost(env, reference, byCode = false) {
  const base = env.VITE_SUPABASE_URL?.replace(/\/$/, "");
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(base || "") || !key) return { status: 503 };
  try {
    // Never forward a member session or increment views for preview requests.
    const result = await fetch(base + "/rest/v1/rpc/" + (byCode ? "community_post_by_code" : "community_post"), {
      method: "POST", headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify(byCode ? { p_code: reference } : { p_id: reference }),
      signal: AbortSignal.timeout(8000),
    });
    if (!result.ok) return { status: result.status >= 500 ? 503 : 404 };
    const { post } = await result.json();
    if (!post || !uuid.test(post.id) || !code.test(post.publicCode)
      || (byCode ? post.publicCode : post.id) !== reference
      || post.status !== "published" || post.isSecret || post.readable === false) return { status: 404 };
    return { post, base, key, status: 200 };
  } catch { return { status: 503 }; }
}
export async function shareImage({ post, base, key }, request) {
  try {
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

  } catch { return failure("사진을 불러올 수 없습니다.", 503); }
}
export function postHead(post, url) {
  const title = post ? post.title : "VOKU On";
  const description = post ? excerpt(post.body, post.bodyFormat) : "VOKU On에서 게시글을 확인해 주세요.";
  const image = post?.photos?.length ? url + "?image=1" : new URL("/icons/voku-on-512.png", url).href;
  return `<title>${escape(title)} · VOKU On</title><meta name="description" content="${escape(description)}"><meta property="og:type" content="article"><meta property="og:site_name" content="VOKU On"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${escape(url)}"><meta property="og:image" content="${escape(image)}"><meta name="twitter:card" content="summary_large_image"><link rel="canonical" href="${escape(url)}">`;
}
export function postShell(html, post, url) {
  return html.replace(/<title>[^<]*<\/title>/i, "")
    .replace(/<meta\s+name="description"[^>]*>/i, "")
    .replace("</head>", () => postHead(post, url) + "</head>");
}
