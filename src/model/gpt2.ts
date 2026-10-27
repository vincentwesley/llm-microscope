// GPT-2 forward pass in plain TypeScript, with the hook points the UI needs:
// attention patterns, the residual stream before every block (logit lens),
// per-head zero ablation and a steering vector added to the residual stream.
import type { QMat, Weights } from "./weights";

export interface RunOptions {
  /** ablate[layer][head] = true zeroes that head's output before the output projection. */
  ablate?: boolean[][];
  /** Adds alpha * vec to the residual stream entering `layer`, at every position. */
  steer?: { layer: number; vec: Float32Array; alpha: number };
}

export interface RunResult {
  T: number;
  /** Next-token logits at the last position. */
  logits: Float32Array;
  /** Per layer: [nHead, T, T] attention probabilities (row = query, column = key). */
  attn: Float32Array[];
  /** nLayer + 1 entries of [T, dModel]: the residual stream entering each block, then the final one. */
  resid: Float32Array[];
}

/** out[t, r] = bias[r] + sum_c x[t, c] * W[r, c], with W dequantised group by group. x is [T, cols], out is [T, rows]. */
export function matmul(x: Float32Array, T: number, m: QMat, bias: Float32Array | null, out: Float32Array): void {
  const { q, s, rows, cols, group } = m;
  const ng = cols / group;
  for (let r = 0; r < rows; r++) {
    const qo = r * cols;
    const so = r * ng;
    const br = bias ? bias[r] : 0;
    for (let t = 0; t < T; t++) {
      const xo = t * cols;
      let acc = br;
      for (let g = 0; g < ng; g++) {
        const c0 = g * group;
        let a0 = 0, a1 = 0, a2 = 0, a3 = 0;
        for (let c = c0; c < c0 + group; c += 4) {
          a0 += x[xo + c] * q[qo + c];
          a1 += x[xo + c + 1] * q[qo + c + 1];
          a2 += x[xo + c + 2] * q[qo + c + 2];
          a3 += x[xo + c + 3] * q[qo + c + 3];
        }
        acc += s[so + g] * (a0 + a1 + a2 + a3);
      }
      out[t * rows + r] = acc;
    }
  }
}

export function layerNorm(x: Float32Array, T: number, d: number, g: Float32Array, b: Float32Array, eps: number, out: Float32Array): void {
  for (let t = 0; t < T; t++) {
    const o = t * d;
    let mu = 0;
    for (let i = 0; i < d; i++) mu += x[o + i];
    mu /= d;
    let v = 0;
    for (let i = 0; i < d; i++) v += (x[o + i] - mu) ** 2;
    const inv = 1 / Math.sqrt(v / d + eps);
    for (let i = 0; i < d; i++) out[o + i] = (x[o + i] - mu) * inv * g[i] + b[i];
  }
}

/** GPT-2's "gelu_new" (tanh approximation). */
export function gelu(x: number): number {
  return 0.5 * x * (1 + Math.tanh(0.7978845608028654 * (x + 0.044715 * x * x * x)));
}

export function softmaxInPlace(a: Float32Array, start = 0, end = a.length): void {
  let m = -Infinity;
  for (let i = start; i < end; i++) if (a[i] > m) m = a[i];
  let sum = 0;
  for (let i = start; i < end; i++) {
    a[i] = Math.exp(a[i] - m);
    sum += a[i];
  }
  for (let i = start; i < end; i++) a[i] /= sum;
}

