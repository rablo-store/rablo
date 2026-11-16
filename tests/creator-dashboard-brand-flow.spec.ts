import { test, expect } from '@playwright/test';
import {
  sanitizeContactUrl,
  resolveContact,
  ALLOWED_CONTACT_HOSTS,
} from '../src/lib/contact';
import { checkSlugAvailable } from '../src/lib/brands';

test.describe('Part 4: Creator Registration, Dashboard, Product Form, Admin Brands, Auth', () => {
  test('1. SSR Middleware redirects unauthenticated requests from protected routes to /account', async ({ page }) => {
    // 1a. /seller -> redirects to /account?redirect=%2Fseller
    await page.goto('/seller');
    await page.waitForURL(/\/account\?redirect=%2Fseller/);
    expect(page.url()).toContain('/account?redirect=%2Fseller');

    // 1b. /seller/upload -> redirects to /account?redirect=%2Fseller%2Fupload
    await page.goto('/seller/upload');
    await page.waitForURL(/\/account\?redirect=%2Fseller%2Fupload/);
    expect(page.url()).toContain('/account?redirect=%2Fseller%2Fupload');

    // 1c. /admin -> redirects to /account?redirect=%2Fadmin
    await page.goto('/admin');
    await page.waitForURL(/\/account\?redirect=%2Fadmin/);
    expect(page.url()).toContain('/account?redirect=%2Fadmin');
  });

  test('2. Unauthenticated /account renders Mockup 9 layout: Welcome to Rijlo, Google button, botanical illustration, email auth hidden', async ({ page }) => {
    await page.goto('/account');
    await page.waitForLoadState('networkidle');

    // Branding & Header
    await expect(page.locator('text=Welcome to Rijlo').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Discover unique products from independent creators.').first()).toBeVisible();

    // Primary action button (Google)
    const googleBtn = page.locator('button:has-text("Continue with Google")').first();
    await expect(googleBtn).toBeVisible();

    // Botanical illustration SVG matching Mockup 9
    const botanicalSvg = page.locator('svg[viewBox="0 0 100 120"]');
    await expect(botanicalSvg.first()).toBeVisible();

    // Anti-guessing / Feature Flag rule: Email auth form and button must NOT render when PUBLIC_ENABLE_EMAIL_AUTH is off
    const createAccountForm = page.locator('form:has-text("Create Account")');
    await expect(createAccountForm).toHaveCount(0);
    const continueEmailBtn = page.locator('button:has-text("Continue with Email")');
    await expect(continueEmailBtn).toHaveCount(0);
  });

  test('3. Unauthenticated /account with target_ig displays Direct Instagram DM Unlock Banner', async ({ page }) => {
    await page.goto('/account?target_ig=https%3A%2F%2Finstagram.com%2Fcrochetbynia');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('text=Sign in with Google to unlock this creator\'s Instagram ID').first()).toBeVisible();
  });

  test('4. AuthModal (Screen 9) opens on unauthenticated Contact DM click, displays artisan details, Google button, and botanical SVG', async ({ page }) => {
    await page.route('**/rest/v1/products*', async (route) => {
      const url = route.request().url();
      const isSingle = route.request().headers()['accept']?.includes('application/vnd.pgrst.object+json');
      const prod = {
        id: 'prod-test',
        name: 'Crochet Daisy Tote Bag',
        description: 'Handmade daisy tote',
        price: 899,
        stock: 5,
        seller_id: 'user-nia',
        seller_ig_url: 'https://instagram.com/crochetbynia',
        product_ig_url: null,
        contact_link: null,
        approval_status: 'Approved',
        thumbnail_url: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=800',
        attributes: {},
        seller: { full_name: 'crochet by Nia', instagram_url: 'https://instagram.com/crochetbynia' },
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(isSingle ? prod : [prod]),
      });
    });

    await page.goto('/products/prod-test');
    await page.waitForLoadState('networkidle');

    // Click contact button when logged out
    const contactBtn = page.locator('button:has-text("Contact"), button:has-text("Chat")').last();
    await expect(contactBtn).toBeVisible({ timeout: 10000 });
    await contactBtn.click();

    // AuthModal dialog should appear
    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible();
    await expect(modal.locator('text=Sign in with Google').first()).toBeVisible();
    await expect(modal.locator('button:has-text("Continue with Google")').first()).toBeVisible();

    // Botanical illustration should be present in modal
    const modalBotanicalSvg = modal.locator('svg[viewBox="0 0 100 120"]');
    await expect(modalBotanicalSvg.first()).toBeVisible();

    // Close button works
    const closeBtn = modal.locator('button[aria-label="Close dialog"]');
    await closeBtn.click();
    await expect(modal).not.toBeVisible();
  });

  test('5. Pure logic: Contact link resolver & sanitizer validates allowed domains and templates', () => {
    // Whitelisted domains
    expect(sanitizeContactUrl('https://instagram.com/crochetbynia')).toBe('https://instagram.com/crochetbynia');
    expect(sanitizeContactUrl('https://wa.me/919876543210')).toBe('https://wa.me/919876543210');
    expect(sanitizeContactUrl('https://t.me/crochetbynia')).toBe('https://t.me/crochetbynia');
    expect(sanitizeContactUrl('https://ig.me/m/crochetbynia')).toBe('https://ig.me/m/crochetbynia');

    // Forbidden domains & attacks
    expect(sanitizeContactUrl('https://malicious-site.com/steal')).toBeNull();
    expect(sanitizeContactUrl('javascript:alert(1)')).toBeNull();
    expect(sanitizeContactUrl('http://insecure-http.com')).toBeNull();
    expect(sanitizeContactUrl('https://user:pass@wa.me/919876543210')).toBeNull();

    // Link resolution with templates
    const resolved = resolveContact({
      product: { id: 'p1', name: 'Daisy Tote Bag', price: 899 },
      brand: { name: 'crochet by Nia', instagram_url: 'https://instagram.com/crochetbynia' },
      brandContact: {
        contact_type: 'whatsapp',
        link_template: 'https://wa.me/919876543210?text={message}',
        message_template: 'Hi {brand_name}! Inquiring about {product_name} (₹{price}). {product_url}',
      },
      origin: 'https://rablo.in',
    });

    expect(resolved).not.toBeNull();
    expect(resolved?.type).toBe('whatsapp');
    expect(resolved?.url).toContain('https://wa.me/919876543210?text=');
    expect(resolved?.message).toContain('Hi crochet by Nia! Inquiring about Daisy Tote Bag (₹899). https://rablo.in/products/p1');
  });

  test('6. Pure logic: checkSlugAvailable validates handle rules', async () => {
    // Valid slugs
    expect(await checkSlugAvailable('crochet-by-nia')).toBe(true);
    expect(await checkSlugAvailable('candlelab')).toBe(true);

    // Invalid slugs (too short, uppercase, invalid chars)
    expect(await checkSlugAvailable('ab')).toBe(false); // < 3 chars
    expect(await checkSlugAvailable('')).toBe(false);
    expect(await checkSlugAvailable('invalid slug with spaces')).toBe(false);
    expect(await checkSlugAvailable('invalid@symbol')).toBe(false);
  });

  test('7. 360px viewport has zero horizontal scroll on all Part 4 screens', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });

    for (const path of ['/', '/catalog', '/creators', '/categories', '/cart', '/account']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHorizontalScroll, `Horizontal overflow on ${path} at 360px`).toBe(false);
    }
  });
});
