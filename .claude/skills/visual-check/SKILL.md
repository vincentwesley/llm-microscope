---
name: visual-check
description: Headless visual QA for a web project. Screenshots at 375/768/1280 in dark and light, axe accessibility, Lighthouse, and a Markdown report in qa-output/report.md. Use to verify UI changes or before shipping.
---

Headless only. Never open a visible browser, DevTools window or headed Playwright.

## Recipe
1. Start the project's dev/preview server in the background (note its PID; stop that PID only when done). Get its URL.
2. Run the bundled script from the target project root (it resolves `@playwright/test` and `@axe-core/playwright` from the project; install them as devDependencies if missing and the user agrees):
   `node "${CLAUDE_PLUGIN_ROOT}/skills/visual-check/scripts/visual-check.mjs" <url> [path ...]`
   Output: `qa-output/<route>-<width>-<theme>.png` and `qa-output/axe.json`, plus a summary line per route. Dark runs first; light sets `data-theme="light"` and `colorScheme: light`.
3. Lighthouse: if the `chrome-devtools` MCP is available, use `lighthouse_audit` (headless/navigation mode, mobile and desktop). Otherwise `npx @lhci/cli collect --url=<url> --numberOfRuns=1` (needs Chrome; headless by default).
4. Read the screenshots yourself (Read tool on the PNGs). Check: no horizontal scroll at 375, dark is the default, light works, contrast, credits card visible at page bottom if the project uses one, reduced-motion respected.
5. Write `qa-output/report.md`: date, URL, a table of routes x (axe violations, Lighthouse scores), each screenshot linked, and findings sorted blocker / high / nit. Keep it short.
6. `qa-output/` is gitignored; do not commit it.
