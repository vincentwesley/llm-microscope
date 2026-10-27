# vite-ts

Vite + TypeScript starter with the house style kit: dark by default (light via toggle), self-hosted fonts, glowing pixel-frame cards, credits card at the bottom.

```bash
npm install --ignore-scripts
npm run dev          # local dev server
npm run typecheck && npm run lint && npm test
npm run build        # dist/
npm run test:e2e     # Playwright (headless) + axe, desktop and 375px
```

First e2e run needs `npx playwright install chromium`.

## Deploy
Cloudflare Pages, output `dist/`. `public/_headers` ships a strict CSP (no external hosts, no inline scripts). Widen `connect-src` / `img-src` one host at a time when the app needs an API.

## Secrets and network
None. The app makes no network calls, uses no analytics, and stores only the theme choice in `localStorage`. Fonts are self-hosted.

## Credits card
`{{PROJECT}}` in the card text (`index.html`) is left as a placeholder; replace it with the project name. The character art is all rights reserved (see root `NOTICE.md`).

Provided as is, without warranty.
