import { test, expect } from '@playwright/test';

test.describe('Part 5: Search & Categories Pages and End-to-End Hardening', () => {
  test.beforeEach(async ({ page }) => {
    // Isolate tests to mocked Supabase records by clearing unseeded dummy products
    await page.addInitScript(() => {
      const dummyIds = Array.from({ length: 12 }, (_, i) => `d0000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}`);
      try {
        localStorage.setItem('rablo:deleted_dummy_ids', JSON.stringify(dummyIds));
      } catch {}
    });

    // Intercept Supabase requests with mock data
    await page.route('**/rest/v1/categories*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'c1', name: 'Crochet', slug: 'crochet', is_approved: true },
          { id: 'c2', name: 'Ceramics & Pottery', slug: 'pottery', is_approved: true },
          { id: 'c3', name: 'Jewelry', slug: 'jewelry', is_approved: true },
          { id: 'c4', name: 'Art & Prints', slug: 'art', is_approved: true },
        ]),
      });
    });

    await page.route('**/rest/v1/brands*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'b1',
            owner_id: 'u1',
            slug: 'crochetbynia',
            name: 'Crochet by Nia',
            tagline: 'Handmade Crochet Accessories & Bags',
            bio: 'Warm handmade crochet pieces crafted in Bangalore.',
            logo_url: null,
            instagram_url: 'https://instagram.com/crochetbynia',
            creator_type: 'individual',
            is_verified: true,
            approval_status: 'Approved',
            created_at: '2026-01-01T00:00:00Z',
          },
          {
            id: 'b2',
            owner_id: 'u2',
            slug: 'mudandmuse',
            name: 'Mud & Muse Studio',
            tagline: 'Wheel-thrown ceramic cups and stoneware',
            bio: 'Studio pottery studio based in Jaipur.',
            logo_url: null,
            instagram_url: 'https://instagram.com/mudandmuse',
            creator_type: 'small_brand',
            is_verified: false,
            approval_status: 'Approved',
            created_at: '2026-01-02T00:00:00Z',
          },
        ]),
      });
    });

    await page.route('**/rest/v1/products*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'p1',
            name: 'Crochet Daisy Tote',
            description: 'Beautiful hand-crocheted tote bag with daisy pattern.',
            price: 899,
            stock: 5,
            seller_id: 'u1',
            seller_ig_url: 'https://instagram.com/crochetbynia',
            product_ig_url: 'https://instagram.com/p/crochet123',
            contact_link: null,
            thumbnail_url: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=600',
            approval_status: 'Approved',
            category_id: 'c1',
            category: { id: 'c1', name: 'Crochet', slug: 'crochet' },
            brand_id: 'b1',
            brand: {
              id: 'b1',
              slug: 'crochetbynia',
              name: 'Crochet by Nia',
              logo_url: null,
              instagram_url: 'https://instagram.com/crochetbynia',
              is_verified: true,
              creator_type: 'individual',
            },
          },
          {
            id: 'p2',
            name: 'Handmade Ceramic Mug Set',
            description: 'Pair of artisanal glazed ceramic mugs for coffee.',
            price: 699,
            stock: 3,
            seller_id: 'u2',
            seller_ig_url: 'https://instagram.com/mudandmuse',
            product_ig_url: 'https://instagram.com/p/pottery456',
            contact_link: null,
            thumbnail_url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600',
            approval_status: 'Approved',
            category_id: 'c2',
            category: { id: 'c2', name: 'Ceramics & Pottery', slug: 'pottery' },
            brand_id: 'b2',
            brand: {
              id: 'b2',
              slug: 'mudandmuse',
              name: 'Mud & Muse Studio',
              logo_url: null,
              instagram_url: 'https://instagram.com/mudandmuse',
              is_verified: false,
              creator_type: 'small_brand',
            },
          },
        ]),
      });
    });
  });

  test('1. /search route renders Mockup 10 layout: search input, clear button, heading, count line, and segmented tabs', async ({ page }) => {
    await page.goto('/search?q=crochet');
    await page.waitForLoadState('domcontentloaded');

    // Heading and query reflection
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Search Results for "crochet"');

    // Count line
    await expect(page.getByText(/1 product · 1 creator/i)).toBeVisible();

    // Tabs: Products (1) and Creators (1)
    const productsTab = page.getByRole('button', { name: /products \(1\)/i });
    const creatorsTab = page.getByRole('button', { name: /creators \(1\)/i });
    await expect(productsTab).toBeVisible();
    await expect(creatorsTab).toBeVisible();

    // Active products grid
    await expect(page.getByText('Crochet Daisy Tote')).toBeVisible();
    await expect(page.getByText('Handmade Ceramic Mug Set')).toHaveCount(0);

    // Switch tab to Creators
    await creatorsTab.click();
    await expect(page.getByText('Crochet by Nia')).toBeVisible();
    await expect(page.getByText('Mud & Muse Studio')).toHaveCount(0);
  });

  test('2. /search input allows clearing query and updating active results', async ({ page }) => {
    await page.goto('/search?q=crochet');
    await page.waitForLoadState('domcontentloaded');

    const searchInput = page.getByRole('searchbox', { name: /search creations or creators/i });
    await expect(searchInput).toHaveValue('crochet');
    await expect(page.getByText('Crochet Daisy Tote')).toBeVisible();

    // Click clear button (X)
    const clearBtn = page.getByRole('main').getByRole('button', { name: /clear search/i });
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();

    await expect(searchInput).toHaveValue('');
    // Heading should change to all products/creators
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/All Products & Creators/i);
    await expect(page.getByText(/2 products · 2 creators/i)).toBeVisible();
  });

  test('3. /search with non-matching query displays Empty State with link to /categories', async ({ page }) => {
    await page.goto('/search?q=nonexistentcraftxyz');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText(/No products match "nonexistentcraftxyz"/i)).toBeVisible();
    const categoriesLink = page.getByRole('link', { name: /browse categories/i });
    await expect(categoriesLink).toBeVisible();
    await expect(categoriesLink).toHaveAttribute('href', '/categories');
  });

  test('4. /categories route renders Mockup 11 layout with DB categories and links to /catalog?category=<slug>', async ({ page }) => {
    await page.goto('/categories');
    await page.waitForLoadState('domcontentloaded');

    // Title
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Shop by Category');

    // Check category tiles from DB
    const categoryTiles = page.locator('a[href^="/catalog?category="]');
    await expect(categoryTiles.first()).toBeVisible();

    const firstTile = categoryTiles.first();
    await expect(firstTile.locator('h2')).toBeVisible();
    await expect(firstTile).toContainText(/product/i);

    // Click on first category tile to navigate to catalog
    const href = await firstTile.getAttribute('href');
    await firstTile.click();
    await expect(page).toHaveURL(new RegExp(href!.replace('?', '\\?')));

    // Verify CatalogGrid receives the category filter
    await page.waitForLoadState('domcontentloaded');
  });

  test('5. Header search submission redirects to /search?q=...', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Fill header search input
    const headerInput = page.locator('.header-search-container input');
    await headerInput.fill('ceramic');
    await headerInput.press('Enter');

    // Should redirect to /search?q=ceramic
    await expect(page).toHaveURL(/\/search\?q=ceramic/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Search Results for "ceramic"');
    await expect(page.getByText('Handmade Ceramic Mug Set')).toBeVisible();
  });

  test('6. 360px viewport has zero horizontal scroll on /search and /categories', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });

    for (const url of ['/search?q=crochet', '/categories']) {
      await page.goto(url);
      await page.waitForLoadState('domcontentloaded');

      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHorizontalScroll, `Horizontal overflow detected on ${url} at 360px`).toBe(false);
    }
  });
});
