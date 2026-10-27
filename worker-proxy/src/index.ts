export interface Env {
  API_KEY: string; // Worker secret, never in vars or git
  UPSTREAM_URL: string; // e.g. https://api.example.com/v1 (no trailing slash)
  ALLOWED_ORIGINS: string; // comma-separated exact origins
  CACHE_TTL_SECONDS?: string;
  RATE_LIMIT_PER_MINUTE?: string;
}

const PREFIX = "/api/";
const WINDOW_MS = 60_000;

// ponytail: per-isolate memory. Each isolate counts alone and resets on eviction, so the real
// limit is roughly N x isolates and is best-effort only. Upgrade to a Durable Object or the
// Workers Rate Limiting binding when a hard limit matters.
const hits = new Map<string, { count: number; reset: number }>();

export function resetRateLimit(): void {
  hits.clear();
}

function limited(ip: string, max: number, now: number): boolean {
  if (hits.size > 5000) for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
  const e = hits.get(ip);
  if (!e || e.reset <= now) {
    hits.set(ip, { count: 1, reset: now + WINDOW_MS });
    return false;
  }
  return ++e.count > max;
}

function corsHeaders(req: Request, env: Env): Headers {
  const h = new Headers({ Vary: "Origin" });
  const origin = req.headers.get("Origin");
  const allowed = env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);
  if (origin && allowed.includes(origin)) {
    h.set("Access-Control-Allow-Origin", origin);
    h.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    h.set("Access-Control-Allow-Headers", "Content-Type");
    h.set("Access-Control-Max-Age", "86400");
  }
  return h;
}

function reply(body: string | null, status: number, cors: Headers, extra: HeadersInit = {}): Response {
  const h = new Headers(extra);
  cors.forEach((v, k) => h.set(k, v));
  return new Response(body, { status, headers: h });
}

export async function handle(req: Request, env: Env, ctx: Pick<ExecutionContext, "waitUntil">): Promise<Response> {
  const cors = corsHeaders(req, env);
  const url = new URL(req.url);

  if (req.method === "OPTIONS") return reply(null, cors.has("Access-Control-Allow-Origin") ? 204 : 403, cors);
  if (req.method !== "GET") return reply("Method not allowed", 405, cors, { Allow: "GET, OPTIONS" });
  if (!url.pathname.startsWith(PREFIX) || url.pathname.includes("..")) return reply("Not found", 404, cors);

  const origin = req.headers.get("Origin");
  if (origin && !cors.has("Access-Control-Allow-Origin")) return reply("Origin not allowed", 403, cors);

  const max = Number(env.RATE_LIMIT_PER_MINUTE ?? 60);
  const ip = req.headers.get("CF-Connecting-IP") ?? "unknown";
  if (limited(ip, max, Date.now())) return reply("Too many requests", 429, cors, { "Retry-After": "60" });

  // The cache key is the key-less upstream URL, so the secret never touches the cache.
  const upstream = `${env.UPSTREAM_URL}/${url.pathname.slice(PREFIX.length)}${url.search}`;
  const cacheKey = new Request(upstream, { method: "GET" });
  const cache = caches.default;

  let res = await cache.match(cacheKey);
  if (!res) {
    const up = await fetch(upstream, { headers: { Authorization: `Bearer ${env.API_KEY}`, Accept: "application/json" } });
    if (!up.ok) return reply(`Upstream error ${up.status}`, up.status === 404 ? 404 : 502, cors);
    const ttl = Number(env.CACHE_TTL_SECONDS ?? 300);
    res = new Response(up.body, {
      status: 200,
      headers: { "Content-Type": up.headers.get("Content-Type") ?? "application/json", "Cache-Control": `public, max-age=${ttl}` },
    });
    ctx.waitUntil(cache.put(cacheKey, res.clone()));
  }
  const out = new Response(res.body, res);
  cors.forEach((v, k) => out.headers.set(k, v));
  return out;
}

export default {
  fetch: (req: Request, env: Env, ctx: ExecutionContext) => handle(req, env, ctx),
} satisfies ExportedHandler<Env>;
