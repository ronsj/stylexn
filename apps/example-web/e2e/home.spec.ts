import { expect, test } from "@playwright/test";

test("home page shows the shared component with StyleX styles applied", async ({ page }) => {
  await page.goto("/");
  const hello = page.getByText("Hello from @stylexn/shared, web!");
  await expect(hello).toBeVisible();
  // rebeccapurple, set in packages/shared/src/Hello.tsx via stylex.create.
  // Proves the CSS StyleX extracted from the shared package actually ships.
  await expect(hello).toHaveCSS("color", "rgb(102, 51, 153)");
});
