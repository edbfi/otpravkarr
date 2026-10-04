import { expect, test } from "@playwright/test";

/**
 * Regression coverage for the audit pagination Next/Previous buttons.
 *
 * The dogfood pass (P06-ISSUE-001) reported that clicking "Next" on
 * /audit did not advance the page. The source code (admin/audit/+page.svelte
 * `updateFilter` → `goto(...)`) is correct, so we keep this spec to catch any
 * future regression in the real-browser navigation path.
 *
 * Requires the seeder to have populated >10 audit rows
 * (E2E_SEED_AUDIT=1, see playwright.config.ts).
 */

test.describe("Admin audit pagination", () => {
  test("Next/Previous buttons navigate between pages", async ({ page }) => {
    await page.goto("/audit?limit=10");

    await expect(page.getByText(/Page 1 of/)).toBeVisible();

    await page.getByRole("button", { name: /Next/ }).click();

    await expect(page).toHaveURL(/page=2(?!\d)/);
    await expect(page.getByText(/Page 2 of/)).toBeVisible();

    await page.getByRole("button", { name: /Previous/ }).click();

    await expect(page).toHaveURL(/page=1(?!\d)/);
    await expect(page.getByText(/Page 1 of/)).toBeVisible();
  });

  // M4(b): pagination scrolls to the top (SvelteKit 3 has no "keep focus but
  // reset scroll" goto mode, so the page does it); focus stays where it was.
  test("pagination scrolls to the top and keeps keyboard focus usable", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 360 });
    await page.goto("/audit?limit=5");
    const pager = page.getByText(/Page \d+ of \d+/);
    await expect(pager).toHaveText(/Page 1 of \d+/);
    const totalPages = Number((await pager.textContent())?.match(/of (\d+)/)?.[1]);
    expect(totalPages).toBeGreaterThanOrEqual(3);

    const next = page.getByRole("button", { name: /Next/ });
    await next.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

    await next.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/page=2(?!\d)/);
    await expect(pager).toHaveText(/Page 2 of \d+/);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await expect(next).toBeFocused();

    // A keyboard user can continue from the kept focus without re-finding the control.
    for (let current = 3; current <= totalPages; current++) {
      await page.keyboard.press("Enter");
      await expect(pager).toHaveText(new RegExp(`Page ${current} of`));
    }
    await expect(next).toBeDisabled();
    const focusOnLastPage = await page.evaluate(
      () => document.activeElement?.textContent?.trim() || document.activeElement?.tagName,
    );
    test
      .info()
      .annotations.push({ type: "focus on last page", description: String(focusOnLastPage) });
  });

  // Regression coverage for P06-ISSUE-002: the date filter button label should
  // reflect the active `?after=` value when arriving from a deep link.
  test("After-date filter button reflects URL state on load", async ({ page }) => {
    await page.goto("/audit?after=2026-05-01");

    await expect(page.getByRole("button", { name: "Filter after date" })).toContainText(
      "2026-05-01",
    );
  });
});
