# worker-proxy (starter)

Cloudflare Worker proxy for one upstream API (hidden key, cache, rate limit, CORS). No UI. Part of the `starters` monorepo; copied into new projects by `new-project`.

## Rules
- Read `docs/next-session.md` first; update it when state changes.
- Node 24, npm only, commit `package-lock.json`, install with `npm ci --ignore-scripts`. No install-time scripts.
- Checks that must stay green: `npm run typecheck && npm run lint && npm test && npm run build`
- House rules from the root CLAUDE.md apply (MIT, no secrets or personal data in tracked files, one git identity).
- The key is the API_KEY Worker secret only. Never put it in vars, logs, cache keys or responses.
- No paid bindings. The rate limit is best effort per isolate (see the ponytail: comment).
