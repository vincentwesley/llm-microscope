import "./style.css";
import "./credits/credits.js";
import { applyTheme, nextTheme, type Theme } from "./theme";
import { drawGrid, drawHeat, gridHit, type HeatLayout, type Pattern } from "./ui/attention";
import { delta, pct, showToken } from "./ui/format";
import { MAX_TOKENS, type LensReply, type Reply, type RunReply, type Steer } from "./worker/protocol";

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

const KEY = "theme";
const store = {
  get: (): Theme => {
    try {
      return localStorage.getItem(KEY) === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  },
  set: (t: Theme) => {
    try {
      localStorage.setItem(KEY, t);
    } catch {
      /* storage blocked: theme just won't persist */
    }
  },
};

const themeBtn = $<HTMLButtonElement>("#theme");
function syncTheme(t: Theme): void {
  applyTheme(t);
  themeBtn.setAttribute("aria-pressed", String(t === "light"));
  themeBtn.textContent = t === "light" ? "Dark theme" : "Light theme";
}
syncTheme(store.get());
themeBtn.addEventListener("click", () => {
  const t = nextTheme(store.get());
  store.set(t);
  syncTheme(t);
  redraw(); // canvas colours come from the theme tokens
});

// ---- state ----
const statusChip = $("#status-chip");
const statusText = $("#status-text");
const statusBar = $<HTMLProgressElement>("#status-bar");
const runBtn = $<HTMLButtonElement>("#run");
const promptEl = $<HTMLTextAreaElement>("#prompt");

let ready = false;
let last: RunReply | null = null;
// L9H9 is a "name mover" head from the indirect-object circuit: from " to" it looks back at " Mary".
const sel = { layer: 9, head: 9, query: -1 };
/** Ablated heads as "layer:head" keys. */
const ablated = new Set<string>();
const NAME_MOVERS = ["9:6", "9:9", "10:0"];

// ---- model worker: one job at a time; only the latest run and latest lens wait ----
const worker = new Worker(new URL("./worker/model.worker.ts", import.meta.url), { type: "module" });
let busy = false;
let jobId = 0;
let pendingRun: { text?: string; ids?: number[] } | null = null;
let pendingLens: number | null = null;

function setStatus(chip: string, text: string, state: "loading" | "ready" | "error"): void {
  statusChip.textContent = chip;
  statusText.textContent = text;
  $("#status-card").dataset.state = state;
}

function idle(): void {
  busy = false;
  runBtn.disabled = !ready;
  runBtn.textContent = "Run";
  flush();
}

worker.onmessage = (e: MessageEvent<Reply>) => {
  const m = e.data;
  if (m.type === "progress") {
    statusBar.value = m.loaded / m.total;
    const mb = (n: number) => (n / 2 ** 20).toFixed(0);
    setStatus("Loading", `${m.cached ? "Reading cached model" : "Downloading GPT-2 small"}: ${mb(m.loaded)} / ${mb(m.total)} MB`, "loading");
  } else if (m.type === "ready") {
    ready = true;
    statusBar.value = 1;
    setStatus("Ready", `GPT-2 small loaded in ${(m.ms / 1000).toFixed(1)} s. Runs on your CPU.`, "ready");
    runBtn.disabled = false;
    request({ text: promptEl.value });
  } else if (m.type === "result") {
    show(m);
    idle();
  } else if (m.type === "lens") {
    showLens(m);
    idle();
  } else {
    if (!ready) setStatus("Error", `Could not load the model: ${m.message}`, "error");
    else $("#run-info").textContent = m.message;
    idle();
  }
};
worker.onerror = () => setStatus("Error", "The model worker failed to start. Try a recent Chrome, Edge, Firefox or Safari.", "error");
worker.postMessage({ type: "load", base: `${import.meta.env.BASE_URL}model/` });

function request(r: { text?: string; ids?: number[] }): void {
  pendingRun = r;
  pendingLens = null; // a new run supersedes any lens on the old one
  flush();
}
function requestLens(pos: number): void {
  pendingLens = pos;
  flush();
}
/** Re-runs the current tokens with the current interventions. */
function rerun(): void {
  if (last) request({ ids: last.ids });
}

function steer(): Steer | null {
  const alpha = Number($<HTMLInputElement>("#steer-alpha").value);
  const plus = $<HTMLInputElement>("#steer-plus").value.trim();
  const minus = $<HTMLInputElement>("#steer-minus").value.trim();
  if (!alpha || !plus || !minus) return null; // incomplete: run without steering rather than erroring
  return {
    plus,
    minus,
    layer: Number($<HTMLSelectElement>("#steer-layer").value),
    alpha,
  };
}

function flush(): void {
  if (busy || !ready) return;
  if (pendingRun) {
    busy = true;
    runBtn.disabled = true;
    runBtn.textContent = "Running…";
    $("#run-info").textContent = "";
    const ablate = [...ablated].map((k) => k.split(":").map(Number) as [number, number]);
    worker.postMessage({ type: "run", id: ++jobId, ...pendingRun, ablate, steer: steer() });
    pendingRun = null;
  } else if (pendingLens !== null && last) {
    busy = true;
    worker.postMessage({ type: "lens", id: ++jobId, pos: pendingLens });
    pendingLens = null;
  }
}

$("#prompt-form").addEventListener("submit", (e) => {
  e.preventDefault();
  request({ text: promptEl.value });
});
promptEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) request({ text: promptEl.value });
});
document.querySelectorAll<HTMLButtonElement>("[data-preset]").forEach((b) =>
  b.addEventListener("click", () => {
    promptEl.value = b.dataset.preset!;
    request({ text: promptEl.value });
  }),
);

