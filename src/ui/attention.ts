// Canvas drawing for the 144-head overview and the zoomed head.
import { gridCell, showToken } from "./format";

export interface Pattern {
  attn: Float32Array[]; // per layer [nHead, T, T]
  T: number;
  nLayer: number;
  nHead: number;
}

interface Colours {
  bg: [number, number, number];
  hot: [number, number, number];
  fg: string;
  muted: string;
  sel: string;
}

function rgb(v: string): [number, number, number] {
  const m = v.trim().match(/^#([0-9a-f]{6})$/i);
  if (!m) return [128, 128, 128];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function readColours(): Colours {
  const cs = getComputedStyle(document.documentElement);
  return {
    bg: rgb(cs.getPropertyValue("--bg")),
    hot: rgb(cs.getPropertyValue("--accent")),
    fg: cs.getPropertyValue("--fg").trim(),
    muted: cs.getPropertyValue("--fg-muted").trim(),
    sel: cs.getPropertyValue("--fx-2").trim(),
  };
}

/** sqrt ramp so weak but real attention stays visible. */
function shade(c: Colours, p: number, out: Uint8ClampedArray, o: number): void {
  const t = Math.sqrt(Math.max(0, Math.min(1, p)));
  out[o] = c.bg[0] + (c.hot[0] - c.bg[0]) * t;
  out[o + 1] = c.bg[1] + (c.hot[1] - c.bg[1]) * t;
  out[o + 2] = c.bg[2] + (c.hot[2] - c.bg[2]) * t;
  out[o + 3] = 255;
}

function fit(canvas: HTMLCanvasElement): { ctx: CanvasRenderingContext2D; w: number; h: number } {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || canvas.width;
  const h = w; // square
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

const GAP = 2;
const AXIS = 22;

function gridGeometry(w: number, p: Pattern) {
  const cell = (w - AXIS - GAP * (p.nHead - 1)) / p.nHead;
  return { cell, step: cell + GAP };
}

export function drawGrid(canvas: HTMLCanvasElement, p: Pattern, sel: { layer: number; head: number }): void {
  const { ctx, w } = fit(canvas);
  const c = readColours();
  const { T, nLayer, nHead } = p;
  const { cell, step } = gridGeometry(w, p);
  ctx.clearRect(0, 0, w, w);

  // One pixel per attention weight, then scaled up without smoothing.
  const img = new ImageData(T, T);
  const tile = document.createElement("canvas");
  tile.width = T;
  tile.height = T;
  const tctx = tile.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  for (let l = 0; l < nLayer; l++) {
    for (let h = 0; h < nHead; h++) {
      const A = p.attn[l];
      for (let i = 0; i < T * T; i++) shade(c, A[h * T * T + i], img.data, i * 4);
      tctx.putImageData(img, 0, 0);
      ctx.drawImage(tile, AXIS + h * step, AXIS + l * step, cell, cell);
    }
  }

  ctx.fillStyle = c.muted;
  ctx.font = `10px "JetBrains Mono", monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let h = 0; h < nHead; h += 1) if (cell > 14 || h % 2 === 0) ctx.fillText(String(h), AXIS + h * step + cell / 2, AXIS / 2);
  ctx.textAlign = "right";
  for (let l = 0; l < nLayer; l++) if (cell > 14 || l % 2 === 0) ctx.fillText(String(l), AXIS - 5, AXIS + l * step + cell / 2);

  ctx.strokeStyle = c.sel;
  ctx.lineWidth = 2;
  ctx.strokeRect(AXIS + sel.head * step - 2, AXIS + sel.layer * step - 2, cell + 4, cell + 4);
}

/** Maps a click on the grid canvas (CSS px) to a layer/head. */
export function gridHit(canvas: HTMLCanvasElement, p: Pattern, x: number, y: number): { layer: number; head: number } | null {
  const { cell } = gridGeometry(canvas.clientWidth, p);
  const hit = gridCell(x - AXIS, y - AXIS, cell, GAP, p.nHead, p.nLayer);
  return hit && { layer: hit.row, head: hit.col };
}

export interface HeatLayout {
  left: number;
  top: number;
  cell: number;
}

export function drawHeat(canvas: HTMLCanvasElement, p: Pattern, layer: number, head: number, tokens: string[], query: number): HeatLayout {
  const { ctx, w } = fit(canvas);
  const c = readColours();
  const { T } = p;
  const labelChars = 9;
  ctx.font = `11px "JetBrains Mono", monospace`;
  const lw = Math.min(w * 0.3, ctx.measureText("m".repeat(labelChars)).width + 6);
  const left = lw;
  const top = lw;
  const cell = (w - left) / T;
  ctx.clearRect(0, 0, w, w);

  const img = new ImageData(T, T);
  const A = p.attn[layer];
  for (let i = 0; i < T * T; i++) shade(c, A[head * T * T + i], img.data, i * 4);
  const tile = document.createElement("canvas");
  tile.width = T;
  tile.height = T;
  tile.getContext("2d")!.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tile, left, top, cell * T, cell * T);

  const label = (t: string) => {
    const s = showToken(t);
    return s.length > labelChars ? s.slice(0, labelChars - 1) + "…" : s;
  };
  const every = Math.max(1, Math.ceil(11 / cell)); // skip labels when cells are tiny
  ctx.textBaseline = "middle";
  for (let i = 0; i < T; i += 1) {
    if (i % every && i !== query) continue;
    ctx.fillStyle = i === query ? c.sel : c.muted;
    ctx.textAlign = "right";
    ctx.fillText(label(tokens[i]), left - 4, top + (i + 0.5) * cell);
    ctx.save();
    ctx.translate(left + (i + 0.5) * cell, top - 4);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "left";
    ctx.fillText(label(tokens[i]), 0, 0);
    ctx.restore();
  }
  ctx.strokeStyle = c.sel;
  ctx.lineWidth = 2;
  ctx.strokeRect(left, top + query * cell, cell * T, cell);
  return { left, top, cell };
}
