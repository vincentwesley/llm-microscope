export type Theme = "dark" | "light";

export function nextTheme(t: Theme): Theme {
  return t === "dark" ? "light" : "dark";
}

export function applyTheme(t: Theme, root: HTMLElement = document.documentElement): void {
  root.dataset.theme = t;
}
