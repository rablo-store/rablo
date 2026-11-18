import assert from 'node:assert';
import {
  getProductImageVariantUrl,
  getProductImageSrcSet,
  isSupabaseStorageUrl,
  hasImageVariants,
  SIZES_PRESETS,
  IMAGE_VARIANTS,
} from '../src/lib/imageUrl.ts';

console.log('Testing Image Optimization & Variant Handling...');

// 1. Supabase public URL detection
const validSupabaseUrl = 'https://xyzcompany.supabase.co/storage/v1/object/public/product-images/user_123/1700000000_photo-450.webp';
const legacySupabaseUrl = 'https://xyzcompany.supabase.co/storage/v1/object/public/product-images/user_123/1700000000_photo.jpg';
const externalUrl = 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&q=80';
const otherExternal = 'https://cdn.example.com/uploads/item.png';

assert.strictEqual(isSupabaseStorageUrl(validSupabaseUrl), true, 'Should detect valid Supabase storage URL');
assert.strictEqual(isSupabaseStorageUrl(legacySupabaseUrl), true, 'Should detect legacy Supabase storage URL');
assert.strictEqual(isSupabaseStorageUrl(externalUrl), false, 'Unsplash is not Supabase');
assert.strictEqual(isSupabaseStorageUrl(otherExternal), false, 'Other CDN is not Supabase');
assert.strictEqual(isSupabaseStorageUrl(null), false, 'Null safe');
assert.strictEqual(isSupabaseStorageUrl(''), false, 'Empty safe');

// 2. Variant detection
assert.strictEqual(hasImageVariants(validSupabaseUrl), true, 'Should detect -450.webp suffix');
assert.strictEqual(hasImageVariants(legacySupabaseUrl), false, 'Should detect lack of variant suffix');

// 3. Variant URL resolution
const thumbUrl = getProductImageVariantUrl(validSupabaseUrl, 'thumbnail');
const cardUrl = getProductImageVariantUrl(validSupabaseUrl, 'card');
const detailUrl = getProductImageVariantUrl(validSupabaseUrl, 'detail');

assert.strictEqual(
  thumbUrl,
  'https://xyzcompany.supabase.co/storage/v1/object/public/product-images/user_123/1700000000_photo-200.webp',
  'Thumbnail should resolve to -200.webp'
);
assert.strictEqual(
  cardUrl,
  'https://xyzcompany.supabase.co/storage/v1/object/public/product-images/user_123/1700000000_photo-450.webp',
  'Card should resolve to -450.webp'
);
assert.strictEqual(
  detailUrl,
  'https://xyzcompany.supabase.co/storage/v1/object/public/product-images/user_123/1700000000_photo-1000.webp',
  'Detail should resolve to -1000.webp'
);

// 4. Backward compatibility: Legacy URLs must NOT be corrupted or modified
assert.strictEqual(
  getProductImageVariantUrl(legacySupabaseUrl, 'thumbnail'),
  legacySupabaseUrl,
  'Legacy upload URL must remain unchanged'
);
assert.strictEqual(
  getProductImageVariantUrl(otherExternal, 'detail'),
  otherExternal,
  'External URL must remain unchanged'
);

// 5. Unsplash dynamic variant resolution
const unsplashThumb = getProductImageVariantUrl(externalUrl, 'thumbnail');
assert.ok(unsplashThumb.includes('w=200'), 'Unsplash thumbnail should have w=200');
assert.ok(unsplashThumb.includes('auto=format'), 'Unsplash thumbnail should have auto=format');

const unsplashDetail = getProductImageVariantUrl(externalUrl, 'detail');
assert.ok(unsplashDetail.includes('w=1000'), 'Unsplash detail should have w=1000');

// 6. Responsive srcset generation
const srcset = getProductImageSrcSet(validSupabaseUrl);
assert.ok(srcset.includes('-200.webp 200w'), 'srcset should contain 200w');
assert.ok(srcset.includes('-450.webp 450w'), 'srcset should contain 450w');
assert.ok(srcset.includes('-1000.webp 1000w'), 'srcset should contain 1000w');

// Legacy image srcset should be empty to prevent invalid requests
assert.strictEqual(getProductImageSrcSet(legacySupabaseUrl), '', 'Legacy images should return empty srcset');
assert.strictEqual(getProductImageSrcSet(otherExternal), '', 'Unknown external images should return empty srcset');

// 7. Verify NO /render/image/ or transform params exist in output
assert.ok(!srcset.includes('/render/image/'), 'Must not generate /render/image/');
assert.ok(!thumbUrl.includes('/render/image/'), 'Must not generate /render/image/');
assert.ok(!thumbUrl.includes('width='), 'Must not use query params on Supabase URLs');

// 8. Preset checks
assert.ok(SIZES_PRESETS.card, 'Sizes presets card exists');
assert.ok(SIZES_PRESETS.detail, 'Sizes presets detail exists');
assert.strictEqual(IMAGE_VARIANTS.thumbnail, 'thumbnail');

console.log('✓ All 8 image optimization & variant unit assertions passed successfully!');

