/**
 * RABLO — Category 1:1 Images & Data Layer Unit Tests
 * Run with: node scripts/verify-categories.mjs
 */

import assert from 'node:assert/strict';
import {
  DEFAULT_CATEGORY_IMAGES,
  getCategoryImageUrl,
  normalizeCategoryName,
  normalizeCategorySlug,
} from '../src/lib/categories.ts';

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

console.log('\n--- Running Rablo Category & 1:1 Images Unit Tests ---\n');

// 1. DEFAULT_CATEGORY_IMAGES
console.log('1. DEFAULT_CATEGORY_IMAGES:');

test('contains high-resolution WebP for all requested categories', () => {
  assert.equal(DEFAULT_CATEGORY_IMAGES['art'], '/categories/art-and-prints.webp');
  assert.equal(DEFAULT_CATEGORY_IMAGES['clothing'], '/categories/clothing-and-apparel.webp');
  assert.equal(DEFAULT_CATEGORY_IMAGES['crochet'], '/categories/crochet.webp');
  assert.equal(DEFAULT_CATEGORY_IMAGES['home-decor'], '/categories/home-and-decor.webp');
  assert.equal(DEFAULT_CATEGORY_IMAGES['jewelry'], '/categories/jewellery.webp');
  assert.equal(DEFAULT_CATEGORY_IMAGES['jewellery'], '/categories/jewellery.webp');
  assert.equal(DEFAULT_CATEGORY_IMAGES['mobile-accessories'], '/categories/mobile-accessories.webp');
  assert.equal(DEFAULT_CATEGORY_IMAGES['phone-covers'], '/categories/mobile-accessories.webp');
});

// 2. normalizeCategoryName & normalizeCategorySlug
console.log('\n2. Name and Slug Normalization:');

test('renames Phone Covers to Mobile Accessories and maps slug', () => {
  assert.equal(normalizeCategoryName('Phone Covers'), 'Mobile Accessories');
  assert.equal(normalizeCategorySlug('phone-covers'), 'mobile-accessories');
  assert.equal(normalizeCategoryName('Home Decor'), 'Home & Decor');
  assert.equal(normalizeCategoryName('Jewelry'), 'Jewellery');
});

// 3. getCategoryImageUrl
console.log('\n3. getCategoryImageUrl:');

test('prefers custom uploaded image_url if provided', () => {
  const custom = getCategoryImageUrl({
    name: 'Art & Prints',
    slug: 'art',
    image_url: 'https://storage.supabase.com/site-assets/categories/custom-art.webp',
  });
  assert.equal(custom, 'https://storage.supabase.com/site-assets/categories/custom-art.webp');
});

test('falls back to default high-resolution 1:1 asset by slug', () => {
  assert.equal(getCategoryImageUrl({ slug: 'art' }), '/categories/art-and-prints.webp');
  assert.equal(getCategoryImageUrl({ slug: 'clothing' }), '/categories/clothing-and-apparel.webp');
  assert.equal(getCategoryImageUrl({ slug: 'crochet' }), '/categories/crochet.webp');
  assert.equal(getCategoryImageUrl({ slug: 'home-decor' }), '/categories/home-and-decor.webp');
  assert.equal(getCategoryImageUrl({ slug: 'jewelry' }), '/categories/jewellery.webp');
  assert.equal(getCategoryImageUrl({ slug: 'mobile-accessories' }), '/categories/mobile-accessories.webp');
  assert.equal(getCategoryImageUrl({ slug: 'phone-covers' }), '/categories/mobile-accessories.webp');
});

test('falls back to default high-resolution 1:1 asset by keyword match in name', () => {
  assert.equal(getCategoryImageUrl({ name: 'Botanical Art & Prints' }), '/categories/art-and-prints.webp');
  assert.equal(getCategoryImageUrl({ name: 'Linen Clothing & Apparel' }), '/categories/clothing-and-apparel.webp');
  assert.equal(getCategoryImageUrl({ name: 'Crochet Creations' }), '/categories/crochet.webp');
  assert.equal(getCategoryImageUrl({ name: 'Home & Living Decor' }), '/categories/home-and-decor.webp');
  assert.equal(getCategoryImageUrl({ name: 'Handcrafted Jewellery' }), '/categories/jewellery.webp');
  assert.equal(getCategoryImageUrl({ name: 'Mobile Accessories & Covers' }), '/categories/mobile-accessories.webp');
});

test('returns null when category has no custom image and no matching keyword', () => {
  assert.equal(getCategoryImageUrl({ name: 'Unknown Category 123', slug: 'unknown-xyz' }), null);
});

console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) process.exit(1);

