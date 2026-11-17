import { test, expect } from '@playwright/test';
import {
  cleanInstagramHandle,
  isValidInstagramHandle,
  type Brand,
} from '../src/lib/brands';
import { verifyBioCode, INSTAGRAM_AUTO_VERIFY } from '../src/lib/instagramBioCheck';
import { RABLO_INSTAGRAM_HANDLE } from '../src/config/site';

const ref = 'ogakjurjotthhcbpqhqf';

function makeFakeJwt(payload: any) {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.sig`;
}

function encodeCookie(sessionObj: any) {
  return 'base64-' + Buffer.from(JSON.stringify(sessionObj)).toString('base64url');
}

const sellerPendingSession = {
  access_token: makeFakeJwt({ sub: 'usr-seller-pending-01', role: 'authenticated', email: 'pending.creator@example.com' }),
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'fake-pending-refresh',
  user: {
    id: 'usr-seller-pending-01',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'pending.creator@example.com',
    user_metadata: { full_name: 'Pending Creator' },
    app_metadata: { provider: 'google' },
    created_at: '2026-01-01T00:00:00.000Z',
  },
};

const sellerApprovedSession = {
  access_token: makeFakeJwt({ sub: 'usr-seller-approved-02', role: 'authenticated', email: 'approved.creator@example.com' }),
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'fake-approved-refresh',
  user: {
    id: 'usr-seller-approved-02',
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

test.describe('Instagram Handle Verification & Admin Approval Queue', () => {

  // =========================================================================
  // 1. Handle Normalisation & Validation Unit Tests
  // =========================================================================
  test('1. Handle normalisation and validation rules', () => {
    // Valid handles pass
    expect(isValidInstagramHandle('artisan_clay')).toBe(true);
    expect(isValidInstagramHandle('shop.studio')).toBe(true);
    expect(isValidInstagramHandle('maker123')).toBe(true);

    // Normalisation cleans @, URLs, trailing slashes, whitespace, and upper case
    expect(cleanInstagramHandle('@artisan_clay')).toBe('artisan_clay');
    expect(cleanInstagramHandle('https://instagram.com/shop.studio')).toBe('shop.studio');
    expect(cleanInstagramHandle('https://www.instagram.com/maker123/')).toBe('maker123');
    expect(cleanInstagramHandle('  @Studio_Decor  ')).toBe('studio_decor');

    // Invalid handles fail regex check
    expect(isValidInstagramHandle('maker space')).toBe(false); // contains space
    expect(isValidInstagramHandle('maker!')).toBe(false); // special characters
    expect(isValidInstagramHandle('a'.repeat(31))).toBe(false); // exceeds 30 characters
    expect(isValidInstagramHandle('')).toBe(false); // empty
    expect(isValidInstagramHandle('@name')).toBe(false); // raw @ not allowed in DB column
    expect(isValidInstagramHandle('https://instagram.com/foo')).toBe(false); // raw URL not allowed in DB column

    // Cleaned version of previously invalid inputs becomes valid
    expect(isValidInstagramHandle(cleanInstagramHandle('@name'))).toBe(true);
    expect(isValidInstagramHandle(cleanInstagramHandle('https://instagram.com/foo'))).toBe(true);
  });

  // =========================================================================
  // 2. Unofficial API Check
  // =========================================================================
  test('2. Unofficial API check: instagramBioCheck is disabled and safe', async () => {
    expect(INSTAGRAM_AUTO_VERIFY).toBe(false);
    const result = await verifyBioCode('artisan_clay', 'RABLO-ABC123');
    expect(result.status).toBe('unavailable');
  });

  // =========================================================================
  // 3. Security Check: Public API & View never leaks verification_code
  // =========================================================================
  test('3. Security check: verification_code is excluded from public projections', async ({ page }) => {
    let capturedQuery = '';
    await page.route('**/rest/v1/approved_brands*', (route) => {
      capturedQuery = route.request().url();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'b1', name: 'Safe Brand', slug: 'safe-brand', instagram_handle: 'safebrand', is_verified: true, approval_status: 'Approved' }
        ]),
      });
    });

    await page.route('**/rest/v1/brands*', (route) => {
      capturedQuery = route.request().url();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    // Visit home page / catalog
    await page.goto('/catalog');
    await page.waitForLoadState('networkidle');

    // Query string must never ask for verification_code in public contexts
    expect(capturedQuery).not.toContain('verification_code');
  });

  // =========================================================================
  // 4. Route Guard on /seller/upload: Verified+Pending vs Approved
  // =========================================================================
  test('4. Route guard on /seller/upload: Verified + Pending seller cannot list products', async ({ page, context }) => {
    await context.addCookies([{
      name: `sb-${ref}-auth-token`,
      value: encodeCookie(sellerPendingSession),
      domain: 'localhost',
      path: '/',
    }]);

    const pendingBrand: Brand = {
      id: 'brand-pending-01',
      owner_id: 'usr-seller-pending-01',
      name: 'Clay Studio',
      slug: 'clay-studio',
      tagline: 'Handmade Ceramics',
      bio: 'Crafted with passion',
      logo_url: null,
      banner_url: null,
      creator_type: 'individual',
      instagram_url: 'https://instagram.com/claystudio',
      instagram_handle: 'claystudio',
      is_verified: true, // Proved IG ownership!
      approval_status: 'Pending', // BUT admin has NOT approved yet
      verification_method: 'bio_code',
      verification_code: 'RABLO-789XYZ',
      verification_code_expires_at: new Date(Date.now() + 6 * 86400000).toISOString(),
      verification_requested_at: new Date().toISOString(),
      verified_at: new Date().toISOString(),
      reviewed_at: null,
      reviewed_by: null,
      rejection_reason: null,
      rejection_feedback: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await page.route('**/rest/v1/**', (route) => {
      const url = route.request().url();
      if (url.includes('/brands')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([pendingBrand]),
        });
      }
      if (url.includes('/profiles')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{ id: 'usr-seller-pending-01', role: 'user', is_seller: true, is_banned: false }]),
        });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.goto('/seller/upload');
    await page.waitForLoadState('networkidle');

    // Awaiting approval / verification banner must be visible
    await expect(page.locator('text=Instagram verified! Your store is under review by the Rablo team')).toBeVisible();

    // Product upload form must NOT be visible
    await expect(page.locator('text=List a Handcrafted Creation')).toHaveCount(0);
    await expect(page.locator('input[placeholder*="Crochet Daisy Tote Bag"]')).toHaveCount(0);
  });

  test('5. Route guard on /seller/upload: Approved seller sees upload form', async ({ page, context }) => {
    const sessionObj = adminSession;
    const cookieVal = encodeCookie(sessionObj);
    await context.addCookies([{
      name: `sb-${ref}-auth-token`,
      value: cookieVal,
      domain: 'localhost',
      path: '/',
    }]);

    await page.addInitScript(({ refKey, payload }) => {
      window.localStorage.setItem(`sb-${refKey}-auth-token`, JSON.stringify(payload));
    }, { refKey: ref, payload: sessionObj });

    const approvedBrand: Brand = {
      id: 'brand-approved-02',
      owner_id: adminSession.user.id,
      name: 'Linen & Wood',
      slug: 'linen-wood',
      tagline: 'Natural home items',
      bio: 'Pure linen and teak wood',
      logo_url: null,
      banner_url: null,
      creator_type: 'individual',
      instagram_url: 'https://instagram.com/linenwood',
      instagram_handle: 'linenwood',
      is_verified: true,
      approval_status: 'Approved',
      verification_method: 'bio_code',
      verification_code: 'RABLO-APPROVED',
      verification_code_expires_at: null,
      verification_requested_at: null,
      verified_at: new Date().toISOString(),
      reviewed_at: new Date().toISOString(),
      reviewed_by: 'admin-id',
      rejection_reason: null,
      rejection_feedback: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await page.route('**/rest/v1/**', (route) => {
      const url = route.request().url();
      if (url.includes('/brands')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([approvedBrand]),
        });
      }
      if (url.includes('/profiles')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{ id: 'usr-seller-approved-02', role: 'user', is_seller: true, is_banned: false }]),
        });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.goto('/seller/upload');
    await page.waitForLoadState('networkidle');

    // Upload form is present
    await expect(page.locator('text=List a Handcrafted Creation')).toBeVisible();
    await expect(page.locator('input[placeholder*="Crochet Daisy Tote Bag"]')).toBeVisible();
  });

  // =========================================================================
  // 5. Seller Verification Panel: All Required States and Flows
  // =========================================================================
  test('6. Option A flow: Seller requests Bio code, sees code box, clicks "I\'ve added it"', async ({ page, context }) => {
    await context.addCookies([{
      name: `sb-${ref}-auth-token`,
      value: encodeCookie(sellerPendingSession),
      domain: 'localhost',
      path: '/',
    }]);

    let rpcRequestedReview = false;

    // Brand with code issued but not submitted yet
    const brandCodeIssued: Brand = {
      id: 'brand-bio-flow',
      owner_id: 'usr-seller-pending-01',
      name: 'Paper Flowers',
      slug: 'paper-flowers',
      tagline: 'Origami & paper art',
      bio: 'Delicate handmade flowers',
      logo_url: null,
      banner_url: null,
      creator_type: 'individual',
      instagram_url: 'https://instagram.com/paperflowers',
      instagram_handle: 'paperflowers',
      is_verified: false,
      approval_status: 'Pending',
      verification_method: 'bio_code',
      verification_code: 'RABLO-BIO999',
      verification_code_expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      verification_requested_at: null,
      verified_at: null,
      reviewed_at: null,
      reviewed_by: null,
      rejection_reason: null,
      rejection_feedback: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await page.route('**/rest/v1/**', (route) => {
      const url = route.request().url();
      if (url.includes('/rpc/request_instagram_review')) {
        rpcRequestedReview = true;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      }
      if (url.includes('/brands')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([brandCodeIssued]),
        });
      }
      if (url.includes('/profiles')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{ id: 'usr-seller-pending-01', role: 'user', is_seller: true, is_banned: false }]),
        });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.goto('/seller');
    await page.waitForLoadState('networkidle');

    // Code box rendered
    await expect(page.locator('text=RABLO-BIO999')).toBeVisible();
    await expect(page.locator('button[title="Copy code"]')).toBeVisible();

    // Click "I've added it"
    const submitBtn = page.locator('button:has-text("I\'ve added it")');
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // Verify RPC was triggered
    expect(rpcRequestedReview).toBe(true);

    // Panel moves to Submitted pending state with exact copy
    await expect(page.locator('text=⏳ Pending. We\'ll check your bio and verify your identity soon.')).toBeVisible();
  });

  test('7. Option B flow: DM method button displays "I\'ve sent the DM"', async ({ page, context }) => {
    await context.addCookies([{
      name: `sb-${ref}-auth-token`,
      value: encodeCookie(sellerPendingSession),
      domain: 'localhost',
      path: '/',
    }]);

    const brandDmIssued: Brand = {
      id: 'brand-dm-flow',
      owner_id: 'usr-seller-pending-01',
      name: 'Paper Flowers',
      slug: 'paper-flowers',
      tagline: 'Origami & paper art',
      bio: 'Delicate handmade flowers',
      logo_url: null,
      banner_url: null,
      creator_type: 'individual',
      instagram_url: 'https://instagram.com/paperflowers',
      instagram_handle: 'paperflowers',
      is_verified: false,
      approval_status: 'Pending',
      verification_method: 'dm',
      verification_code: 'RABLO-DM777',
      verification_code_expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      verification_requested_at: null,
      verified_at: null,
      reviewed_at: null,
      reviewed_by: null,
      rejection_reason: null,
      rejection_feedback: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await page.route('**/rest/v1/**', (route) => {
      const url = route.request().url();
      if (url.includes('/rpc/request_instagram_review')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      }
      if (url.includes('/brands')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([brandDmIssued]),
        });
      }
      if (url.includes('/profiles')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{ id: 'usr-seller-pending-01', role: 'user', is_seller: true, is_banned: false }]),
        });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.goto('/seller');
    await page.waitForLoadState('networkidle');

    // Code box rendered
    await expect(page.locator('text=RABLO-DM777')).toBeVisible();

    // "I have sent the DM" button is visible
    const submitBtn = page.locator('button:has-text("I have sent the DM")');
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // Transitions to pending DM state
    await expect(page.locator('text=Verification Pending. Our team will manually review your DM within 24 hours.')).toBeVisible();
  });

  test('8. Panel State: Not started renders Option A (recommended) and Option B (active DM method)', async ({ page, context }) => {
    await context.addCookies([{
      name: `sb-${ref}-auth-token`,
      value: encodeCookie(sellerPendingSession),
      domain: 'localhost',
      path: '/',
    }]);

    const brandNotStarted: Brand = {
      id: 'brand-not-started',
      owner_id: 'usr-seller-pending-01',
      name: 'Woodwork Shop',
      slug: 'woodwork-shop',
      tagline: 'Hand carved wood',
      bio: 'Handmade wooden bowls',
      logo_url: null,
      banner_url: null,
      creator_type: 'individual',
      instagram_url: 'https://instagram.com/woodworkshop',
      instagram_handle: 'woodworkshop',
      is_verified: false,
      approval_status: 'Pending',
      verification_method: null,
      verification_code: null,
      verification_code_expires_at: null,
      verification_requested_at: null,
      verified_at: null,
      reviewed_at: null,
      reviewed_by: null,
      rejection_reason: null,
      rejection_feedback: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await page.route('**/rest/v1/**', (route) => {
      const url = route.request().url();
      if (url.includes('/brands')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([brandNotStarted]),
        });
      }
      if (url.includes('/profiles')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{ id: 'usr-seller-pending-01', role: 'user', is_seller: true, is_banned: false }]),
        });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.goto('/seller');
    await page.waitForLoadState('networkidle');

    // Title & description exact copy
    await expect(page.locator('text=Verify your Instagram handle to get your store reviewed.')).toBeVisible();
    await expect(page.locator('text=Recommended')).toBeVisible();
    await expect(page.locator('text=Add a code to your bio')).toBeVisible();
    await expect(page.locator('text=Send us a DM')).toBeVisible();

    // DM option is active and enabled
    expect(RABLO_INSTAGRAM_HANDLE).toBe('rijlo.store');
    const dmButton = page.locator('button:has-text("Choose DM Method")');
    await expect(dmButton).toBeVisible();
    await expect(dmButton).toBeEnabled();
  });

  test('9. Panel State: Code expired renders "Your code expired. Get a new code."', async ({ page, context }) => {
    await context.addCookies([{
      name: `sb-${ref}-auth-token`,
      value: encodeCookie(sellerPendingSession),
      domain: 'localhost',
      path: '/',
    }]);

    const brandExpired: Brand = {
      id: 'brand-expired',
      owner_id: 'usr-seller-pending-01',
      name: 'Expired Studio',
      slug: 'expired-studio',
      tagline: 'Art studio',
      bio: 'Fine art',
      logo_url: null,
      banner_url: null,
      creator_type: 'individual',
      instagram_url: 'https://instagram.com/expiredstudio',
      instagram_handle: 'expiredstudio',
      is_verified: false,
      approval_status: 'Pending',
      verification_method: 'bio_code',
      verification_code: 'RABLO-EXPIRED',
      verification_code_expires_at: new Date(Date.now() - 86400000).toISOString(), // Expired 1 day ago
      verification_requested_at: null,
      verified_at: null,
      reviewed_at: null,
      reviewed_by: null,
      rejection_reason: null,
      rejection_feedback: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await page.route('**/rest/v1/**', (route) => {
      const url = route.request().url();
      if (url.includes('/brands')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([brandExpired]),
        });
      }
      if (url.includes('/profiles')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{ id: 'usr-seller-pending-01', role: 'user', is_seller: true, is_banned: false }]),
        });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.goto('/seller');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('text=Your code expired. Get a new code.')).toBeVisible();
    await expect(page.locator('button:has-text("Get a new code")')).toBeVisible();
  });

  test('10. Panel State: Rejected renders feedback and "Fix and resubmit"', async ({ page, context }) => {
    await context.addCookies([{
      name: `sb-${ref}-auth-token`,
      value: encodeCookie(sellerPendingSession),
      domain: 'localhost',
      path: '/',
    }]);

    const brandRejected: Brand = {
      id: 'brand-rejected',
      owner_id: 'usr-seller-pending-01',
      name: 'Rejected Brand',
      slug: 'rejected-brand',
      tagline: 'Crafts',
      bio: 'Crafts maker',
      logo_url: null,
      banner_url: null,
      creator_type: 'individual',
      instagram_url: 'https://instagram.com/rejectedbrand',
      instagram_handle: 'rejectedbrand',
      is_verified: false,
      approval_status: 'Rejected',
      verification_method: 'bio_code',
      verification_code: 'RABLO-REJECT',
      verification_code_expires_at: null,
      verification_requested_at: null,
      verified_at: null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: 'admin-id',
      rejection_reason: 'Code was not found in your bio. Please try again.',
      rejection_feedback: 'Code was not found in your bio. Please try again.',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await page.route('**/rest/v1/**', (route) => {
      const url = route.request().url();
      if (url.includes('/brands')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([brandRejected]),
        });
      }
      if (url.includes('/profiles')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{ id: 'usr-seller-pending-01', role: 'user', is_seller: true, is_banned: false }]),
        });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.goto('/seller');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('text=Application Needs Revision')).toBeVisible();
    await expect(page.locator('text=Code was not found in your bio. Please try again.')).toBeVisible();
    await expect(page.locator('button:has-text("Fix and resubmit")')).toBeVisible();
  });

  // =========================================================================
  // 6. Admin Queue: Filters, Actions, Rejection Reason, Security
  // =========================================================================
  test('11. Admin verification queue: tabs, IG links, actions, and rejection modal', async ({ page, context }) => {
    const sessionObj = adminSession;
    const cookieVal = encodeCookie(sessionObj);
    await context.addCookies([{
      name: `sb-${ref}-auth-token`,
      value: cookieVal,
      domain: 'localhost',
      path: '/',
    }]);

    await page.addInitScript(({ refKey, payload }) => {
      window.localStorage.setItem(`sb-${refKey}-auth-token`, JSON.stringify(payload));
    }, { refKey: ref, payload: sessionObj });

    const queueBrands: Brand[] = [
      {
        id: 'b-review-needed',
        owner_id: 'seller-1',
        name: 'Artisan Glass',
        slug: 'artisan-glass',
        tagline: 'Blown Glass Art',
        bio: 'Glass maker',
        logo_url: null,
        banner_url: null,
        creator_type: 'individual',
        instagram_url: 'https://instagram.com/artisanglass',
        instagram_handle: 'artisanglass',
        is_verified: false,
        approval_status: 'Pending',
        verification_method: 'bio_code',
        verification_code: 'RABLO-GLASS1',
        verification_code_expires_at: new Date(Date.now() + 5 * 86400000).toISOString(),
        verification_requested_at: new Date().toISOString(),
        verified_at: null,
        reviewed_at: null,
        reviewed_by: null,
        rejection_reason: null,
        rejection_feedback: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'b-verified-pending',
        owner_id: 'seller-2',
        name: 'Leather Guild',
        slug: 'leather-guild',
        tagline: 'Handmade Bags',
        bio: 'Leather artisan',
        logo_url: null,
        banner_url: null,
        creator_type: 'individual',
        instagram_url: 'https://instagram.com/leatherguild',
        instagram_handle: 'leatherguild',
        is_verified: true,
        approval_status: 'Pending',
        verification_method: 'bio_code',
        verification_code: 'RABLO-LEATHER',
        verification_code_expires_at: new Date(Date.now() + 5 * 86400000).toISOString(),
        verification_requested_at: new Date().toISOString(),
        verified_at: new Date().toISOString(),
        reviewed_at: null,
        reviewed_by: null,
        rejection_reason: null,
        rejection_feedback: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    await page.route('**/rest/v1/**', (route) => {
      const url = route.request().url();
      if (url.includes('/brands')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(queueBrands),
        });
      }
      if (url.includes('/products')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      }
      if (url.includes('/profiles')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{ id: 'usr-admin-0004', email: 'sumitkatiyar783@gmail.com', role: 'admin' }]),
        });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // Switch to Verification Queue tab in admin
    const verifyTab = page.locator('button:has-text("Instagram Verification")').first();
    await expect(verifyTab).toBeVisible({ timeout: 10000 });
    await verifyTab.click();

    // Check tabs exist
    await expect(page.locator('button:has-text("Needs review")')).toBeVisible();
    await expect(page.locator('button:has-text("Verified - awaiting approval")')).toBeVisible();
    await expect(page.locator('button:has-text("Approved")')).toBeVisible();
    await expect(page.locator('button:has-text("Rejected")')).toBeVisible();

    // Check row details
    await expect(page.locator('text=Artisan Glass')).toBeVisible();
    const igLink = page.locator('a[href="https://instagram.com/artisanglass"]');
    await expect(igLink).toBeVisible();
    await expect(igLink).toHaveAttribute('target', '_blank');
    await expect(igLink).toHaveAttribute('rel', 'noopener noreferrer');

    // Code displayed for admin check
    await expect(page.locator('text=RABLO-GLASS1')).toBeVisible();

    // Actions visible
    await expect(page.locator('button:has-text("Verify + Approve")').first()).toBeVisible();
    await expect(page.locator('button:has-text("Verify only")').first()).toBeVisible();
    const rejectBtn = page.getByRole('button', { name: 'Reject', exact: true }).first();
    await expect(rejectBtn).toBeVisible();

    // Clicking Reject opens the rejection modal
    await rejectBtn.click();
    await expect(page.locator('text=Reject Brand Application')).toBeVisible();
    await expect(page.locator('textarea[placeholder*="Bio code was not found"]')).toBeVisible();
    
    // Confirm button in modal should be disabled when reason is empty
    const confirmRejectBtn = page.locator('button:has-text("Confirm Rejection")');
    await expect(confirmRejectBtn).toBeDisabled();

    // Type a reason
    await page.locator('textarea').fill('Instagram bio code not present');
    await expect(confirmRejectBtn).toBeEnabled();
  });

  test('12. Non-admin is blocked from /admin', async ({ page, context }) => {
    await context.addCookies([{
      name: `sb-${ref}-auth-token`,
      value: encodeCookie(sellerApprovedSession),
      domain: 'localhost',
      path: '/',
    }]);

    await page.goto('/admin');
    // Middleware redirects authenticated non-admin to /
    await page.waitForURL('http://localhost:4322/');
    expect(page.url()).not.toContain('/admin');
  });

});
