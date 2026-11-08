/**
 * RABLO — Unit Test Suite for Contact Link Resolver & Sanitizer (Part 1)
 * Run with: node scripts/verify-contact.mjs
 */

import assert from 'node:assert/strict';
import {
  sanitizeContactUrl,
  buildMessage,
  resolveContact,
  getContactButtonLabel,
  ALLOWED_CONTACT_HOSTS,
} from '../src/lib/contact.ts';

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

console.log('\n--- Running Rablo Contact Resolver & Sanitizer Unit Tests ---\n');

// ============================================================================
// 1. sanitizeContactUrl Tests
// ============================================================================
console.log('1. sanitizeContactUrl:');

test('accepts valid https URLs for all allowed hosts', () => {
  for (const host of ALLOWED_CONTACT_HOSTS) {
    const url = `https://${host}/testuser`;
    const result = sanitizeContactUrl(url);
    assert.ok(result, `Expected ${url} to be allowed`);
    assert.ok(result.startsWith(`https://${host}`));
  }
});

test('accepts subdomains of allowed hosts', () => {
  const result = sanitizeContactUrl('https://api.whatsapp.com/send?phone=919876543210');
  assert.ok(result);
});

test('rejects plain http URLs', () => {
  assert.equal(sanitizeContactUrl('http://instagram.com/knotandthread'), null);
  assert.equal(sanitizeContactUrl('http://wa.me/919876543210'), null);
});

test('rejects untrusted domains and lookalikes', () => {
  assert.equal(sanitizeContactUrl('https://evil.com/instagram.com'), null);
  assert.equal(sanitizeContactUrl('https://fake-instagram.com/user'), null);
  assert.equal(sanitizeContactUrl('https://notwhatsapp.com/send'), null);
  assert.equal(sanitizeContactUrl('https://phishing.site'), null);
});

test('rejects javascript: and data: URIs', () => {
  assert.equal(sanitizeContactUrl('javascript:alert(1)'), null);
  assert.equal(sanitizeContactUrl('javascript:void(0)'), null);
  assert.equal(sanitizeContactUrl('data:text/html,<script>alert(1)</script>'), null);
});

test('rejects credentials in URLs', () => {
  assert.equal(sanitizeContactUrl('https://user:pass@instagram.com/victim'), null);
  assert.equal(sanitizeContactUrl('https://admin@wa.me/919876543210'), null);
});

test('rejects custom ports', () => {
  assert.equal(sanitizeContactUrl('https://instagram.com:8080/victim'), null);
  assert.equal(sanitizeContactUrl('https://wa.me:3000/919876543210'), null);
});

test('rejects URLs exceeding 500 characters', () => {
  const longUrl = 'https://instagram.com/' + 'a'.repeat(480);
  assert.equal(sanitizeContactUrl(longUrl), null);
});

test('handles null, undefined, empty, and whitespace gracefully', () => {
  assert.equal(sanitizeContactUrl(null), null);
  assert.equal(sanitizeContactUrl(undefined), null);
  assert.equal(sanitizeContactUrl(''), null);
  assert.equal(sanitizeContactUrl('   '), null);
});


// ============================================================================
// 2. buildMessage Tests
// ============================================================================
console.log('\n2. buildMessage:');

test('interpolates all placeholders with default template', () => {
  const msg = buildMessage(null, {
    brandName: 'Nia Sharma',
    productName: 'Crochet Daisy Tote',
    price: 899,
    productUrl: 'https://rablo.in/products/item-123',
  });

  assert.equal(
    msg,
    'Hi Nia Sharma! I found "Crochet Daisy Tote" (₹899) on Rablo and I\'m interested. https://rablo.in/products/item-123'
  );
});

test('interpolates custom template', () => {
  const tmpl = 'Hello {brand_name}! Interested in {product_name} at ₹{price}. Link: {product_url}';
  const msg = buildMessage(tmpl, {
    brandName: 'Clay Craft',
    productName: 'Ceramic Mug',
    price: 499,
    productUrl: 'https://rablo.in/products/mug-1',
  });

  assert.equal(msg, 'Hello Clay Craft! Interested in Ceramic Mug at ₹499. Link: https://rablo.in/products/mug-1');
});

test('handles missing or empty context fields gracefully', () => {
  const msg = buildMessage(null, {});
  assert.ok(msg.includes('Hi Creator!'));
  assert.ok(msg.includes('this creation'));
  assert.ok(msg.includes('Price on request'));
});


