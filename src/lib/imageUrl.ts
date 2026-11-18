/**
 * RABLO — High-Performance Responsive Image URL Utility
 * Works natively with Supabase Storage Free tier (pure static object URLs).
 * Resolves pre-generated variants (-200.webp, -450.webp, -1000.webp) with 100% backward
 * compatibility for legacy uploads, external URLs, and Unsplash images.
 * Zero dependency on paid /render/image/ endpoints or query parameter transformations.
 */

export type ImageVariant = 'thumbnail' | 'card' | 'detail';

export const IMAGE_VARIANTS = {
  thumbnail: 'thumbnail' as const,
  card: 'card' as const,
  detail: 'detail' as const,
  avatar: 'thumbnail' as const,
};

export const SIZES_PRESETS = {
  card: '(max-width: 639px) 50vw, (max-width: 1023px) 33vw, 25vw',
  avatar: '48px',
  thumbnail: '80px',
  detail: '(max-width: 1023px) 100vw, 60vw',
  banner: '100vw',
} as const;

// Matcher for multi-variant pre-generated Supabase URLs: -200.webp, -450.webp, -1000.webp
const VARIANT_SUFFIX_REGEX = /-(?:200|450|1000)\.webp(?:\?.*)?$/i;

/**
 * Check if a URL is a valid Supabase public storage object URL
 */
export function isSupabaseStorageUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  return /^https:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/public\//i.test(url.trim());
}

/**
 * Check if a URL has pre-generated multi-size variants
 */
export function hasImageVariants(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  return VARIANT_SUFFIX_REGEX.test(url.trim());
}

/**
 * Get the specific variant URL for a product image (thumbnail: 200px, card: 450px, detail: 1000px).
 * Fully backward-compatible: if the image does not have variants (e.g. legacy upload), returns original URL.
 */
export function getProductImageVariantUrl(
  url: string | null | undefined,
  variant: ImageVariant = 'card'
): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  const suffix = variant === 'thumbnail' ? '-200.webp' : variant === 'detail' ? '-1000.webp' : '-450.webp';

  // 1. Multi-variant Supabase object URLs
  if (VARIANT_SUFFIX_REGEX.test(trimmed)) {
    return trimmed.replace(VARIANT_SUFFIX_REGEX, suffix);
  }

  // 2. Unsplash demo images (support dynamic dimensions)
  if (trimmed.includes('images.unsplash.com')) {
    try {
      const parsed = new URL(trimmed);
      const w = variant === 'thumbnail' ? 200 : variant === 'card' ? 450 : 1000;
      parsed.searchParams.set('w', String(w));
      parsed.searchParams.set('auto', 'format');
      parsed.searchParams.set('q', '80');
      return parsed.toString();
    } catch {
      return trimmed;
    }
  }

  // 3. All other URLs (legacy Supabase uploads, signed URLs, external images): return as-is
  return trimmed;
}

/**
 * Generate a responsive srcset string using the actual pre-generated image files.
 * Returns empty string if the URL does not have pre-generated variants or dynamic sizing,
 * ensuring browsers use standard src without fake or duplicate requests.
 */
export function getProductImageSrcSet(url: string | null | undefined): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  // 1. Multi-variant Supabase images
  if (VARIANT_SUFFIX_REGEX.test(trimmed)) {
    const thumbUrl = trimmed.replace(VARIANT_SUFFIX_REGEX, '-200.webp');
    const cardUrl = trimmed.replace(VARIANT_SUFFIX_REGEX, '-450.webp');
    const detailUrl = trimmed.replace(VARIANT_SUFFIX_REGEX, '-1000.webp');
    return `${thumbUrl} 200w, ${cardUrl} 450w, ${detailUrl} 1000w`;
  }

  // 2. Unsplash demo images
  if (trimmed.includes('images.unsplash.com')) {
    try {
      const parsed = new URL(trimmed);
      parsed.searchParams.set('auto', 'format');
      parsed.searchParams.set('q', '80');

      parsed.searchParams.set('w', '200');
      const u200 = parsed.toString();

      parsed.searchParams.set('w', '450');
      const u450 = parsed.toString();

      parsed.searchParams.set('w', '1000');
      const u1000 = parsed.toString();

      return `${u200} 200w, ${u450} 450w, ${u1000} 1000w`;
    } catch {
      return '';
    }
  }

  // 3. Single legacy images or external URLs: no srcset, browser loads src directly
  return '';
}

/**
 * Backward-compatible helper for general images (avatars, banners, categories)
 */
export function getOptimizedImageUrl(
  url: string | null | undefined,
  variant: ImageVariant = 'card'
): string {
  return getProductImageVariantUrl(url, variant);
}

/**
 * Backward-compatible helper for general srcset
 */
export function getOptimizedImageSrcSet(
  url: string | null | undefined
): string {
  return getProductImageSrcSet(url);
}
