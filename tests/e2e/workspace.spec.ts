import "dotenv/config";
import { test, expect } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
test("dispatcher dashboard is accessible and supports incident review", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("Email address", { exact: true })
    .fill("dispatcher@resqcloud.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.DEV_SEED_PASSWORD ?? "");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Priority queue" }),
  ).toBeVisible();
  await expect(
    page.getByText(/critical incident.*coordination/i),
  ).toBeVisible();
  await expect(page.getByText("All reports", { exact: true })).toBeVisible();
  await page
    .getByRole("button", {
      name: "Multi-vehicle collision near Katpadi",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Incident timeline" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByLabel("Search incidents").fill("no-matching-report-ui-check");
  await expect(
    page.getByRole("heading", { name: "No matching incidents" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(
    page.getByRole("button", {
      name: "Multi-vehicle collision near Katpadi",
      exact: true,
    }),
  ).toBeVisible();
  const a11y = await new AxeBuilder({ page }).analyze();
  expect(a11y.violations).toEqual([]);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "docs/dashboard-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "docs/dashboard-mobile.png", fullPage: true });
  await expect(
    page.getByRole("list", { name: "Incident results" }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/settings");
  await expect(
    page.getByRole("heading", {
      name: "This workspace area is not available to your role",
    }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Settings" })).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
test("anonymous report has private receipt and tracking", async ({ page }) => {
  await page.goto("/report");
  await page.getByLabel("Short title").fill("E2E report at Katpadi station");
  await page
    .getByLabel("Description", { exact: true })
    .fill("A person needs help at the station entrance.");
  await page
    .getByLabel("Location description")
    .fill("Katpadi station entrance");
  await page.getByRole("button", { name: "Submit incident report" }).click();
  await expect(
    page.getByRole("heading", { name: "Report received" }),
  ).toBeVisible();
  const id = await page.getByLabel("Tracking ID", { exact: true }).inputValue();
  const token = await page
    .getByLabel("Private tracking key", { exact: true })
    .inputValue();
  await page.goto("/tracking");
  await page.getByLabel("Tracking ID", { exact: true }).fill(id);
  await page.getByLabel("Private tracking key", { exact: true }).fill(token);
  await page
    .getByRole("button", { name: "Track incident", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "reported", exact: true }),
  ).toBeVisible();
});