// ============================================================================
// 3. resolveContact Resolution Order & Templating Tests
// ============================================================================
console.log('\n3. resolveContact:');

test('Resolution order 1: Per-product override takes highest precedence', () => {
  const resolved = resolveContact({
    product: {
      id: 'prod-1',
      name: 'Daisy Bag',
      price: 899,
      product_ig_url: 'https://wa.me/919999999999',
    },
    brandContact: {
      contact_type: 'instagram',
      link_template: 'https://instagram.com/brand_template',
    },
    brand: {
      name: 'Nia Shop',
      instagram_url: 'https://instagram.com/fallback_ig',
    },
  });

  assert.ok(resolved);
  assert.equal(resolved.type, 'whatsapp');
  assert.ok(resolved.url.includes('919999999999'));
});

test('Resolution order 2: Brand contact template used when no product override', () => {
  const resolved = resolveContact({
    product: {
      id: 'prod-2',
      name: 'Ceramic Pot',
      price: 699,
      product_ig_url: null,
    },
    brandContact: {
      contact_type: 'whatsapp',
      link_template: 'https://wa.me/918888888888',
    },
    brand: {
      name: 'Clay Studio',
      instagram_url: 'https://instagram.com/fallback_ig',
    },
  });

  assert.ok(resolved);
  assert.equal(resolved.type, 'whatsapp');
  assert.ok(resolved.url.includes('918888888888'));
});

test('Resolution order 3: Falls back to seller Instagram when no templates exist', () => {
  const resolved = resolveContact({
    product: {
      id: 'prod-3',
      name: 'Silver Ring',
      price: 1200,
    },
    brand: {
      name: 'Silver Line',
      instagram_url: 'https://instagram.com/silverline_art',
    },
  });

  assert.ok(resolved);
  assert.equal(resolved.type, 'instagram');
  assert.equal(resolved.prefillSupported, false);
  assert.ok(resolved.url.includes('instagram.com/silverline_art'));
});

test('WhatsApp prefill: prefillSupported is true and text query is set', () => {
  const resolved = resolveContact({
    product: {
      id: 'prod-wa',
      name: 'Handmade Scarf',
      price: 450,
      contact_link: 'https://wa.me/919876543210',
    },
    brand: { name: 'Weave Studio' },
  });

  assert.ok(resolved);
  assert.equal(resolved.type, 'whatsapp');
  assert.equal(resolved.prefillSupported, true);
  assert.ok(resolved.url.includes('text='));
  const parsed = new URL(resolved.url);
  assert.ok(parsed.searchParams.get('text')?.includes('Handmade Scarf'));
});

test('Instagram contact: prefillSupported is false', () => {
  const resolved = resolveContact({
    product: {
      id: 'prod-ig',
      name: 'Resin Art',
      price: 999,
      product_ig_url: 'https://instagram.com/p/DB12345678',
    },
    brand: { name: 'Resin Magic' },
  });

  assert.ok(resolved);
  assert.equal(resolved.type, 'instagram');
  assert.equal(resolved.prefillSupported, false);
});

test('Placeholder URL encoding: special characters are properly encoded in URLs', () => {
  const resolved = resolveContact({
    product: {
      id: 'prod-special',
      name: 'Bag & "Scarf" / Special',
      price: 1500,
    },
    brandContact: {
      contact_type: 'whatsapp',
      link_template: 'https://wa.me/919876543210?text={message}',
    },
    brand: { name: 'Artisan & Co.' },
  });

  assert.ok(resolved);
  // Ensure double quotes and ampersands in message body don't break the URL
  assert.ok(!resolved.url.includes('"'));
  assert.ok(resolved.url.includes(encodeURIComponent('Bag & "Scarf" / Special')));
});


// ============================================================================
// 4. getContactButtonLabel Tests
// ============================================================================
console.log('\n4. getContactButtonLabel:');

test('returns appropriate labels by contact type', () => {
  assert.equal(getContactButtonLabel('whatsapp'), 'Chat on WhatsApp');
  assert.equal(getContactButtonLabel('instagram'), 'Contact on Instagram');
  assert.equal(getContactButtonLabel('custom'), 'Contact creator');
  assert.equal(getContactButtonLabel(undefined), 'Contact creator');
});

console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) {
  process.exit(1);
}
