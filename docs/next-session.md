> Update at the end of any session that changed state. Keep it lean.

## Before anything
1. Read `CLAUDE.md`, this file, `docs/PLAN.md`, `docs/DECISIONS.md`. Check `docs/HANDOVER.md` for the owner's open steps (Actions off? then push).
2. `npm ci --ignore-scripts`, then the checks below.

## How to work here
- Identity `vincentwesley <221810966+vincentwesley@users.noreply.github.com>`, branch `claude/relaxed-bohr-e8q7ik`.
- Checks: `npm run typecheck && npm run lint && npm test && npm run build && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome npm run test:e2e`.
- Zero GitHub Actions minutes: verify locally, never use CI.

## Current state
- M1 done: GPT-2 small (int8, 128.6 MiB in 7 chunks) runs in a worker; next-word top 10, 144-head grid, zoomed head, attention text view. Matches the numpy fp32 reference.
- Not pushed (Actions could not be switched off from here).

## Known gaps
1. No KV cache: each appended token re-runs the whole prompt (~2 s for 14 tokens on CPU).
2. First visit downloads 129 MB; cached afterwards.
