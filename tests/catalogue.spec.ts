import { test, expect } from '@playwright/test';

test('Rijlo landing page loads correctly', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('a[aria-label="Rijlo Home"]').first()).toBeVisible();
});

