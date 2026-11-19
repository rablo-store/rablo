import { test, expect } from '@playwright/test';
import { createEdgeCacheKey, BUILD_ID } from '../src/lib/edge-cache';

test.describe('Edge Cache Key & Visibility System', () => {
  test('1. Build ID creates distinct cache keys and preserves query params', () => {
    const url1 = 'https://rablo.store/catalog';
    const keyA = createEdgeCacheKey(url1, 'deploy-sha-1111');
    const keyB = createEdgeCacheKey(url1, 'deploy-sha-2222');

    expect(keyA.url).toBe('https://rablo.store/catalog?__b=deploy-sha-1111');
    expect(keyB.url).toBe('https://rablo.store/catalog?__b=deploy-sha-2222');
    expect(keyA.url).not.toBe(keyB.url);

    // Query parameters preservation
    const urlWithQuery = 'https://rablo.store/catalog?category=crochet&sort=price';
    const keyWithQuery = createEdgeCacheKey(urlWithQuery, 'deploy-sha-1111');
    expect(keyWithQuery.url).toBe('https://rablo.store/catalog?category=crochet&sort=price&__b=deploy-sha-1111');

    // Default BUILD_ID export is defined and non-empty
    expect(BUILD_ID).toBeTruthy();
    const defaultKey = createEdgeCacheKey(url1);
    expect(defaultKey.url).toContain(`__b=${encodeURIComponent(BUILD_ID)}`);
  });

  test('2. Cache behavior headers: MISS on first load with Server-Timing, HIT on second load without leaking __b', async ({ request }) => {
    // Public cacheable route to test MISS then HIT
    const testUrl = '/catalog';

    // 1. First fetch (MISS or HIT)
    const res1 = await request.get(testUrl);
    expect(res1.status()).toBe(200);

    const edgeCache1 = res1.headers()['x-edge-cache'];
    expect(['MISS', 'HIT']).toContain(edgeCache1);

    if (edgeCache1 === 'MISS') {
      const serverTiming = res1.headers()['server-timing'];
      expect(serverTiming).toBeDefined();
      expect(serverTiming).toMatch(/app;dur=\d+/);
    }

    // Key must never leak into response headers or body
    for (const [headerName, headerVal] of Object.entries(res1.headers())) {
      expect(headerVal).not.toContain('__b=');
      expect(headerName).not.toContain('__b');
    }
    const body1 = await res1.text();
    expect(body1).not.toContain('__b=');

    // 2. Second fetch should HIT from edge cache
    const res2 = await request.get(testUrl);
    expect(res2.status()).toBe(200);
    const edgeCache2 = res2.headers()['x-edge-cache'];
    expect(edgeCache2).toBe('HIT');

    // On HIT, Server-Timing duration from initial generation is not attached
    const serverTiming2 = res2.headers()['server-timing'];
    expect(serverTiming2).toBeUndefined();

    // Body of cached response also never leaks __b
    const body2 = await res2.text();
    expect(body2).not.toContain('__b=');
  });

  test('3. Authenticated requests bypass edge cache with BYPASS', async ({ request }) => {
    const res = await request.get('/catalog', {
      headers: {
        Cookie: 'sb-localhost-auth-token=mock_session_token',
      },
    });

    expect(res.status()).toBe(200);
    expect(res.headers()['x-edge-cache']).toBe('BYPASS');
    expect(res.headers()['cache-control']).toContain('private');
    expect(res.headers()['cache-control']).toContain('no-store');
  });

  test('4. Authorization header requests bypass edge cache with BYPASS', async ({ request }) => {
    const res = await request.get('/catalog', {
      headers: {
        Authorization: 'Bearer mock_bearer_token',
      },
    });

    expect(res.status()).toBe(200);
    expect(res.headers()['x-edge-cache']).toBe('BYPASS');
    expect(res.headers()['cache-control']).toContain('private');
    expect(res.headers()['cache-control']).toContain('no-store');
  });

  test('5. Private routes bypass edge cache with BYPASS', async ({ request }) => {
    const res = await request.get('/account');
    expect(res.headers()['x-edge-cache']).toBe('BYPASS');
    expect(res.headers()['cache-control']).toContain('private');
  });

  test('6. Non-GET requests bypass edge cache with BYPASS', async ({ request }) => {
    const res = await request.post('/catalog', {
      data: { test: true },
    });

    expect(res.headers()['x-edge-cache']).toBe('BYPASS');
  });
});

