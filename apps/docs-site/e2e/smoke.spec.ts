import { expect, test } from "@playwright/test";
import { PAGES } from "../app/_lib/pages";

for (const { href, title } of PAGES) {
  test(`${title} renders its heading and a live example`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(href);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: title, exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
    // The first live example's root element: compiled StyleX classes, and
    // the View base styles, which come from stylexn/elements.css.
    const example = page.locator('[data-testid^="example-"] > *').first();
    await expect(example).toBeVisible();
    await expect(example).toHaveClass(/\bx[a-z0-9]{5,}\b/);
    await expect(example).toHaveCSS("display", /flex|grid/);
    expect(errors).toEqual([]);
  });
}

test("the navigation collapses behind a menu button on narrow screens", async ({ page }) => {
  const target = PAGES[PAGES.length - 1] ?? PAGES[0];
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Documentation" });
  const link = nav.getByRole("link", { name: target.title, exact: true });
  await expect(link).toBeHidden();
  await nav.getByRole("button", { name: "Menu" }).click();
  await expect(nav.getByRole("button", { name: "Close" })).toHaveAttribute("aria-expanded", "true");
  await link.click();
  await expect(page).toHaveURL(new RegExp(`${target.href}$`));
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // Following a link closes the menu again.
  await expect(link).toBeHidden();
});
