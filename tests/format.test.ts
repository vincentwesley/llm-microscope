import { describe, expect, it } from "vitest";
import { delta, gridCell, pct, showToken } from "../src/ui/format";

describe("format", () => {
  it("shows token whitespace", () => {
    expect(showToken(" Mary")).toBe("·Mary");
    expect(showToken("\n\n")).toBe("↵↵");
    expect(showToken("")).toBe("∅");
  });
  it("formats probabilities", () => {
    expect(pct(0.453)).toBe("45%");
    expect(pct(0.0123)).toBe("1.2%");
    expect(pct(0.00001)).toBe("<0.1%");
    expect(pct(0.999)).toBe("99%+");
  });
  it("formats deltas in percentage points", () => {
    expect(delta(0.45, 0.2)).toEqual({ text: "+25", dir: "up" });
    expect(delta(0.1, 0.15)).toEqual({ text: "−5.0", dir: "down" });
    expect(delta(0.3, 0.3)).toEqual({ text: "±0", dir: "same" });
  });
  it("hit-tests grid cells and gaps", () => {
    expect(gridCell(5, 5, 10, 2, 12, 12)).toEqual({ col: 0, row: 0 });
    expect(gridCell(13, 25, 10, 2, 12, 12)).toEqual({ col: 1, row: 2 });
    expect(gridCell(11, 5, 10, 2, 12, 12)).toBeNull();
    expect(gridCell(200, 5, 10, 2, 12, 12)).toBeNull();
  });
});
