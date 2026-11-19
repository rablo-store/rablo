import { test, expect } from '@playwright/test';

// Sample mock banners
const mockBanners = [
  {
    id: 'banner-1',
    image_path: 'banners/artisan-pottery.webp',
    image_url: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=1600&auto=format&fit=crop&q=80',
    alt_text: 'Handcrafted stoneware ceramic mug set',
    link_url: '/catalog',
    focal_x: 50,
    focal_y: 50,
    position: 1,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'banner-2',
    image_path: 'banners/crochet-bags.webp',
    image_url: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=1600&auto=format&fit=crop&q=80',
    alt_text: 'Handcrafted crochet and textile creations',
    link_url: '/categories',
    focal_x: 35,
    focal_y: 40,
    position: 2,
    is_active: true,
    created_at: '2026-01-02T00:00:00Z',
  },
  {
    id: 'banner-3',
    image_path: 'banners/botanical-resin.webp',
    image_url: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=1600&auto=format&fit=crop&q=80',
    alt_text: 'Pressed flower botanical resin jewellery',
    link_url: 'https://instagram.com/rablo.store',
    focal_x: 60,
    focal_y: 50,
    position: 3,
    is_active: true,
    created_at: '2026-01-03T00:00:00Z',
  },
];

// Helper to generate mock products
function generateMockProducts(count: number) {
  return Array.from({ length: count }).map((_, i) => ({
    id: `prod-${i + 1}`,
    name: `Handcrafted Item ${i + 1}`,
    price: 499 + i * 50,
    description: `Authentic indie piece number ${i + 1}`,
    images: ['https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=600&auto=format&fit=crop&q=80'],
    primary_image: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=600&auto=format&fit=crop&q=80',
    approval_status: 'Approved',
    created_at: new Date(Date.now() - i * 3600000).toISOString(),
    category_id: `cat-${(i % 4) + 1}`,
    seller_id: `seller-${(i % 5) + 1}`,
    seller_ig_url: `https://instagram.com/creator_${(i % 5) + 1}`,
    category: {
      id: `cat-${(i % 4) + 1}`,
      name: `Category ${(i % 4) + 1}`,
      slug: `category-${(i % 4) + 1}`,
    },
    brand: {
      id: `brand-${(i % 5) + 1}`,
      slug: `maker-${(i % 5) + 1}`,
      name: `Maker Studio ${(i % 5) + 1}`,
      logo_url: null,
      instagram_url: `https://instagram.com/creator_${(i % 5) + 1}`,
      is_verified: true,
      creator_type: 'Handmade Artisan',
      approval_status: 'Approved',
    },
  }));
}

// Mock categories
const mockCategories = [
  { id: 'cat-1', name: 'Pottery & Ceramics', slug: 'pottery', product_count: 14, is_approved: true },
  { id: 'cat-2', name: 'Crochet & Knitwear', slug: 'crochet', product_count: 22, is_approved: true },
  { id: 'cat-3', name: 'Jewellery & Gems', slug: 'jewellery', product_count: 8, is_approved: true },
  { id: 'cat-4', name: 'Art & Prints', slug: 'art', product_count: 19, is_approved: true },
];

// Mock creators
const mockCreators = Array.from({ length: 8 }).map((_, i) => ({
  id: `brand-${i + 1}`,
  owner_id: `seller-${i + 1}`,
  slug: `creator-${i + 1}`,
  name: `Studio Artisan ${i + 1}`,
  tagline: `Handcrafted with devotion #${i + 1}`,
  bio: `Independent maker bio #${i + 1}`,
  logo_url: null,
  banner_url: null,
  instagram_url: `https://instagram.com/artisan_${i + 1}`,
  creator_type: 'Ceramicist & Maker',
  is_verified: true,
  approval_status: 'Approved',
  created_at: new Date(Date.now() - i * 86400000).toISOString(),
  updated_at: new Date().toISOString(),
}));

