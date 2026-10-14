const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
export async function collectUsage({ request, env }, transport = fetch) {
  if (request.method !== "POST") return json({ error: "method" }, 405);
  const url = new URL(request.url);
  if (
    request.headers.get("Origin") !== url.origin ||
    (request.headers.get("Sec-Fetch-Site") &&
      !["same-origin", "none"].includes(request.headers.get("Sec-Fetch-Site")))
  )
    return json({ error: "origin" }, 403);
  if (!request.headers.get("Content-Type")?.startsWith("application/json"))
    return json({ error: "content_type" }, 415);
  if (Number(request.headers.get("Content-Length")) > 32768)
    return json({ error: "size" }, 413);
  if (
    !/^[a-f0-9]{64}$/.test(env.USAGE_INGEST_KEY || "") ||
    !/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(env.VITE_SUPABASE_URL || "")
  )
    return json({ error: "unavailable" }, 503);
  let body;
  try {
    // Bound streamed bodies too: Content-Length is not a trusted upper bound.
    const reader = request.body?.getReader();
    if (!reader) return json({ error: "body" }, 400);
    let bytes = 0;
    const chunks = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 32768) {
        await reader.cancel();
        return json({ error: "size" }, 413);
      }
      chunks.push(value);
    }
    const buffer = new Uint8Array(bytes);
    let at = 0;
    for (const part of chunks) {
      buffer.set(part, at);
      at += part.length;
    }
    body = JSON.parse(new TextDecoder().decode(buffer));
  } catch {
    return json({ error: "body" }, 400);
  }
  if (!body || !UUID.test(body.visitor || ""))
    return json({ error: "visitor" }, 400);
  const erase = url.pathname.endsWith("/erase");
  if (
    !erase &&
    (!UUID.test(body.session || "") ||
      body.v !== 1 ||
      !Array.isArray(body.events) ||
      body.events.length < 1 ||
      body.events.length > 30)
  )
    return json({ error: "batch" }, 400);
  const ua = request.headers.get("User-Agent") || "";
  const device = /ipad|tablet/i.test(ua)
    ? "tablet"
    : /mobile|android|iphone/i.test(ua)
      ? "mobile"
      : "desktop";
  const bot =
    body.automated === true ||
    /bot|crawler|spider|headless|playwright|puppeteer|curl|wget|python|go-http-client/i.test(
      ua,
    ) ||
    request.cf?.botManagement?.verifiedBot === true ||
    (typeof request.cf?.botManagement?.score === "number" &&
      request.cf.botManagement.score < 30);
  const environment =
    url.hostname === "voku.pages.dev" ? "production" : "preview";
  const date = new Date().toISOString().slice(0, 10);
  const hmacKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.USAGE_INGEST_KEY),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    hmacKey,
    new TextEncoder().encode(
      date + ":" + (request.headers.get("CF-Connecting-IP") || "unknown"),
    ),
  );
  const rateKey = Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  const auth = request.headers.get("Authorization");
  const headers = {
    "Content-Type": "application/json",
    apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
  if (auth && /^Bearer [A-Za-z0-9_.-]{20,8192}$/.test(auth))
    headers.Authorization = auth;
  const args = erase
    ? { p_key: env.USAGE_INGEST_KEY, p_visitor: body.visitor }
    : {
        p_key: env.USAGE_INGEST_KEY,
        p_payload: body,
        p_context: {
          device,
          bot,
          environment,
          rateKey,
          release: env.CF_PAGES_COMMIT_SHA || "unknown",
        },
      };
  try {
    const response = await transport(
      `${env.VITE_SUPABASE_URL}/rest/v1/rpc/${erase ? "usage_erase" : "usage_ingest"}`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(args),
        signal: AbortSignal.timeout(7000),
      },
    );
    if (!response.ok)
      return json(
        { error: response.status === 401 ? "session" : "upstream" },
        response.status === 401 ? 401 : 503,
      );
    const result = erase ? { erased: true } : await response.json();
    return json(result, result?.limited ? 429 : 200);
  } catch {
    return json({ error: "unavailable" }, 503);
  }
}
