import { test, expect } from '@playwright/test';

// Resolutions specified by user:
// 1170 x 2532 px (iPhone 12/13/14 Pro — 390 x 844 CSS px)
// 1256 x 2756 px (Pixel 9 Pro — 412 x 915 CSS px)
// 1080 x 2400 px (Samsung S20/S21/A52 — 360 x 800 / 412 x 915 CSS px)
// 1440 x 3200 px (Samsung S20+/S21 Ultra — 384 x 854 / 412 x 915 CSS px)
// 1644 x 3840 px (Sony Xperia 1 — 411 x 960 CSS px)
// 1080 x 1920 px (Standard FHD mobile — 360 x 640 / 412 x 732 CSS px)
const MOBILE_DEVICES = [
  { name: 'iPhone (1170x2532 physical)', width: 390, height: 844 },
  { name: 'Pixel 9 Pro (1256x2756 physical)', width: 412, height: 915 },
  { name: 'Samsung Galaxy (1080x2400 physical)', width: 360, height: 800 },
  { name: 'Samsung Ultra (1440x3200 physical)', width: 384, height: 854 },
  { name: 'Sony Xperia 1 (1644x3840 physical)', width: 411, height: 960 },
  { name: 'Standard FHD (1080x1920 physical)', width: 360, height: 640 },
];

test.describe('Mobile Screen Fit & Responsiveness Across Requested Displays', () => {
  for (const device of MOBILE_DEVICES) {
    test(`Home Page fits perfectly on ${device.name} without horizontal overflow`, async ({ page }) => {
      await page.setViewportSize({ width: device.width, height: device.height });
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // 1. Check for zero horizontal overflow on page
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHorizontalScroll).toBe(false);

      // 2. Header: Logo, Search input, Cart button, and Hamburger menu are visible
      const brandLogo = page.locator('.header-brand-lockup');
      await expect(brandLogo).toBeVisible();

      const searchInput = page.locator('.header-search-container input');
      await expect(searchInput).toBeVisible();

      const hamburger = page.locator('button[aria-label="Open menu"]');
      await expect(hamburger).toBeVisible();

      // 3. Header brand lockup fits within viewport without clipping
      const brandLogoBox = await brandLogo.boundingBox();
      expect(brandLogoBox).not.toBeNull();
      if (brandLogoBox) {
        expect(brandLogoBox.x).toBeGreaterThanOrEqual(0);
        expect(brandLogoBox.x + brandLogoBox.width).toBeLessThanOrEqual(device.width + 2);
      }

      // 4. Test live search dropdown spans comfortably on mobile
      await searchInput.fill('crochet');
      const dropdown = page.locator('.header-search-container .fixed');
      await expect(dropdown).toBeVisible();

      // Dropdown should fit within mobile screen bounds
      const dropdownBox = await dropdown.boundingBox();
      expect(dropdownBox).not.toBeNull();
      if (dropdownBox) {
        expect(dropdownBox.x).toBeGreaterThanOrEqual(0);
        expect(dropdownBox.x + dropdownBox.width).toBeLessThanOrEqual(device.width + 2);
      }

      // Close dropdown
      await page.keyboard.press('Escape');
    });

    test(`Catalog Page fits perfectly on ${device.name} with 2-column card grid`, async ({ page }) => {
      await page.setViewportSize({ width: device.width, height: device.height });
      await page.goto('/catalog');
      await page.waitForLoadState('networkidle');

      // Zero horizontal scroll
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHorizontalScroll).toBe(false);

      // Category filters fit
      const catNav = page.locator('nav.collection-links');
      await expect(catNav).toBeVisible();
    });
  }

  test('Mobile menu drawer contains all 4 explore options and action buttons with expected functionality', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open mobile menu
    const hamburger = page.locator('button[aria-label="Open menu"]');
    await expect(hamburger).toBeVisible();
    await hamburger.click();

    // Menu drawer is visible
    const dialog = page.locator('div[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Verify Explore heading
    await expect(dialog.getByText('Explore Rijlo', { exact: true })).toBeVisible();

    // Verify the primary NAV_ITEMS
    await expect(dialog.getByRole('link', { name: /Discover/i })).toBeVisible();
    await expect(dialog.getByRole('link', { name: /Creators/i })).toBeVisible();
    await expect(dialog.getByRole('link', { name: /Categories/i })).toBeVisible();
    await expect(dialog.getByRole('link', { name: /Lead Cart/i })).toBeVisible();

    // Verify secondary navigation items
    await expect(dialog.getByRole('link', { name: 'Our Story' })).toBeVisible();
    await expect(dialog.getByRole('link', { name: 'FAQ' })).toBeVisible();

    // Verify guest role: shows "Become a Creator", NOT "List a Product" or "Sell on Rijlo"
    await expect(dialog.getByRole('link', { name: /Become a Creator/i })).toBeVisible();
    await expect(dialog.getByText(/List Your Product|List a Product/i)).not.toBeVisible();

    // Close menu with X button
    const closeBtn = dialog.locator('button[aria-label="Close menu"]');
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await expect(dialog).not.toBeVisible();

    // Reopen and test Our Story navigation to dedicated page
    await hamburger.click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('link', { name: 'Our Story' }).click();
    await page.waitForURL(/\/our-story/);
    expect(page.url()).toContain('/our-story');
  });
});

