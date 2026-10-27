/** Manifest written by scripts/prepare-model.mjs. */
export interface Manifest {
  model: string;
  config: Config;
  totalBytes: number;
  chunks: { file: string; length: number; sha256: string }[];
  tensors: { name: string; dtype: "f32" | "i8"; shape: number[]; offset: number; length: number }[];
}

export interface Config {
  nLayer: number;
  nHead: number;
  dModel: number;
  nCtx: number;
  vocab: number;
  eps: number;
  /** Quantisation group size along each matrix row. */
  group: number;
}

/** Group-quantised matrix [rows, cols]: value = q[r * cols + c] * s[(r * cols + c) / group]. */
export interface QMat {
  q: Int8Array;
  s: Float32Array;
  rows: number;
  cols: number;
  group: number;
}

export interface Layer {
  ln1g: Float32Array;
  ln1b: Float32Array;
  qkv: QMat;
  qkvB: Float32Array;
  proj: QMat;
  projB: Float32Array;
  ln2g: Float32Array;
  ln2b: Float32Array;
  fc: QMat;
  fcB: Float32Array;
  out: QMat;
  outB: Float32Array;
}

export interface Weights {
  config: Config;
  wte: QMat;
  wpe: Float32Array;
  layers: Layer[];
  lnfG: Float32Array;
  lnfB: Float32Array;
}

/** Joins chunk files (in manifest order) into the single model blob. */
export function concatChunks(manifest: Manifest, chunks: Uint8Array[]): Uint8Array<ArrayBuffer> {
  if (chunks.length !== manifest.chunks.length) throw new Error("chunk count mismatch");
  const blob = new Uint8Array(manifest.totalBytes);
  let at = 0;
  chunks.forEach((c, i) => {
    if (c.length !== manifest.chunks[i].length) throw new Error(`chunk ${i} has the wrong length`);
    blob.set(c, at);
    at += c.length;
  });
  if (at !== manifest.totalBytes) throw new Error("model size mismatch");
  return blob;
}

/** Builds typed-array views on the model blob. */
export function assemble(manifest: Manifest, blob: Uint8Array<ArrayBuffer>): Weights {
  if (blob.byteOffset !== 0 || blob.length !== manifest.totalBytes) throw new Error("model size mismatch");
  const byName = new Map(manifest.tensors.map((t) => [t.name, t]));
  const entry = (name: string) => {
    const t = byName.get(name);
    if (!t) throw new Error(`missing tensor ${name}`);
    return t;
  };
  const f32 = (name: string) => {
    const t = entry(name);
    return new Float32Array(blob.buffer, t.offset, t.length / 4);
  };
  const mat = (name: string): QMat => {
    const t = entry(name);
    return { q: new Int8Array(blob.buffer, t.offset, t.length), s: f32(`${name}.scale`), rows: t.shape[0], cols: t.shape[1], group: manifest.config.group };
  };

  const { config } = manifest;
  const layers: Layer[] = [];
  for (let l = 0; l < config.nLayer; l++) {
    const p = `h.${l}.`;
    layers.push({
      ln1g: f32(p + "ln_1.weight"),
      ln1b: f32(p + "ln_1.bias"),
      qkv: mat(p + "attn.c_attn.weight"),
      qkvB: f32(p + "attn.c_attn.bias"),
      proj: mat(p + "attn.c_proj.weight"),
      projB: f32(p + "attn.c_proj.bias"),
      ln2g: f32(p + "ln_2.weight"),
      ln2b: f32(p + "ln_2.bias"),
      fc: mat(p + "mlp.c_fc.weight"),
      fcB: f32(p + "mlp.c_fc.bias"),
      out: mat(p + "mlp.c_proj.weight"),
      outB: f32(p + "mlp.c_proj.bias"),
    });
  }
  return { config, wte: mat("wte"), wpe: f32("wpe"), layers, lnfG: f32("ln_f.weight"), lnfB: f32("ln_f.bias") };
}
