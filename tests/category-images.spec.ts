import { test, expect } from '@playwright/test';

// Mock Supabase route calls so tests run fast, offline, and reliably
const defaultCategories = [
  {
    id: 'c0000000-0000-0000-0000-000000000001',
    name: 'Crochet',
    slug: 'crochet',
    is_approved: true,
    image_url: '/categories/crochet.webp',
  },
  {
    id: 'c0000000-0000-0000-0000-000000000002',
    name: 'Art & Prints',
    slug: 'art',
    is_approved: true,
    image_url: '/categories/art-and-prints.webp',
  },
  {
    id: 'c0000000-0000-0000-0000-000000000003',
    name: 'Mobile Accessories',
    slug: 'mobile-accessories',
    is_approved: true,
    image_url: '/categories/mobile-accessories.webp',
  },
  {
    id: 'c0000000-0000-0000-0000-000000000004',
    name: 'Jewellery',
    slug: 'jewelry',
    is_approved: true,
    image_url: '/categories/jewellery.webp',
  },
  {
    id: 'c0000000-0000-0000-0000-000000000005',
    name: 'Clothing & Apparel',
    slug: 'clothing',
    is_approved: true,
    image_url: '/categories/clothing-and-apparel.webp',
  },
  {
    id: 'c0000000-0000-0000-0000-000000000006',
    name: 'Home & Decor',
    slug: 'home-decor',
    is_approved: true,
    image_url: '/categories/home-and-decor.webp',
  },
];

async function setupAdminSession(page: any, context: any) {
  const ref = 'ogakjurjotthhcbpqhqf';
  const adminSessionPayload = {
    access_token: 'fake-admin-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'fake-refresh-token',
    user: {
      id: 'admin-0001',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'sumitkatiyar783@gmail.com',
      app_metadata: { provider: 'email' },
      user_metadata: { full_name: 'Sumit Katiyar' },
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

  await page.route('**/auth/v1/user*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(adminSessionPayload.user),
    });
  });

  await page.route('**/auth/v1/session*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(adminSessionPayload),
    });
  });

  await page.route('**/rest/v1/profiles*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([adminSessionPayload.user]),
    });
  });

  await page.route('**/rest/v1/category_requests*', async (route: any) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await page.route('**/rest/v1/brands*', async (route: any) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await page.route('**/rest/v1/home_featured*', async (route: any) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
}

function mockSupabaseRoutes(page: any) {
  return page.route('**/rest/v1/**', async (route: any) => {
    const url = route.request().url();
    const method = route.request().method();

    // Categories query
    if (url.includes('/rest/v1/categories')) {
      if (method === 'POST') {
        let postData: any = {};
        try {
          postData = route.request().postDataJSON() || {};
        } catch {
          // ignore
        }
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'c0000000-0000-0000-0000-000000000099',
            name: postData.name || 'New Category',
            slug: postData.slug || 'new-category',
            is_approved: true,
            image_url: postData.image_url || null,
          }),
        });
      }
      if (method === 'DELETE') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(defaultCategories),
      });
    }

    // Products query for counts / unlink update
    if (url.includes('/rest/v1/products')) {
      if (method === 'PATCH') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: '[]',
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'p1', category_id: 'c0000000-0000-0000-0000-000000000001', approval_status: 'Approved' },
          { id: 'p2', category_id: 'c0000000-0000-0000-0000-000000000002', approval_status: 'Approved' },
          { id: 'p3', category_id: 'c0000000-0000-0000-0000-000000000003', approval_status: 'Approved' },
        ]),
      });
    }

    return route.continue();
  });
}

