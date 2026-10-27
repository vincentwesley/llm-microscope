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
- M2 done: logit lens for the selected token (13 depths, top 5, P(final)).
- M3 done: head ablation (toggle, name-mover preset, chips) and steering (phrase pair, layer, strength) with deltas against the clean run.
- Checked under the production CSP (injected in Playwright). Next: M4 (WebGPU + KV cache), see `docs/PLAN.md`.
- Not pushed (Actions could not be switched off from here).

## Known gaps
1. No KV cache: each appended token re-runs the whole prompt (~2 s for 14 tokens on CPU); interventions add one clean pass.
3. Steering is judged on the next word only; it shows best on continued text (needs M4 speed).
4. `security-review` skill needs `origin/HEAD`; it can't run until the branch is pushed. A manual check was done (no DOM sinks, no inline scripts, same-origin only).
2. First visit downloads 129 MB; cached afterwards.
