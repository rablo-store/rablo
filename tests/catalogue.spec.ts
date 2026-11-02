import { test, expect } from '@playwright/test';

test('Rablo landing page loads correctly', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toBeVisible();
});
