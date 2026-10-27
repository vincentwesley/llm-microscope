> Update at the end of any session that changed state. Keep it lean.

Continue work on **vite-ts** (repo `vincentwesley/starters`, folder `vite-ts/`; not deployed, it is a template).
Initial scaffold, all checks green. Only do what the owner asks.

## Before anything
1. Work in `starters/vite-ts`; read this file and `docs/PLAN.md`.
2. Run `npm ci --ignore-scripts` and the checks below to confirm green.

## How to work here
- Local commits only unless the owner says push. Identity: `vincentwesley` noreply.
- Checks: `npm run typecheck && npm run lint && npm test && npm run build && npm run test:e2e`

## Current state
- Scaffold complete per `docs/PLAN.md`; the CI job in the root `.github/workflows/ci.yml` calls `vincentwesley/house` `ci-node.yml`.

## Known gaps / ideas
1. Not yet run through the `new-project` skill end to end.
2. Report outcomes in a line or two.
