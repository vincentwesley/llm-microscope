# Research

Project: LLM Microscope, GPT-2 small running fully in the browser with interpretability tools.

## Prior art

| Tool | Link | What we take | What we avoid |
|---|---|---|---|
| TransformerLens (MIT, Python) | https://github.com/TransformerLensOrg/TransformerLens | Hook-point naming (`resid_pre`, attn pattern, head ablation) as our mental model | Python runtime |
| CircuitsVis (MIT, React) | https://github.com/TransformerLensOrg/CircuitsVis | Coloured-token rendering idea | Dependency (React, bundle size) |
| bertviz (Apache-2.0) | https://github.com/jessevig/bertviz | Head grid thumbnails (model view), token-hover head view | Jupyter-only delivery |
| Logit lens, nostalgebraist 2020 | https://www.lesswrong.com/posts/AcKRB8wDpdaN6v6ru/interpreting-gpt-the-logit-lens | Decode every layer's residual through ln_f + unembedding. Cheap: we keep resid per layer | n/a |
| Tuned lens, Belrose et al. 2023 | https://arxiv.org/abs/2303.08112 | Trained affine probes beat the logit lens | Needs trained weights, so later/optional |
| Neuronpedia | https://www.neuronpedia.org/ | Design reference for SAE/feature exploration (incl. GPT-2 small) | Any runtime dependency (hosted) |
| Transformer Explainer (poloclub, MIT) | https://github.com/poloclub/transformer-explainer | Closest prior art: live GPT-2 in browser (ONNX) | It explains mechanics only: no ablation, no logit lens, no steering |
| bbycroft LLM Visualization | https://bbycroft.net/llm | Step-visual reference only | Reuse of anything: licence unverified |
| Anthropic induction heads | https://transformer-circuits.pub/2022/in-context-learning-and-induction-heads/index.html | Built-in demo: repeated random tokens reveal induction heads; ablate them | n/a |
| ActAdd, Turner et al. | https://arxiv.org/abs/2308.10248 | Steering vector = difference of residuals for a prompt pair, added at one layer | n/a |
| IOI circuit in GPT-2 small, Wang et al. 2022 | https://arxiv.org/abs/2211.00593 | Default prompt "When Mary and John went to the store, John gave a drink to" -> " Mary" (verified with our numpy reference). Name-mover heads = classic ablation demo | n/a |
| gpt2-webgl (nathan-barry) | n/a | TypeScript WebGL2 GPT-2 with attention viz. **Unverified**: seen only via an aggregator | Relying on it |
| SAELens (MIT, Python) | https://github.com/jbloomAus/SAELens | n/a | Out of MVP scope |

## Platform limits (verified 2026-10-27)

[Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/):

- 25 MiB max per asset (the original constraint still holds)
- 20,000 files (free)
- 500 builds/month, 1 concurrent, 20 min timeout
- `_headers`: max 100 rules, 2,000 chars per header

[WebGPU](https://caniuse.com/webgpu): ~88% global; Chrome 113+; Safari 26 on by default (secondary source: https://github.com/gpuweb/gpuweb/wiki/implementation-status); Firefox partial (141 Windows). Hence CPU first, WebGPU as an optional speed-up later.

## Licences

- GPT-2 code/weights: [openai/gpt-2 LICENSE](https://github.com/openai/gpt-2/blob/master/LICENSE) is a "Modified MIT License", "Software Copyright (c) 2019 OpenAI". Asks to use responsibly and to indicate content created with GPT-2.
- [HF card](https://huggingface.co/openai-community/gpt2) says "License: mit".
- Weights source: `openai-community/gpt2` `model.safetensors`, SHA-256 `248dfc3911869ec493c76e65bf2fcf7f615828b0254c12b473182f0f81d3a707` (548 MB fp32).
- Reference tools: TransformerLens, CircuitsVis, Transformer Explainer, SAELens are MIT; bertviz is Apache-2.0; bbycroft unverified.

## Libraries

- [gpt-tokenizer](https://www.npmjs.com/package/gpt-tokenizer) v4.1.0, MIT. `gpt-tokenizer/encoding/r50k_base` is GPT-2's BPE (verified: "The capital of France is" -> `[464, 3139, 286, 4881, 318]`). Whole package ~1 MB gz per bundlephobia; loaded inside the Web Worker only.
- Stock `Xenova/gpt2` ONNX q8 is ~127 MB, a single file, over the 25 MiB limit. [Transformers.js docs](https://huggingface.co/docs/transformers.js/index) don't document attention outputs (**unverified**).

## What makes this stand out

Real hook-level interpretability (attention per head, logit lens, ablation, steering) on the real pretrained GPT-2 small, all client-side: no install, no server, same-origin weights. Existing browser tools explain mechanics but don't let you intervene.

## Tools worth installing later

- Lighthouse CI, local only: https://github.com/GoogleChrome/lighthouse-ci
- WebGPU-capable headless Chromium setup for a future GPU path (flags **unverified**)
- `wrangler pages dev` for testing `_headers` locally
