import { test, expect } from '@playwright/test';

const ref = 'ogakjurjotthhcbpqhqf';

const adminSessionPayload = {
  access_token: 'fake-admin-jwt',
  refresh_token: 'fake-admin-refresh',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: {
    id: 'user-admin-1',
    email: 'sumitkatiyar783@gmail.com',
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: { provider: 'google' },
    user_metadata: { full_name: 'Super Admin' },
    created_at: new Date().toISOString(),
  },
};

const sellerSessionPayload = {
  access_token: 'fake-seller-jwt',
  refresh_token: 'fake-seller-refresh',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: {
    id: 'user-seller-1',
    email: 'seller@test.com',
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: { provider: 'google' },
    user_metadata: { full_name: 'Artisan Seller' },
    created_at: new Date().toISOString(),
  },
};

const mockInitialBanners = [
  {
    id: 'banner-1',
    image_path: 'banners/banner-1.webp',
    image_url: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=1920',
    alt_text: 'Handcrafted crochet and textile creations',
    link_url: '/catalog?category=fashion',
    focal_x: 50,
    focal_y: 50,
    position: 0,
    is_active: true,
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'banner-2',
    image_path: 'banners/banner-2.webp',
    image_url: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=1920',
    alt_text: 'Studio pottery and stoneware ceramics',
    link_url: 'https://instagram.com/clay_artisan',
    focal_x: 40,
    focal_y: 60,
    position: 1,
    is_active: true,
    created_at: new Date().toISOString(),
  },
];

const mockInitialFeatured = [
  {
    id: 'feat-tp-1',
    section: 'trending_products',
    product_id: 'prod-1',
    brand_id: null,
    category_id: null,
    position: 0,
    created_at: new Date().toISOString(),
    product: {
      id: 'prod-1',
      name: 'Crochet Daisy Tote Bag',
      price: 899,
      approval_status: 'Approved',
      thumbnail_url: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=800',
    },
  },
  {
    id: 'feat-na-1',
    section: 'new_arrivals',
    product_id: 'prod-2',
    brand_id: null,
    category_id: null,
    position: 0,
    created_at: new Date().toISOString(),
    product: {
      id: 'prod-2',
      name: 'Handcrafted Terracotta Mug',
      price: 699,
      approval_status: 'Approved',
      thumbnail_url: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=800',
    },
  },
  {
    id: 'feat-tc-1',
    section: 'trending_creators',
    product_id: null,
    brand_id: 'brand-1',
    category_id: null,
    position: 0,
    created_at: new Date().toISOString(),
    brand: {
      id: 'brand-1',
      slug: 'crochetbynia',
      name: 'Crochet by Nia',
      tagline: 'Handmade with Love',
      logo_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200',
      instagram_url: 'https://instagram.com/crochetbynia',
      is_verified: true,
      approval_status: 'Approved',
    },
  },
  {
    id: 'feat-tcat-1',
    section: 'trending_categories',
    product_id: null,
    brand_id: null,
    category_id: 'cat-1',
    position: 0,
    created_at: new Date().toISOString(),
    category: {
      id: 'cat-1',
      name: 'Home & Living',
      slug: 'home-living',
      is_approved: true,
    },
  },
];

const mockCatalogProducts = [
  {
    id: 'prod-pending-1',
    name: 'Pending Ceramic Planter',
    price: 499,
    approval_status: 'Pending',
    rejection_feedback: null,
    seller_id: 'user-seller-1',
    thumbnail_url: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=800',
  },
  {
    id: 'prod-1',
    name: 'Crochet Daisy Tote Bag',
    price: 899,
    approval_status: 'Approved',
    rejection_feedback: null,
    seller_id: 'user-seller-1',
    thumbnail_url: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=800',
  },
  {
    id: 'prod-2',
    name: 'Handcrafted Terracotta Mug',
    price: 699,
    approval_status: 'Approved',
    rejection_feedback: null,
    seller_id: 'user-seller-1',
    thumbnail_url: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=800',
  },
  {
    id: 'prod-3',
    name: 'Ceramic Pour Over Dripper',
    price: 1199,
    approval_status: 'Approved',
    rejection_feedback: null,
    seller_id: 'user-seller-1',
    thumbnail_url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800',
  },
];

