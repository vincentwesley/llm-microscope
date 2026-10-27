/** Makes a GPT-2 token readable: leading space as "·", newlines as "↵", tabs as "⇥". */
export function showToken(t: string): string {
  if (t === "") return "∅";
  return t.replace(/^ /, "·").replace(/\n/g, "↵").replace(/\t/g, "⇥");
}

export function pct(p: number): string {
  if (p >= 0.995) return "99%+";
  if (p >= 0.1) return `${Math.round(p * 100)}%`;
  if (p >= 0.001) return `${(p * 100).toFixed(1)}%`;
  return "<0.1%";
}

/** Which cell of a cols × rows grid of square cells (with `gap` px between them) a point falls in. */
export function gridCell(x: number, y: number, cell: number, gap: number, cols: number, rows: number): { col: number; row: number } | null {
  const step = cell + gap;
  const col = Math.floor(x / step);
  const row = Math.floor(y / step);
  if (col < 0 || row < 0 || col >= cols || row >= rows) return null;
  if (x - col * step >= cell || y - row * step >= cell) return null; // in a gap
  return { col, row };
}