export function run(w: Weights, ids: number[], opts: RunOptions = {}): RunResult {
  const { nHead, dModel: d, eps, nCtx } = w.config;
  const T = ids.length;
  if (T === 0 || T > nCtx) throw new Error(`need 1..${nCtx} tokens`);
  const dh = d / nHead;
  const scale = 1 / Math.sqrt(dh);

  const x = new Float32Array(T * d);
  for (let t = 0; t < T; t++) {
    const id = ids[t];
    const g = w.wte.group;
    for (let i = 0; i < d; i++) x[t * d + i] = w.wte.q[id * d + i] * w.wte.s[(id * d + i) / g | 0] + w.wpe[t * d + i];
  }

  const h = new Float32Array(T * d);
  const qkv = new Float32Array(T * 3 * d);
  const z = new Float32Array(T * d);
  const tmp = new Float32Array(T * d);
  const ff = new Float32Array(T * 4 * d);
  const attn: Float32Array[] = [];
  const resid: Float32Array[] = [];

  w.layers.forEach((L, l) => {
    if (opts.steer && opts.steer.layer === l) {
      const { vec, alpha } = opts.steer;
      for (let t = 0; t < T; t++) for (let i = 0; i < d; i++) x[t * d + i] += alpha * vec[i];
    }
    resid.push(x.slice());

    layerNorm(x, T, d, L.ln1g, L.ln1b, eps, h);
    matmul(h, T, L.qkv, L.qkvB, qkv);
    const A = new Float32Array(nHead * T * T);
    z.fill(0);
    for (let hd = 0; hd < nHead; hd++) {
      const qo = hd * dh, ko = d + hd * dh, vo = 2 * d + hd * dh;
      for (let i = 0; i < T; i++) {
        const row = (hd * T + i) * T;
        for (let j = 0; j <= i; j++) {
          let dot = 0;
          for (let k = 0; k < dh; k++) dot += qkv[i * 3 * d + qo + k] * qkv[j * 3 * d + ko + k];
          A[row + j] = dot * scale;
        }
        softmaxInPlace(A, row, row + i + 1); // positions j > i stay 0 (causal mask)
        if (opts.ablate?.[l]?.[hd]) continue;
        for (let j = 0; j <= i; j++) {
          const p = A[row + j];
          for (let k = 0; k < dh; k++) z[i * d + qo + k] += p * qkv[j * 3 * d + vo + k];
        }
      }
    }
    attn.push(A);
    matmul(z, T, L.proj, L.projB, tmp);
    for (let i = 0; i < T * d; i++) x[i] += tmp[i];

    layerNorm(x, T, d, L.ln2g, L.ln2b, eps, h);
    matmul(h, T, L.fc, L.fcB, ff);
    for (let i = 0; i < ff.length; i++) ff[i] = gelu(ff[i]);
    matmul(ff, T, L.out, L.outB, tmp);
    for (let i = 0; i < T * d; i++) x[i] += tmp[i];
  });
  resid.push(x.slice());

  return { T, logits: unembed(w, x.subarray((T - 1) * d, T * d)), attn, resid };
}

/** Final LayerNorm then the tied unembedding, for one residual vector. This is also the logit lens. */
export function unembed(w: Weights, r: Float32Array): Float32Array {
  const d = w.config.dModel;
  const h = new Float32Array(d);
  layerNorm(r, 1, d, w.lnfG, w.lnfB, w.config.eps, h);
  const logits = new Float32Array(w.config.vocab);
  matmul(h, 1, w.wte, null, logits);
  return logits;
}

/** Top-k indices with their softmax probabilities over the whole vocabulary. */
export function topK(logits: Float32Array, k: number): { id: number; logit: number; prob: number }[] {
  let m = -Infinity;
  for (const v of logits) if (v > m) m = v;
  let sum = 0;
  for (const v of logits) sum += Math.exp(v - m);
  const best: number[] = [];
  for (let i = 0; i < logits.length; i++) {
    const v = logits[i];
    if (best.length === k && v <= logits[best[k - 1]]) continue;
    // Insertion into the sorted list; when full, the old last entry is shifted out.
    let at = best.length === k ? k - 1 : best.length;
    while (at > 0 && logits[best[at - 1]] < v) {
      best[at] = best[at - 1];
      at--;
    }
    best[at] = i;
  }
  return best.map((id) => ({ id, logit: logits[id], prob: Math.exp(logits[id] - m) / sum }));
}
