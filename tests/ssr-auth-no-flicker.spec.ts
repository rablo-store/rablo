import { test, expect } from '@playwright/test';

test.describe('SSR Authentication & Hydration Flicker Prevention', () => {
  const ref = 'ogakjurjotthhcbpqhqf';

  const userSessionPayload = {
    access_token: 'fake-user-access-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'fake-user-refresh-token',
    user: {
      id: 'usr-1234-5678',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'ananya.sharma@example.com',
      user_metadata: {
        full_name: 'Ananya Sharma',
        avatar_url: '',
      },
      app_metadata: {
        provider: 'google',
      },
      created_at: '2026-01-01T00:00:00.000Z',
    },
  };

  const adminSessionPayload = {
    access_token: 'fake-admin-access-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'fake-admin-refresh-token',
    user: {
      id: 'admin-0001',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'sumitkatiyar783@gmail.com',
      user_metadata: {
        full_name: 'Sumit Katiyar',
        avatar_url: '',
      },
      app_metadata: {
        provider: 'google',
      },
      created_at: '2026-01-01T00:00:00.000Z',
    },
  };

  test('1. Server HTML contains logged-in user avatar initials before any client JS executes', async ({ request }) => {
    const base64User = 'base64-' + Buffer.from(JSON.stringify(userSessionPayload)).toString('base64url');

    // Make direct HTTP GET request to SSR home page with auth cookie
    const response = await request.get('/', {
      headers: {
        Cookie: `sb-${ref}-auth-token=${base64User}`,
      },
    });

    expect(response.status()).toBe(200);
    const html = await response.text();

    // Verify initial HTML from server already has user avatar
    expect(html).toContain('aria-label="Account menu for ananya.sharma@example.com"');
    expect(html).toContain('AS'); // Initials for Ananya Sharma
    // Ensure "Sign In" button is NOT rendered in the initial HTML for authenticated user
    expect(html).not.toContain('<span class="hidden sm:inline">Sign In</span>');
  });

  test('2. Server HTML contains admin shield avatar when admin is logged in', async ({ request }) => {
    const base64Admin = 'base64-' + Buffer.from(JSON.stringify(adminSessionPayload)).toString('base64url');

    // Make direct HTTP GET request to SSR home page with admin cookie
    const response = await request.get('/', {
      headers: {
        Cookie: `sb-${ref}-auth-token=${base64Admin}`,
      },
    });

    expect(response.status()).toBe(200);
    const html = await response.text();

    // Verify initial HTML from server already has admin account menu
    expect(html).toContain('aria-label="Account menu for sumitkatiyar783@gmail.com"');
    expect(html).toContain('Superadmin: sumitkatiyar783@gmail.com');
    // Ensure "Sign In" button is NOT rendered in the initial HTML
    expect(html).not.toContain('<span class="hidden sm:inline">Sign In</span>');
  });

  test('3. Server HTML contains Sign In button for guest users without cookies', async ({ request }) => {
    // Make direct HTTP GET request without any auth cookies
    const response = await request.get('/');

    expect(response.status()).toBe(200);
    const html = await response.text();

    // Initial HTML for guest user contains Sign In button
    expect(html).toContain('Sign In');
    expect(html).toContain('aria-label="Sign in to your account"');
    expect(html).not.toContain('Account menu for');
  });

  test('4. Browser page load and reload has zero hydration flicker or unauthenticated flash', async ({ page, context }) => {
    const base64User = 'base64-' + Buffer.from(JSON.stringify(userSessionPayload)).toString('base64url');

    await context.addCookies([
      {
        name: `sb-${ref}-auth-token`,
        value: base64User,
        domain: 'localhost',
        path: '/',
      },
    ]);

    await page.route('**/auth/v1/user*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(userSessionPayload.user),
      });
    });

    // Mock profiles lookup
    await page.route('**/rest/v1/profiles*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: userSessionPayload.user.id,
          email: userSessionPayload.user.email,
          full_name: 'Ananya Sharma',
          avatar_url: '',
          is_banned: false,
          is_seller: false,
          role: 'user',
        }),
      });
    });

    // Navigate to home page
    await page.goto('/');

    // Verify avatar button is immediately visible with correct initials
    const avatarButton = page.locator('button[aria-label="Account menu for ananya.sharma@example.com"]');
    await expect(avatarButton).toBeVisible();
    await expect(avatarButton).toContainText('AS');

    // Confirm "Sign In" button is never visible on the page
    const signInBtn = page.locator('a[aria-label="Sign in to your account"]');
    await expect(signInBtn).toHaveCount(0);

    // Reload the page: avatar must remain present without flickering to "Sign In"
    await page.reload();
    await expect(avatarButton).toBeVisible();
    await expect(signInBtn).toHaveCount(0);
  });

  test('5. Catalog and Categories SSR routes also render avatar on server side', async ({ request }) => {
    const base64User = 'base64-' + Buffer.from(JSON.stringify(userSessionPayload)).toString('base64url');

    for (const path of ['/catalog', '/categories', '/faq', '/our-story']) {
      const response = await request.get(path, {
        headers: {
          Cookie: `sb-${ref}-auth-token=${base64User}`,
        },
      });

      expect(response.status()).toBe(200);
      const html = await response.text();
      expect(html).toContain('aria-label="Account menu for ananya.sharma@example.com"');
      expect(html).not.toContain('<span class="hidden sm:inline">Sign In</span>');
    }
  });
});

