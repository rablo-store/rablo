import { test, expect } from '@playwright/test';

const mockBrands = [
  {
    id: 'b0000000-0000-0000-0000-000000000001',
    owner_id: '00000000-0000-0000-0000-000000000010',
    slug: 'crochetbynia',
    name: 'crochet by Nia',
    tagline: 'Crochet Accessories • Handmade with Love',
    bio: 'Self-taught crochet artist crafting slow-made bags and accessories.',
    logo_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    banner_url: 'https://images.unsplash.com/photo-1590736969955-71cc94801759?w=1200',
    instagram_url: 'https://instagram.com/crochetbynia',
    creator_type: 'individual',
    is_verified: true,
    approval_status: 'Approved',
    created_at: '2026-11-06T10:00:00.000Z',
    updated_at: '2026-11-06T10:00:00.000Z',
    product_count: 56,
    save_count: 120,
  },
  {
    id: 'b0000000-0000-0000-0000-000000000002',
    owner_id: '00000000-0000-0000-0000-000000000011',
    slug: 'thecandlelab',
    name: 'The Candle Lab',
    tagline: 'Scented Soy Candles & Botanical Wax Melts',
    bio: 'Artisanal soy wax candles hand-poured in small batches.',
    logo_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    banner_url: 'https://images.unsplash.com/photo-1603006905003-be475563bc59?w=1200',
    instagram_url: 'https://instagram.com/thecandlelab',
    creator_type: 'small_brand',
    is_verified: true,
    approval_status: 'Approved',
    created_at: '2026-11-05T09:00:00.000Z',
    updated_at: '2026-11-05T09:00:00.000Z',
    product_count: 24,
    save_count: 85,
  },
  {
    id: 'b0000000-0000-0000-0000-000000000003',
    owner_id: '00000000-0000-0000-0000-000000000012',
    slug: 'mudandmuse',
    name: 'Mud & Muse',
    tagline: 'Ceramics & Modern Pottery',
    bio: 'Wheel-thrown artisanal ceramics.',
    logo_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
    banner_url: 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=1200',
    instagram_url: 'https://instagram.com/mud_and_muse_studio',
    creator_type: 'small_brand',
    is_verified: true,
    approval_status: 'Approved',
    created_at: '2026-11-04T12:00:00.000Z',
    updated_at: '2026-11-04T12:00:00.000Z',
    product_count: 0,
    save_count: 0,
  },
  {
    id: 'b0000000-0000-0000-0000-000000000004',
    owner_id: '00000000-0000-0000-0000-000000000013',
    slug: 'beadwithlove',
    name: 'Bead with Love',
    tagline: 'Handmade Bead Jewellery & Y2K Accessories',
    bio: 'Vibrant beaded necklaces and earrings.',
    logo_url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150',
    banner_url: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=1200',
    instagram_url: 'https://instagram.com/beadwithlove',
    creator_type: 'individual',
    is_verified: false,
    approval_status: 'Approved',
    created_at: '2026-11-01T10:00:00.000Z',
    updated_at: '2026-11-01T10:00:00.000Z',
    product_count: 41,
    save_count: 40,
  },
];

const mockProducts = [
  {
    id: 'd0000000-0000-0000-0000-000000000001',
    name: 'Crochet Daisy Tote Bag',
    description: 'A beautiful hand-crocheted tote bag with daisy pattern.',
    price: 899,
    stock: 15,
    category_id: 'c0000000-0000-0000-0000-000000000001',
    seller_id: '00000000-0000-0000-0000-000000000010',
    seller_ig_url: 'https://instagram.com/crochetbynia',
    product_ig_url: 'https://instagram.com/p/DA_crochet_tote',
    contact_link: 'https://wa.me/919876543210?text=Hi%20Nia%2C%20I%20am%20inquiring%20about%20the%20Crochet%20Daisy%20Tote%20Bag%20on%20Rablo',
    thumbnail_url: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800',
    gallery_urls: ['https://images.unsplash.com/photo-1590736969955-71cc94801759?w=800'],
    approval_status: 'Approved',
    created_at: '2026-11-06T10:00:00.000Z',
    updated_at: '2026-11-06T10:00:00.000Z',
    brand_id: 'b0000000-0000-0000-0000-000000000001',
    brand: mockBrands[0],
    attributes: {
      Material: 'Cotton Yarn',
      Size: '14" (H) × 12" (W)',
      Type: 'Handmade',
      Availability: 'Made to Order (3-5 days)',
    },
    bulk_orders: true,
  },
  {
    id: 'd0000000-0000-0000-0000-000000000008',
    name: 'Crochet Pouch',
    description: 'Charming pastel pink mini pouch.',
    price: 499,
    stock: 20,
    category_id: 'c0000000-0000-0000-0000-000000000001',
    seller_id: '00000000-0000-0000-0000-000000000010',
    seller_ig_url: 'https://instagram.com/crochetbynia',
    product_ig_url: 'https://instagram.com/p/DA_crochet_pouch',
    contact_link: 'https://wa.me/919876543210?text=Hi%20Nia%2C%20inquiring%20about%20Crochet%20Pouch',
    thumbnail_url: 'https://images.unsplash.com/photo-1590736969955-71cc94801759?w=800',
    gallery_urls: [],
    approval_status: 'Approved',
    created_at: '2026-11-06T03:00:00.000Z',
    updated_at: '2026-11-06T03:00:00.000Z',
    brand_id: 'b0000000-0000-0000-0000-000000000001',
    brand: mockBrands[0],
    attributes: {
      Material: 'Organic Milk Cotton',
      Size: '6" × 5"',
      Type: 'Handmade Crochet',
      Availability: 'In Stock',
    },
  },
];

