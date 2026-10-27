// Loads GPT-2 and runs it off the main thread. Tokenizer lives here too, to keep the page bundle small.
import { decode, encode } from "gpt-tokenizer/encoding/r50k_base";
import { run, softmaxStats, steeringVector, topK, unembed, type RunOptions, type RunResult } from "../model/gpt2";
import { loadModel } from "../model/loader";
import { assemble, type Weights } from "../model/weights";
import { MAX_TOKENS, type LensRow, type Reply, type Request } from "./protocol";

let weights: Weights | null = null;
/** Residual streams of the last (possibly intervened) run, for the logit lens. */
let lastRun: RunResult | null = null;
let clean: { key: string; logits: Float32Array } | null = null;
let steerCache: { key: string; vec: Float32Array } | null = null;

const post = (m: Reply, transfer: Transferable[] = []) => self.postMessage(m, { transfer });

/** Steering phrases are read as words inside a sentence, so "Hate" becomes " Hate" (one token, not "H" + "ate"). */
function prepare(text: string): number[] {
  const t = text.trim();
  return t ? encode(" " + t).slice(-MAX_TOKENS) : [];
}

self.onmessage = async (e: MessageEvent<Request>) => {
  const msg = e.data;
  try {
    if (msg.type === "load") {
      const t0 = performance.now();
      const { manifest, blob } = await loadModel(msg.base, (p) => post({ type: "progress", ...p }));
      weights = assemble(manifest, blob);
      post({ type: "ready", ms: performance.now() - t0 });
      return;
    }
    if (!weights) throw new Error("model not loaded");
    const w = weights;

    if (msg.type === "lens") {
      if (!lastRun) throw new Error("run the model first");
      const d = w.config.dModel;
      const at = (r: Float32Array) => r.subarray(msg.pos * d, (msg.pos + 1) * d);
      const decoded = lastRun.resid.map((r) => {
        const logits = unembed(w, at(r));
        const stats = softmaxStats(logits);
        return { logits, stats, top: topK(logits, 5, stats) };
      });
      const finalId = decoded[decoded.length - 1].top[0].id;
      const rows: LensRow[] = decoded.map(({ logits, stats, top }) => ({
        top: top.map((t) => ({ token: decode([t.id]), prob: t.prob })),
        final: Math.exp(logits[finalId] - stats.max) / stats.sum,
      }));
      post({ type: "lens", id: msg.id, pos: msg.pos, finalToken: decode([finalId]), rows });
      return;
    }

    const t0 = performance.now();
    let ids = msg.ids ?? encode(msg.text ?? "");
    if (ids.length === 0) throw new Error("Type a prompt first.");
    const truncated = ids.length > MAX_TOKENS;
    if (truncated) ids = ids.slice(-MAX_TOKENS);

    const opts: RunOptions = {};
    if (msg.ablate.length) {
      opts.ablate = Array.from({ length: w.config.nLayer }, () => Array<boolean>(w.config.nHead).fill(false));
      for (const [l, h] of msg.ablate) opts.ablate[l][h] = true;
    }
    if (msg.steer && msg.steer.alpha !== 0) {
      const s = msg.steer;
      const key = `${s.layer}\u0000${s.plus}\u0000${s.minus}`;
      if (steerCache?.key !== key) {
        const plus = prepare(s.plus);
        const minus = prepare(s.minus);
        if (!plus.length || !minus.length) throw new Error("Steering needs two non-empty phrases.");
        steerCache = { key, vec: steeringVector(w, plus, minus, s.layer) };
      }
      opts.steer = { layer: s.layer, vec: steerCache.vec, alpha: s.alpha };
    }
    const intervened = !!(opts.ablate || opts.steer);

    const r = run(w, ids, opts);
    lastRun = r;
    const key = ids.join(",");
    if (!intervened) clean = { key, logits: r.logits };
    else if (clean?.key !== key) clean = { key, logits: run(w, ids).logits };
    const base = softmaxStats(clean!.logits);

    const top = topK(r.logits, 10).map((t) => ({
      id: t.id,
      token: decode([t.id]),
      prob: t.prob,
      clean: Math.exp(clean!.logits[t.id] - base.max) / base.sum,
    }));
    const { nLayer, nHead } = w.config;
    // attn buffers are transferred, so the worker no longer holds them (lastRun keeps only resid).
    post(
      { type: "result", id: msg.id, ids, tokens: ids.map((i) => decode([i])), truncated, intervened, top, attn: r.attn, nLayer, nHead, ms: performance.now() - t0 },
      r.attn.map((a) => a.buffer),
    );
  } catch (err) {
    post({ type: "error", id: "id" in msg ? msg.id : undefined, message: err instanceof Error ? err.message : String(err) });
  }
};
