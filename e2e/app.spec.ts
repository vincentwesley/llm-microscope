import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Loads the real 129 MB model (from the local preview server) and runs it on the CPU.
test.setTimeout(180_000);

async function ready(page: Page) {
  await page.goto("/");
  await expect(page.locator("#status-chip")).toHaveText("Ready", { timeout: 150_000 });
  await expect(page.locator("#preds li")).toHaveCount(10, { timeout: 60_000 });
}

test("predicts the indirect object and shows every head", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("#preds li").first()).toContainText("Mary");
  await expect(page.locator("#tokens .tok")).toHaveCount(14);

  // L9H9 (default) attends from " to" mostly to " Mary".
  await expect(page.locator("#attn-text .w").nth(1)).toHaveAttribute("title", /^\d+(\.\d)?% of L9H9/);

  // Click a head in the overview grid and the pickers follow.
  const grid = page.locator("#grid");
  const box = (await grid.boundingBox())!;
  await grid.click({ position: { x: box.width - 4, y: box.height - 4 } });
  await expect(page.locator("#layer")).toHaveValue("11");
  await expect(page.locator("#head")).toHaveValue("11");

  // Picking a prediction appends it and predicts again.
  await page.locator("#preds .pred").first().click();
  await expect(page.locator("#tokens .tok")).toHaveCount(15, { timeout: 60_000 });
  await expect(page.locator("#prompt")).toHaveValue(/drink to Mary$/);

  // Logit lens: one row per depth, ending on the final guess.
  await expect(page.locator("#lens tr")).toHaveCount(13, { timeout: 60_000 });

  // Switching off the name-mover heads knocks " Mary" off the top.
  await page.getByRole("button", { name: "Names" }).click();
  await expect(page.locator("#preds li").first()).toContainText("Mary", { timeout: 60_000 });
  await page.getByRole("button", { name: "Switch off name movers" }).click();
  await expect(page.locator("#run-info")).toContainText("with interventions", { timeout: 60_000 });
  await expect(page.locator("#preds li").first()).not.toContainText("Mary");
  await expect(page.locator("#ablated .hs-chip")).toHaveCount(3);
  await page.getByRole("button", { name: "Clear" }).click();
  await expect(page.locator("#preds li").first()).toContainText("Mary", { timeout: 60_000 });

  // Presets run new prompts.
  await page.getByRole("button", { name: "Count" }).click();
  await expect(page.locator("#preds li").first()).toContainText("5", { timeout: 60_000 });
  expect(errors).toEqual([]);
});

test("theme toggle and credits", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Light theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.getByText("Made by")).toBeAttached();
  await expect(page.locator(".creator__blurb")).toContainText("LLM Microscope");
});

for (const theme of ["dark", "light"] as const) {
  test(`axe clean (${theme})`, async ({ page }) => {
    await ready(page);
    await expect(page.locator("#lens tr")).toHaveCount(13, { timeout: 60_000 });
    if (theme === "light") await page.getByRole("button", { name: "Light theme" }).click();
    // Include the intervention states (deltas, pressed toggle, chips).
    await page.locator("#ablate-toggle").click();
    await expect(page.locator("#run-info")).toContainText("with interventions", { timeout: 60_000 });
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations).toEqual([]);
  });
}
