/**
 * RABLO — Edge Cache Key & Visibility Helpers
 * - Attaches BUILD_ID to cache keys so new deployments invalidate stale cached HTML.
 * - Manages Cloudflare Worker edge cache (caches.default) with in-memory fallback for local dev/testing.
 */

declare const __BUILD_ID__: string | undefined;

export const BUILD_ID: string =
  (typeof __BUILD_ID__ !== 'undefined' && __BUILD_ID__) ||
  (typeof process !== 'undefined' &&
    (process.env.CF_PAGES_COMMIT_SHA ||
      process.env.GITHUB_SHA ||
      process.env.COMMIT_SHA ||
      process.env.BUILD_ID)) ||
  'dev-build';

/**
 * Creates an edge cache key with the current or specified build ID appended as an internal parameter.
 * The '__b=' parameter exists strictly inside the cache key and never leaks into visitor-facing URLs.
 */
export function createEdgeCacheKey(
  requestUrl: string | URL,
  buildId: string = BUILD_ID
): Request {
  const url = typeof requestUrl === 'string' ? new URL(requestUrl) : new URL(requestUrl.toString());
  const separator = url.search ? '&' : '?';
  const cacheUrl = `${url.origin}${url.pathname}${url.search}${separator}__b=${encodeURIComponent(buildId)}`;
  return new Request(cacheUrl, {
    method: 'GET',
  });
}

export interface EdgeCacheStore {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}

// In-memory cache fallback for Node.js test environments or local preview where caches.default is undefined
const memoryCache = new Map<
  string,
  {
    body: ArrayBuffer;
    status: number;
    statusText: string;
    headers: [string, string][];
  }
>();

export function resetMemoryEdgeCache(): void {
  memoryCache.clear();
}

/**
 * Accesses Cloudflare's caches.default or falls back to an in-memory store.
 */
export function getEdgeCache(): EdgeCacheStore {
  if (typeof caches !== 'undefined' && (caches as any).default) {
    return (caches as any).default as EdgeCacheStore;
  }

  return {
    async match(request: Request): Promise<Response | undefined> {
      const entry = memoryCache.get(request.url);
      if (!entry) return undefined;
      return new Response(entry.body.slice(0), {
        status: entry.status,
        statusText: entry.statusText,
        headers: new Headers(entry.headers),
      });
    },
    async put(request: Request, response: Response): Promise<void> {
      const body = await response.clone().arrayBuffer();
      memoryCache.set(request.url, {
        body,
        status: response.status,
        statusText: response.statusText,
        headers: Array.from(response.headers.entries()),
      });
    },
  };
}