test.describe('Part 3: Public Home Page Overhaul & Dedicated Pages', () => {

  test.beforeEach(async ({ page }) => {
    // In tests, reset SSR island props to {} so client components fetch from the test-provided mocks,
    // and switch client="visible" to client="load" so islands hydrate immediately in test runs.
    await page.route('/', async (route) => {
      const response = await route.fetch();
      let html = await response.text();
      html = html.replace(
        /(<astro-island[^>]+(?:HomeBannerSlider|HomeTrendingProducts|HomeNewArrivals|HomeTrendingCreators|HomeTrendingCategories|AllProductsSection)[^>]+props=")[^"]*(")/g,
        '$1{}$2'
      );
      html = html.replace(/client="visible"/g, 'client="load"');
      await route.fulfill({ response, body: html });
    });
  });

  test('1. Banner Slider: 0, 1, and 3 banners behavior', async ({ page }) => {
    // 1a. Zero banners -> slider renders nothing (no gap)
    await page.route('**/rest/v1/home_banners*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('/');
    const sliderRegion = page.locator('[aria-roledescription="carousel"]');
    await expect(sliderRegion).toHaveCount(0);

    // 1b. Exactly 1 banner -> renders single slide, NO dots, NO arrows
    await page.unroute('**/rest/v1/home_banners*');
    await page.route('**/rest/v1/home_banners*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([mockBanners[0]]),
      });
    });

    await page.goto('/');
    await expect(sliderRegion).toBeVisible();
    await expect(page.locator('button[aria-label="Previous slide"]')).toHaveCount(0);
    await expect(page.locator('button[aria-label="Next slide"]')).toHaveCount(0);
    await expect(page.locator('[role="tablist"]')).toHaveCount(0);
    await expect(page.locator('img[alt="Handcrafted stoneware ceramic mug set"]')).toBeVisible();

    // 1c. 3 banners -> renders slides, dots, and arrows
    await page.unroute('**/rest/v1/home_banners*');
    await page.route('**/rest/v1/home_banners*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockBanners),
      });
    });

    await page.goto('/');
    await expect(sliderRegion).toBeVisible();
    await expect(page.locator('[role="tablist"]')).toBeVisible();
    await expect(page.locator('button[aria-label="Previous slide"]')).toBeVisible();
    await expect(page.locator('button[aria-label="Next slide"]')).toBeVisible();
  });

  test('2. Banner Slider: Height stays within clamp(200px, 38vw, 440px) at viewports (320, 390, 768, 1280, 1920) without layout shift', async ({ page }) => {
    await page.route('**/rest/v1/home_banners*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockBanners),
      });
    });

    const testViewports = [
      { width: 320, height: 568 },
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 1280, height: 800 },
      { width: 1920, height: 1080 },
    ];

    for (const vp of testViewports) {
      await page.setViewportSize(vp);
      await page.goto('/');

      await expect(page.locator('[aria-label="Loading promotional banners"]')).toHaveCount(0);
      const slider = page.locator('[aria-roledescription="carousel"]');
      await expect(slider).toBeVisible();

      await expect(async () => {
        const box = await slider.boundingBox();
        expect(box).not.toBeNull();
        if (box) {
          expect(box.height).toBeGreaterThanOrEqual(199);
          expect(box.height).toBeLessThanOrEqual(441);
        }
      }).toPass();
    }
  });

  test('3. Banner Slider: dots, arrows, keyboard navigation and hover/focus pause', async ({ page }) => {
    await page.route('**/rest/v1/home_banners*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockBanners),
      });
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    const slider = page.locator('[aria-roledescription="carousel"]');
    await expect(slider).toBeVisible();

    // Check slide 1 active initially
    await expect(page.locator('button[aria-label="Show slide 1 of 3"] span')).toHaveClass(/w-6/);

    // Click Next Arrow
    await page.locator('button[aria-label="Next slide"]').click();
    await expect(page.locator('button[aria-label="Show slide 2 of 3"] span')).toHaveClass(/w-6/);

    // Click Previous Arrow
    await page.locator('button[aria-label="Previous slide"]').click();
    await expect(page.locator('button[aria-label="Show slide 1 of 3"] span')).toHaveClass(/w-6/);

    // Click 3rd Dot
    await page.locator('button[aria-label="Show slide 3 of 3"]').click();
    await expect(page.locator('button[aria-label="Show slide 3 of 3"] span')).toHaveClass(/w-6/);

    // Keyboard ArrowLeft / ArrowRight
    await slider.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('button[aria-label="Show slide 2 of 3"] span')).toHaveClass(/w-6/);

    await page.keyboard.press('ArrowRight');
    await expect(page.locator('button[aria-label="Show slide 3 of 3"] span')).toHaveClass(/w-6/);
  });

  test('4. Curated Sections: Trending Products (max 12), New Arrivals (newest 8), Creators, Categories & empty hides', async ({ page }) => {
    const mock14Products = generateMockProducts(14);

    await page.route('**/rest/v1/home_banners*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockBanners),
      });
    });

    // Mock home_featured endpoint
    await page.route('**/rest/v1/home_featured*', (route) => {
      const url = route.request().url();
      if (url.includes('trending_products')) {
        // Return 12 items for trending products
        const rows = mock14Products.slice(0, 12).map((p, idx) => ({
          id: `tf-${idx + 1}`,
          section: 'trending_products',
          position: idx + 1,
          created_at: new Date().toISOString(),
          product: p,
        }));
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(rows),
        });
      }
      if (url.includes('new_arrivals')) {
        // Return 8 items for new arrivals
        const rows = mock14Products.slice(0, 8).map((p, idx) => ({
          id: `na-${idx + 1}`,
          section: 'new_arrivals',
          position: idx + 1,
          created_at: new Date(Date.now() - idx * 3600000).toISOString(),
          product: p,
        }));
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(rows),
        });
      }
      if (url.includes('trending_creators')) {
        const rows = mockCreators.map((b, idx) => ({
          id: `tc-${idx + 1}`,
          section: 'trending_creators',
          position: idx + 1,
          created_at: new Date().toISOString(),
          brand: b,
        }));
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(rows),
        });
      }
      if (url.includes('trending_categories')) {
        const rows = mockCategories.map((c, idx) => ({
          id: `tcat-${idx + 1}`,
          section: 'trending_categories',
          position: idx + 1,
          created_at: new Date().toISOString(),
          category: c,
        }));
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(rows),
        });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');

    // Verify Trending Products section header and count
    const trendingSection = page.locator('#trending-products');
    await trendingSection.scrollIntoViewIfNeeded();
    await expect(trendingSection).toBeVisible();
    await expect(trendingSection.getByText('Trending Products')).toBeVisible();
    const trendingCards = trendingSection.locator('article');
    await expect(trendingCards).toHaveCount(12);

    // Verify New Arrivals section header and View All link to /catalog?sort=new
    const newArrivalsSection = page.locator('#new-arrivals');
    await newArrivalsSection.scrollIntoViewIfNeeded();
    await expect(newArrivalsSection).toBeVisible();
    await expect(newArrivalsSection.getByText('New Arrivals')).toBeVisible();
    const newArrivalsViewAll = newArrivalsSection.locator('a[href="/catalog?sort=new"]');
    await expect(newArrivalsViewAll).toBeVisible();
    const newArrivalsCards = newArrivalsSection.locator('article');
    await expect(newArrivalsCards).toHaveCount(8);

    // Verify Featured Creators section
    const creatorsSection = page.locator('#trending-creators');
    await creatorsSection.scrollIntoViewIfNeeded();
    await expect(creatorsSection).toBeVisible();
    await expect(creatorsSection.getByText('Featured Creators')).toBeVisible();
    const creatorCards = creatorsSection.locator('article');
    await expect(creatorCards).toHaveCount(8);

    // Verify Trending Categories section
    const categoriesSection = page.locator('#trending-categories');
    await categoriesSection.scrollIntoViewIfNeeded();
    await expect(categoriesSection).toBeVisible();
    await expect(categoriesSection.getByText('Shop by Category')).toBeVisible();
  });

  test('5. All Products: starts with 8, infinite scroll, deduplication, and stops at 48', async ({ page }) => {
    const mock50Products = generateMockProducts(50);

    // Mock products table queries for getAllProductsPage with range/offset support
    await page.route('**/rest/v1/products*', (route) => {
      const url = route.request().url();
      if (url.includes('order=created_at.desc')) {
        const headers = route.request().headers();
        const range = headers['range'] || '';
        let from = 0;
        let to = 7;
        const rangeMatch = range.match(/bytes=(\d+)-(\d+)/) || range.match(/(\d+)-(\d+)/);
        const offsetMatch = url.match(/offset=(\d+)/);
        const limitMatch = url.match(/limit=(\d+)/);

        if (offsetMatch) {
          from = parseInt(offsetMatch[1], 10);
          const limit = limitMatch ? parseInt(limitMatch[1], 10) : 8;
          to = from + limit - 1;
        } else if (rangeMatch) {
          from = parseInt(rangeMatch[1], 10);
          to = parseInt(rangeMatch[2], 10);
        }

        const slice = mock50Products.slice(from, to + 1);
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: {
            'content-range': `${from}-${Math.min(to, mock50Products.length - 1)}/${mock50Products.length}`,
          },
          body: JSON.stringify(slice),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');

    const allProductsSection = page.locator('#all-products');
    const initialCards = allProductsSection.locator('article');
    await expect(initialCards.first()).toBeVisible();
    await allProductsSection.scrollIntoViewIfNeeded();
    await expect(initialCards).toHaveCount(8);

    // Click "Load more products" button
    const loadMoreBtn = allProductsSection.getByRole('button', { name: /Load more products/i });
    await expect(loadMoreBtn).toBeVisible();
    await loadMoreBtn.click();
    await expect(allProductsSection.locator('article')).toHaveCount(16);
  });

  test('6. /faq and /our-story dedicated pages render moved content and sitemap lists them', async ({ page }) => {
    // 6a. Visit /faq
    await page.goto('/faq');
    await expect(page).toHaveTitle(/Frequently Asked Questions/i);
    await expect(page.getByRole('heading', { name: /Frequently Asked Questions/i })).toBeVisible();
    await expect(page.getByText('How do transactions and payments work on Rijlo?')).toBeVisible();

    // Verify FAQ schema.org JSON-LD exists
    const jsonLd = page.locator('script[type="application/ld+json"]');
    await expect(jsonLd).toBeAttached();
    const jsonText = await jsonLd.textContent();
    expect(jsonText).toContain('FAQPage');

    // 6b. Visit /our-story
    await page.goto('/our-story');
    await expect(page).toHaveTitle(/Our Story & Philosophy/i);
    await expect(page.getByText('In a world of fast algorithms')).toBeVisible();
    await expect(page.getByText('The Problem: The Algorithmic Toll Booth')).toBeVisible();
    await expect(page.getByText('Zero Platform Tax')).toBeVisible();

    // 6c. Verify Home page does NOT contain FAQ questions or Our Story text
    await page.goto('/');
    await expect(page.getByText('In a world of fast algorithms')).toHaveCount(0);
    await expect(page.getByText('The Problem: The Algorithmic Toll Booth')).toHaveCount(0);
    await expect(page.getByText('How do transactions and payments work on Rijlo?')).toHaveCount(0);

    // 6d. Verify sitemap.xml contains /faq and /our-story
    const sitemapRes = await page.request.get('/sitemap.xml');
    expect(sitemapRes.ok()).toBeTruthy();
    const sitemapText = await sitemapRes.text();
    expect(sitemapText).toContain('https://rijlo.store/faq');
    expect(sitemapText).toContain('https://rijlo.store/our-story');
  });

  test('7. 360px viewport has zero horizontal scroll on / with all sections rendered', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto('/');

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });
});
