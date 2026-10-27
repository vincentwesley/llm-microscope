# Plan: worker-proxy

Goal: reusable Worker that hides one API key and protects the upstream.

- `GET /api/*` to `UPSTREAM_URL`, bearer key from the `API_KEY` secret.
- Cache API for 200 responses (TTL var), per-IP in-memory rate limit, exact-origin CORS allow-list.
- Tests: Vitest with mocked `fetch` and a fake `caches`; build is `wrangler deploy --dry-run`.

Upgrade paths: Rate Limiting binding or Durable Object for a hard limit; KV or D1 only when state is needed; auth header style per upstream (query-string keys need the key kept out of the cache key).
