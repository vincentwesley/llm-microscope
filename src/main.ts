import "./style.css";
import "./credits/credits.js";
import { applyTheme, nextTheme, type Theme } from "./theme";
import { drawGrid, drawHeat, gridHit, type HeatLayout, type Pattern } from "./ui/attention";
import { pct, showToken } from "./ui/format";
import { MAX_TOKENS, type Reply, type RunReply } from "./worker/protocol";

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

// ---- model worker ----
const worker = new Worker(new URL("./worker/model.worker.ts", import.meta.url), { type: "module" });
const statusChip = $("#status-chip");
const statusText = $("#status-text");
const statusBar = $<HTMLProgressElement>("#status-bar");
const runBtn = $<HTMLButtonElement>("#run");
const promptEl = $<HTMLTextAreaElement>("#prompt");

let ready = false;
let runId = 0;
let busy = false;
let pending: { text?: string; ids?: number[] } | null = null;
let last: RunReply | null = null;
// L9H9 is a "name mover" head from the indirect-object circuit: from " to" it looks back at " Mary".
const sel = { layer: 9, head: 9, query: -1 };

function setStatus(chip: string, text: string, state: "loading" | "ready" | "error"): void {
  statusChip.textContent = chip;
  statusText.textContent = text;
  $("#status-card").dataset.state = state;
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
    busy = false;
    if (m.id === runId) show(m);
    flush();
  } else {
    busy = false;
    if (!ready) {
      setStatus("Error", `Could not load the model: ${m.message}`, "error");
    } else {
      $("#run-info").textContent = m.message;
    }
    runBtn.disabled = !ready;
    runBtn.textContent = "Run";
    flush();
  }
};
worker.onerror = () => setStatus("Error", "The model worker failed to start. Try a recent Chrome, Edge, Firefox or Safari.", "error");
worker.postMessage({ type: "load", base: `${import.meta.env.BASE_URL}model/` });

/** Runs one request at a time; while busy, only the latest one waits. */
function request(r: { text?: string; ids?: number[] }): void {
  pending = r;
  flush();
}
function flush(): void {
  if (busy || !pending || !ready) return;
  busy = true;
  runBtn.disabled = true;
  runBtn.textContent = "Running…";
  $("#run-info").textContent = "";
  worker.postMessage({ type: "run", id: ++runId, ...pending });
  pending = null;
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

function show(r: RunReply): void {
  last = r;
  runBtn.disabled = false;
  runBtn.textContent = "Run";
  sel.query = r.ids.length - 1;
  $("#run-info").textContent =
    `${r.ids.length} tokens · ${(r.ms / 1000).toFixed(2)} s` + (r.truncated ? ` · kept the last ${MAX_TOKENS} tokens` : "");

  const strip = $("#tokens");
  strip.replaceChildren(
    ...r.tokens.map((t, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "tok mono";
      b.textContent = showToken(t);
      b.title = `Token ${i}, id ${r.ids[i]}`;
      b.addEventListener("click", () => {
        sel.query = i;
        redraw();
      });
      return b;
    }),
  );

  const preds = $("#preds");
  preds.replaceChildren(
    ...r.top.map((p) => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pred";
      b.style.setProperty("--p", String(p.prob));
      b.title = `Add "${p.token}" to the prompt`;
      const tok = document.createElement("span");
      tok.className = "pred__tok mono";
      tok.textContent = showToken(p.token);
      const val = document.createElement("span");
      val.className = "pred__p mono";
      val.textContent = pct(p.prob);
      b.append(tok, val);
      b.addEventListener("click", () => {
        promptEl.value += p.token;
        request({ ids: [...r.ids, p.id] });
      });
      li.append(b);
      return li;
    }),
  );
  redraw();
}

const grid = $<HTMLCanvasElement>("#grid");
const heat = $<HTMLCanvasElement>("#heat");
const layerSel = $<HTMLSelectElement>("#layer");
const headSel = $<HTMLSelectElement>("#head");
let heatLayout: HeatLayout | null = null;

for (let i = 0; i < 12; i++) {
  layerSel.add(new Option(String(i), String(i)));
  headSel.add(new Option(String(i), String(i)));
}
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
  if (!last) return;
  const p = pattern(last);
  layerSel.value = String(sel.layer);
  headSel.value = String(sel.head);
  drawGrid(grid, p, sel);
  heatLayout = drawHeat(heat, p, sel.layer, sel.head, last.tokens, sel.query);
  heat.setAttribute("aria-label", `Attention pattern of layer ${sel.layer}, head ${sel.head}`);

  document.querySelectorAll<HTMLButtonElement>("#tokens .tok").forEach((b, i) => b.setAttribute("aria-pressed", String(i === sel.query)));
  $("#query-label").textContent = `“${showToken(last.tokens[sel.query])}”`;
  const T = p.T;
  const row = p.attn[sel.layer].subarray((sel.head * T + sel.query) * T, (sel.head * T + sel.query + 1) * T);
  $("#attn-text").replaceChildren(
    ...last.tokens.map((t, j) => {
      const s = document.createElement("span");
      s.className = "w mono";
      s.textContent = t;
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
  }
});

let resizeTimer = 0;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(redraw, 120);
});
