import { expect, test } from "@playwright/test";

test("home page shows the heading with StyleX styles applied", async ({ page }) => {
  await page.goto("/");
  const heading = page.getByRole("heading", { name: "StyleXN" });
  await expect(heading).toBeVisible();
  // rebeccapurple, set in app/page.tsx via stylex.create. Proves the CSS
  // StyleX extracts actually ships.
  await expect(heading).toHaveCSS("color", "rgb(102, 51, 153)");
});
