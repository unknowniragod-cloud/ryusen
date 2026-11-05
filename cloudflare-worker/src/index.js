const ALLOWED_ORIGINS = new Set([
  "https://unknowniragod-cloud.github.io",
  "http://localhost:8787",
  "http://127.0.0.1:8787"
]);

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : "https://unknowniragod-cloud.github.io";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Ryusen-Key",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(origin) }
  });
}

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (url.pathname === "/api/health" && request.method === "GET") {
      return json({
        ok: true,
        service: "Ryusen Cloud Browser",
        browserProvider: "Cloudflare Browser Run",
        configured: Boolean(env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_API_TOKEN && env.RYUSEN_ACCESS_KEY),
        sessionKeepAliveSeconds: 600,
        note: "Free Browser Run usage is limited to 10 browser minutes per day."
      }, 200, origin);
    }

    if (url.pathname !== "/api/browser-session" || request.method !== "POST") {
      return json({ ok: false, error: "Not found" }, 404, origin);
    }

    if (!ALLOWED_ORIGINS.has(origin)) {
      return json({ ok: false, error: "Origin not allowed" }, 403, origin);
    }

    const suppliedKey = request.headers.get("X-Ryusen-Key") || "";
    if (!safeEqual(suppliedKey, env.RYUSEN_ACCESS_KEY || "")) {
      return json({ ok: false, error: "Unauthorized. Check the Ryusen access key." }, 401, origin);
    }

    if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_API_TOKEN) {
      return json({ ok: false, error: "Cloudflare account secrets are not configured yet." }, 503, origin);
    }

    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/browser-rendering/devtools/browser?keep_alive=600000&targets=true`;
    let upstream;
    try {
      upstream = await fetch(endpoint, {
        method: "POST",
        headers: { "Authorization": `Bearer ${env.CLOUDFLARE_API_TOKEN}` }
      });
    } catch (error) {
      return json({ ok: false, error: "Could not reach Cloudflare Browser Run.", detail: String(error) }, 502, origin);
    }

    const result = await upstream.json().catch(() => ({}));
    if (!upstream.ok || result.success === false) {
      const message = result.errors?.map(item => item.message).filter(Boolean).join("; ") || `Cloudflare returned HTTP ${upstream.status}`;
      return json({ ok: false, error: message }, upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502, origin);
    }

    const inspectorUrl = result.targets?.find(target => target.devtoolsFrontendUrl)?.devtoolsFrontendUrl;
    if (!inspectorUrl) {
      return json({ ok: false, error: "Cloudflare created a session but did not return a browser inspector URL.", sessionId: result.sessionId || null }, 502, origin);
    }

    return json({
      ok: true,
      provider: "Cloudflare Browser Run",
      sessionId: result.sessionId || null,
      inspectorUrl,
      keepAliveSeconds: 600,
      nextStep: "Open the inspector, navigate to https://flow.google.com, then sign in to Google."
    }, 201, origin);
  }
};