const mockCartItems = [
  {
    id: 'cart-item-1',
    user_id: 'user-shopper-1',
    product_id: 'd0000000-0000-0000-0000-000000000001',
    click_count: 0,
    added_at: '2026-11-07T12:00:00Z',
    product: mockProducts[0],
  },
];

test.describe('Part 3: Creators List, Brand Store, Product Detail & Lead Cart', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept Supabase REST requests for deterministic test execution
    await page.route('**/rest/v1/brands*', async (route) => {
      const url = route.request().url();
      const headers = route.request().headers();
      const isSingleObject = headers['accept']?.includes('application/vnd.pgrst.object+json');

      if (url.includes('slug=eq.')) {
        const match = url.match(/slug=eq\.([a-zA-Z0-9_-]+)/);
        const slug = match ? match[1].toLowerCase() : null;
        const brand = mockBrands.find((b) => b.slug.toLowerCase() === slug);

        if (!brand) {
          if (isSingleObject) {
            return route.fulfill({
              status: 406,
              contentType: 'application/json',
              body: JSON.stringify({ message: 'JSON object requested, but no results found' }),
            });
          }
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([]),
          });
        }

        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(isSingleObject ? brand : [brand]),
        });
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockBrands),
      });
    });

    await page.route('**/rest/v1/products*', async (route) => {
      const url = route.request().url();
      const headers = route.request().headers();
      const isSingleObject = headers['accept']?.includes('application/vnd.pgrst.object+json');

      if (url.includes('brand_id=eq.')) {
        const match = url.match(/brand_id=eq\.([a-zA-Z0-9-]+)/);
        const bId = match ? match[1] : null;
        const filtered = mockProducts.filter((p) => p.brand_id === bId);
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(filtered),
        });
      }

      if (/(?:^|[?&])id=eq\./.test(url)) {
        const match = url.match(/(?:^|[?&])id=eq\.([a-zA-Z0-9-]+)/);
        const pId = match ? match[1] : null;
        const prod = mockProducts.find((p) => p.id === pId);

        if (!prod) {
          if (isSingleObject) {
            return route.fulfill({
              status: 406,
              contentType: 'application/json',
              body: JSON.stringify({ message: 'JSON object requested, but no results found' }),
            });
          }
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([]),
          });
        }

        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(isSingleObject ? prod : [prod]),
        });
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockProducts),
      });
    });

    await page.route('**/rest/v1/cart_items*', async (route) => {
      const method = route.request().method();
      if (method === 'DELETE') {
        await route.fulfill({ status: 204, body: '' });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockCartItems),
        });
      }
    });

    await page.route('**/rest/v1/rpc/product_save_counts*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { product_id: 'd0000000-0000-0000-0000-000000000001', saves: 120 },
        ]),
      });
    });

    await page.route('**/auth/v1/user*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'user-shopper-1',
          email: 'shopper@test.com',
          aud: 'authenticated',
          role: 'authenticated',
          app_metadata: { provider: 'google' },
          user_metadata: { full_name: 'Test Shopper' },
          created_at: new Date().toISOString(),
        }),
      });
    });
  });

  test('1. /creators lists brands, search filters creators, and chips filter', async ({ page }) => {
    await page.goto('/creators');
    await page.waitForLoadState('networkidle');

    // Page title and intro
    await expect(page.locator('h1:has-text("Explore Creators")')).toBeVisible();

    // Verify creator cards render
    const niaCard = page.locator('article:has-text("crochet by Nia")').first();
    await expect(niaCard).toBeVisible();
    await expect(niaCard.locator('text=@crochetbynia')).toBeVisible();

    // Test search filter
    const searchInput = page.locator('#creator-search-input');
    await searchInput.fill('candle');
    await expect(page.locator('article:has-text("The Candle Lab")')).toBeVisible();
    await expect(page.locator('article:has-text("crochet by Nia")')).not.toBeVisible();

    // Clear search
    await searchInput.fill('');
    await expect(page.locator('article:has-text("crochet by Nia")')).toBeVisible();

    // Test filter chips
    const verifiedChip = page.locator('button:has-text("Verified")');
    await verifiedChip.click();
    await expect(page.locator('article:has-text("crochet by Nia")')).toBeVisible();
    await expect(page.locator('article:has-text("Bead with Love")')).not.toBeVisible();

    // Verify "Top Rated" chip is NOT present (anti-guessing rule)
    await expect(page.locator('button:has-text("Top Rated")')).toHaveCount(0);
  });

  test('2. /creators/[slug] renders products and shows 404 state for unknown slug', async ({ page }) => {
    // Valid creator store
    await page.goto('/creators/crochetbynia');
    await page.waitForLoadState('networkidle');

    // Brand identity and stats
    await expect(page.locator('h1:has-text("crochet by Nia")')).toBeVisible();
    await expect(page.getByRole('paragraph').filter({ hasText: '@crochetbynia' })).toBeVisible();
    await expect(page.locator('button:has-text("Contact on Instagram")')).toBeVisible();
    await expect(page.locator('a:has-text("Instagram Profile")')).toBeVisible();

    // Stats row shows real product count only, NO followers or ratings (anti-guessing rule)
    await expect(page.getByText('Products', { exact: true })).toBeVisible();
    await expect(page.locator('text=Followers')).toHaveCount(0);
    await expect(page.locator('text=Rating')).toHaveCount(0);

    // Products tab renders products
    await expect(page.locator('button:has-text("Products")')).toBeVisible();
    await expect(page.locator('text=Crochet Daisy Tote Bag').first()).toBeVisible();

    // About tab switches to bio and creator type
    const aboutTab = page.locator('button:has-text("About Creator")');
    await aboutTab.click();
    await expect(page.locator('text=About crochet by Nia')).toBeVisible();
    await expect(page.locator('text=Individual Creator')).toBeVisible();

    // Reviews tab should NOT exist
    await expect(page.locator('button:has-text("Reviews")')).toHaveCount(0);

    // Unknown slug shows friendly 404
    const res404 = await page.goto('/creators/nonexistent-artisan-xyz');
    expect(res404?.status()).toBe(404);
    await expect(page.locator('h1:has-text("Creator Not Found")')).toBeVisible();
    await expect(page.locator('a:has-text("Explore Verified Creators")')).toBeVisible();
  });

  test('2b. Brand with zero products shows the empty state (no fake items)', async ({ page }) => {
    // mudandmuse has 0 products
    await page.goto('/creators/mudandmuse');
    await page.waitForLoadState('networkidle');

    // Brand header
    await expect(page.locator('h1:has-text("Mud & Muse")')).toBeVisible();

    // Products tab shows 0
    await expect(page.locator('button:has-text("Products (0)")')).toBeVisible();

    // Proper EmptyState is rendered
    await expect(page.locator('text=No Creations Listed Yet')).toBeVisible();
    await expect(page.locator('text=Mud & Muse is preparing unique handcrafted pieces')).toBeVisible();

    // No fake/dummy products should be rendered
    await expect(page.locator('text=Crochet Daisy Tote Bag')).toHaveCount(0);
    await expect(page.locator('text=Scented Soy Candle')).toHaveCount(0);
  });

  test('2c. Failed products query shows the error state without fake items', async ({ page }) => {
    // Intercept products query for thecandlelab and force 500 failure
    await page.route('**/rest/v1/products*brand_id=eq.b0000000-0000-0000-0000-000000000002*', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Database connection failed' }),
      });
    });

    await page.goto('/creators/thecandlelab');
    await page.waitForLoadState('networkidle');

    // Brand header still renders
    await expect(page.locator('h1:has-text("The Candle Lab")')).toBeVisible();

    // Error state is rendered
    await expect(page.locator('text=Unable to Load Creations')).toBeVisible();
    await expect(page.locator('button:has-text("Try Again")')).toBeVisible();

    // No fake/dummy products should be rendered
    await expect(page.locator('text=Crochet Daisy Tote Bag')).toHaveCount(0);
  });

  test('2d. Legacy /creators/<instagram-handle> 301 redirects to /creators/<slug>', async ({ page }) => {
    // Request legacy URL with Instagram handle that differs from slug
    await page.goto('/creators/mud_and_muse_studio');
    await page.waitForLoadState('networkidle');

    // Should redirect to canonical slug
    await expect(page).toHaveURL(/\/creators\/mudandmuse$/);
    await expect(page.locator('h1:has-text("Mud & Muse")')).toBeVisible();
  });

  test('3. Product details page renders specs from product.attributes and links to creator store', async ({ page }) => {
    await page.goto('/products/d0000000-0000-0000-0000-000000000001');
    await page.waitForLoadState('networkidle');

    // "by @brand" links to /creators/crochetbynia
    const brandLink = page.locator('a[href="/creators/crochetbynia"]').first();
    await expect(brandLink).toBeVisible();
    await expect(brandLink).toHaveText('@crochetbynia');

    // Product specs table rendered from product.attributes
    await expect(page.locator('h3:has-text("Product Details")')).toBeVisible();
    await expect(page.locator('text=Material')).toBeVisible();
    await expect(page.getByText('Cotton Yarn', { exact: true })).toBeVisible();
    await expect(page.locator('text=14" (H) × 12" (W)')).toBeVisible();

    // Save to Lead Cart button
    await expect(page.locator('button:has-text("Save to Lead Cart")')).toBeVisible();

    // Helper text under Contact button
    await expect(page.locator('text=You\'ll be redirected to the creator\'s chat to discuss the purchase.')).toBeVisible();
  });

  test('4. Logged-out Contact on product opens AuthModal with target URL', async ({ page }) => {
    await page.goto('/products/d0000000-0000-0000-0000-000000000001');
    await page.waitForLoadState('networkidle');

    // Click contact button when logged out
    const contactBtn = page.locator('button:has-text("Contact"), button:has-text("Chat")').last();
    await contactBtn.click();

    // AuthModal should open with role="dialog"
    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible();
    await expect(modal.locator('button:has-text("Sign In / Sign Up with Google")')).toBeVisible();
  });

  test('5. Lead Cart /cart renders rows and remove works', async ({ page, context }) => {
    const ref = 'ogakjurjotthhcbpqhqf';
    const sessionPayload = {
      access_token: 'fake-jwt',
      refresh_token: 'fake-refresh',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: {
        id: 'user-shopper-1',
        email: 'shopper@test.com',
        aud: 'authenticated',
        role: 'authenticated',
        app_metadata: { provider: 'google' },
        user_metadata: { full_name: 'Test Shopper' },
        created_at: new Date().toISOString(),
      },
    };
    const base64Val = 'base64-' + Buffer.from(JSON.stringify(sessionPayload)).toString('base64url');

    await context.addCookies([
      {
        name: `sb-${ref}-auth-token`,
        value: base64Val,
        domain: 'localhost',
        path: '/',
      },
    ]);

    await page.addInitScript(({ ref, payload, base64Val }) => {
      document.cookie = `sb-${ref}-auth-token=${base64Val}; path=/; max-age=3600`;
      window.localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(payload));
    }, { ref, payload: sessionPayload, base64Val });

    await page.goto('/cart');
    await page.waitForLoadState('networkidle');

    // Header and subtitle
    await expect(page.locator('h1:has-text("Your Lead Cart")')).toBeVisible();
    await expect(page.locator('text=Saved products to explore and discuss with creators.')).toBeVisible();

    // Item row
    const itemTitle = page.locator('a:has-text("Crochet Daisy Tote Bag")').first();
    await expect(itemTitle).toBeVisible();

    // "by @brand" link to creator profile
    const creatorStoreLink = page.locator('a[href="/creators/crochetbynia"]').first();
    await expect(creatorStoreLink).toBeVisible();

    // Price
    await expect(page.locator('text=₹899').first()).toBeVisible();

    // Remove button removes item
    const removeBtn = page.locator('button[aria-label="Remove item"]').first();
    await expect(removeBtn).toBeVisible();
    await removeBtn.click();

    // Toast appears
    await expect(page.locator('text=Removed "Crochet Daisy Tote Bag" from your cart.')).toBeVisible({ timeout: 5000 });
  });

  test('6. Zero horizontal scroll at 360px viewport on Part 3 pages', async ({ page }) => {
    const urls = [
      '/creators',
      '/creators/crochetbynia',
      '/products/d0000000-0000-0000-0000-000000000001',
      '/cart',
    ];

    await page.setViewportSize({ width: 360, height: 740 });

    for (const url of urls) {
      await page.goto(url);
      await page.waitForLoadState('networkidle');

      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });

      expect(hasHorizontalScroll, `Horizontal scroll detected on ${url} at 360px`).toBe(false);
    }
  });
});
