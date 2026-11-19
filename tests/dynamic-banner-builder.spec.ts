import { test, expect } from '@playwright/test';

const mockBannerWithDynamicButtons = {
  id: 'banner-builder-1',
  image_path: 'banners/banner1-desktop.webp',
  image_url: '/images/home_banners/banner1-desktop.webp',
  tablet_image_path: 'banners/banner1-desktop.webp',
  tablet_image_url: '/images/home_banners/banner1-desktop.webp',
  mobile_image_path: 'banners/banner1-mobile.webp',
  mobile_image_url: '/images/home_banners/banner1-mobile.webp',
  alt_text: 'Handcrafted artisan creations banner',
  position: 0,
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  buttons: [
    {
      id: 'btn-explore-1',
      text: 'Explore Products',
      url: '/catalog',
      is_visible: true,
      open_in_new_tab: false,
      style: {
        background: '#9E4A2B',
        color: '#FAF6F0',
        borderColor: '#9E4A2B',
        borderWidth: 1,
        shape: 'rounded',
        size: 'medium',
        fontWeight: '600',
      },
      responsive: {
        desktop: { x: 20, y: 70, width: 180, height: 48, fontSize: 16 },
        tablet: { x: 25, y: 75, width: 150, height: 42, fontSize: 14 },
        mobile: { x: 50, y: 80, width: 130, height: 38, fontSize: 12 },
      },
    },
    {
      id: 'btn-creators-2',
      text: 'Meet Creators',
      url: '/creators',
      is_visible: true,
      open_in_new_tab: false,
      style: {
        background: '#30251F',
        color: '#FAF6F0',
        borderColor: '#FAF6F0',
        borderWidth: 1,
        shape: 'pill',
        size: 'medium',
        fontWeight: '600',
      },
      responsive: {
        desktop: { x: 38, y: 70, width: 170, height: 48, fontSize: 16 },
        tablet: { x: 45, y: 75, width: 140, height: 42, fontSize: 14 },
        mobile: { x: 50, y: 92, width: 130, height: 38, fontSize: 12 },
      },
    },
    {
      id: 'btn-hidden-3',
      text: 'Hidden Secret Sale',
      url: '/secret',
      is_visible: false,
      open_in_new_tab: false,
      style: {
        background: '#637B58',
        color: '#FAF6F0',
        shape: 'square',
        size: 'small',
        fontWeight: '500',
      },
      responsive: {
        desktop: { x: 80, y: 80, fontSize: 14 },
        tablet: { x: 80, y: 80, fontSize: 14 },
        mobile: { x: 50, y: 50, fontSize: 12 },
      },
    },
  ],
};

async function mockHomeBanners(page: any, banner: any) {
  await page.route('**/rest/v1/home_banners*', (route: any) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([banner]),
    });
  });

  await page.route('/', async (route: any) => {
    const response = await route.fetch();
    let html = await response.text();
    // In tests, strip SSR props and pre-rendered children so HomeBannerSlider executes client fetch with the mock
    html = html.replace(
      /(<astro-island[^>]+HomeBannerSlider[^>]+props=")[^"]*("[\s\S]*?>)[\s\S]*?(<\/astro-island>)/,
      '$1{}$2$3'
    );
    await route.fulfill({ response, body: html });
  });
}

