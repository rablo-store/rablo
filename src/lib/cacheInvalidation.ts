/**
 * Cross-module cache invalidation bus.
 * Prevents circular dependencies between home.ts, products.ts, and admin actions.
 */

type InvalidationCallback = () => void;
const listeners = new Set<InvalidationCallback>();

/**
 * Register a callback to be triggered when the home page or catalog caches need invalidation.
 */
export function onHomeCurationInvalidate(callback: InvalidationCallback): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

/**
 * Invalidate all home curation and product page in-memory caches.
 */
export function invalidateHomeCurationCache(): void {
  for (const callback of listeners) {
    try {
      callback();
    } catch (err) {
      console.error('Rablo: Error during cache invalidation:', err);
    }
  }
}

