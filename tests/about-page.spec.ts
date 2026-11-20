import { test, expect } from '@playwright/test';

test.describe('About Rijlo Page (/about) and /our-story 301 Redirect', () => {
  test('1. Status 200, single H1, title, meta description, and canonical link', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      // Ignore offline external font/API network resolution errors in test environment
      if (msg.type() === 'error' && !msg.text().includes('ERR_NAME_NOT_RESOLVED')) {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    const response = await page.goto('/about');
    expect(response?.status()).toBe(200);

    // Exactly one H1
    const h1s = page.locator('h1');
    await expect(h1s).toHaveCount(1);
    await expect(h1s).toHaveText(/About Rijlo/i);

    // Page title under 60 chars
    const title = await page.title();
    expect(title).toMatch(/About Rijlo/i);
    expect(title.length).toBeLessThanOrEqual(60);

    // Meta description under 160 chars
    const descriptionLocator = page.locator('meta[name="description"]');
    await expect(descriptionLocator).toHaveCount(1);
    const description = await descriptionLocator.getAttribute('content');
    expect(description).toBeTruthy();
    expect(description?.length).toBeLessThanOrEqual(160);
    expect(description).toContain('discovery catalog');

    // Canonical URL points to https://rijlo.com/about
    const canonical = page.locator('link[rel="canonical"]');
    await expect(canonical).toHaveCount(1);
    await expect(canonical).toHaveAttribute('href', 'https://rijlo.com/about');

    // No console errors
    expect(consoleErrors).toHaveLength(0);
  });

  test('2. JSON-LD parses with AboutPage and Organization schema', async ({ page }) => {
    await page.goto('/about');

    const jsonLdScripts = page.locator('script[type="application/ld+json"]');
    const count = await jsonLdScripts.count();
    expect(count).toBeGreaterThan(0);

    let foundAbout = false;
    let foundOrg = false;

    for (let i = 0; i < count; i++) {
      const text = await jsonLdScripts.nth(i).textContent();
      if (!text) continue;
      try {
        const parsed = JSON.parse(text);
        const graph = parsed['@graph'] || [parsed];
        for (const item of graph) {
          if (item['@type'] === 'AboutPage') {
            foundAbout = true;
            expect(item.url).toBe('https://rijlo.com/about');
            expect(item.name).toContain('About Rijlo');
          }
          if (item['@type'] === 'Organization') {
            foundOrg = true;
            expect(item.name).toBe('Rijlo');
            expect(item.url).toBe('https://rijlo.com');
            expect(item.logo).toBe('https://rijlo.com/brand/logo.webp');
          }
        }
      } catch {}
    }

    expect(foundAbout).toBe(true);
    expect(foundOrg).toBe(true);
  });

  test('3. Audience tabs work by mouse click, keyboard navigation, and deep links (#sellers, #shoppers, ?for=sellers)', async ({ page }) => {
    await page.goto('/about');

    const tablist = page.locator('#audience-tablist');
    await tablist.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    const shoppersTab = page.locator('#tab-shoppers');
    const sellersTab = page.locator('#tab-sellers');
    const shoppersPanel = page.locator('#tabpanel-shoppers');
    const sellersPanel = page.locator('#tabpanel-sellers');

    // Default view: shoppers
    await expect(shoppersTab).toHaveAttribute('aria-selected', 'true');
    await expect(shoppersPanel).toBeVisible();
    await expect(sellersPanel).toBeHidden();

    // Mouse click: switch to sellers
    await sellersTab.click();
    await expect(sellersTab).toHaveAttribute('aria-selected', 'true');
    await expect(sellersPanel).toBeVisible();
    await expect(shoppersPanel).toBeHidden();

    // Mouse click: switch back to shoppers
    await shoppersTab.click();
    await expect(shoppersTab).toHaveAttribute('aria-selected', 'true');
    await expect(shoppersPanel).toBeVisible();
    await expect(sellersPanel).toBeHidden();

    // Keyboard navigation: ArrowRight / ArrowLeft
    await shoppersTab.focus();
    await page.keyboard.press('ArrowRight');
    await expect(sellersTab).toHaveAttribute('aria-selected', 'true');
    await expect(sellersPanel).toBeVisible();
    await expect(sellersTab).toBeFocused();

    await page.keyboard.press('ArrowLeft');
    await expect(shoppersTab).toHaveAttribute('aria-selected', 'true');
    await expect(shoppersPanel).toBeVisible();
    await expect(shoppersTab).toBeFocused();

    // Deep link via hash #sellers
    await page.goto('/about#sellers');
    await page.locator('#audience-tablist').scrollIntoViewIfNeeded();
    await expect(sellersPanel).toBeVisible();
    await expect(shoppersPanel).toBeHidden();

    // Deep link via hash #shoppers
    await page.goto('/about#shoppers');
    await page.locator('#audience-tablist').scrollIntoViewIfNeeded();
    await expect(shoppersPanel).toBeVisible();
    await expect(sellersPanel).toBeHidden();

    // Server-rendered initial tab via query param ?for=sellers
    await page.goto('/about?for=sellers');
    await expect(sellersPanel).toBeVisible();
    await expect(shoppersPanel).toBeHidden();
  });

  test('4. With JavaScript disabled, both audience panels are visible via noscript fallback', async ({ browser }) => {
    const noJsContext = await browser.newContext({ javaScriptEnabled: false });
    const noJsPage = await noJsContext.newPage();

    await noJsPage.goto('/about');

    const shoppersPanel = noJsPage.locator('#tabpanel-shoppers');
    const sellersPanel = noJsPage.locator('#tabpanel-sellers');

    await expect(shoppersPanel).toBeVisible();
    await expect(sellersPanel).toBeVisible();

    await noJsContext.close();
  });

  test('5. Seller checklist matches real upload-form required fields and supports interactive toggling', async ({ page }) => {
    // Navigate with ?for=sellers so the seller panel is rendered and visible immediately
    await page.goto('/about?for=sellers');
    await page.locator('#audience-section').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    // Required fields: name, price, thumbnail_url, brand_id
    await expect(page.getByText('Required Field: name')).toBeVisible();
    await expect(page.getByText('Required Field: price')).toBeVisible();
    await expect(page.getByText('Required Field: thumbnail_url')).toBeVisible();
    await expect(page.getByText('Required Field: brand_id')).toBeVisible();

    // Interactive checkbox click
    const titleCheckbox = page.locator('label:has-text("Product Title / Name") input[type="checkbox"]');
    await expect(titleCheckbox).not.toBeChecked();
    await titleCheckbox.check();
    await expect(titleCheckbox).toBeChecked();
  });

  test('6. Native <details> FAQ accordions open and close without JavaScript dependency', async ({ page }) => {
    await page.goto('/about');

    const detailsList = page.locator('details');
    const detailsCount = await detailsList.count();
    expect(detailsCount).toBeGreaterThanOrEqual(6);

    // First item is open by default
    const firstDetails = detailsList.first();
    await expect(firstDetails).toHaveAttribute('open', '');

    // Second item is closed initially
    const secondDetails = detailsList.nth(1);
    await expect(secondDetails).not.toHaveAttribute('open');

    // Click second summary to open
    const secondSummary = secondDetails.locator('summary');
    await secondSummary.click();
    await expect(secondDetails).toHaveAttribute('open', '');

    // Click again to close
    await secondSummary.click();
    await expect(secondDetails).not.toHaveAttribute('open');
  });

  test('7. Viewport 320px and 360px have zero horizontal scroll on /about', async ({ page }) => {
    for (const width of [320, 360]) {
      await page.setViewportSize({ width, height: 740 });
      await page.goto('/about');

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth, `Viewport ${width}px horizontal overflow detected`).toBeLessThanOrEqual(clientWidth);
    }
  });

  test('8. Page contains NO people photographs or AI faces (only brand logo & SVGs)', async ({ page }) => {
    await page.goto('/about');

    const images = page.locator('main img, #main-content img, .store-width img');
    const imgCount = await images.count();

    for (let i = 0; i < imgCount; i++) {
      const src = await images.nth(i).getAttribute('src');
      // Only logo or SVG icons allowed, absolutely no unsplash or avatar photos
      expect(src).toMatch(/(\/brand\/logo|\.svg)/);
      expect(src).not.toMatch(/unsplash\.com/);
      expect(src).not.toMatch(/avatar|photo|portrait|person|face/i);
    }
  });

  test('9. /our-story permanently 301-redirects to /about', async ({ page }) => {
    // Check raw HTTP status code without following redirects
    const response = await page.request.get('/our-story', { maxRedirects: 0 });
    expect(response.status()).toBe(301);
    expect(response.headers()['location']).toBe('/about');

    // Check full browser navigation lands on /about
    await page.goto('/our-story');
    await expect(page).toHaveURL(/\/about$/);
    await expect(page).toHaveTitle(/About Rijlo/i);
  });

  test('10. Footer links to /about and sitemap includes /about without /our-story', async ({ page }) => {
    await page.goto('/');

    const footerAboutLink = page.locator('footer a[href="/about"]');
    await expect(footerAboutLink).toBeVisible();

    const sitemapRes = await page.request.get('/sitemap.xml');
    expect(sitemapRes.ok()).toBeTruthy();
    const sitemapText = await sitemapRes.text();
    expect(sitemapText).toContain('https://rijlo.com/about');
    expect(sitemapText).not.toContain('https://rijlo.com/our-story');
  });

  test('11. All internal links on /about return non-404 status codes', async ({ page }) => {
    await page.goto('/about');

    const hrefs = await page.locator('a[href^="/"]').evaluateAll((anchors: HTMLAnchorElement[]) =>
      Array.from(new Set(anchors.map((a) => a.getAttribute('href') || '').filter((h) => h.startsWith('/') && !h.startsWith('/#'))))
    );

    expect(hrefs.length).toBeGreaterThan(0);

    for (const href of hrefs) {
      const res = await page.request.get(href, { maxRedirects: 5 });
      expect(res.status(), `Internal link ${href} returned 404 or server error`).toBeLessThan(400);
    }
  });
});
