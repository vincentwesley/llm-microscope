import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("dark by default, toggles to light, counter works", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Add one" }).click();
  await expect(page.locator("#count")).toHaveText("1");
  await page.getByRole("button", { name: "Light theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.getByText("Made by")).toBeAttached();
});

for (const theme of ["dark", "light"] as const) {
  test(`axe clean (${theme})`, async ({ page }) => {
    await page.goto("/");
    if (theme === "light") await page.getByRole("button", { name: "Light theme" }).click();
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations).toEqual([]);
  });
}
