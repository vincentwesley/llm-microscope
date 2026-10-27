import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { run, topK, unembed } from "../src/model/gpt2";
import { assemble, concatChunks, type Manifest, type Weights } from "../src/model/weights";

interface Ref {
  text: string;
  ids: number[];
  top10: number[];
  top10Logits: number[];
  lensTop1: number[];
  attnL5H1: number[];
}

const refs: Ref[] = JSON.parse(readFileSync("tests/fixtures/reference.json", "utf8"));
let w: Weights;

beforeAll(() => {
  const manifest: Manifest = JSON.parse(readFileSync("public/model/manifest.json", "utf8"));
  const chunks = manifest.chunks.map((c) => new Uint8Array(readFileSync(`public/model/${c.file}`)));
  w = assemble(manifest, concatChunks(manifest, chunks));
});

describe("int8 GPT-2 matches the fp32 numpy reference", () => {
  for (const ref of refs) {
    it(ref.text, () => {
      const r = run(w, ref.ids);
      const top = topK(r.logits, 10);
      expect(top[0].id).toBe(ref.top10[0]);
      // Most of the reference top 5 survive quantisation.
      const ours = new Set(top.slice(0, 5).map((t) => t.id));
      expect(ref.top10.slice(0, 5).filter((id) => ours.has(id)).length).toBeGreaterThanOrEqual(4);
      // Compare logit gaps to the top token: softmax ignores a uniform shift.
      const ours0 = r.logits[ref.top10[0]];
      ref.top10.forEach((id, i) => {
        expect(Math.abs(r.logits[id] - ours0 - (ref.top10Logits[i] - ref.top10Logits[0]))).toBeLessThan(0.6); // int8 noise; flat top-10 on the France prompt peaks near 0.54
      });

      const lens = r.resid.map((x) => topK(unembed(w, x.subarray((r.T - 1) * 768, r.T * 768)), 1)[0].id);
      expect(lens.slice(-3)).toEqual(ref.lensTop1.slice(-3));

      const row = r.attn[5].subarray((1 * r.T + r.T - 1) * r.T, (1 * r.T + r.T) * r.T);
      ref.attnL5H1.forEach((p, j) => expect(Math.abs(row[j] - p)).toBeLessThan(0.05));
    });
  }
});

describe("hooks", () => {
  const ids = refs[1].ids;
  it("attention rows are causal distributions", () => {
    const { attn, T } = run(w, ids.slice(0, 6));
    const A = attn[0];
    for (let i = 0; i < T; i++) {
      let sum = 0;
      for (let j = 0; j < T; j++) {
        if (j > i) expect(A[i * T + j]).toBe(0);
        sum += A[i * T + j];
      }
      expect(sum).toBeCloseTo(1, 5);
    }
  });

  it("ablating every head changes the prediction; ablating none does not", () => {
    const clean = run(w, ids);
    const none = run(w, ids, { ablate: Array.from({ length: 12 }, () => Array(12).fill(false)) });
    expect(Array.from(none.logits.subarray(0, 50))).toEqual(Array.from(clean.logits.subarray(0, 50)));
    const all = run(w, ids, { ablate: Array.from({ length: 12 }, () => Array(12).fill(true)) });
    expect(topK(all.logits, 1)[0].id).not.toBe(topK(clean.logits, 1)[0].id);
  });

  it("steering with alpha 0 is a no-op", () => {
    const clean = run(w, ids);
    const steered = run(w, ids, { steer: { layer: 6, vec: new Float32Array(768).fill(1), alpha: 0 } });
    expect(steered.logits[100]).toBe(clean.logits[100]);
  });
});

describe("topK", () => {
  it("returns the largest values in order with softmax probabilities", () => {
    const top = topK(new Float32Array([1, 5, 3, 5.5, -2, 4]), 3);
    expect(top.map((t) => t.id)).toEqual([3, 1, 5]);
    expect(top[0].prob).toBeGreaterThan(top[1].prob);
    expect(top.reduce((a, t) => a + t.prob, 0)).toBeLessThan(1);
  });
});
