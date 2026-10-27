# worker-proxy

Cloudflare Worker (TypeScript) that proxies one upstream API so the key never reaches the browser. No UI, no paid bindings.

- `GET /api/<path>` forwards to `UPSTREAM_URL/<path>` with `Authorization: Bearer $API_KEY`.
- Cache API caching of successful responses for `CACHE_TTL_SECONDS` (key-less upstream URL as cache key; errors never cached).
- Per-IP rate limit, `RATE_LIMIT_PER_MINUTE`, in memory per isolate (best effort, see the `ponytail:` comment in `src/index.ts`).
- CORS allow-list from `ALLOWED_ORIGINS` (exact origins). GET and OPTIONS only.

```bash
npm install --ignore-scripts
cp .dev.vars.example .dev.vars   # then edit; gitignored
npm run dev
npm run typecheck && npm run lint && npm test && npm run build
```

## Secrets and network
- Secret: `API_KEY`, set with `npx wrangler secret put API_KEY`. Only `.dev.vars.example` (names, no values) is tracked.
- Network: one outbound host, `UPSTREAM_URL` in `wrangler.jsonc` (placeholder `api.example.com`). Respect the upstream's terms and rate limits.
- Cache API only works on custom domains, not `*.workers.dev`; there it silently never hits.
- Nothing is stored beyond the edge cache and the in-memory counters.

Provided as is, without warranty.
