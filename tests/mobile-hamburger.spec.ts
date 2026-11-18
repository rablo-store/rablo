import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const ref = 'ogakjurjotthhcbpqhqf';

function makeFakeJwt(payload: any) {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.sig`;
}

function mockSupabase(page: any, options: { profile?: any; brands?: any[] } = {}) {
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
        body: JSON.stringify(options.brands ?? []),
      });
    }
    if (url.includes('/rest/v1/profiles')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(options.profile ? [options.profile] : []),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });
}

function encodeCookie(obj: any) {
  return 'base64-' + Buffer.from(JSON.stringify(obj)).toString('base64url');
}

const normalUserSession = {
  access_token: makeFakeJwt({ sub: 'usr-normal-0001', role: 'authenticated', email: 'normal.user@example.com' }),
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'fake-normal-refresh',
  user: {
    id: 'usr-normal-0001',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'normal.user@example.com',
    user_metadata: { full_name: 'Normal User' },
    app_metadata: { provider: 'google' },
    created_at: '2026-01-01T00:00:00.000Z',
  },
};

const sellerSession = {
  access_token: makeFakeJwt({ sub: 'usr-seller-0003', role: 'authenticated', email: 'approved.creator@example.com' }),
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'fake-seller-refresh',
  user: {
    id: 'usr-seller-0003',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'approved.creator@example.com',
    user_metadata: { full_name: 'Approved Creator' },
    app_metadata: { provider: 'google' },
    created_at: '2026-01-01T00:00:00.000Z',
  },
};

const adminSession = {
  access_token: makeFakeJwt({ sub: 'usr-admin-0004', role: 'authenticated', email: 'sumitkatiyar783@gmail.com' }),
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'fake-admin-refresh',
  user: {
    id: 'usr-admin-0004',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'sumitkatiyar783@gmail.com',
    user_metadata: { full_name: 'Sumit Katiyar' },
    app_metadata: { provider: 'google' },
    created_at: '2026-01-01T00:00:00.000Z',
  },
};

test.describe('Mobile Hamburger Dropdown Navigation System', () => {
  test.beforeEach(async ({ page }) => {
    await mockSupabase(page);
  });

  const mobileWidths = [320, 360, 390, 767];
  const desktopWidths = [768, 1024, 1280, 1920];

  test('1. Mobile widths (320, 360, 390, 767): button sizing, toggle, bounding box, elementFromPoint, navigation, outside click, and no scroll lock', async ({ page }) => {
    for (const width of mobileWidths) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const hamburger = page.locator('button[aria-controls="mobile-nav-drawer"]');
      await expect(hamburger).toBeVisible();

      // Tap target >= 44x44px
      const box = await hamburger.boundingBox();
      expect(box, `Hamburger bounding box at ${width}px`).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);

      // Aria attributes initial
      expect(await hamburger.getAttribute('aria-expanded')).toBe('false');
      expect(await hamburger.getAttribute('aria-label')).toBe('Open menu');

      // Top bar 3 links are NOT in top bar
      const desktopNav = page.locator('header nav[aria-label="Main Desktop Navigation"]');
      await expect(desktopNav).not.toBeVisible();

      // Dropdown absent before click
      const dropdown = page.locator('div[role="dialog"]#mobile-nav-drawer');
      await expect(dropdown).not.toBeVisible();

      // Click opens dropdown
      await hamburger.click();
      await expect(dropdown).toBeVisible();
      expect(await hamburger.getAttribute('aria-expanded')).toBe('true');
      expect(await hamburger.getAttribute('aria-label')).toBe('Close menu');

      // Dropdown bounding box inside viewport, height > 0
      const dropBox = await dropdown.boundingBox();
      expect(dropBox, `Dropdown box at ${width}px`).not.toBeNull();
      expect(dropBox!.height).toBeGreaterThan(0);
      expect(dropBox!.width).toBeGreaterThan(0);
      expect(dropBox!.x).toBeGreaterThanOrEqual(0);
      expect(dropBox!.x + dropBox!.width).toBeLessThanOrEqual(width + 2); // allowance for subpixel rounding

      // document.elementFromPoint at center of Discover, Creators, Categories hits the links
      for (const label of ['Discover', 'Creators', 'Categories']) {
        const link = dropdown.getByRole('link', { name: new RegExp(label, 'i') });
        await expect(link).toBeVisible();
        const linkBox = await link.boundingBox();
        expect(linkBox).not.toBeNull();
        expect(linkBox!.height).toBeGreaterThanOrEqual(48); // >=48px tap row

        const elementHit = await page.evaluate(({ x, y }) => {
          const el = document.elementFromPoint(x, y);
          return el?.closest('a')?.getAttribute('href');
        }, { x: linkBox!.x + linkBox!.width / 2, y: linkBox!.y + linkBox!.height / 2 });

        if (label === 'Discover') expect(elementHit).toBe('/catalog');
        if (label === 'Creators') expect(elementHit).toBe('/creators');
        if (label === 'Categories') expect(elementHit).toBe('/categories');
      }

      // Body is NOT scroll locked
      const isLocked = await page.evaluate(() => document.body.style.overflow === 'hidden');
      expect(isLocked).toBe(false);

      // Second click toggles closed
      await hamburger.click();
      await expect(dropdown).not.toBeVisible();
      expect(await hamburger.getAttribute('aria-expanded')).toBe('false');

      // Esc key closes
      await hamburger.click();
      await expect(dropdown).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(dropdown).not.toBeVisible();

      // Outside click closes (click at 10, 300 outside the header)
      await hamburger.click();
      await expect(dropdown).toBeVisible();
      await page.mouse.click(10, 300);
      await expect(dropdown).not.toBeVisible();

      // Link click navigates
      await hamburger.click();
      await expect(dropdown).toBeVisible();
      await dropdown.getByRole('link', { name: /Discover/i }).click();
      await page.waitForURL(/\/catalog/);
      await expect(dropdown).not.toBeVisible();

      // Return home and check horizontal scroll
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHorizontalScroll, `Horizontal scroll detected at ${width}px`).toBe(false);
    }
  });

  test('2. Touch device emulation (hasTouch: true): tapping opens dropdown once and STAYS open', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    await mockSupabase(page);

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const hamburger = page.locator('button[aria-controls="mobile-nav-drawer"]');
    await expect(hamburger).toBeVisible();

    const dropdown = page.locator('div[role="dialog"]#mobile-nav-drawer');
    await expect(dropdown).not.toBeVisible();

    // Tap hamburger once
    await hamburger.tap();

    // Assert that tapping opens once and STAYS open (verifies click/hover race condition fix)
    await expect(dropdown).toBeVisible();
    await page.waitForTimeout(300);
    await expect(dropdown).toBeVisible();

    // Tap a second time toggles closed
    await hamburger.tap();
    await expect(dropdown).not.toBeVisible();

    await context.close();
  });

  test('3. Desktop breakpoints (768, 1024, 1280, 1920): hamburger hidden and 3 links visible in top bar', async ({ page }) => {
    for (const width of desktopWidths) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Hamburger must NOT be visible
      const hamburger = page.locator('button[aria-label="Open menu"]');
      await expect(hamburger).not.toBeVisible();

      // Top bar links must be visible
      const header = page.locator('header');
      await expect(header.getByRole('link', { name: 'Discover' })).toBeVisible();
      await expect(header.getByRole('link', { name: 'Creators' })).toBeVisible();
      await expect(header.getByRole('link', { name: 'Categories' })).toBeVisible();

      // No horizontal scroll
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHorizontalScroll, `Horizontal scroll detected at desktop width ${width}px`).toBe(false);
    }
  });

  test('4. Desktop with mouse simulation at 700px (hover: hover): hover opens, moving into panel keeps open, leaving closes after delay, click while hovered keeps open', async ({ browser }) => {
    // Create fine pointer desktop context at 700px
    const context = await browser.newContext({
      viewport: { width: 700, height: 800 },
      hasTouch: false,
    });
    const page = await context.newPage();
    await mockSupabase(page);

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const hamburger = page.locator('button[aria-controls="mobile-nav-drawer"]');
    await expect(hamburger).toBeVisible();

    const dropdown = page.locator('div[role="dialog"]#mobile-nav-drawer');
    await expect(dropdown).not.toBeVisible();

    // Hover over hamburger button -> opens dropdown
    await hamburger.hover();
    await expect(dropdown).toBeVisible();

    // Move mouse into dropdown panel -> keeps it open
    await dropdown.hover();
    await page.waitForTimeout(200);
    await expect(dropdown).toBeVisible();

    // Move mouse out to body (10, 300) -> closes after 150ms delay
    await page.mouse.move(10, 300);
    await expect(dropdown).not.toBeVisible();

    // Click while hovered keeps it open (pins it)
    await hamburger.hover();
    await expect(dropdown).toBeVisible();
    await hamburger.click();
    await expect(dropdown).toBeVisible();
    // Now move mouse away: since it was clicked, it remains pinned open!
    await page.mouse.move(10, 300);
    await page.waitForTimeout(250);
    await expect(dropdown).toBeVisible();

    // Outside click now closes the pinned dropdown
    await page.mouse.click(10, 300);
    await expect(dropdown).not.toBeVisible();

    await context.close();
  });

  test('5. Role gating in dropdown: guest, user, seller, admin show correct items; "List a Product" absent for guest and user', async ({ page, context }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    // A. Guest
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const hamburger = page.locator('button[aria-controls="mobile-nav-drawer"]');
    await hamburger.click();
    const dropdown = page.locator('div[role="dialog"]#mobile-nav-drawer');
    await expect(dropdown).toBeVisible();

    await expect(dropdown.getByRole('link', { name: /Discover/i })).toBeVisible();
    await expect(dropdown.getByRole('link', { name: /Creators/i })).toBeVisible();
    await expect(dropdown.getByRole('link', { name: /Categories/i })).toBeVisible();
    await expect(dropdown.getByRole('link', { name: /Lead Cart/i })).toBeVisible();
    await expect(dropdown.getByRole('link', { name: /Our Story/i })).toBeVisible();
    await expect(dropdown.getByRole('link', { name: /FAQ/i })).toBeVisible();
    await expect(dropdown.getByRole('button', { name: /Sign in with Google/i })).toBeVisible();
    await expect(dropdown.getByRole('link', { name: /Become a Creator/i })).toBeVisible();
    // "List a Product" and "Creator Dashboard" ABSENT for guest
    await expect(dropdown.getByRole('link', { name: /List a Product/i })).not.toBeVisible();
    await expect(dropdown.getByRole('link', { name: /Creator Dashboard/i })).not.toBeVisible();
    await page.mouse.click(10, 300);

    // B. Normal user (logged in, no brand)
    await context.addCookies([{
      name: `sb-${ref}-auth-token`,
      value: encodeCookie(normalUserSession),
      domain: 'localhost',
      path: '/',
    }]);
    mockSupabase(page, {
      profile: { id: 'usr-normal-0001', role: 'user', is_seller: false, is_banned: false },
      brands: [],
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await hamburger.click();
    await expect(dropdown).toBeVisible();
    await expect(dropdown.getByRole('link', { name: /Become a Creator/i })).toBeVisible();
    await expect(dropdown.getByRole('link', { name: /List a Product/i })).not.toBeVisible();
    await expect(dropdown.getByRole('link', { name: /Creator Dashboard/i })).not.toBeVisible();
    await page.mouse.click(10, 300);

    // C. Seller (Approved brand)
    await context.addCookies([{
      name: `sb-${ref}-auth-token`,
      value: encodeCookie(sellerSession),
      domain: 'localhost',
      path: '/',
    }]);
    mockSupabase(page, {
      profile: { id: 'usr-seller-0003', role: 'seller', is_seller: true, is_banned: false },
      brands: [{ id: 'b-1', owner_id: 'usr-seller-0003', name: 'Studio Clay', approval_status: 'Approved' }],
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await hamburger.click();
    await expect(dropdown).toBeVisible();
    await expect(dropdown.getByRole('link', { name: 'List a Product' })).toBeVisible();
    await expect(dropdown.getByRole('link', { name: 'Creator Dashboard' })).toBeVisible();
    await page.mouse.click(10, 300);

    // D. Admin
    await context.addCookies([{
      name: `sb-${ref}-auth-token`,
      value: encodeCookie(adminSession),
      domain: 'localhost',
      path: '/',
    }]);
    mockSupabase(page, {
      profile: { id: 'usr-admin-0004', role: 'admin', is_seller: true, is_banned: false },
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await hamburger.click();
    await expect(dropdown).toBeVisible();
    await expect(dropdown.getByRole('link', { name: 'List a Product' })).toBeVisible();
    await expect(dropdown.getByRole('link', { name: 'Admin Panel' })).toBeVisible();
  });

  test('6. Save screenshots of open dropdown at 360px and 390px to test-results/menu/', async ({ page }) => {
    const resultsDir = path.resolve('test-results/menu');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    for (const width of [360, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const hamburger = page.locator('button[aria-controls="mobile-nav-drawer"]');
      await hamburger.click();
      const dropdown = page.locator('div[role="dialog"]#mobile-nav-drawer');
      await expect(dropdown).toBeVisible();
      await page.waitForTimeout(200); // allow 140ms animation to complete

      const screenshotPath = path.join(resultsDir, `dropdown-${width}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      expect(fs.existsSync(screenshotPath)).toBe(true);
    }
  });
});
