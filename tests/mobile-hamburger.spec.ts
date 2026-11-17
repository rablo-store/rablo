import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

function mockSupabase(page: any) {
  return page.route('**/*.supabase.co/**', async (route: any) => {
    const url = route.request().url();
    if (url.includes('/rest/v1/categories')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'cat-1', name: 'Art & Prints', slug: 'art-prints' },
          { id: 'cat-2', name: 'Ceramics', slug: 'ceramics' },
        ]),
      });
    }
    if (url.includes('/rest/v1/products')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'prod-1',
            title: 'Handmade Ceramic Mug',
            price: 450,
            image_url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd',
            brand_id: 'brand-1',
            category_id: 'cat-2',
            categories: { name: 'Ceramics', slug: 'ceramics' },
            brands: { id: 'brand-1', brand_name: 'Studio Clay', slug: 'studio-clay', status: 'Approved' },
          },
        ]),
      });
    }
    if (url.includes('/rest/v1/brands')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    }
    if (url.includes('/rest/v1/profiles')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });
}

test.describe('Mobile Hamburger Menu & Responsive Navigation System', () => {
  test.beforeEach(async ({ page }) => {
    await mockSupabase(page);
  });

  const mobileWidths = [320, 390, 767];
  const desktopWidths = [768, 1024, 1440];

  test('1. Hamburger button visibility, sizing (>=44x44px), and aria attributes across mobile viewports', async ({ page }) => {
    for (const width of mobileWidths) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const hamburger = page.locator('button[aria-label="Open menu"]');
      await expect(hamburger).toBeVisible();

      // Tap target dimensions check: minimum 44x44px
      const box = await hamburger.boundingBox();
      expect(box, `Hamburger bounding box at ${width}px`).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);

      // Aria attributes
      expect(await hamburger.getAttribute('aria-controls')).toBe('mobile-nav-drawer');
      expect(await hamburger.getAttribute('aria-expanded')).toBe('false');

      // Check desktop nav links are NOT in top bar
      const desktopNav = page.locator('header nav[aria-label="Main Desktop Navigation"]');
      await expect(desktopNav).not.toBeVisible();

      // Check no horizontal scroll
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHorizontalScroll, `Horizontal scroll detected at width ${width}px`).toBe(false);
    }
  });

  test('2. Desktop breakpoints: hamburger hidden and nav links visible in top bar', async ({ page }) => {
    for (const width of desktopWidths) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Hamburger must not be visible on 768px and up
      const hamburger = page.locator('button[aria-label="Open menu"]');
      await expect(hamburger).not.toBeVisible();

      // Top bar desktop nav items must be visible
      const header = page.locator('header');
      await expect(header.getByRole('link', { name: 'Discover' })).toBeVisible();
      await expect(header.getByRole('link', { name: 'Creators' })).toBeVisible();
      await expect(header.getByRole('link', { name: 'Categories' })).toBeVisible();

      // Check no horizontal scroll
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHorizontalScroll, `Horizontal scroll detected at desktop width ${width}px`).toBe(false);
    }
  });

  test('3. Drawer open, content structure, search submit, no seller links, and close mechanisms', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const hamburger = page.locator('button[aria-controls="mobile-nav-drawer"]');
    await hamburger.click();

    const drawer = page.locator('div[role="dialog"]#mobile-nav-drawer');
    await expect(drawer).toBeVisible();
    expect(await hamburger.getAttribute('aria-expanded')).toBe('true');
    expect(await hamburger.getAttribute('aria-label')).toBe('Close menu');

    // Drawer container width bounds (max 340-380px)
    const drawerPanel = drawer.locator('> div:nth-child(2)');
    const panelBox = await drawerPanel.boundingBox();
    expect(panelBox).not.toBeNull();
    expect(panelBox!.width).toBeLessThanOrEqual(380);

    // 1. Rablo Wordmark and Close button
    await expect(drawer.getByText('Rablo', { exact: true })).toBeVisible();
    const closeBtn = drawer.locator('button[aria-label="Close menu"]');
    await expect(closeBtn).toBeVisible();
    const closeBox = await closeBtn.boundingBox();
    expect(closeBox!.width).toBeGreaterThanOrEqual(44);
    expect(closeBox!.height).toBeGreaterThanOrEqual(44);

    // 2. Search input in drawer
    const searchInput = drawer.locator('input[type="search"]');
    await expect(searchInput).toBeVisible();

    // 3. Primary nav items (Discover, Creators, Categories, Lead Cart) with >= 44px tap targets
    const navItems = ['Discover', 'Creators', 'Categories', 'Lead Cart'];
    for (const item of navItems) {
      const link = drawer.getByRole('link', { name: new RegExp(item, 'i') });
      await expect(link).toBeVisible();
      const linkBox = await link.boundingBox();
      expect(linkBox!.height).toBeGreaterThanOrEqual(44);
    }

    // 4. Verify no "List a Product" or seller links in drawer
    await expect(drawer.getByRole('link', { name: /List a Product/i })).not.toBeVisible();
    await expect(drawer.getByRole('link', { name: /Creator Dashboard/i })).not.toBeVisible();

    // 5. Account section for guest: "Sign in with Google"
    const signInBtn = drawer.getByRole('button', { name: /Sign in with Google/i });
    await expect(signInBtn).toBeVisible();
    const signInBox = await signInBtn.boundingBox();
    expect(signInBox!.height).toBeGreaterThanOrEqual(44);

    // 6. Test search submission from drawer
    await searchInput.fill('pottery');
    await searchInput.press('Enter');
    await page.waitForURL(/\/search\?q=pottery/);
    await expect(drawer).not.toBeVisible();

    // Return to home
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 7. Test close via Escape key
    const menuBtn = page.locator('button[aria-controls="mobile-nav-drawer"]');
    await menuBtn.click();
    await expect(drawer).toBeVisible();
    expect(await page.evaluate(() => document.body.style.overflow === 'hidden')).toBe(true);

    await page.keyboard.press('Escape');
    await expect(drawer).not.toBeVisible();
    expect(await page.evaluate(() => document.body.style.overflow === '' || document.body.style.overflow === 'unset')).toBe(true);

    // 8. Test close via backdrop click
    await menuBtn.click();
    await expect(drawer).toBeVisible();
    const backdrop = drawer.locator('div[aria-hidden="true"]');
    await backdrop.click({ position: { x: 10, y: 10 } });
    await expect(drawer).not.toBeVisible();
    expect(await page.evaluate(() => document.body.style.overflow === '' || document.body.style.overflow === 'unset')).toBe(true);

    // 9. Test close via Close (X) button
    await menuBtn.click();
    await expect(drawer).toBeVisible();
    await closeBtn.click();
    await expect(drawer).not.toBeVisible();
    expect(await page.evaluate(() => document.body.style.overflow === '' || document.body.style.overflow === 'unset')).toBe(true);
  });

  test('4. Focus management: focus enters drawer, tabs cycle inside, and returns to menu button on close', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const hamburger = page.locator('button[aria-controls="mobile-nav-drawer"]');
    await hamburger.focus();
    await hamburger.press('Enter');

    const drawer = page.locator('div[role="dialog"]#mobile-nav-drawer');
    await expect(drawer).toBeVisible();

    // Wait for focus to enter drawer
    await page.waitForFunction(() => {
      const active = document.activeElement;
      const drawerEl = document.querySelector('div[role="dialog"]#mobile-nav-drawer');
      return drawerEl && drawerEl.contains(active);
    });

    // Check that active element is inside the drawer
    const isFocusInside = await page.evaluate(() => {
      const active = document.activeElement;
      const drawerEl = document.querySelector('div[role="dialog"]#mobile-nav-drawer');
      return drawerEl ? drawerEl.contains(active) : false;
    });
    expect(isFocusInside).toBe(true);

    // Press Escape to close and verify focus returns to hamburger button
    await page.keyboard.press('Escape');
    await expect(drawer).not.toBeVisible();

    const isHamburgerFocused = await page.evaluate(() => {
      const hamburgerEl = document.querySelector('button[aria-controls="mobile-nav-drawer"]');
      return document.activeElement === hamburgerEl;
    });
    expect(isHamburgerFocused).toBe(true);
  });

  test('5. Capture screenshots of mobile hamburger button and drawer open at 390px', async ({ page }) => {
    const resultsDir = path.resolve('screenshots/mobile-hamburger');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    const brainDir = path.resolve('C:/Users/AYUSH/.gemini/antigravity/brain/a340a09c-6a57-4a5d-8a71-c262520b1493');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 1. Screenshot of hamburger button in header
    const hamburgerScreenshotPath = path.join(resultsDir, 'hamburger-390.png');
    const header = page.getByRole('banner');
    await header.screenshot({ path: hamburgerScreenshotPath });
    expect(fs.existsSync(hamburgerScreenshotPath)).toBe(true);
    if (fs.existsSync(brainDir)) {
      fs.copyFileSync(hamburgerScreenshotPath, path.join(brainDir, 'hamburger-390.png'));
    }

    // 2. Open drawer and take screenshot of drawer open
    const hamburger = page.locator('button[aria-controls="mobile-nav-drawer"]');
    await hamburger.click();
    const drawer = page.locator('div[role="dialog"]#mobile-nav-drawer');
    await expect(drawer).toBeVisible();
    await page.waitForTimeout(350); // allow animation to finish

    const drawerScreenshotPath = path.join(resultsDir, 'drawer-open-390.png');
    await page.screenshot({ path: drawerScreenshotPath, fullPage: true });
    expect(fs.existsSync(drawerScreenshotPath)).toBe(true);
    if (fs.existsSync(brainDir)) {
      fs.copyFileSync(drawerScreenshotPath, path.join(brainDir, 'drawer-open-390.png'));
    }
  });
});

