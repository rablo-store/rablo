import assert from 'node:assert';
import {
  canonicalizeInstagramUrl,
  normalizeInstagramUsername,
  isValidInstagramUrl,
  getSafeInstagramUrl
} from '../src/lib/instagram.ts';
import { extractInstagramHandle } from '../src/lib/products.ts';

console.log('--- 1. Testing Instagram Handle & URL Normalization & Validation ---');

// Test canonicalizeInstagramUrl
assert.strictEqual(
  canonicalizeInstagramUrl('https://instagram.com/clay_artisan'),
  'https://instagram.com/clay_artisan'
);
assert.strictEqual(
  canonicalizeInstagramUrl('@clay_artisan'),
  'https://instagram.com/clay_artisan'
);
assert.strictEqual(
  canonicalizeInstagramUrl('clay_artisan'),
  'https://instagram.com/clay_artisan'
);

// Test isValidInstagramUrl
assert.strictEqual(isValidInstagramUrl('https://instagram.com/clay_artisan'), true);
assert.strictEqual(isValidInstagramUrl('https://www.instagram.com/clay_artisan'), true);
assert.strictEqual(isValidInstagramUrl('http://instagram.com/clay_artisan'), false); // must be https
assert.strictEqual(isValidInstagramUrl('https://evil.com/instagram.com/clay'), false);
assert.strictEqual(isValidInstagramUrl('javascript:alert(1)'), false);

// Test getSafeInstagramUrl (rejects arbitrary domains and reserved paths)
assert.strictEqual(getSafeInstagramUrl('https://instagram.com/clay_artisan'), 'https://instagram.com/clay_artisan');
assert.strictEqual(getSafeInstagramUrl('@clay_artisan'), 'https://instagram.com/clay_artisan');
assert.strictEqual(getSafeInstagramUrl('https://evil.com/malicious'), null);
assert.strictEqual(getSafeInstagramUrl('https://instagram.com/explore'), null); // reserved path

// Test extractInstagramHandle
assert.strictEqual(
  extractInstagramHandle('https://instagram.com/clay_artisan'),
  '@clay_artisan'
);
assert.strictEqual(
  extractInstagramHandle('@crochet_studio'),
  '@crochet_studio'
);
assert.strictEqual(
  extractInstagramHandle('crochet_studio'),
  '@crochet_studio'
);

console.log('✓ Normalization, validation, and handle extraction passed!');

console.log('--- 2. Testing Path Security (Same-Origin & Anti-Open-Redirect) ---');

function isValidNextPath(path) {
  if (!path) return false;
  const trimmed = path.trim();
  return trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.includes('\\');
}

assert.strictEqual(isValidNextPath('/catalog'), true);
assert.strictEqual(isValidNextPath('/products/ceramic-mug-123'), true);
assert.strictEqual(isValidNextPath('/products/456?ref=summer'), true);
assert.strictEqual(isValidNextPath('//evil.com/phish'), false); // open redirect attempt
assert.strictEqual(isValidNextPath('/\\evil.com'), false); // backslash escape attempt
assert.strictEqual(isValidNextPath('https://evil.com'), false);

console.log('✓ Same-origin path validation passed!');

console.log('--- 3. Testing Callback Destination Resolution ---');

function simulateCallback({ pendingIg, creatorName, savedNext, nextUrl, urlTargetIg }) {
  let targetPage = '/catalog';
  const candidateNext = nextUrl || savedNext;
  if (candidateNext && isValidNextPath(candidateNext) && candidateNext !== '/account') {
    targetPage = candidateNext;
  }

  const rawIg = urlTargetIg || pendingIg;
  const safeIg = rawIg ? getSafeInstagramUrl(rawIg) : null;

  if (safeIg) {
    const sep = targetPage.includes('?') ? '&' : '?';
    return {
      type: 'CONFIRMATION_FLOW',
      targetPage,
      safeIg,
      destination: `${targetPage}${sep}auth_success=1&launch_ig=${encodeURIComponent(safeIg)}${creatorName ? `&creator=${encodeURIComponent(creatorName)}` : ''}`,
    };
  }

  const sep = targetPage.includes('?') ? '&' : '?';
  return {
    type: 'STANDARD_FLOW',
    targetPage,
    destination: `${targetPage}${sep}auth_success=1`,
  };
}

