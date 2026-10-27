# Third-party notices

## Fonts (`vite-ts/src/fonts/`, `mv3-extension/src/fonts/`)
SIL Open Font License 1.1, full text in `OFL.txt` next to each copy:
- Space Grotesk
- Inter
- Silkscreen
- JetBrains Mono

## npm dependencies
Development dependencies only, installed from the npm registry and pinned by each folder's `package-lock.json`. Licences are those of the packages (mostly MIT, Apache-2.0, ISC, BSD):
- `vite-ts`: vite, typescript, vitest, eslint, typescript-eslint, @playwright/test, @axe-core/playwright (MPL-2.0), knip
- `mv3-extension`: esbuild, typescript, vitest, eslint, typescript-eslint, @types/chrome, fflate, knip
- `worker-proxy`: wrangler, @cloudflare/workers-types, typescript, vitest, eslint, typescript-eslint, knip

Nothing from these packages is bundled into shipped output except Vite's small runtime helpers and the starters' own code.

## Vendored Claude skills (`.claude/`)
Copied from `vincentwesley/vin-claude` (MIT) so cloud sessions can use them. Reference material under `.claude/skills/design-review/references/` and `.claude/skills/ship-batch/references/` keeps its upstream licence text next to it; repos and pinned SHAs are in `.claude/SOURCES.md`.
- `design-review/references/redesign-existing-projects`: Copyright (c) 2026 Leonxlnx, MIT (Leonxlnx/taste-skill).
- `design-review/references/ui-ux-pro-max`: Copyright (c) 2024 Next Level Builder, MIT (nextlevelbuilder/ui-ux-pro-max-skill).
- `design-review/references/web-design-guidelines`: Copyright (c) 2025 Vercel Labs, MIT (vercel-labs/web-interface-guidelines).
- `ship-batch/references/`: Copyright (c) 2025 Addy Osmani, MIT (addyosmani/agent-skills).
- `visual-check` uses `@playwright/test` (Apache-2.0) and `@axe-core/playwright` (MPL-2.0) from the target project at run time; not bundled.
