# Plan: LLM Microscope

Look inside GPT-2 small running in the browser: predictions, attention heads, logit lens, ablation and steering. Static site on Cloudflare Pages, no server, no third-party hosts.

## Architecture
```
scripts/prepare-model.mjs   HF safetensors (fp32) -> int8 group-64 chunks + manifest (public/model/)
scripts/reference.py        independent numpy GPT-2 -> tests/fixtures/reference.json
src/model/weights.ts        manifest types, chunk concat, typed-array views
src/model/loader.ts         same-origin fetch, progress, SHA-256 check, Cache API
src/model/gpt2.ts           forward pass + hooks (attention, resid per layer, ablation, steering), unembed, topK
src/worker/                 module worker (model + tokenizer) and the message protocol
src/ui/                     canvas attention views, formatting helpers
src/main.ts                 page wiring
```

## Milestones
1. **M1 MVP**: model in the browser, top-10 next word (click to append), 144-head attention grid, zoomed head with token labels, per-token attention text view. ✅
2. **M2 Logit lens**: per selected position, every depth's top 5 and the probability of the final guess. ✅ (A full layer × position grid costs ~10 s on CPU; it waits for M4.)
3. **M3 Interventions**: switch heads off (zero ablation) and compare predictions with the clean run; steering vector from a phrase pair at a chosen layer and strength. ✅
4. **M4 Speed**: WebGPU matmuls with the CPU path as fallback; KV cache for appending tokens; then a full logit-lens grid and greedy "continue the text" comparisons (clean vs steered), where steering shows best.
5. **Later**: induction-head finder (repeated random tokens), shareable URLs (prompt + settings in the hash), tuned lens, distilGPT-2 option.

## Done means
Typecheck, lint, unit (model vs numpy reference) and e2e (real model in headless Chromium) pass; axe clean in dark and light; works at 375 px and desktop; credits card present.
