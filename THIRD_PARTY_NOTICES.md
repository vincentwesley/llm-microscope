# Third-party notices

## Fonts (`src/fonts/`)
SIL Open Font License 1.1, full text in `OFL.txt` next to each copy:
- Space Grotesk
- Inter
- Silkscreen
- JetBrains Mono

## GPT-2 model weights (`public/model/`)
OpenAI's GPT-2 small (124M), from https://github.com/openai/gpt-2 via the Hugging Face copy `openai-community/gpt2` (`model.safetensors`, SHA-256 `248dfc3911869ec493c76e65bf2fcf7f615828b0254c12b473182f0f81d3a707`). Licence: "Modified MIT License", Software Copyright (c) 2019 OpenAI (https://github.com/openai/gpt-2/blob/master/LICENSE); the Hugging Face card lists MIT. Converted to 8-bit by `scripts/prepare-model.mjs`; the numbers are OpenAI's, the quantisation is ours. Model outputs shown in the app are produced by GPT-2.

## Runtime dependency
- `gpt-tokenizer` 4.1.0 (MIT, https://github.com/niieani/gpt-tokenizer): GPT-2 byte-pair tokenizer (`r50k_base`), bundled into the model worker.

## npm development dependencies
Pinned by `package-lock.json`, not shipped: vite, typescript, vitest, eslint, @eslint/js, typescript-eslint, @playwright/test (Apache-2.0), @axe-core/playwright (MPL-2.0), knip, @types/node. Only Vite's small runtime helpers end up in the build.

## Vendored Claude skills (`.claude/`)
Copied from `vincentwesley/vin-claude` (MIT) so cloud sessions can use them. Reference material under `.claude/skills/design-review/references/` and `.claude/skills/ship-batch/references/` keeps its upstream licence text next to it; repos and pinned SHAs are in `.claude/SOURCES.md`.
- `design-review/references/redesign-existing-projects`: Copyright (c) 2026 Leonxlnx, MIT (Leonxlnx/taste-skill).
- `design-review/references/ui-ux-pro-max`: Copyright (c) 2024 Next Level Builder, MIT (nextlevelbuilder/ui-ux-pro-max-skill).
- `design-review/references/web-design-guidelines`: Copyright (c) 2025 Vercel Labs, MIT (vercel-labs/web-interface-guidelines).
- `ship-batch/references/`: Copyright (c) 2025 Addy Osmani, MIT (addyosmani/agent-skills).
- `visual-check` uses `@playwright/test` (Apache-2.0) and `@axe-core/playwright` (MPL-2.0) from the target project at run time; not bundled.
