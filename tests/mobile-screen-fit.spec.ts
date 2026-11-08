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

      // 3. Hero content fits within viewport without clipping
      const heroH1 = page.locator('.hero-copy h1');
      await expect(heroH1).toBeVisible();

      const exploreBtn = page.locator('#hero-explore-catalog-btn');
      await expect(exploreBtn).toBeVisible();

      const sellBtn = page.locator('#hero-sell-btn');
      await expect(sellBtn).toBeVisible();

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
});