// ---- rendering ----
function pattern(r: RunReply): Pattern {
  return { attn: r.attn, T: r.ids.length, nLayer: r.nLayer, nHead: r.nHead };
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text = ""): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  e.textContent = text;
  return e;
}

function show(r: RunReply): void {
  const sameTokens = last?.ids.join() === r.ids.join();
  last = r;
  if (!sameTokens || sel.query >= r.ids.length) sel.query = r.ids.length - 1;
  $("#run-info").textContent =
    `${r.ids.length} tokens · ${(r.ms / 1000).toFixed(2)} s` +
    (r.intervened ? " · with interventions" : "") +
    (r.truncated ? ` · kept the last ${MAX_TOKENS} tokens` : "");

  $("#tokens").replaceChildren(
    ...r.tokens.map((t, i) => {
      const b = el("button", "tok mono", showToken(t));
      b.type = "button";
      b.title = `Token ${i}, id ${r.ids[i]}`;
      b.addEventListener("click", () => {
        sel.query = i;
        redraw();
        requestLens(i);
      });
      return b;
    }),
  );

  $("#preds").replaceChildren(
    ...r.top.map((p) => {
      const li = document.createElement("li");
      const b = el("button", "pred");
      b.type = "button";
      b.style.setProperty("--p", String(p.prob));
      b.title = `Add "${p.token}" to the prompt`;
      const val = el("span", "pred__p mono", pct(p.prob));
      if (r.intervened) {
        const d = delta(p.prob, p.clean);
        const dv = el("span", `pred__d mono pred__d--${d.dir}`, d.text);
        dv.title = `${pct(p.clean)} without interventions`;
        val.prepend(dv);
      }
      b.append(el("span", "pred__tok mono", showToken(p.token)), val);
      b.addEventListener("click", () => {
        promptEl.value += p.token;
        request({ ids: [...r.ids, p.id] });
      });
      li.append(b);
      return li;
    }),
  );
  redraw();
  requestLens(sel.query);
}

const lensBody = $("#lens");
function showLens(m: LensReply): void {
  if (!last || m.pos !== sel.query) return; // stale
  $("#lens-pos").textContent = `“${showToken(last.tokens[m.pos])}” (token ${m.pos})`;
  $("#lens-final").textContent = showToken(m.finalToken);
  lensBody.replaceChildren(
    ...m.rows.map((row, i) => {
      const tr = document.createElement("tr");
      const th = el("th", "mono", i === 0 ? "embed" : `L${i - 1}`);
      th.title = i === 0 ? "Token + position embeddings" : `After block ${i - 1}`;
      th.scope = "row";
      const top = row.top[0];
      const best = el("td", "lens__top mono", showToken(top.token));
      best.title = pct(top.prob);
      if (top.token === m.finalToken) best.classList.add("is-final");
      const more = el("td", "lens__more mono", row.top.slice(1).map((t) => showToken(t.token)).join("  "));
      const fin = el("td", "");
      const wrap = el("div", "lens__bar");
      const bar = el("span", "bar");
      bar.style.setProperty("--p", String(row.final));
      wrap.append(bar, el("span", "mono", pct(row.final)));
      fin.append(wrap);
      tr.append(th, best, more, fin);
      return tr;
    }),
  );
}

const grid = $<HTMLCanvasElement>("#grid");
const heat = $<HTMLCanvasElement>("#heat");
const layerSel = $<HTMLSelectElement>("#layer");
const headSel = $<HTMLSelectElement>("#head");
const steerLayer = $<HTMLSelectElement>("#steer-layer");
let heatLayout: HeatLayout | null = null;

for (let i = 0; i < 12; i++) {
  layerSel.add(new Option(String(i), String(i)));
  headSel.add(new Option(String(i), String(i)));
  steerLayer.add(new Option(String(i), String(i)));
}
steerLayer.value = "6";
layerSel.value = String(sel.layer);
headSel.value = String(sel.head);
layerSel.addEventListener("change", () => {
  sel.layer = Number(layerSel.value);
  redraw();
});
headSel.addEventListener("change", () => {
  sel.head = Number(headSel.value);
  redraw();
});

