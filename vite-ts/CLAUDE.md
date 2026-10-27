# vite-ts (starter)

Vite + TypeScript app (house style kit, credits card). Part of the `starters` monorepo; copied into new projects by `new-project`.

## Rules
- Read `docs/next-session.md` first; update it when state changes.
- Node 24, npm only, commit `package-lock.json`, install with `npm ci --ignore-scripts`. No install-time scripts.
- Checks that must stay green: `npm run typecheck && npm run lint && npm test && npm run build && npm run test:e2e`
- House rules from the root CLAUDE.md apply (MIT, no secrets or personal data in tracked files, one git identity).
- Dark is the default; light only via the toggle. Reuse hs- classes from src/tokens.css.
- Keep public/_headers strict: no inline scripts, no third-party hosts.
