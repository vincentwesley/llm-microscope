import { describe, expect, it } from "vitest";
import { nextTheme } from "../src/theme";

describe("nextTheme", () => {
  it("toggles between dark and light", () => {
    expect(nextTheme("dark")).toBe("light");
    expect(nextTheme("light")).toBe("dark");
  });
});