test.describe('Category 1:1 Images, Mobile Accessories & Admin Functionality', () => {
  test('1. /categories renders high-resolution 1:1 square images for requested categories', async ({ page }) => {
    await mockSupabaseRoutes(page);
    await page.goto('/categories');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Shop by Category');

    // Verify all 6 requested categories are present
    const categoriesToCheck = [
      { name: 'Art & Prints', imgSubstr: 'art-and-prints.webp' },
      { name: 'Clothing & Apparel', imgSubstr: 'clothing-and-apparel.webp' },
      { name: 'Crochet', imgSubstr: 'crochet.webp' },
      { name: 'Home & Decor', imgSubstr: 'home-and-decor.webp' },
      { name: 'Jewellery', imgSubstr: 'jewellery.webp' },
      { name: 'Mobile Accessories', imgSubstr: 'mobile-accessories.webp' },
    ];

    for (const cat of categoriesToCheck) {
      const heading = page.getByRole('heading', { name: cat.name });
      await expect(heading).toBeVisible();

      // Find the card container
      const card = page.locator('a').filter({ has: heading });
      const img = card.locator('img');
      await expect(img).toBeVisible();

      // Check src contains expected webp
      const src = await img.getAttribute('src');
      expect(src).toContain(cat.imgSubstr);

      // Verify 1:1 square aspect ratio (aspect-square on container)
      const imgContainer = card.locator('div.aspect-square');
      await expect(imgContainer).toBeVisible();

      const box = await imgContainer.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        // Assert width and height are equal within 1.5px (accounting for subpixel rounding)
        expect(Math.abs(box.width - box.height)).toBeLessThanOrEqual(2);
      }
    }
  });

  test('2. Category images have object-fit cover and maintain 1:1 proportions across screen sizes', async ({ page }) => {
    await mockSupabaseRoutes(page);

    const VIEWPORTS = [360, 480, 768, 1280];
    for (const width of VIEWPORTS) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/categories');
      await page.waitForLoadState('domcontentloaded');

      // Check the first image
      const firstImg = page.locator('a div.aspect-square img').first();
      await expect(firstImg).toBeVisible();

      const objectFit = await firstImg.evaluate((el) => window.getComputedStyle(el).objectFit);
      expect(objectFit).toBe('cover');

      // Check horizontal scroll
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHorizontalScroll, `Horizontal overflow at ${width}px`).toBe(false);
    }
  });

  test('3. Mobile Accessories replaces Phone Covers and clicking navigates to catalog', async ({ page }) => {
    await mockSupabaseRoutes(page);
    await page.goto('/categories');
    await page.waitForLoadState('domcontentloaded');

    // Phone Covers should not appear as a heading
    await expect(page.getByRole('heading', { name: 'Phone Covers' })).toHaveCount(0);

    // Mobile Accessories should be present
    const mobileCat = page.locator('a[href*="mobile-accessories"]');
    await expect(mobileCat).toBeVisible();
    await expect(mobileCat.locator('h2')).toContainText('Mobile Accessories');
  });

  test('4. Admin Dashboard Categories tab displays 1:1 preview and upload functionality', async ({ page, context }) => {
    await setupAdminSession(page, context);
    await mockSupabaseRoutes(page);

    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // Click on Categories tab
    const categoriesTabBtn = page.getByRole('button', { name: /Categories/i });
    await expect(categoriesTabBtn).toBeVisible({ timeout: 10000 });
    await categoriesTabBtn.click();

    // Check Categories Manager header
    await expect(page.getByText('Category Images & Directory Manager')).toBeVisible();

    // Check Mobile Accessories card in admin
    await expect(page.getByText('Mobile Accessories')).toBeVisible();

    // Check 1:1 update button is present
    const uploadButtons = page.getByRole('button', { name: /Update 1:1 Image|Upload 1:1 Image/i });
    await expect(uploadButtons.first()).toBeVisible();
  });

  test('5. Admin can directly create a new category', async ({ page, context }) => {
    await setupAdminSession(page, context);
    await mockSupabaseRoutes(page);

    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // Click on Categories tab
    const categoriesTabBtn = page.getByRole('button', { name: /Categories/i });
    await categoriesTabBtn.click();

    // Click "New Category" button to reveal form
    const newCatBtn = page.getByRole('button', { name: /New Category/i });
    await expect(newCatBtn).toBeVisible();
    await newCatBtn.click();

    // Check form is opened
    await expect(page.getByText('Create New Category with 1:1 Cover')).toBeVisible();

    // Fill Category Name
    const nameInput = page.getByPlaceholder('e.g. Handmade Candles');
    await nameInput.fill('Handmade Candles');

    // Verify Slug is auto-populated
    const slugInput = page.getByPlaceholder('e.g. handmade-candles');
    await expect(slugInput).toHaveValue('handmade-candles');

    // Submit form
    const submitBtn = page.getByRole('button', { name: /Add Category/i });
    await submitBtn.click();

    // Verify success toast appears
    await expect(page.getByText(/Category "Handmade Candles" created successfully!/i)).toBeVisible({
      timeout: 5000,
    });
  });

  test('6. Admin can delete an existing category with confirmation modal and safety notice', async ({ page, context }) => {
    await setupAdminSession(page, context);
    await mockSupabaseRoutes(page);

    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // Click on Categories tab
    const categoriesTabBtn = page.getByRole('button', { name: /Categories/i });
    await categoriesTabBtn.click();

    // Look for Crochet card's delete button
    const deleteCrochetBtn = page.getByRole('button', { name: 'Delete category Crochet' });
    await expect(deleteCrochetBtn).toBeVisible();
    await deleteCrochetBtn.click();

    // Verify Delete Category modal opened
    await expect(page.getByRole('heading', { name: 'Delete Category?' })).toBeVisible();
    await expect(page.getByText('Are you sure you want to permanently delete "Crochet"?')).toBeVisible();
    await expect(page.getByText('Safety Notice:')).toBeVisible();
    await expect(page.getByText('Existing products will NOT be deleted')).toBeVisible();

    // Click "Yes, Delete Category"
    const confirmDeleteBtn = page.getByRole('button', { name: 'Yes, Delete Category' });
    await confirmDeleteBtn.click();

    // Verify success toast appears
    await expect(page.getByText(/Category "Crochet" deleted successfully/i)).toBeVisible({
      timeout: 5000,
    });
  });

  test('7. Trending categories section on homepage fetches updated category images when rablo:categories-updated is dispatched', async ({ page }) => {
    let currentCrochetImg: string | null = null;

    await page.route('**/rest/v1/home_banners*', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.route('**/rest/v1/home_featured*', (route) => {
      const url = route.request().url();
      if (url.includes('trending_categories')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'tcat-1',
              section: 'trending_categories',
              position: 0,
              created_at: new Date().toISOString(),
              category: {
                id: 'c0000000-0000-0000-0000-000000000001',
                name: 'Crochet',
                slug: 'crochet',
                is_approved: true,
                image_url: currentCrochetImg,
              },
            },
          ]),
        });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.route('**/rest/v1/products*', (route) => {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.route('**/rest/v1/categories*', (route) => {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(defaultCategories) });
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const trendingCategoriesSection = page.locator('#trending-categories');
    await trendingCategoriesSection.scrollIntoViewIfNeeded();
    await expect(trendingCategoriesSection).toBeVisible();

    const crochetImg = trendingCategoriesSection.locator('img[alt="Crochet"]');
    await expect(crochetImg).toBeVisible();
    await expect(crochetImg).toHaveAttribute('src', '/categories/crochet.webp');

    // Now update category image in mock database
    currentCrochetImg = 'https://storage.supabase.co/site-assets/categories/custom-crochet-123.webp';

    // Dispatch rablo:categories-updated as if admin just updated it
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('rablo:categories-updated'));
    });

    // Trending category image should automatically fetch and update to custom-crochet-123.webp
    await expect(crochetImg).toHaveAttribute('src', 'https://storage.supabase.co/site-assets/categories/custom-crochet-123.webp', {
      timeout: 5000,
    });
  });
});

