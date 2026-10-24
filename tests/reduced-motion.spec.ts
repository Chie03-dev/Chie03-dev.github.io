import { test, expect } from "@playwright/test";

test.use({ reducedMotion: "reduce" });

test("reduced motion: no console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);
  expect(errors).toEqual([]);
});
