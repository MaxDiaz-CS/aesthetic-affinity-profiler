import { expect, test } from "@playwright/test";

test("serves the three scaffold routes", async ({ page }) => {
  const routes = [
    { path: "/", heading: "Aesthetic Affinity Profiler" },
    { path: "/quiz", heading: "Quiz" },
    { path: "/results", heading: "Results" },
  ];

  for (const { path, heading } of routes) {
    const response = await page.goto(path);
    expect(response?.ok()).toBe(true);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  }
});
