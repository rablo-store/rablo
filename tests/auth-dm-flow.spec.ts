import { test, expect } from '@playwright/test';

const mockProducts = [
  {
    id: 'test-product-1',
    name: 'Handcrafted Terracotta Vessel',
    description: 'Wheel-thrown organic earthen pot for contemporary home decor',
    price: 1200,
    stock: 5,
    approval_status: 'Approved',
    seller_id: 'seller-1',
    seller_ig_url: 'https://instagram.com/clay_artisan',
    product_ig_url: 'https://instagram.com/clay_artisan',
    thumbnail_url: '/brand/favicon.png',
    gallery_urls: [],
    created_at: new Date().toISOString(),
    seller: {
      full_name: 'Clay Artisan',
      avatar_url: '',
      instagram_url: 'https://instagram.com/clay_artisan'
    }
  }
];

const mockCategories = [
  { id: 'cat-1', name: 'Pottery & Ceramics', slug: 'pottery', is_approved: true }
];

test.describe('Instagram Chat DM Auth & Direct Commerce Flow', () => {

  test.beforeEach(async ({ page }) => {
    // Mock Supabase API calls so tests run deterministically regardless of live DB credentials
    await page.route('**/rest/v1/products*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockProducts),
      });
    });

    await page.route('**/rest/v1/categories*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockCategories),
      });
    });
  });

  test('1. Logged out on /catalog: Chat DM click opens AuthModal, keeps scroll locked, shows Google sign-in', async ({ page }) => {
    await page.goto('/catalog');
    
    // Find the Chat DM or Sign in to view Insta ID button
    const dmButton = page.locator('button:has-text("Sign in to view Insta ID"), button:has-text("DM"), button:has-text("Chat DM")').first();
    await expect(dmButton).toBeVisible({ timeout: 10000 });
    
    // Click the DM button
    await dmButton.click();
    
    // AuthModal should open with role="dialog"
    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible();
    await expect(modal.getByRole('heading', { name: 'Sign in with Google' })).toBeVisible();
    await expect(modal.locator('button:has-text("Sign In / Sign Up with Google")')).toBeVisible();
    
    // Document body should have overflow: hidden
    const overflow = await page.evaluate(() => document.body.style.overflow);
    expect(overflow).toBe('hidden');
  });

  test('2. Dismiss AuthModal with Escape key clears pending state and unlocks scroll', async ({ page }) => {
    await page.goto('/catalog');
    
    const dmButton = page.locator('button:has-text("Sign in to view Insta ID"), button:has-text("DM")').first();
    await expect(dmButton).toBeVisible({ timeout: 10000 });
    await dmButton.click();
    
    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible();
    
    // Press Escape to dismiss
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
    
    // Verify body overflow is unlocked
    const overflow = await page.evaluate(() => document.body.style.overflow);
    expect(overflow).toBe('');
    
    // Verify pending IG redirect was removed from storage
    const pendingIg = await page.evaluate(() => localStorage.getItem('rablo:pending_ig_redirect'));
    expect(pendingIg).toBeNull();
  });

  test('3. bfcache pageshow restores interactive UI and unlocks body scroll', async ({ page }) => {
    await page.goto('/catalog');
    
    const dmButton = page.locator('button:has-text("Sign in to view Insta ID"), button:has-text("DM")').first();
    await expect(dmButton).toBeVisible({ timeout: 10000 });
    await dmButton.click();
    
    // Simulate browser Back (pageshow event with persisted=true)
    await page.evaluate(() => {
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    });
    
    // Body overflow must be unlocked
    const overflow = await page.evaluate(() => document.body.style.overflow);
    expect(overflow).toBe('');
    
    // Modal should be closed
    const modal = page.locator('div[role="dialog"]');
    await expect(modal).not.toBeVisible();
  });

  test('4. Returning from Google Auth renders the user-gesture confirmation toast', async ({ page }) => {
    // Navigate with post-auth parameters matching Requirement 4
    await page.goto('/catalog?auth_success=1&launch_ig=https%3A%2F%2Finstagram.com%2Fclay_artisan&creator=Clay%20Artisan');
    
    // Confirmation banner must be visible
    const banner = page.locator('#rablo-ig-launcher-banner');
    await expect(banner).toBeVisible({ timeout: 5000 });
    await expect(banner).toContainText('Signed in. Continue to chat with Clay Artisan');
    
    // Must contain a user-click action button with target="_blank"
    const launchBtn = page.locator('#rablo-ig-launch-btn');
    await expect(launchBtn).toBeVisible();
    await expect(launchBtn).toHaveAttribute('target', '_blank');
    await expect(launchBtn).toHaveAttribute('href', 'https://instagram.com/clay_artisan');
    
    // URL query parameters must be cleaned without refreshing the page
    await expect(page).toHaveURL(/\/catalog$/);
  });

  test('5. Product detail page preserves return target to same product', async ({ page }) => {
    await page.goto('/products/test-product-1?auth_success=1&launch_ig=https%3A%2F%2Finstagram.com%2Fclay_artisan&creator=Clay%20Artisan');
    
    const banner = page.locator('#rablo-ig-launcher-banner');
    await expect(banner).toBeVisible({ timeout: 5000 });
    await expect(banner).toContainText('Signed in. Continue to chat with Clay Artisan');
    await expect(page.locator('#rablo-ig-launch-btn')).toHaveAttribute('href', 'https://instagram.com/clay_artisan');
  });

  test('6. Banned user is halted and presented with ban screen on auth callback', async ({ page }) => {
    // When a banned user is detected, callback renders the ban screen
    await page.goto('/auth/callback?error=access_denied&error_description=User+is+banned');
    
    const errorEl = page.locator('#callback-error');
    await expect(errorEl).toBeVisible({ timeout: 5000 });
    await expect(errorEl).toContainText('Google Authentication Error');
  });

});
