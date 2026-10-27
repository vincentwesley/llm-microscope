import { beforeEach, describe, expect, it, vi } from "vitest";
import { handle, resetRateLimit, type Env } from "../src/index";

const env: Env = {
  API_KEY: "secret-key",
  UPSTREAM_URL: "https://up.test/v1",
  ALLOWED_ORIGINS: "https://app.test, http://localhost:5173",
  CACHE_TTL_SECONDS: "60",
  RATE_LIMIT_PER_MINUTE: "3",
};
const ctx = { waitUntil: (p: Promise<unknown>) => void p };

const store = new Map<string, Response>();
const fetchMock = vi.fn();

beforeEach(() => {
  store.clear();
  resetRateLimit();
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => Response.json({ ok: true }));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("caches", {
    default: {
      match: async (r: Request) => store.get(r.url)?.clone(),
      put: async (r: Request, res: Response) => void store.set(r.url, res),
    },
  });
});

const get = (path: string, headers: Record<string, string> = {}) =>
  handle(new Request(`https://w.test${path}`, { headers: { "CF-Connecting-IP": "1.1.1.1", ...headers } }), env, ctx);

describe("proxy", () => {
  it("forwards with the secret as a bearer header and caches the result", async () => {
    const r1 = await get("/api/items?x=1");
    expect(r1.status).toBe(200);
    expect(await r1.json()).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://up.test/v1/items?x=1");
    expect(init.headers.Authorization).toBe("Bearer secret-key");
    expect([...store.keys()].join()).not.toContain("secret-key");

    await get("/api/items?x=1");
    expect(fetchMock).toHaveBeenCalledTimes(1); // second hit served from cache
  });

  it("never leaks the key in the response", async () => {
    const r = await get("/api/items");
    expect(JSON.stringify([...r.headers])).not.toContain("secret-key");
  });

  it("rate limits per IP", async () => {
    for (let i = 0; i < 3; i++) expect((await get("/api/a")).status).toBe(200);
    expect((await get("/api/a")).status).toBe(429);
    const other = await handle(new Request("https://w.test/api/a", { headers: { "CF-Connecting-IP": "2.2.2.2" } }), env, ctx);
    expect(other.status).toBe(200);
  });

  it("CORS allow-list: echoes allowed origins, rejects others", async () => {
    const ok = await get("/api/a", { Origin: "https://app.test" });
    expect(ok.headers.get("Access-Control-Allow-Origin")).toBe("https://app.test");
    const bad = await get("/api/a", { Origin: "https://evil.test" });
    expect(bad.status).toBe(403);
    expect(bad.headers.get("Access-Control-Allow-Origin")).toBeNull();
    const pre = await handle(new Request("https://w.test/api/a", { method: "OPTIONS", headers: { Origin: "https://app.test" } }), env, ctx);
    expect(pre.status).toBe(204);
  });

  it("rejects non-GET, unknown paths and traversal; maps upstream failures to 502", async () => {
    expect((await handle(new Request("https://w.test/api/a", { method: "POST" }), env, ctx)).status).toBe(405);
    expect((await get("/other")).status).toBe(404);
    expect((await get("/api/../admin")).status).toBe(404);
    fetchMock.mockResolvedValueOnce(new Response("boom", { status: 500 }));
    expect((await get("/api/fail")).status).toBe(502);
    expect(store.size).toBe(0); // errors are not cached
  });
});