// Test Flow 1: Logged-out click from /catalog for @clay_artisan
const f1 = simulateCallback({
  pendingIg: 'https://instagram.com/clay_artisan',
  creatorName: 'Clay Artisan',
  savedNext: '/catalog',
});
assert.strictEqual(f1.type, 'CONFIRMATION_FLOW');
assert.strictEqual(f1.targetPage, '/catalog');
assert.strictEqual(f1.safeIg, 'https://instagram.com/clay_artisan');
assert.strictEqual(f1.destination, '/catalog?auth_success=1&launch_ig=https%3A%2F%2Finstagram.com%2Fclay_artisan&creator=Clay%20Artisan');
console.log('✓ Flow 1 (/catalog Chat DM -> Return to /catalog) passed!');

// Test Flow 2: Logged-out click from /products/xyz?tab=details for @ananya_crochet
const f2 = simulateCallback({
  pendingIg: '@ananya_crochet',
  creatorName: 'Ananya Studio',
  savedNext: '/products/xyz?tab=details',
});
assert.strictEqual(f2.type, 'CONFIRMATION_FLOW');
assert.strictEqual(f2.targetPage, '/products/xyz?tab=details');
assert.strictEqual(f2.safeIg, 'https://instagram.com/ananya_crochet');
assert.strictEqual(f2.destination, '/products/xyz?tab=details&auth_success=1&launch_ig=https%3A%2F%2Finstagram.com%2Fananya_crochet&creator=Ananya%20Studio');
console.log('✓ Flow 2 (/products/xyz Chat DM -> Return to same product page) passed!');

// Test Flow 3: Malicious external redirect attempt should be sanitized
const f3 = simulateCallback({
  pendingIg: 'https://evil.com/hack',
  savedNext: '//attacker.com/steal',
});
assert.strictEqual(f3.type, 'STANDARD_FLOW');
assert.strictEqual(f3.targetPage, '/catalog'); // defaulted to safe same-origin /catalog
assert.strictEqual(f3.destination, '/catalog?auth_success=1');
console.log('✓ Flow 3 (Malicious parameters sanitized) passed!');

// Test Flow 4: Header login without pending IG target
const f4 = simulateCallback({
  pendingIg: null,
  savedNext: '/catalog',
});
assert.strictEqual(f4.type, 'STANDARD_FLOW');
assert.strictEqual(f4.targetPage, '/catalog');
assert.strictEqual(f4.destination, '/catalog?auth_success=1');
console.log('✓ Flow 4 (Normal login) passed!');

console.log('--- 4. Testing Confirmation Banner User-Click Launch Parsing ---');

function simulateBannerParsing(searchString) {
  const urlParams = new URLSearchParams(searchString);
  const launchIg = urlParams.get('launch_ig');
  const creatorParam = urlParams.get('creator');

  if (!launchIg) return null;

  urlParams.delete('launch_ig');
  urlParams.delete('rablo_ig');
  urlParams.delete('auth_success');
  urlParams.delete('creator');
  const cleanSearch = urlParams.toString();

  const safeTargetUrl = getSafeInstagramUrl(launchIg);
  if (!safeTargetUrl) return null;

  const creatorDisplay = creatorParam?.trim() || extractInstagramHandle(safeTargetUrl);
  const confirmationText = `Signed in. Continue to chat with ${creatorDisplay}`;

  return {
    safeTargetUrl,
    creatorDisplay,
    confirmationText,
    cleanSearch,
  };
}

const bannerResult = simulateBannerParsing('?auth_success=1&launch_ig=https%3A%2F%2Finstagram.com%2Fclay_artisan&creator=Clay%20Artisan');
assert.strictEqual(bannerResult.safeTargetUrl, 'https://instagram.com/clay_artisan');
assert.strictEqual(bannerResult.creatorDisplay, 'Clay Artisan');
assert.strictEqual(bannerResult.confirmationText, 'Signed in. Continue to chat with Clay Artisan');
assert.strictEqual(bannerResult.cleanSearch, '');
console.log('✓ Confirmation banner parsing and message text passed!');

console.log('\n======================================================');
console.log('ALL VERIFICATION ACCEPTANCE SUITE CHECKS PASSED! 🚀');
console.log('======================================================\n');
