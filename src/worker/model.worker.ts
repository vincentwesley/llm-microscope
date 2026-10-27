// Loads GPT-2 and runs it off the main thread. Tokenizer lives here too, to keep the page bundle small.
import { decode, encode } from "gpt-tokenizer/encoding/r50k_base";
import { run, topK } from "../model/gpt2";
import { loadModel } from "../model/loader";
import { assemble, type Weights } from "../model/weights";
import { MAX_TOKENS, type Reply, type Request } from "./protocol";

let weights: Weights | null = null;
const post = (m: Reply, transfer: Transferable[] = []) => self.postMessage(m, { transfer });

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
    const t0 = performance.now();
    let ids = msg.ids ?? encode(msg.text ?? "");
    if (ids.length === 0) throw new Error("Type a prompt first.");
    const truncated = ids.length > MAX_TOKENS;
    if (truncated) ids = ids.slice(-MAX_TOKENS);
    const r = run(weights, ids);
    const top = topK(r.logits, 10).map((t) => ({ id: t.id, token: decode([t.id]), prob: t.prob }));
    const { nLayer, nHead } = weights.config;
    post(
      { type: "result", id: msg.id, ids, tokens: ids.map((i) => decode([i])), truncated, top, attn: r.attn, nLayer, nHead, ms: performance.now() - t0 },
      r.attn.map((a) => a.buffer),
    );
  } catch (err) {
    post({ type: "error", id: "id" in msg ? msg.id : undefined, message: err instanceof Error ? err.message : String(err) });
  }
};
