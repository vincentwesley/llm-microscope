# Plan: vite-ts

Goal: smallest useful Vite + TS app that already meets the house definition of done.

- App: counter + theme toggle (dark default, `data-theme` on `<html>`, choice in `localStorage`).
- House kit copied in: `src/tokens.css`, `src/fonts/` with `OFL.txt`, `src/credits/` + card in `index.html`.
- Tests: Vitest (`tests/`), Playwright + axe at desktop and 375px, dark and light (`e2e/`).
- Deploy: Cloudflare Pages, `public/_headers` strict CSP.
- Checks: typecheck, ESLint, knip (optional, `npm run knip`).

Skipped: size-limit (needs a preset and a real bundle to budget), router/state libs (add per project).
