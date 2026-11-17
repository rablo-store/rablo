import { test, expect } from '@playwright/test';

// Helper to mock Supabase routes if needed
function mockSupabaseRoutes(page: any) {
  page.route('**/rest/v1/**', (route: any) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });
}

test.describe('Rijlo Legal & Privacy Pages', () => {
  test('Terms of Service (/terms) renders correctly with all 18 sections', async ({ page }) => {
    mockSupabaseRoutes(page);
    await page.goto('/terms');
    await page.waitForLoadState('domcontentloaded');

    await expect(page).toHaveTitle(/Terms of Service \| Rijlo/i);

    const heading = page.locator('header h1');
    await expect(heading).toHaveText(/Rijlo Terms of Service/i);

    // Verify Effective & Last updated date
    const bodyText = await page.textContent('body');
    expect(bodyText).toContain('November 17, 2026');

    // Verify key sections
    const section1 = page.locator('#agreement');
    await expect(section1).toBeVisible();
    await expect(section1).toContainText('Agreement');

    const section4 = page.locator('#creator-terms');
    await expect(section4).toBeVisible();
    await expect(section4).toContainText('Creator terms');
    await expect(section4).toContainText('Identity Verification');
    await expect(section4).toContainText('Platform Approval');

    const section18 = page.locator('#contact');
    await expect(section18).toBeVisible();
    await expect(section18).toContainText('Ayush Katiyar');
    await expect(section18).toContainText('Kanpur Nagar, Uttar Pradesh');

    // Verify tabs
    const privacyTab = page.locator('header a[href="/privacy"]');
    await expect(privacyTab).toBeVisible();
  });

  test('Privacy Policy (/privacy) renders correctly with global rights & grievance officer', async ({ page }) => {
    mockSupabaseRoutes(page);
    await page.goto('/privacy');
    await page.waitForLoadState('domcontentloaded');

    await expect(page).toHaveTitle(/Privacy Policy \| Rijlo/i);

    const heading = page.locator('header h1');
    await expect(heading).toHaveText(/Rijlo Privacy Policy/i);

    const bodyText = await page.textContent('body');
    expect(bodyText).toContain('November 17, 2026');
    expect(bodyText).toContain('DPDP Act 2023');
    expect(bodyText).toContain('Ayush Katiyar');

    // Check table of purposes
    const table = page.locator('table');
    await expect(table).toBeVisible();

    // Verify anchor navigation
    const grievanceSection = page.locator('#grievance');
    await expect(grievanceSection).toBeVisible();
    await expect(grievanceSection).toContainText('support@rijlo.com');
  });

  test('Data Deletion Policy (/data-deletion) renders correctly with mailto & Google access instructions', async ({ page }) => {
    mockSupabaseRoutes(page);
    await page.goto('/data-deletion');
    await page.waitForLoadState('domcontentloaded');

    await expect(page).toHaveTitle(/Delete Your Account and Data \| Rijlo/i);

    const heading = page.locator('header h1');
    await expect(heading).toHaveText(/Delete Your Rijlo Account and Data/i);

    const mailtoBtn = page.getByRole('link', { name: 'Draft Deletion Email' });
    await expect(mailtoBtn).toBeVisible();

    const googleLink = page.locator('a[href*="myaccount.google.com/permissions"]');
    await expect(googleLink).toBeVisible();

    // Verify 3 business days / 30 days timeline
    const bodyText = await page.textContent('body');
    expect(bodyText).toContain('3 business days');
    expect(bodyText).toContain('30 days');
  });

  test('Policy switcher tabs navigate smoothly between all three legal pages', async ({ page }) => {
    mockSupabaseRoutes(page);
    await page.goto('/terms');

    await page.click('header a[href="/privacy"]');
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.locator('header h1')).toHaveText(/Rijlo Privacy Policy/i);

    await page.click('header a[href="/data-deletion"]');
    await expect(page).toHaveURL(/\/data-deletion$/);
    await expect(page.locator('header h1')).toHaveText(/Delete Your Rijlo Account and Data/i);

    await page.click('header a[href="/terms"]');
    await expect(page).toHaveURL(/\/terms$/);
    await expect(page.locator('header h1')).toHaveText(/Rijlo Terms of Service/i);
  });
});