const mockCatalogBrands = [
  {
    id: 'brand-1',
    slug: 'crochetbynia',
    name: 'Crochet by Nia',
    tagline: 'Handmade with Love',
    approval_status: 'Approved',
    is_verified: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'brand-2',
    slug: 'clayartisan',
    name: 'Clay Artisan Studio',
    tagline: 'Wheel-thrown stoneware',
    approval_status: 'Approved',
    is_verified: true,
    created_at: new Date().toISOString(),
  },
];

const mockAllCategories = [
  { id: 'cat-1', name: 'Home & Living', slug: 'home-living', is_approved: true },
  { id: 'cat-2', name: 'Fashion & Accessories', slug: 'fashion', is_approved: true },
  { id: 'cat-3', name: 'Art & Collectibles', slug: 'art', is_approved: true },
  { id: 'cat-4', name: 'Stationery & Gifts', slug: 'stationery', is_approved: true },
  { id: 'cat-5', name: 'Beauty & Care', slug: 'beauty', is_approved: true },
];

test.describe('Part 2: Admin Homepage Manager', () => {

  test('1. Non-admin cannot access or view the Homepage tab (redirects or restricted portal)', async ({ page, context }) => {
    // 1a. Unauthenticated guest visiting /admin redirects to login
    await page.goto('/admin');
    await page.waitForURL(/\/account\?redirect=%2Fadmin/);
    expect(page.url()).toContain('/account?redirect=%2Fadmin');

    // 1b. Non-admin seller user cannot access /admin
    const base64Seller = 'base64-' + Buffer.from(JSON.stringify(sellerSessionPayload)).toString('base64url');
    await context.addCookies([
      {
        name: `sb-${ref}-auth-token`,
        value: base64Seller,
        domain: 'localhost',
        path: '/',
      },
    ]);

    await page.goto('/admin');
    // Middleware redirects unauthorized non-admin away from /admin
    await page.waitForURL((url) => !url.pathname.startsWith('/admin'));
    expect(page.url()).not.toContain('/admin');
  });

  test.describe('Authenticated Admin Dashboard & Homepage Manager', () => {
    let bannersState: any[];
    let featuredState: any[];
    let productDeleteCallCount: number;

    test.beforeEach(async ({ page, context }) => {
      bannersState = JSON.parse(JSON.stringify(mockInitialBanners));
      featuredState = JSON.parse(JSON.stringify(mockInitialFeatured));
      productDeleteCallCount = 0;

      // Setup admin session cookie & local storage
      const base64Admin = 'base64-' + Buffer.from(JSON.stringify(adminSessionPayload)).toString('base64url');
      await context.addCookies([
        {
          name: `sb-${ref}-auth-token`,
          value: base64Admin,
          domain: 'localhost',
          path: '/',
        },
      ]);

      await page.addInitScript(({ ref, payload, base64Val }) => {
        document.cookie = `sb-${ref}-auth-token=${base64Val}; path=/; max-age=3600`;
        window.localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(payload));
      }, { ref, payload: adminSessionPayload, base64Val: base64Admin });

      // Mock Supabase Auth
      await page.route('**/auth/v1/user*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(adminSessionPayload.user),
        });
      });

      // Mock standard Admin dashboard endpoints
      await page.route('**/rest/v1/category_requests*', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      });

      await page.route('**/rest/v1/profiles*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([adminSessionPayload.user]),
        });
      });

      await page.route('**/rest/v1/categories*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockAllCategories),
        });
      });

      await page.route('**/rest/v1/brands*', async (route) => {
        const url = route.request().url();
        let filtered = mockCatalogBrands;
        if (url.includes('Clay')) {
          filtered = mockCatalogBrands.filter((b) => b.name.includes('Clay'));
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(filtered),
        });
      });

      await page.route('**/rest/v1/products*', async (route) => {
        const method = route.request().method();
        const url = route.request().url();

        if (method === 'DELETE') {
          productDeleteCallCount++;
          await route.fulfill({ status: 204, body: '' });
          return;
        }

        if (method === 'PATCH') {
          // Product approval update
          await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
          return;
        }

        let filtered = mockCatalogProducts;
        if (url.includes('Pour') || url.includes('Pour%20Over') || url.includes('Pour+Over')) {
          filtered = mockCatalogProducts.filter((p) => p.name.includes('Pour Over'));
        }

        const isSingle = route.request().headers()['accept']?.includes('application/vnd.pgrst.object+json');
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(isSingle ? filtered[0] : filtered),
        });
      });

      // Mock Home Banners table
      await page.route('**/rest/v1/home_banners*', async (route) => {
        const method = route.request().method();
        const url = route.request().url();

        if (method === 'GET') {
          if (url.includes('select=*') && route.request().headers()['prefer']?.includes('count=exact')) {
            // Count query
            await route.fulfill({
              status: 200,
              headers: { 'content-range': `0-${bannersState.length}/${bannersState.length}` },
              contentType: 'application/json',
              body: '[]',
            });
            return;
          }
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(bannersState),
          });
          return;
        }

        if (method === 'POST') {
          const body = route.request().postDataJSON();
          const newBanner = {
            id: body.id || 'banner-new',
            image_path: body.image_path || 'banners/new.webp',
            image_url: body.image_url || 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=1920',
            alt_text: body.alt_text || 'New Banner',
            link_url: body.link_url || null,
            focal_x: body.focal_x ?? 50,
            focal_y: body.focal_y ?? 50,
            position: bannersState.length,
            is_active: body.is_active ?? true,
            created_at: new Date().toISOString(),
          };
          bannersState.push(newBanner);
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify(newBanner),
          });
          return;
        }

        if (method === 'PATCH') {
          const body = route.request().postDataJSON();
          const idMatch = url.match(/id=eq\.([^&]+)/);
          if (idMatch) {
            const id = idMatch[1];
            const target = bannersState.find((b) => b.id === id);
            if (target) {
              Object.assign(target, body);
              await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(target),
              });
              return;
            }
          }
          await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
          return;
        }

        if (method === 'DELETE') {
          const idMatch = url.match(/id=eq\.([^&]+)/);
          if (idMatch) {
            const id = idMatch[1];
            bannersState = bannersState.filter((b) => b.id !== id);
          }
          await route.fulfill({ status: 204, body: '' });
          return;
        }

        await route.continue();
      });

      // Mock Home Featured table
      await page.route('**/rest/v1/home_featured*', async (route) => {
        const method = route.request().method();
        const url = route.request().url();

        if (method === 'HEAD' || (method === 'GET' && route.request().headers()['prefer']?.includes('count=exact') && !url.includes('select=id'))) {
          const sectionMatch = url.match(/section=eq\.([^&]+)/);
          const section = sectionMatch ? sectionMatch[1] : '';
          const filtered = featuredState.filter((f) => !section || f.section === section);
          await route.fulfill({
            status: 200,
            headers: { 'content-range': `0-${filtered.length}/${filtered.length}` },
            contentType: 'application/json',
            body: '',
          });
          return;
        }

        if (method === 'GET') {
          const sectionMatch = url.match(/section=eq\.([^&]+)/);
          const section = sectionMatch ? sectionMatch[1] : '';
          const filtered = featuredState.filter((f) => !section || f.section === section);
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(filtered),
          });
          return;
        }

        if (method === 'POST') {
          const body = route.request().postDataJSON();
          const targetProd = mockCatalogProducts.find((p) => p.id === body.product_id) || null;
          const targetBrand = mockCatalogBrands.find((b) => b.id === body.brand_id) || null;
          const targetCat = mockAllCategories.find((c) => c.id === body.category_id) || null;
          const newRow = {
            id: 'feat-' + Math.random().toString(36).substring(2, 7),
            section: body.section,
            product_id: body.product_id || null,
            brand_id: body.brand_id || null,
            category_id: body.category_id || null,
            position: body.position || 0,
            created_at: new Date().toISOString(),
            product: targetProd,
            brand: targetBrand,
            category: targetCat,
          };
          featuredState.push(newRow);
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify(newRow),
          });
          return;
        }

        if (method === 'PATCH') {
          await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
          return;
        }

        if (method === 'DELETE') {
          const idMatch = url.match(/id\.eq\.([^,)]+)/) || url.match(/id=eq\.([^&]+)/);
          if (idMatch) {
            const id = idMatch[1];
            featuredState = featuredState.filter((f) => f.id !== id && f.product_id !== id);
          }
          await route.fulfill({ status: 204, body: '' });
          return;
        }

        await route.continue();
      });

      // Mock Storage bucket 'site-assets'
      await page.route('**/storage/v1/object/**', async (route) => {
        const method = route.request().method();
        if (method === 'POST' || method === 'PUT') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ Key: 'site-assets/banners/mock.webp' }),
          });
          return;
        }
        if (method === 'DELETE') {
          await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
          return;
        }
        await route.continue();
      });
    });

    test('2. Admin dashboard renders Homepage tab, banner manager, and live preview', async ({ page }) => {
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');

      // Click Homepage Tab
      const homepageTabBtn = page.getByRole('button', { name: 'Homepage', exact: true });
      await expect(homepageTabBtn).toBeVisible({ timeout: 10000 });
      await homepageTabBtn.click();

      // Heading and Banner Slider section
      await expect(page.getByText('Homepage Layout & Curation')).toBeVisible();
      await expect(page.getByText('Hero Banner Slider')).toBeVisible();
      await expect(page.getByText('2 of 8 banners')).toBeVisible();

      // Live Preview / Builder Canvas exists
      await expect(page.getByText(/Interactive Canvas/)).toBeVisible();

      // Both initial banners rendered in list
      await expect(page.locator('text=Handcrafted crochet and textile creations').first()).toBeVisible();
      await expect(page.locator('text=Studio pottery and stoneware ceramics').first()).toBeVisible();
    });

    test('3. Banner Manager: Upload validation blocks invalid format, file too large, and 9th banner', async ({ page }) => {
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');
      await page.getByRole('button', { name: 'Homepage', exact: true }).click();

      // 3a. Invalid format validation
      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles({
        name: 'document.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('fake pdf content'),
      });
      await expect(page.getByText('Invalid format. Only JPEG, PNG, and WebP are allowed.')).toBeVisible();

      // 3b. File too large validation (> 5 MB)
      const bigBuffer = Buffer.alloc(6 * 1024 * 1024);
      await fileInput.setInputFiles({
        name: 'large_banner.png',
        mimeType: 'image/png',
        buffer: bigBuffer,
      });
      await expect(page.getByText('File size exceeds 5 MB limit.')).toBeVisible();

      // 3c. 9th banner block when 8 banners exist
      bannersState = Array.from({ length: 8 }, (_, idx) => ({
        id: `banner-${idx + 1}`,
        image_path: `banners/b${idx + 1}.webp`,
        image_url: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=1920',
        alt_text: `Banner ${idx + 1}`,
        link_url: null,
        focal_x: 50,
        focal_y: 50,
        position: idx,
        is_active: true,
        created_at: new Date().toISOString(),
      }));

      await page.getByRole('button', { name: 'Refresh' }).click();
      await page.getByRole('button', { name: 'Homepage', exact: true }).click();

      await expect(page.getByText('8 of 8 banners')).toBeVisible();
      await expect(page.getByText('Maximum of 8 banners reached. Delete an existing banner to add a new one.')).toBeVisible();
      const uploadBtn = page.getByRole('button', { name: /Upload Images|Quick Upload/ });
      await expect(uploadBtn).toBeDisabled();
    });

    test('4. Banner Manager: Active toggle, reorder and delete with confirm', async ({ page }) => {
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');
      await page.getByRole('button', { name: 'Homepage', exact: true }).click();

      // 4a. Active toggle
      const activeBtn = page.locator('button[aria-label="Deactivate banner"]').first();
      await activeBtn.click();
      // Toast notification appears
      await expect(page.getByText(/Banner hidden from shoppers|Banner deactivated/)).toBeVisible();

      // 4b. Reorder Down on Banner 1
      const moveDownBtn = page.locator('button[aria-label="Move banner down"]').first();
      await moveDownBtn.click();
      await expect(page.getByText('Banner order updated.')).toBeVisible();

      // 4c. Delete banner with confirm dialog
      page.once('dialog', async (dialog) => {
        expect(dialog.message()).toContain('permanently?');
        await dialog.accept();
      });
      const deleteBannerBtn = page.locator('button[aria-label="Delete banner"]').first();
      await deleteBannerBtn.click();
      await expect(page.getByText('Banner deleted.')).toBeVisible();
    });

    test('5. Featured Section Managers: add item, reorder, section limit, and remove with confirm', async ({ page }) => {
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');
      await page.getByRole('button', { name: 'Homepage', exact: true }).click();

      // 5a. Trending Products Manager: Add item via debounced search
      const trendingProductsSection = page.locator('section:has-text("Trending Products")');
      await expect(trendingProductsSection).toBeVisible();
      const productSearchInput = trendingProductsSection.locator('input[type="search"]');
      await productSearchInput.fill('Pour Over');

      // Click "+ Add" on search result
      const addBtn = trendingProductsSection.getByRole('button', { name: 'Add' }).first();
      await expect(addBtn).toBeVisible({ timeout: 5000 });
      await addBtn.click();
      await expect(page.getByText(/Added "Ceramic Pour Over Dripper" to Trending Products!/)).toBeVisible();

      // 5b. Trending Creators Manager: Add creator via search
      const creatorsSection = page.locator('section:has-text("Trending Creators")');
      const creatorSearchInput = creatorsSection.locator('input[type="search"]');
      await creatorSearchInput.fill('Clay');
      const addCreatorBtn = creatorsSection.getByRole('button', { name: 'Add' }).first();
      await expect(addCreatorBtn).toBeVisible({ timeout: 5000 });
      await addCreatorBtn.click();
      await expect(page.getByText(/Added "Clay Artisan Studio" to Trending Creators!/)).toBeVisible();

      // 5c. Trending Categories: Select from dropdown
      const categoriesSection = page.locator('section:has-text("Trending Categories")');
      const categorySelect = categoriesSection.locator('select');
      await categorySelect.selectOption({ label: 'Fashion & Accessories' });
      await expect(page.getByText(/Added "Fashion & Accessories" to Trending Categories!/)).toBeVisible();

      // 5d. Remove item with confirm
      page.once('dialog', async (dialog) => {
        expect(dialog.message()).toContain('Remove "Crochet by Nia" from Trending Creators?');
        await dialog.accept();
      });
      const removeBtn = creatorsSection.locator('button[aria-label*="Remove"]').first();
      await removeBtn.click();
      await expect(page.getByText(/Removed "Crochet by Nia" from Trending Creators/)).toBeVisible();
    });

    test('6. New Arrivals Manager: Remove from New Arrivals does NOT call a product delete and supports manual curation', async ({ page }) => {
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');
      await page.getByRole('button', { name: 'Homepage', exact: true }).click();

      const newArrivalsSection = page.locator('section:has-text("New Arrivals")');
      await expect(newArrivalsSection).toBeVisible();

      // Up/Down reorder buttons exist in New Arrivals as it is manually curated by admin
      await expect(newArrivalsSection.locator('button[aria-label*="Move"]').first()).toBeVisible();

      // Remove with confirm dialog
      page.once('dialog', async (dialog) => {
        expect(dialog.message()).toContain('Remove "Handcrafted Terracotta Mug" from New Arrivals?');
        expect(dialog.message()).toContain('The product itself will NOT be deleted.');
        await dialog.accept();
      });

      const removeBtn = newArrivalsSection.locator('button[aria-label*="Remove"]').first();
      await expect(removeBtn).toBeVisible();
      await removeBtn.click();

      await expect(page.getByText(/Removed "Handcrafted Terracotta Mug" from New Arrivals \(product preserved\)/)).toBeVisible();

      // Critical requirement: underlying product was NEVER deleted
      expect(productDeleteCallCount, 'Product DELETE endpoint should never be called when removing from New Arrivals').toBe(0);
    });

    test('7. Product Moderation: Manual approval toast shows "Product approved successfully."', async ({ page }) => {
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');

      // Click Product Moderation Tab
      await page.getByRole('button', { name: /Product Moderation/ }).click();

      // Approve pending product
      const approveBtn = page.getByRole('button', { name: /Approve/ }).first();
      await expect(approveBtn).toBeVisible();
      await approveBtn.click();

      // Toast confirms manual approval without automatic new arrival insertion
      await expect(page.getByText('Product approved successfully.')).toBeVisible();
    });

    test('8. 360px viewport has zero horizontal scroll on /admin with Homepage tab active', async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 740 });
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');

      // Activate Homepage tab
      await page.getByRole('button', { name: 'Homepage', exact: true }).click();

      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHorizontalScroll, 'Horizontal overflow on /admin Homepage tab at 360px').toBe(false);
    });
  });
});
