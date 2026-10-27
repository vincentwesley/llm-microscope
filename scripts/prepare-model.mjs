// Converts OpenAI's GPT-2 small (Hugging Face `openai-community/gpt2`, fp32 safetensors)
// into int8 weight chunks the browser can load from the same origin.
//
//   node scripts/prepare-model.mjs [path/to/model.safetensors]
//
// Without an argument it downloads the file into .cache/gpt2/ (once) and checks its SHA-256.
// Output: public/model/manifest.json + chunks/gpt2-int8.NNN.<hash>.bin (each <= 20 MiB, under Cloudflare's 25 MiB cap).
//
// Matrices are stored transposed as [out, in] int8 with one fp32 scale per 64 inputs of each output
// row, so every matmul is a run of contiguous dot products. wte ([vocab, 768]) already has that layout and is
// used for both the embedding lookup and the tied unembedding. Biases, LayerNorm and wpe stay fp32.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";

const SRC_URL = "https://huggingface.co/openai-community/gpt2/resolve/main/model.safetensors";
const SRC_SHA256 = "248dfc3911869ec493c76e65bf2fcf7f615828b0254c12b473182f0f81d3a707";
const OUT = "public/model";
const CHUNK = 20 * 1024 * 1024;
const N_LAYER = 12;
const GROUP = 64;

async function source() {
  if (process.argv[2]) return readFileSync(process.argv[2]);
  const path = ".cache/gpt2/model.safetensors";
  if (!existsSync(path)) {
    console.log(`downloading ${SRC_URL}`);
    const res = await fetch(SRC_URL);
    if (!res.ok) throw new Error(`download failed: ${res.status}`);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  }
  return readFileSync(path);
}

function parseSafetensors(buf) {
  const n = Number(buf.readBigUInt64LE(0));
  const header = JSON.parse(buf.subarray(8, 8 + n).toString("utf8"));
  const base = 8 + n;
  const tensors = new Map();
  for (const [name, info] of Object.entries(header)) {
    if (name === "__metadata__") continue;
    if (info.dtype !== "F32") throw new Error(`${name}: unexpected dtype ${info.dtype}`);
    const [a, b] = info.data_offsets;
    const bytes = buf.subarray(base + a, base + b);
    // Copy so the Float32Array is 4-byte aligned regardless of the header length.
    const data = new Float32Array(new Uint8Array(bytes).buffer);
    tensors.set(name, { shape: info.shape, data });
  }
  return tensors;
}

/** Quantise an [rows, cols] matrix in groups of GROUP along each row (symmetric int8, scale = max|x| / 127). */
function quantRows(data, rows, cols) {
  if (cols % GROUP) throw new Error(`cols ${cols} not a multiple of ${GROUP}`);
  const q = new Int8Array(rows * cols);
  const scale = new Float32Array((rows * cols) / GROUP);
  for (let g = 0; g < scale.length; g++) {
    const o = g * GROUP;
    let m = 0;
    for (let c = 0; c < GROUP; c++) m = Math.max(m, Math.abs(data[o + c]));
    const s = m / 127 || 1;
    scale[g] = s;
    for (let c = 0; c < GROUP; c++) q[o + c] = Math.round(data[o + c] / s);
  }
  return { q, scale };
}

function transpose(data, rows, cols) {
  const out = new Float32Array(rows * cols);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out[c * rows + r] = data[r * cols + c];
  return out;
}

const tensors = parseSafetensors(await source());
const get = (name) => {
  const t = tensors.get(name);
  if (!t) throw new Error(`missing ${name}`);
  return t;
};

const parts = []; // { name, dtype, shape, bytes }
const addF32 = (name, t) => parts.push({ name, dtype: "f32", shape: t.shape, bytes: new Uint8Array(t.data.buffer) });
const addMatrix = (name, data, rows, cols) => {
  const { q, scale } = quantRows(data, rows, cols);
  parts.push({ name, dtype: "i8", shape: [rows, cols], bytes: new Uint8Array(q.buffer) });
  parts.push({ name: `${name}.scale`, dtype: "f32", shape: [rows, cols / GROUP], bytes: new Uint8Array(scale.buffer) });
};

const wte = get("wte.weight");
addMatrix("wte", wte.data, wte.shape[0], wte.shape[1]);
addF32("wpe", get("wpe.weight"));
for (let l = 0; l < N_LAYER; l++) {
  const p = `h.${l}.`;
  for (const n of ["ln_1.weight", "ln_1.bias", "ln_2.weight", "ln_2.bias", "attn.c_attn.bias", "attn.c_proj.bias", "mlp.c_fc.bias", "mlp.c_proj.bias"]) {
    addF32(p + n, get(p + n));
  }
  for (const n of ["attn.c_attn.weight", "attn.c_proj.weight", "mlp.c_fc.weight", "mlp.c_proj.weight"]) {
    const t = get(p + n);
    const [inDim, outDim] = t.shape; // HF Conv1D stores [in, out]
    addMatrix(p + n, transpose(t.data, inDim, outDim), outDim, inDim);
  }
}
addF32("ln_f.weight", get("ln_f.weight"));
addF32("ln_f.bias", get("ln_f.bias"));

// Lay everything out in one 16-byte-aligned blob, then cut it into chunks.
let size = 0;
const entries = parts.map((p) => {
  const offset = size;
  size = Math.ceil((size + p.bytes.length) / 16) * 16;
  return { name: p.name, dtype: p.dtype, shape: p.shape, offset, length: p.bytes.length };
});
const blob = new Uint8Array(size);
parts.forEach((p, i) => blob.set(p.bytes, entries[i].offset));

mkdirSync(OUT, { recursive: true });
rmSync(join(OUT, "chunks"), { recursive: true, force: true });
mkdirSync(join(OUT, "chunks"));
const chunks = [];
for (let i = 0, start = 0; start < size; i++, start += CHUNK) {
  const bytes = blob.subarray(start, Math.min(size, start + CHUNK));
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  // Content-hashed names, so public/_headers can mark /model/chunks/* immutable.
  const file = `chunks/gpt2-int8.${String(i).padStart(3, "0")}.${sha256.slice(0, 12)}.bin`;
  writeFileSync(join(OUT, file), bytes);
  chunks.push({ file, length: bytes.length, sha256 });
}
const manifest = {
  model: "gpt2",
  source: { url: SRC_URL, sha256: SRC_SHA256 },
  config: { nLayer: N_LAYER, nHead: 12, dModel: 768, nCtx: 1024, vocab: wte.shape[0], eps: 1e-5, group: GROUP },
  totalBytes: size,
  chunks,
  tensors: entries,
};
writeFileSync(join(OUT, "manifest.json"), JSON.stringify(manifest) + "\n");
console.log(`${chunks.length} chunks, ${(size / 2 ** 20).toFixed(1)} MiB -> ${OUT}`);
