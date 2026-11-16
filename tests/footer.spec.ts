import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

const TEST_WIDTHS = [320, 390, 768, 1280, 1920];
const TEST_PAGES = ['/', '/catalog'];

// Helper to mock Supabase calls
function mockSupabaseRoutes(page: any) {
  page.route('**/rest/v1/**', (route: any) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });
}

test.describe('Footer Redesign & Contrast Verification', () => {

  // Ensure test-results/footer directory exists
  test.beforeAll(() => {
    const dir = path.join(process.cwd(), 'test-results', 'footer');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  for (const pagePath of TEST_PAGES) {
    for (const width of TEST_WIDTHS) {
      test(`Footer layout, contrast, and visibility on ${pagePath} at ${width}px`, async ({ page }) => {
        mockSupabaseRoutes(page);
        await page.setViewportSize({ width, height: 900 });
        await page.goto(pagePath);
        await page.waitForLoadState('domcontentloaded');

        const footer = page.locator('footer');
        await expect(footer).toBeVisible();

        // 1. Check for zero horizontal scroll
        const hasHorizontalScroll = await page.evaluate(() => {
          return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });
        expect(hasHorizontalScroll).toBe(false);

        // 2. Compute real colour contrast for EVERY text node inside footer
        const contrastResults = await footer.evaluate((footerEl) => {
          const canvas = document.createElement('canvas');
          canvas.width = 1;
          canvas.height = 1;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });

          function getEffectiveOpacity(el: Element, stopEl: Element): number {
            let opacity = 1;
            let curr: Element | null = el;
            while (curr && curr !== stopEl.parentElement) {
              const op = parseFloat(window.getComputedStyle(curr).opacity);
              if (!isNaN(op)) opacity *= op;
              curr = curr.parentElement;
            }
            return opacity;
          }

          function getBackgroundColor(el: Element, fallback: [number, number, number]): [number, number, number] {
            let curr: Element | null = el;
            while (curr) {
              const bg = window.getComputedStyle(curr).backgroundColor;
              if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') {
                if (ctx) {
                  ctx.clearRect(0, 0, 1, 1);
                  ctx.fillStyle = 'rgba(0,0,0,0)';
                  ctx.fillStyle = bg;
                  ctx.fillRect(0, 0, 1, 1);
                  const d = ctx.getImageData(0, 0, 1, 1).data;
                  if (d[3] > 10) {
                    return [d[0], d[1], d[2]];
                  }
                }
              }
              if (curr === footerEl) break;
              curr = curr.parentElement;
            }
            return fallback;
          }

          function getCompositedColor(
            fgStr: string,
            bgRgb: [number, number, number],
            extraOpacity = 1
          ): [number, number, number] {
            if (ctx) {
              ctx.clearRect(0, 0, 1, 1);
              ctx.fillStyle = `rgb(${bgRgb[0]}, ${bgRgb[1]}, ${bgRgb[2]})`;
              ctx.fillRect(0, 0, 1, 1);
              ctx.globalAlpha = extraOpacity;
              ctx.fillStyle = fgStr;
              ctx.fillRect(0, 0, 1, 1);
              ctx.globalAlpha = 1;
              const data = ctx.getImageData(0, 0, 1, 1).data;
              return [data[0], data[1], data[2]];
            }
            return [255, 255, 255];
          }

          function channelLuminance(val: number): number {
            const s = val / 255;
            return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
          }

          function relativeLuminance(rgb: [number, number, number]): number {
            return (
              0.2126 * channelLuminance(rgb[0]) +
              0.7152 * channelLuminance(rgb[1]) +
              0.0722 * channelLuminance(rgb[2])
            );
          }

          function getContrastRatio(l1: number, l2: number): number {
            const lighter = Math.max(l1, l2);
            const darker = Math.min(l1, l2);
            return (lighter + 0.05) / (darker + 0.05);
          }

          const defaultBg: [number, number, number] = [48, 37, 31]; // Espresso #30251F
          const footerBg = getBackgroundColor(footerEl, defaultBg);

          const walker = document.createTreeWalker(footerEl, NodeFilter.SHOW_TEXT);
          const results: Array<{
            text: string;
            tag: string;
            fontSize: number;
            color: string;
            compositedRgb: string;
            bgRgb: string;
            ratio: number;
            requiredRatio: number;
            passed: boolean;
          }> = [];

          let node: Node | null;
          while ((node = walker.nextNode())) {
            const txt = node.textContent?.trim();
            if (!txt) continue;

            const parent = node.parentElement;
            if (!parent) continue;

            const style = window.getComputedStyle(parent);
            if (style.display === 'none' || style.visibility === 'hidden') continue;

            const fontSize = parseFloat(style.fontSize) || 14;
            const fontWeight = parseInt(style.fontWeight, 10) || 400;
            const extraOpacity = getEffectiveOpacity(parent, footerEl);

            const bgRgb = getBackgroundColor(parent.parentElement || parent, footerBg);
            const compositedFg = getCompositedColor(style.color, bgRgb, extraOpacity);

            const fgLum = relativeLuminance(compositedFg);
            const bgLum = relativeLuminance(bgRgb);
            const ratio = parseFloat(getContrastRatio(fgLum, bgLum).toFixed(2));

            const isLarge = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
            const requiredRatio = isLarge ? 3.0 : 4.5;

            results.push({
              text: txt.substring(0, 30),
              tag: parent.tagName.toLowerCase(),
              fontSize,
              color: style.color,
              compositedRgb: `rgb(${compositedFg.join(',')})`,
              bgRgb: `rgb(${bgRgb.join(',')})`,
              ratio,
              requiredRatio,
              passed: ratio >= requiredRatio,
            });
          }

          return results;
        });

        // Fail if any text node has contrast below the required threshold
        expect(contrastResults.length).toBeGreaterThan(0);
        for (const res of contrastResults) {
          expect(
            res.passed,
            `Contrast failure on <${res.tag}> "${res.text}": ratio ${res.ratio}:1 is below required ${res.requiredRatio}:1 (color: ${res.color}, composited: ${res.compositedRgb}, bg: ${res.bgRgb})`
          ).toBe(true);
        }

        // 3. The wordmark, all column headings, all links, and copyright are visible and non-empty
        const wordmark = footer.locator('.footer-brand-wordmark');
        await expect(wordmark).toBeVisible();
        await expect(wordmark).toHaveText('Rablo');

        const headings = footer.locator('h3');
        const headingTexts = await headings.allTextContents();
        expect(headingTexts).toContain('Discover & Explore');
        expect(headingTexts).toContain('Independent Creators');
        expect(headingTexts).toContain('Platform & Trust');

        const links = footer.locator('a');
        const linkCount = await links.count();
        expect(linkCount).toBeGreaterThanOrEqual(10); // Brand link + 9 navigation links

        const copyright = footer.getByText(/All rights reserved/i);
        await expect(copyright).toBeVisible();

        // 4. Verify no footer link points to /admin, and every internal link exists
        for (let i = 0; i < linkCount; i++) {
          const link = links.nth(i);
          const href = await link.getAttribute('href');
          expect(href).toBeTruthy();
          expect(href).not.toContain('/admin');
          await expect(link).toBeVisible();
        }

        // 5. The page does not contain sumitkatiyar783@gmail.com inside the footer
        const footerHtml = await footer.innerHTML();
        expect(footerHtml).not.toContain('sumitkatiyar783@gmail.com');
        expect(footerHtml).not.toContain('Admin Moderation');

        // 6. Focus outline & phone link height check
        for (let i = 0; i < linkCount; i++) {
          const link = links.nth(i);
          await link.focus();

          const focusStyle = await link.evaluate((el) => {
            const s = window.getComputedStyle(el);
            return {
              outlineStyle: s.outlineStyle,
              outlineWidth: parseFloat(s.outlineWidth) || 0,
              boxShadow: s.boxShadow,
            };
          });

          const hasVisibleFocus =
            (focusStyle.outlineStyle !== 'none' && focusStyle.outlineWidth > 0) ||
            (focusStyle.boxShadow && focusStyle.boxShadow !== 'none');
          expect(hasVisibleFocus).toBe(true);

          if (width < 640) {
            const box = await link.boundingBox();
            expect(box).not.toBeNull();
            if (box) {
              expect(
                box.height,
                `Link "${await link.innerText()}" at ${width}px has height ${box.height}px, must be >= 44px`
              ).toBeGreaterThanOrEqual(44);
            }
          }
        }
      });
    }
  }

  // 4. Status below 400 for all internal links
  test('Every internal footer link responds with status < 400', async ({ page }) => {
    mockSupabaseRoutes(page);
    await page.goto('/');
    const links = page.locator('footer a');
    const count = await links.count();

    for (let i = 0; i < count; i++) {
      const href = await links.nth(i).getAttribute('href');
      expect(href).not.toContain('/admin');
      if (href && href.startsWith('/')) {
        const response = await page.request.get(href);
        expect(response.status()).toBeLessThan(400);
      }
    }
  });

  // Save screenshots at widths 390, 768, and 1440
  const SCREENSHOT_WIDTHS = [390, 768, 1440];
  for (const w of SCREENSHOT_WIDTHS) {
    test(`Save footer screenshot at ${w}px width`, async ({ page }) => {
      mockSupabaseRoutes(page);
      await page.setViewportSize({ width: w, height: 900 });
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const footer = page.locator('footer');
      await footer.scrollIntoViewIfNeeded();
      const screenshotPath = path.join(process.cwd(), 'test-results', 'footer', `footer-${w}.png`);
      await footer.screenshot({ path: screenshotPath });

      expect(fs.existsSync(screenshotPath)).toBe(true);
    });
  }
});

