import { expect, test, type Page } from "@playwright/test";

const titles = (page: Page) => page.getByTestId("todo-title");
const item = (page: Page, title: string) =>
  page.getByTestId("todo-item").filter({ hasText: title });

/** Type into the add field once the page has hydrated (the add button reacts). */
async function add(page: Page, title: string) {
  const input = page.getByTestId("todo-input");
  await expect(async () => {
    await input.fill(title);
    await expect(page.getByTestId("todo-add")).toBeEnabled({ timeout: 500 });
  }).toPass();
  await page.getByTestId("todo-add").click();
  await expect(item(page, title)).toBeVisible();
}

test("todo flow: add, complete, filter, paginate, edit, delete and persist", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Todos" })).toBeVisible();
  // The accent (#6a3db8) comes from packages/shared/src/todo/tokens.stylex.ts
  // via defineVars. Proves the CSS StyleX extracted from the shared package ships.
  await expect(page.getByTestId("filter-all")).toHaveCSS("background-color", "rgb(106, 61, 184)");

  // Add, then mark done.
  await add(page, "Buy milk");
  await item(page, "Buy milk").getByTestId("todo-toggle").check();
  await expect(page.getByTestId("todo-summary")).toHaveText("0 left · 1 done");

  // Filter.
  await page.getByTestId("filter-active").click();
  await expect(page.getByTestId("todo-empty")).toHaveText("Nothing left to do.");
  await page.getByTestId("filter-done").click();
  await expect(titles(page)).toHaveText(["Buy milk"]);
  await page.getByTestId("filter-all").click();

  // Six more: a second page appears.
  for (let i = 1; i <= 6; i++) await add(page, `Todo ${i}`);
  const label = page.getByTestId("page-label");
  await expect(label).toHaveText("Page 1 of 2");
  await expect(titles(page)).toHaveText(["Todo 6", "Todo 5", "Todo 4", "Todo 3", "Todo 2"]);
  await expect(page.getByTestId("page-prev")).toBeDisabled();
  await page.getByTestId("page-next").click();
  await expect(label).toHaveText("Page 2 of 2");
  await expect(titles(page)).toHaveText(["Todo 1", "Buy milk"]);
  await expect(page.getByTestId("page-next")).toBeDisabled();
  await page.getByTestId("page-prev").click();
  await expect(label).toHaveText("Page 1 of 2");

  // Edit a title: Return saves.
  await item(page, "Todo 6").getByTestId("todo-edit").click();
  const field = page.getByTestId("todo-edit-input");
  await expect(field).toBeFocused();
  await field.fill("Todo six");
  await field.press("Enter");
  await expect(titles(page).first()).toHaveText("Todo six");

  // Delete: the row animates out, then the next todo moves up from page 2.
  await item(page, "Todo 5").getByTestId("todo-delete").click();
  await expect(item(page, "Todo 5")).toHaveCount(0);
  await expect(titles(page)).toHaveText(["Todo six", "Todo 4", "Todo 3", "Todo 2", "Todo 1"]);
  await expect(label).toHaveText("Page 1 of 2");

  // Reload: everything comes back from localStorage.
  await page.reload();
  await expect(titles(page)).toHaveText(["Todo six", "Todo 4", "Todo 3", "Todo 2", "Todo 1"]);
  await expect(page.getByTestId("todo-summary")).toHaveText("5 left · 1 done");
  await page.getByTestId("page-next").click();
  await expect(item(page, "Buy milk").getByTestId("todo-toggle")).toBeChecked();
  const saved = await page.evaluate(() => localStorage.getItem("stylexn-todos"));
  expect(JSON.parse(saved ?? "[]")).toHaveLength(6);
});
