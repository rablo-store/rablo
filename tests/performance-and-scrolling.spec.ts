import { test, expect } from '@playwright/test';

// Deterministic mock products with pre-generated multi-variant WebP URLs
const mockProducts = Array.from({ length: 16 }).map((_, i) => ({
  id: `prod-perf-${i + 1}`,
  name: `Artisan Performance Product ${i + 1}`,
  price: 799 + i * 20,
  description: `High performance artisan craft item ${i + 1}`,
  images: [
    `https://ogakjurjotthhcbpqhqf.supabase.co/storage/v1/object/public/product-images/test_user/item_${i + 1}-450.webp`,
  ],
  thumbnail_url: `https://ogakjurjotthhcbpqhqf.supabase.co/storage/v1/object/public/product-images/test_user/item_${i + 1}-450.webp`,
  primary_image: `https://ogakjurjotthhcbpqhqf.supabase.co/storage/v1/object/public/product-images/test_user/item_${i + 1}-450.webp`,
  approval_status: 'Approved',
  created_at: new Date(Date.now() - i * 3600000).toISOString(),
  category_id: 'cat-1',
  seller_id: 'seller-1',
  seller_ig_url: 'https://instagram.com/artisan_creator',
  category: {
    id: 'cat-1',
    name: 'Handcrafted Pottery',
    slug: 'pottery',
  },
  brand: {
    id: 'brand-1',
    slug: 'clay-studio',
    name: 'Clay Studio',
    logo_url: 'https://ogakjurjotthhcbpqhqf.supabase.co/storage/v1/object/public/product-images/test_user/logo.webp',
    instagram_url: 'https://instagram.com/clay_studio',
    is_verified: true,
    creator_type: 'Pottery Maker',
    approval_status: 'Approved',
  },
}));

async function setupMockRoutes(page: any) {
  // 1. Mock home banners
  await page.route('**/rest/v1/home_banners*', (route: any) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'banner-perf-1',
          image_path: 'banners/banner1-desktop.webp',
          image_url: 'https://ogakjurjotthhcbpqhqf.supabase.co/storage/v1/object/public/product-images/test_user/banner1-desktop.webp',
          alt_text: 'Performance banner slider',
          position: 1,
          is_active: true,
          created_at: '2026-01-01T00:00:00Z',
        },
      ]),
    });
  });

  // 2. Mock featured sections (trending products, new arrivals)
  await page.route('**/rest/v1/home_featured*', (route: any) => {
    const rows = mockProducts.slice(0, 8).map((p, idx) => ({
      id: `feat-${idx + 1}`,
      section: 'trending_products',
      position: idx + 1,
      created_at: new Date().toISOString(),
      product: p,
    }));
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(rows),
    });
  });

  // 3. Mock products table queries
  await page.route('**/rest/v1/products*', (route: any) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockProducts),
    });
  });

  // 4. Mock categories
  await page.route('**/rest/v1/categories*', (route: any) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 'cat-1', name: 'Handcrafted Pottery', slug: 'pottery', is_approved: true },
      ]),
    });
  });

  // 5. Intercept synthetic image loads with a 1x1 WebP payload so scrolling doesn't hang
  await page.route('**/storage/v1/object/public/product-images/**', (route: any) => {
    // 1x1 transparent WebP image base64
    const tinyWebp = Buffer.from(
      'UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAQAcJaQAA3AA/v3AgAA=',
      'base64'
    );
    route.fulfill({
      status: 200,
      contentType: 'image/webp',
      headers: {
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
      body: tinyWebp,
    });
  });
}

