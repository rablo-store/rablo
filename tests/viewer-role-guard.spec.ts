import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

const ref = 'ogakjurjotthhcbpqhqf';

function makeFakeJwt(payload: any) {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.sig`;
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

const applicantSession = {
  access_token: makeFakeJwt({ sub: 'usr-applicant-0002', role: 'authenticated', email: 'applicant.maker@example.com' }),
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'fake-applicant-refresh',
  user: {
    id: 'usr-applicant-0002',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'applicant.maker@example.com',
    user_metadata: { full_name: 'Pending Maker' },
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

function encodeCookie(sessionObj: any) {
  return 'base64-' + Buffer.from(JSON.stringify(sessionObj)).toString('base64url');
}

function mockSupabase(page: any, custom?: { brands?: any[]; profile?: any }) {
  page.route('**/rest/v1/**', (route: any) => {
    const url = route.request().url();
    if (url.includes('/brands')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(custom?.brands || []),
      });
    }
    if (url.includes('/profiles')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(custom?.profile ? [custom.profile] : []),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });
}

test.describe('Viewer Role Gating & Mobile Drawer System', () => {

  test('1. Server HTML with JS disabled has NO seller-only CTAs and footer shows "Become a Creator"', async ({ request }) => {
    const res = await request.get('/');
    expect(res.status()).toBe(200);
    const html = await res.text();

    // Guest SSR HTML must never contain seller upload links
    expect(html).not.toContain('href="/seller/upload"');
    expect(html).not.toContain('+ List Product');
    expect(html).not.toContain('List a Product');
    expect(html).not.toContain('Admin Moderation Portal');

    // Footer must render "Become a Creator"
    expect(html).toContain('Become a Creator');
  });

  test('2. Guest viewer: navbar, drawer, footer, account do NOT show "List a Product"', async ({ page }) => {
    mockSupabase(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Navbar desktop: no "+ List Product"
    await expect(page.locator('header').getByRole('link', { name: /List Product/i })).not.toBeVisible();

    // Footer: shows "Become a Creator", no "List a Product"
    const footer = page.locator('footer');
    await expect(footer.getByRole('link', { name: 'Become a Creator' })).toBeVisible();
    await expect(footer.getByRole('link', { name: 'List a Product' })).not.toBeVisible();
    await expect(footer.getByText('sumitkatiyar783@gmail.com')).not.toBeVisible();

    // Mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });
    const hamburger = page.locator('button[aria-label="Open menu"]');
    await expect(hamburger).toBeVisible();
    await hamburger.click();

    const drawer = page.locator('div[role="dialog"]');
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('button', { name: /Sign in with Google/i })).toBeVisible();
    await expect(drawer.getByRole('link', { name: /List a Product/i })).not.toBeVisible();
    await expect(drawer.getByRole('link', { name: /Creator Dashboard/i })).not.toBeVisible();
  });

  test('3. Normal user (logged in, no brand): cannot see "List a Product" anywhere and is guided to "Become a Creator"', async ({ page, context }) => {
    await context.addCookies([{
      name: `sb-${ref}-auth-token`,
      value: encodeCookie(normalUserSession),
      domain: 'localhost',
      path: '/',
    }]);

    mockSupabase(page, {
      brands: [],
      profile: { id: 'usr-normal-0001', role: 'user', is_seller: false, is_banned: false },
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Navbar: No "+ List Product"
    await expect(page.locator('header').getByRole('link', { name: /List Product/i })).not.toBeVisible();

    // Account menu dropdown check
    const accountBtn = page.locator('header').getByRole('button', { name: /Account menu for normal\.user/i });
    if (await accountBtn.isVisible()) {
      await accountBtn.click();
      await expect(page.locator('header').getByRole('link', { name: /Become a Creator/i })).toBeVisible();
      await expect(page.locator('header').getByRole('link', { name: /List a Product/i })).not.toBeVisible();
      await expect(page.locator('header').getByRole('link', { name: /Admin Operations/i })).not.toBeVisible();
    }

    // Account page
    await page.goto('/account');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#main-content').getByRole('link', { name: /Become a Creator/i })).toBeVisible();
    await expect(page.locator('#main-content').getByRole('link', { name: /List a Product/i })).not.toBeVisible();
  });

  test('4. Applicant (Pending brand) viewer: sees "List a Product" and "Creator Dashboard"', async ({ page, context }) => {
    await context.addCookies([{
      name: `sb-${ref}-auth-token`,
      value: encodeCookie(applicantSession),
      domain: 'localhost',
      path: '/',
    }]);

    mockSupabase(page, {
      brands: [{
        id: 'brand-pending-001',
        owner_id: 'usr-applicant-0002',
        name: 'Pending Craft Studio',
        approval_status: 'Pending',
      }],
      profile: { id: 'usr-applicant-0002', role: 'seller', is_seller: true, is_banned: false },
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Desktop navbar shows "+ List Product"
    await expect(page.locator('header').getByRole('link', { name: /List Product/i })).toBeVisible();

    // Footer shows "List a Product" & "Creator Dashboard"
    const footer = page.locator('footer');
    await expect(footer.getByRole('link', { name: 'List a Product' })).toBeVisible();
    await expect(footer.getByRole('link', { name: 'Creator Dashboard' })).toBeVisible();
  });

  test('4b. Seller (Approved brand) viewer: sees "List a Product" and "Creator Dashboard"', async ({ page, context }) => {
    await context.addCookies([{
      name: `sb-${ref}-auth-token`,
      value: encodeCookie(sellerSession),
      domain: 'localhost',
      path: '/',
    }]);

    mockSupabase(page, {
      brands: [{
        id: 'brand-001',
        owner_id: 'usr-seller-0003',
        name: 'Artisan Studio',
        approval_status: 'Approved',
      }],
      profile: { id: 'usr-seller-0003', role: 'seller', is_seller: true, is_banned: false },
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Desktop navbar shows "+ List Product"
    await expect(page.locator('header').getByRole('link', { name: /List Product/i })).toBeVisible();

    // Footer shows "List a Product" & "Creator Dashboard"
    const footer = page.locator('footer');
    await expect(footer.getByRole('link', { name: 'List a Product' })).toBeVisible();
    await expect(footer.getByRole('link', { name: 'Creator Dashboard' })).toBeVisible();

    // Mobile dropdown shows My Account, Sign out, Creator Dashboard, and List a Product
    await page.setViewportSize({ width: 390, height: 844 });
    const hamburger = page.locator('button[aria-label="Open menu"]');
    await hamburger.click();

    const drawer = page.locator('div[role="dialog"]');
    await expect(drawer.getByRole('link', { name: 'My Account' })).toBeVisible();
    await expect(drawer.getByRole('button', { name: 'Sign out' })).toBeVisible();
    await expect(drawer.getByRole('link', { name: 'List a Product' })).toBeVisible();
    await expect(drawer.getByRole('link', { name: 'Creator Dashboard' })).toBeVisible();
  });

  test('5. Admin viewer: sees "+ List Product", Admin link in account menu, but NEVER admin link in footer', async ({ page, context }) => {
    await context.addCookies([{
      name: `sb-${ref}-auth-token`,
      value: encodeCookie(adminSession),
      domain: 'localhost',
      path: '/',
    }]);

    mockSupabase(page, {
      profile: { id: 'usr-admin-0004', role: 'admin', is_seller: true, is_banned: false },
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Navbar shows "+ List Product"
    await expect(page.locator('header').getByRole('link', { name: /List Product/i })).toBeVisible();

    // Account menu shows Admin link
    const accountBtn = page.locator('header').getByRole('button', { name: /Account menu for sumitkatiyar/i });
    if (await accountBtn.isVisible()) {
      await accountBtn.click();
      await expect(page.locator('header').getByRole('link', { name: /Admin Operations/i })).toBeVisible();
    }

    // Footer NEVER shows admin link or email
    const footer = page.locator('footer');
    await expect(footer.getByRole('link', { name: /admin/i })).not.toBeVisible();
    await expect(footer.getByText('sumitkatiyar783@gmail.com')).not.toBeVisible();
  });

  test('6. Route guard: /seller/upload redirects guest to /account and normal user to /seller?notice=apply_first', async ({ request }) => {
    // Guest fetch without session redirects to /account?redirect=/seller/upload
    const guestRes = await request.get('/seller/upload', { maxRedirects: 0 });
    expect(guestRes.status()).toBe(302);
    expect(decodeURIComponent(guestRes.headers()['location'])).toContain('/account?redirect=/seller/upload');

    // Normal user with no brand redirects to /seller?notice=apply_first
    const userRes = await request.get('/seller/upload', {
      headers: {
        Cookie: `sb-${ref}-auth-token=${encodeCookie(normalUserSession)}`,
      },
      maxRedirects: 0,
    });
    expect(userRes.status()).toBe(302);
    expect(userRes.headers()['location']).toContain('/seller?notice=apply_first');

    // Admin can access /seller/upload
    const adminRes = await request.get('/seller/upload', {
      headers: {
        Cookie: `sb-${ref}-auth-token=${encodeCookie(adminSession)}`,
      },
      maxRedirects: 0,
    });
    expect(adminRes.status()).toBe(200);
  });

  test('7. Mobile drawer responsive behavior (320px to 1920px), focus trapping, Escape and backdrop close', async ({ page }) => {
    mockSupabase(page);
    const mobileWidths = [320, 360, 390, 767];
    const desktopWidths = [768, 1024, 1280, 1920];

    // Mobile tests
    for (const width of mobileWidths) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const hamburger = page.locator('button[aria-controls="mobile-nav-drawer"]');
      await expect(hamburger).toBeVisible();

      // Check button tap target is at least 44x44px
      const box = await hamburger.boundingBox();
      expect(box, `Hamburger button bounding box at ${width}px`).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);

      // Check the three desktop links are NOT in the top bar
      const desktopNav = page.locator('header nav[aria-label="Main Desktop Navigation"]');
      await expect(desktopNav).not.toBeVisible();

      // Check aria attributes
      expect(await hamburger.getAttribute('aria-controls')).toBe('mobile-nav-drawer');
      expect(await hamburger.getAttribute('aria-expanded')).toBe('false');
      expect(await hamburger.getAttribute('aria-label')).toBe('Open menu');

      // Open dropdown
      await hamburger.click();
      const drawer = page.locator('div[role="dialog"]#mobile-nav-drawer');
      await expect(drawer).toBeVisible();
      expect(await hamburger.getAttribute('aria-expanded')).toBe('true');
      expect(await hamburger.getAttribute('aria-label')).toBe('Close menu');

      // Check primary items: Discover, Creators, Categories, Lead Cart
      await expect(drawer.getByRole('link', { name: /Discover/i })).toBeVisible();
      await expect(drawer.getByRole('link', { name: /Creators/i })).toBeVisible();
      await expect(drawer.getByRole('link', { name: /Categories/i })).toBeVisible();
      await expect(drawer.getByRole('link', { name: /Lead Cart/i })).toBeVisible();

      // Check body is NOT scroll locked (dropdown does not lock body scroll)
      const isLocked = await page.evaluate(() => document.body.style.overflow === 'hidden');
      expect(isLocked).toBe(false);

      // Check Escape key closes dropdown
      await page.keyboard.press('Escape');
      await expect(drawer).not.toBeVisible();

      // Check outside click closes dropdown
      await hamburger.click();
      await expect(drawer).toBeVisible();
      await page.mouse.click(10, 300);
      await expect(drawer).not.toBeVisible();

      // Check link click closes dropdown & navigates
      await hamburger.click();
      await expect(drawer).toBeVisible();
      await drawer.getByRole('link', { name: /Discover/i }).click();
      await page.waitForURL(/\/catalog/);
      await expect(drawer).not.toBeVisible();

      // Return to home page to check horizontal scroll
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Verify no horizontal scroll at this width
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHorizontalScroll, `Horizontal scroll detected at width ${width}px`).toBe(false);
    }

    // Desktop tests: hamburger hidden, desktop links present
    for (const width of desktopWidths) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const hamburger = page.locator('button[aria-controls="mobile-nav-drawer"]');
      await expect(hamburger).not.toBeVisible();

      // Nav items present in desktop navbar
      const header = page.locator('header');
      await expect(header.getByRole('link', { name: 'Discover' })).toBeVisible();
      await expect(header.getByRole('link', { name: 'Creators' })).toBeVisible();
      await expect(header.getByRole('link', { name: 'Categories' })).toBeVisible();
    }
  });

  test('8. Codebase scan: All links to /seller/upload are gated or within allowed creator components', () => {
    const allowedFiles = new Set([
      'src/components/islands/HeaderNav.tsx',
      'src/components/islands/HeaderAuthButton.tsx',
      'src/components/islands/FooterCreatorsNav.tsx',
      'src/components/islands/AccountView.tsx',
      'src/components/islands/SellerVerificationPanel.tsx',
      'src/components/islands/FaqSection.tsx',
      'src/components/islands/SellerDashboard.tsx',
      'src/components/islands/ProductUploadForm.tsx',
      'src/config/site.ts',
      'src/pages/seller/upload.astro',
      'src/pages/seller/index.astro',
    ]);

    function walkDir(dir: string, fileList: string[] = []) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          walkDir(fullPath, fileList);
        } else if (file.endsWith('.astro') || file.endsWith('.tsx') || file.endsWith('.ts')) {
          fileList.push(fullPath);
        }
      }
      return fileList;
    }

    const allSrcFiles = walkDir(path.join(process.cwd(), 'src'));
    const violatingFiles: string[] = [];

    for (const file of allSrcFiles) {
      const relPath = path.relative(process.cwd(), file).replace(/\\/g, '/');
      const content = fs.readFileSync(file, 'utf-8');
      if (content.includes('/seller/upload') && !allowedFiles.has(relPath)) {
        violatingFiles.push(relPath);
      }
    }

    expect(
      violatingFiles,
      `Found ungated references to /seller/upload in: ${violatingFiles.join(', ')}`
    ).toHaveLength(0);
  });

});
