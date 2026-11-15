import { test, expect } from '@playwright/test';

test('Rablo landing page loads correctly', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[aria-label="Why shop on Rablo"]')).toBeVisible();
});