test.describe('Phase 10: Performance & Image Scrolling Verification', () => {

  test('1. ProductCard delivers responsive WebP srcset and async decoding without /render/image/', async ({ page }) => {
    await setupMockRoutes(page);
    await page.goto('/');

    // Wait for at least one product card to be present in curated section
    const firstCard = page.locator('article').first();
    await expect(firstCard).toBeVisible({ timeout: 10000 });

    // Verify product image attributes
    const firstImg = firstCard.locator('img').first();
    await expect(firstImg).toBeVisible();

    const src = await firstImg.getAttribute('src');
    expect(src).toBeTruthy();
    expect(src).toContain('-450.webp');
    expect(src).not.toContain('/render/image/');

    const srcset = await firstImg.getAttribute('srcset');
    expect(srcset).toBeTruthy();
    expect(srcset).toContain('-200.webp 200w');
    expect(srcset).toContain('-450.webp 450w');
    expect(srcset).toContain('-1000.webp 1000w');
    expect(srcset).not.toContain('/render/image/');

    const decoding = await firstImg.getAttribute('decoding');
    expect(decoding).toBe('async');

    const sizes = await firstImg.getAttribute('sizes');
    expect(sizes).toBeTruthy();
    expect(sizes).toContain('50vw');

    // Verify aspect ratio container exists to avoid Cumulative Layout Shift (CLS)
    const imgContainer = firstCard.locator('.aspect-square').first();
    await expect(imgContainer).toBeVisible();
  });

  test('2. Product details delivers hero image with high fetchpriority and async decoding', async ({ page }) => {
    await setupMockRoutes(page);
    await page.goto('/');

    // Verify product cards are loaded
    const cards = page.locator('article');
    await expect(cards.first()).toBeVisible({ timeout: 10000 });

    // Check eager priority on hero product cards
    const priorityImg = cards.first().locator('img').first();
    const loading = await priorityImg.getAttribute('loading');
    expect(loading).toBe('eager');

    const fetchPriority = await priorityImg.getAttribute('fetchpriority');
    expect(fetchPriority).toBe('high');

    const decoding = await priorityImg.getAttribute('decoding');
    expect(decoding).toBe('async');
  });

  test('3. Scrolling down and back up preserves loaded image state without duplicate network requests', async ({ page }) => {
    await setupMockRoutes(page);
    await page.goto('/');

    const cards = page.locator('article');
    await expect(cards.first()).toBeVisible({ timeout: 10000 });

    // Capture initial image URLs of the first 2 visible cards
    const initialSrc1 = await cards.nth(0).locator('img').first().getAttribute('src');
    const initialSrc2 = await cards.nth(1).locator('img').first().getAttribute('src');
    expect(initialSrc1).toBeTruthy();
    expect(initialSrc2).toBeTruthy();

    // Track network image requests
    const imageRequests: string[] = [];
    page.on('request', (request) => {
      if (request.resourceType() === 'image') {
        imageRequests.push(request.url());
      }
    });

    // Scroll down 1200px
    await page.evaluate(() => window.scrollBy({ top: 1200, behavior: 'instant' }));
    await page.waitForTimeout(300);

    // Scroll further down
    await page.evaluate(() => window.scrollBy({ top: 1200, behavior: 'instant' }));
    await page.waitForTimeout(300);

    const requestsAfterScrollDown = imageRequests.length;

    // Scroll back up to the top
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(400);

    // Verify first 2 cards are still visible with exact identical src
    const finalSrc1 = await cards.nth(0).locator('img').first().getAttribute('src');
    const finalSrc2 = await cards.nth(1).locator('img').first().getAttribute('src');
    expect(finalSrc1).toBe(initialSrc1);
    expect(finalSrc2).toBe(initialSrc2);

    // Verify that the browser did not issue duplicate requests for the already loaded top images
    const top1DuplicateRequests = imageRequests.slice(requestsAfterScrollDown).filter((url) => url === initialSrc1);
    expect(top1DuplicateRequests.length).toBe(0);
  });

  test('4. Homepage banner builder & curated sections continue working without regression', async ({ page }) => {
    await setupMockRoutes(page);
    await page.goto('/');

    // Check banner slider is mounted
    const bannerContainer = page.locator('[aria-roledescription="carousel"]');
    await expect(bannerContainer).toBeVisible({ timeout: 10000 });

    // Scroll down to hydrate client:visible islands
    await page.evaluate(() => window.scrollBy({ top: 800, behavior: 'instant' }));

    // All products section is present and mounted
    const allProductsSec = page.locator('#all-products');
    await expect(allProductsSec).toBeVisible({ timeout: 10000 });
  });
});
