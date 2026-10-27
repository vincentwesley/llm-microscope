import "./style.css";
import "./credits/credits.js";
import { applyTheme, nextTheme, type Theme } from "./theme";

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

const btn = document.querySelector<HTMLButtonElement>("#theme")!;
function sync(t: Theme): void {
  applyTheme(t);
  btn.setAttribute("aria-pressed", String(t === "light"));
  btn.textContent = t === "light" ? "Dark theme" : "Light theme";
}
sync(store.get());
btn.addEventListener("click", () => {
  const t = nextTheme(store.get());
  store.set(t);
  sync(t);
});

const out = document.querySelector<HTMLOutputElement>("#count")!;
document.querySelector("#inc")!.addEventListener("click", () => {
  out.value = String(Number(out.value) + 1);
});