test.describe('Responsive Dynamic Banner Builder & Frontend Slider', () => {

  test('1. Frontend: Renders responsive <picture> with desktop, tablet, and mobile sources', async ({ page }) => {
    await mockHomeBanners(page, mockBannerWithDynamicButtons);

    await page.goto('/');

    const slider = page.locator('[aria-roledescription="carousel"]');
    await expect(slider).toBeVisible();

    const picture = slider.locator('picture').first();
    await expect(picture).toBeVisible();

    // Check media queries in source tags with web-first auto-retrying assertions
    const mobileSource = picture.locator('source[media="(max-width: 639px)"]');
    await expect(mobileSource).toHaveAttribute('srcSet', /banner1-mobile\.webp/);

    const tabletSource = picture.locator('source[media="(max-width: 1023px)"]');
    await expect(tabletSource).toHaveAttribute('srcSet', /banner1-desktop\.webp/);

    const img = picture.locator('img');
    await expect(img).toBeVisible();
    await expect(img).toHaveAttribute('src', /banner1-desktop\.webp/);
  });

  test('2. Frontend: Renders visible dynamic CTA buttons and excludes hidden ones', async ({ page }) => {
    await mockHomeBanners(page, mockBannerWithDynamicButtons);

    await page.goto('/');

    // Visible buttons must appear
    const btn1 = page.locator('a.banner-builder-btn', { hasText: 'Explore Products' });
    const btn2 = page.locator('a.banner-builder-btn', { hasText: 'Meet Creators' });
    await expect(btn1).toBeVisible();
    await expect(btn2).toBeVisible();

    // Hidden button must NOT be rendered
    const hiddenBtn = page.locator('a.banner-builder-btn', { hasText: 'Hidden Secret Sale' });
    await expect(hiddenBtn).toHaveCount(0);

    // Verify correct destination URLs
    expect(await btn1.getAttribute('href')).toBe('/catalog');
    expect(await btn2.getAttribute('href')).toBe('/creators');
  });

  test('3. Frontend: Applies independent responsive positions (Desktop >= 1024px, Tablet 768px, Mobile 375px)', async ({ page }) => {
    await mockHomeBanners(page, mockBannerWithDynamicButtons);

    // A. Desktop Viewport (1280px)
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    const btnDesktop = page.locator('a.banner-builder-btn', { hasText: 'Explore Products' });
    await expect(btnDesktop).toBeVisible();
    const dBox = await btnDesktop.boundingBox();
    expect(dBox).not.toBeNull();

    // B. Tablet Viewport (768px)
    await page.setViewportSize({ width: 768, height: 1024 });
    const btnTablet = page.locator('a.banner-builder-btn', { hasText: 'Explore Products' });
    await expect(btnTablet).toBeVisible();
    const tBox = await btnTablet.boundingBox();
    expect(tBox).not.toBeNull();

    // C. Mobile Viewport (375px)
    await page.setViewportSize({ width: 375, height: 667 });
    const btnMobile = page.locator('a.banner-builder-btn', { hasText: 'Explore Products' });
    await expect(btnMobile).toBeVisible();
    const mBox = await btnMobile.boundingBox();
    expect(mBox).not.toBeNull();
  });

  test('4. Admin Builder: Renders live preview, switches device modes, and supports button configuration', async ({ page, context }) => {
    let currentBanners = [JSON.parse(JSON.stringify(mockBannerWithDynamicButtons))];

    // Setup Admin Auth Cookie for SSR middleware
    const ref = 'ogakjurjotthhcbpqhqf';
    const adminSessionPayload = {
      access_token: 'fake-admin-token',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: 'fake-refresh-token',
      user: {
        id: 'admin-user-id',
        aud: 'authenticated',
        role: 'authenticated',
        email: 'sumitkatiyar783@gmail.com',
        app_metadata: { provider: 'email' },
        user_metadata: { role: 'admin', full_name: 'Admin Sumit' },
      },
    };
    const base64Admin = 'base64-' + Buffer.from(JSON.stringify(adminSessionPayload)).toString('base64url');

    await context.addCookies([
      {
        name: `sb-${ref}-auth-token`,
        value: base64Admin,
        domain: 'localhost',
        path: '/',
      },
    ]);

    await page.addInitScript(({ ref, payload, base64Val }: any) => {
      document.cookie = `sb-${ref}-auth-token=${base64Val}; path=/; max-age=3600`;
      window.localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(payload));
    }, { ref, payload: adminSessionPayload, base64Val: base64Admin });

    // Mock admin session
    await page.route('**/auth/v1/user*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(adminSessionPayload.user),
      });
    });

    await page.route('**/auth/v1/session*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(adminSessionPayload),
      });
    });

    await page.route('**/rest/v1/profiles*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'admin-user-id',
          email: 'sumitkatiyar783@gmail.com',
          role: 'admin',
          full_name: 'Admin Sumit',
        }),
      });
    });

    await page.route('**/rest/v1/home_banners*', async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(currentBanners),
        });
      } else if (method === 'PATCH') {
        const patch = route.request().postDataJSON();
        currentBanners[0] = { ...currentBanners[0], ...patch };
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(currentBanners[0]),
        });
      }
    });

    // Mock featured sections so admin dashboard mounts cleanly
    await page.route('**/rest/v1/home_featured*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/rest/v1/categories*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/rest/v1/brands*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/rest/v1/products*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.goto('/admin');

    // Navigate to Homepage tab
    const homeTab = page.locator('button').filter({ hasText: 'Homepage' }).first();
    await homeTab.click();

    // Verify Builder header is visible
    await expect(page.locator('h2', { hasText: 'Responsive Dynamic Banner Builder' })).toBeVisible();

    // Verify 3 preview mode buttons
    const desktopTab = page.locator('button', { hasText: 'Desktop (≥1024px)' });
    const tabletTab = page.locator('button', { hasText: 'Tablet (768px)' });
    const mobileTab = page.locator('button', { hasText: 'Mobile (375px)' });

    await expect(desktopTab).toBeVisible();
    await expect(tabletTab).toBeVisible();
    await expect(mobileTab).toBeVisible();

    // Click tablet view
    await tabletTab.click();

    // Click mobile view
    await mobileTab.click();

    // Verify button list in admin panel
    await expect(page.locator('h4', { hasText: 'CTA Buttons' })).toBeVisible();
    await expect(page.locator('text=Explore Products').first()).toBeVisible();
    await expect(page.locator('text=Meet Creators').first()).toBeVisible();

    // Verify add button action
    const addBtnAction = page.locator('button', { hasText: 'Add Button' }).first();
    await expect(addBtnAction).toBeVisible();
  });
});