function redraw(): void {
  renderAblated();
  if (!last) return;
  const p = pattern(last);
  layerSel.value = String(sel.layer);
  headSel.value = String(sel.head);
  drawGrid(grid, p, sel, ablated);
  heatLayout = drawHeat(heat, p, sel.layer, sel.head, last.tokens, sel.query);
  heat.setAttribute("aria-label", `Attention pattern of layer ${sel.layer}, head ${sel.head}`);

  document.querySelectorAll<HTMLButtonElement>("#tokens .tok").forEach((b, i) => b.setAttribute("aria-pressed", String(i === sel.query)));
  $("#query-label").textContent = `“${showToken(last.tokens[sel.query])}”`;
  const T = p.T;
  const row = p.attn[sel.layer].subarray((sel.head * T + sel.query) * T, (sel.head * T + sel.query + 1) * T);
  $("#attn-text").replaceChildren(
    ...last.tokens.map((t, j) => {
      const s = el("span", "w mono", t);
      if (j <= sel.query) {
        s.style.setProperty("--w", String(Math.sqrt(row[j])));
        s.title = `${pct(row[j])} of L${sel.layer}H${sel.head}'s attention`;
      } else {
        s.classList.add("w--future");
        s.title = "Later tokens can't be seen";
      }
      return s;
    }),
  );
}

// ---- interventions ----
const ablateBtn = $<HTMLButtonElement>("#ablate-toggle");
function renderAblated(): void {
  const key = `${sel.layer}:${sel.head}`;
  ablateBtn.setAttribute("aria-pressed", String(ablated.has(key)));
  ablateBtn.textContent = `${ablated.has(key) ? "Switch on" : "Switch off"} L${sel.layer}H${sel.head}`;
  const box = $("#ablated");
  if (!ablated.size) {
    box.replaceChildren(el("span", "hint", "None. Pick a head under Attention heads and switch it off."));
    return;
  }
  const keys = [...ablated].sort((a, b) => {
    const [la, ha] = a.split(":").map(Number);
    const [lb, hb] = b.split(":").map(Number);
    return la - lb || ha - hb;
  });
  box.replaceChildren(
    ...keys.map((k) => {
      const [l, h] = k.split(":");
      const b = el("button", "hs-chip chip--off", `L${l}H${h} `);
      const x = el("span", "", "×");
      x.setAttribute("aria-hidden", "true");
      b.append(x);
      b.type = "button";
      b.title = `Switch L${l}H${h} back on`;
      b.addEventListener("click", () => {
        ablated.delete(k);
        redraw();
        rerun();
      });
      return b;
    }),
  );
}
ablateBtn.addEventListener("click", () => {
  const key = `${sel.layer}:${sel.head}`;
  if (!ablated.delete(key)) ablated.add(key);
  redraw();
  rerun();
});
$("#ablate-movers").addEventListener("click", () => {
  NAME_MOVERS.forEach((k) => ablated.add(k));
  redraw();
  rerun();
});
$("#ablate-clear").addEventListener("click", () => {
  if (!ablated.size) return;
  ablated.clear();
  redraw();
  rerun();
});

const alphaEl = $<HTMLInputElement>("#steer-alpha");
const syncAlpha = () => {
  $("#steer-alpha-out").textContent = alphaEl.value === "0" ? "off" : alphaEl.value;
};
alphaEl.addEventListener("input", syncAlpha);
syncAlpha(); // browsers may restore the slider on reload
for (const id of ["#steer-alpha", "#steer-layer", "#steer-plus", "#steer-minus"]) {
  $(id).addEventListener("change", () => {
    if (id === "#steer-alpha" || steer()) rerun();
  });
}

grid.addEventListener("click", (e) => {
  if (!last) return;
  const r = grid.getBoundingClientRect();
  const hit = gridHit(grid, pattern(last), e.clientX - r.left, e.clientY - r.top);
  if (!hit) return;
  sel.layer = hit.layer;
  sel.head = hit.head;
  redraw();
});

const readout = $("#heat-readout");
heat.addEventListener("pointermove", (e) => {
  if (!last || !heatLayout) return;
  const r = heat.getBoundingClientRect();
  const { left, top, cell } = heatLayout;
  const j = Math.floor((e.clientX - r.left - left) / cell);
  const i = Math.floor((e.clientY - r.top - top) / cell);
  const T = last.ids.length;
  if (i < 0 || j < 0 || i >= T || j >= T) return;
  const v = last.attn[sel.layer][(sel.head * T + i) * T + j];
  readout.textContent = `${showToken(last.tokens[i])} → ${showToken(last.tokens[j])}: ${j > i ? "masked" : pct(v)}`;
});
heat.addEventListener("click", (e) => {
  if (!last || !heatLayout) return;
  const r = heat.getBoundingClientRect();
  const i = Math.floor((e.clientY - r.top - heatLayout.top) / heatLayout.cell);
  if (i >= 0 && i < last.ids.length) {
    sel.query = i;
    redraw();
    requestLens(i);
  }
});

let resizeTimer = 0;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(redraw, 120);
});
renderAblated();
