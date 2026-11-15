/**
 * RABLO — Unit Test Suite for Home Page Curation & Data Layer (Part 1)
 * Run with: node scripts/verify-home.mjs
 */

import assert from 'node:assert/strict';
import { computeTargetSize } from '../src/lib/imageResize.ts';
import {
  HOME_LIMITS,
  isSafeBannerLink,
} from '../src/lib/home.ts';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

console.log('\n--- Running Rablo Home Curation & Data Layer Unit Tests ---\n');

// ============================================================================
// 1. HOME_LIMITS Verification
// ============================================================================
console.log('1. HOME_LIMITS:');

test('enforces exact section caps and pagination limits', () => {
  assert.equal(HOME_LIMITS.banners, 8, 'Max banners must be 8');
  assert.equal(HOME_LIMITS.trendingProducts, 12, 'Max trending products must be 12');
  assert.equal(HOME_LIMITS.newArrivals, 8, 'New arrivals limit must be 8');
  assert.equal(HOME_LIMITS.trendingCreators, 8, 'Max trending creators must be 8');
  assert.equal(HOME_LIMITS.trendingCategories, 4, 'Max trending categories must be 4');
  assert.equal(HOME_LIMITS.allProductsPageSize, 8, 'Page size must be 8');
  assert.equal(HOME_LIMITS.allProductsMax, 48, 'Max products cap must be 48');
});

// ============================================================================
// 2. computeTargetSize Tests
// ============================================================================
console.log('\n2. computeTargetSize:');

test('never upscales images smaller than maxWidth', () => {
  const result = computeTargetSize(1200, 800, 1920);
  assert.deepEqual(result, { width: 1200, height: 800 });
});

test('never upscales images equal to maxWidth', () => {
  const result = computeTargetSize(1920, 1080, 1920);
  assert.deepEqual(result, { width: 1920, height: 1080 });
});

test('scales down wide images proportionally to maxWidth', () => {
  const result = computeTargetSize(3840, 2160, 1920);
  assert.deepEqual(result, { width: 1920, height: 1080 });
});

test('maintains aspect ratio for arbitrary resolutions and rounds integers', () => {
  const result = computeTargetSize(2500, 1250, 1920);
  assert.equal(result.width, 1920);
  assert.equal(result.height, 960);

  // Test rounding with odd aspect ratio
  const odd = computeTargetSize(2500, 1667, 1920);
  assert.equal(odd.width, 1920);
  assert.equal(odd.height, Math.round(1667 * (1920 / 2500)));
});

test('handles invalid, zero, or negative dimensions gracefully', () => {
  assert.deepEqual(computeTargetSize(0, 100, 1920), { width: 0, height: 0 });
  assert.deepEqual(computeTargetSize(100, 0, 1920), { width: 0, height: 0 });
  assert.deepEqual(computeTargetSize(-50, 100, 1920), { width: 0, height: 0 });
  assert.deepEqual(computeTargetSize(100, 100, 0), { width: 0, height: 0 });
  assert.deepEqual(computeTargetSize(100, 100, -100), { width: 0, height: 0 });
});

// ============================================================================
// 3. isSafeBannerLink Tests (matches SQL CHECK constraint)
// ============================================================================
console.log('\n3. isSafeBannerLink:');

test('accepts null, undefined, empty, and whitespace strings as optional links', () => {
  assert.equal(isSafeBannerLink(null), true);
  assert.equal(isSafeBannerLink(undefined), true);
  assert.equal(isSafeBannerLink(''), true);
  assert.equal(isSafeBannerLink('   '), true);
});

test('accepts valid internal paths starting with /', () => {
  assert.equal(isSafeBannerLink('/'), true);
  assert.equal(isSafeBannerLink('/catalog'), true);
  assert.equal(isSafeBannerLink('/creators/crochetbynia'), true);
  assert.equal(isSafeBannerLink('/search?q=pottery'), true);
  assert.equal(isSafeBannerLink('/products/d0000000-0000-0000-0000-000000000001'), true);
});

test('accepts secure https URLs', () => {
  assert.equal(isSafeBannerLink('https://rablo.in'), true);
  assert.equal(isSafeBannerLink('https://rablo.in/catalog'), true);
  assert.equal(isSafeBannerLink('https://instagram.com/rablo.in'), true);
});

test('rejects protocol-relative // URLs', () => {
  assert.equal(isSafeBannerLink('//evil.com'), false);
  assert.equal(isSafeBannerLink('//evil.com/phishing'), false);
});

test('rejects dangerous javascript:, data:, and vbscript: URIs', () => {
  assert.equal(isSafeBannerLink('javascript:alert(1)'), false);
  assert.equal(isSafeBannerLink('javascript:void(0)'), false);
  assert.equal(isSafeBannerLink('data:text/html,<script>alert(1)</script>'), false);
  assert.equal(isSafeBannerLink('vbscript:msgbox("hacked")'), false);
});

test('rejects insecure plain http URLs', () => {
  assert.equal(isSafeBannerLink('http://rablo.in'), false);
  assert.equal(isSafeBannerLink('http://example.com'), false);
});

test('rejects relative paths without a leading slash', () => {
  assert.equal(isSafeBannerLink('catalog'), false);
  assert.equal(isSafeBannerLink('creators/crochetbynia'), false);
  assert.equal(isSafeBannerLink('www.rablo.in'), false);
});

// ============================================================================
// 4. Pagination Math & hasMore Logic Tests
// ============================================================================
console.log('\n4. Pagination Math & hasMore Logic:');

function evaluateHasMore(page, returnedCount) {
  const pageSize = HOME_LIMITS.allProductsPageSize;
  const maxProducts = HOME_LIMITS.allProductsMax;
  if (page < 0 || page * pageSize >= maxProducts) return false;
  const reachedCap = (page + 1) * pageSize >= maxProducts;
  return returnedCount === pageSize && !reachedCap;
}

test('page 0 with full page of 8 items hasMore is true', () => {
  assert.equal(evaluateHasMore(0, 8), true);
});

test('pages 1 to 4 with full 8 items hasMore is true', () => {
  assert.equal(evaluateHasMore(1, 8), true); // 16 items
  assert.equal(evaluateHasMore(2, 8), true); // 24 items
  assert.equal(evaluateHasMore(3, 8), true); // 32 items
  assert.equal(evaluateHasMore(4, 8), true); // 40 items
});

test('page 5 (reaching 48 max products cap) hasMore is FALSE even if 8 items returned', () => {
  // (5 + 1) * 8 = 48 >= 48
  assert.equal(evaluateHasMore(5, 8), false);
});

test('any page with fewer than 8 items returned hasMore is FALSE', () => {
  assert.equal(evaluateHasMore(0, 7), false);
  assert.equal(evaluateHasMore(1, 3), false);
  assert.equal(evaluateHasMore(2, 0), false);
});

test('pages beyond cap or negative return false', () => {
  assert.equal(evaluateHasMore(6, 8), false);
  assert.equal(evaluateHasMore(10, 8), false);
  assert.equal(evaluateHasMore(-1, 8), false);
});

// ============================================================================
// SUMMARY
// ============================================================================
console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) {
  process.exit(1);
}
