# starters

Self-contained project starters. Each folder has its own `package.json`, lockfile, tests, CI entry and docs. Node 24, npm, MIT.

| Folder | What it is |
|---|---|
| `vite-ts/` | Vite + TypeScript app. House style kit (dark default, light toggle, self-hosted fonts), credits card, Vitest, Playwright + axe, strict CSP in `public/_headers` for Cloudflare Pages. |
| `mv3-extension/` | Chrome Manifest V3 side-panel extension. esbuild + TypeScript, house styling and credits card, Vitest, `npm run zip` for the Web Store. Only the `sidePanel` permission. |
| `worker-proxy/` | Cloudflare Worker that proxies one upstream API. Key hidden as the `API_KEY` secret, Cache API caching, per-IP rate limit, CORS allow-list. No UI. |

## Use one

`new-project` copies a single folder (not the whole repo) into the new project, then renames it (`package.json` name, `repository`, the `{{PROJECT}}` placeholder in the credits card, `docs/`), runs `git init` with the one project identity, and installs with `npm ci --ignore-scripts` semantics.

By hand:

```bash
cp -r vite-ts ../my-app && cd ../my-app
npm install --ignore-scripts
npm run typecheck && npm run lint && npm test && npm run build
```

Every folder passes `typecheck`, `lint`, `test` and `build`. `vite-ts` also passes `test:e2e` (Playwright, axe). CI (`.github/workflows/ci.yml`) calls the reusable `ci-node.yml` from `vincentwesley/house`, one job per folder.

## Provided as is

No warranty. Nothing here runs install-time scripts. See each folder's README for the secrets and network calls it needs. Licence: MIT (`LICENSE`); the credits card art is not MIT (`NOTICE.md`); third-party material is in `THIRD_PARTY_NOTICES.md`.
