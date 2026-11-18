/**
 * RABLO — Supabase Storage Operations
 * Client-side multi-variant image compression & upload to 'product-images' bucket.
 * Generates 200px (thumbnail), 450px (card), and 1000px (detail) WebP variants before upload.
 * Sets long-lived immutable Cache-Control headers since paths are timestamp-versioned.
 * Zero dependency on paid Supabase image transformation add-ons.
 */

import { supabase, isSupabaseConfigured } from './supabase';
import { resizeToWebp, cropAndResizeToSquareWebp } from './imageResize';

const BUCKET = 'product-images';

export interface StorageUploadResult {
  success: boolean;
  url?: string; // 450px card variant URL (primary)
  path?: string; // 450px card variant path
  thumbnailUrl?: string; // 200px thumbnail variant URL
  detailUrl?: string; // 1000px detail variant URL
  error?: string;
}

/**
 * Upload an image file to Supabase Storage.
 * Generates 3 pre-compressed WebP variants for products:
 *   - 200px (thumbnail, quality 0.80)
 *   - 450px (card, quality 0.82)
 *   - 1000px (detail, quality 0.85)
 * For brand logos: generates a 600px 1:1 square WebP.
 * Uses unique timestamp-versioned paths with 1-year immutable Cache-Control.
 */
export async function uploadProductImage(
  file: File,
  userId?: string,
  subfolder?: string
): Promise<StorageUploadResult> {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, error: 'Storage not configured' };
  }

  let folder = userId;
  if (!folder) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      folder = session?.user?.id || 'public';
    } catch {
      folder = 'public';
    }
  }

  const timestamp = Date.now();
  const rawBaseName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanSub = subfolder ? subfolder.replace(/^\/+|\/+$/g, '') : null;
  const folderPath = cleanSub ? `${folder}/${cleanSub}` : folder;

  const isImage = typeof window !== 'undefined' &&
    (file.type.startsWith('image/') || /\.(jpe?g|png|webp|avif)$/i.test(file.name));

  // Case A: Brand Logo / Square Avatar (600x600 1:1 WebP)
  if (isImage && (cleanSub === 'brand' || cleanSub === 'logo')) {
    try {
      const logoBlob = await cropAndResizeToSquareWebp(file, 600, 0.88);
      const filePath = `${folderPath}/${timestamp}_${rawBaseName}.webp`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, logoBlob, {
          cacheControl: '31536000',
          contentType: 'image/webp',
          upsert: false,
        });

      if (uploadError) {
        return { success: false, error: uploadError.message };
      }

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
      return {
        success: true,
        url: urlData.publicUrl,
        path: filePath,
      };
    } catch (err) {
      console.warn('Rablo: Logo processing fallback to raw file:', err);
    }
  }

  // Case B: Product Photography — Generate 3 Pre-compressed WebP Variants (200px, 450px, 1000px)
  if (isImage) {
    try {
      const [thumbBlob, cardBlob, detailBlob] = await Promise.all([
        resizeToWebp(file, 200, 0.80),
        resizeToWebp(file, 450, 0.82),
        resizeToWebp(file, 1000, 0.85),
      ]);

      const path200 = `${folderPath}/${timestamp}_${rawBaseName}-200.webp`;
      const path450 = `${folderPath}/${timestamp}_${rawBaseName}-450.webp`;
      const path1000 = `${folderPath}/${timestamp}_${rawBaseName}-1000.webp`;

      // Upload all 3 variants in parallel
      const uploadResults = await Promise.all([
        supabase.storage.from(BUCKET).upload(path200, thumbBlob, {
          cacheControl: '31536000',
          contentType: 'image/webp',
          upsert: false,
        }),
        supabase.storage.from(BUCKET).upload(path450, cardBlob, {
          cacheControl: '31536000',
          contentType: 'image/webp',
          upsert: false,
        }),
        supabase.storage.from(BUCKET).upload(path1000, detailBlob, {
          cacheControl: '31536000',
          contentType: 'image/webp',
          upsert: false,
        }),
      ]);

      const firstError = uploadResults.find((r) => r.error)?.error;
      if (firstError) {
        // Rollback uploaded variants if any fail
        await supabase.storage.from(BUCKET).remove([path200, path450, path1000]);
        return { success: false, error: firstError.message };
      }

      const { data: url200 } = supabase.storage.from(BUCKET).getPublicUrl(path200);
      const { data: url450 } = supabase.storage.from(BUCKET).getPublicUrl(path450);
      const { data: url1000 } = supabase.storage.from(BUCKET).getPublicUrl(path1000);

      return {
        success: true,
        url: url450.publicUrl, // Primary URL for product cards & listings
        path: path450,
        thumbnailUrl: url200.publicUrl,
        detailUrl: url1000.publicUrl,
      };
    } catch (procErr) {
      console.warn('Rablo: Multi-variant generation fallback to raw file:', procErr);
    }
  }

  // Case C: Fallback to single raw file upload
  const ext = file.name.split('.').pop() || 'jpg';
  const rawPath = `${folderPath}/${timestamp}_${rawBaseName}.${ext.toLowerCase()}`;

  const { error: rawError } = await supabase.storage
    .from(BUCKET)
    .upload(rawPath, file, {
      cacheControl: '31536000',
      contentType: file.type || 'image/jpeg',
      upsert: false,
    });

  if (rawError) {
    return { success: false, error: rawError.message };
  }

  const { data: rawUrlData } = supabase.storage.from(BUCKET).getPublicUrl(rawPath);
  return {
    success: true,
    url: rawUrlData.publicUrl,
    path: rawPath,
  };
}

/**
 * Upload multiple product images in parallel.
 */
export async function uploadMultipleImages(
  files: File[],
  userId?: string
): Promise<{ urls: string[]; errors: string[] }> {
  const results = await Promise.all(
    files.map(async (file) => {
      const result = await uploadProductImage(file, userId);
      return { file, result };
    })
  );

  const urls: string[] = [];
  const errors: string[] = [];

  for (const { file, result } of results) {
    if (result.success && result.url) {
      urls.push(result.url);
    } else {
      errors.push(`${file.name}: ${result.error || 'Upload failed'}`);
    }
  }

  return { urls, errors };
}

/**
 * Delete an image and all its associated variants (-200.webp, -450.webp, -1000.webp).
 * Accepts either a storage path (e.g., 'user123/img-450.webp') or full public Supabase URL.
 */
export async function deleteProductImage(pathOrUrl: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase || !pathOrUrl) return false;

  let cleanPath = pathOrUrl.trim();
  // Strip URL prefix or bucket name if full URL was passed
  const prefixMatch = cleanPath.match(/\/storage\/v1\/object\/public\/product-images\/(.+)$/i);
  if (prefixMatch) {
    cleanPath = prefixMatch[1];
  } else if (cleanPath.startsWith('product-images/')) {
    cleanPath = cleanPath.slice('product-images/'.length);
  }

  const pathsToDelete: string[] = [];

  if (/-(?:200|450|1000)\.webp$/i.test(cleanPath)) {
    const base = cleanPath.replace(/-(?:200|450|1000)\.webp$/i, '');
    pathsToDelete.push(`${base}-200.webp`, `${base}-450.webp`, `${base}-1000.webp`);
  } else {
    pathsToDelete.push(cleanPath);
  }

  const { error } = await supabase.storage
    .from(BUCKET)
    .remove(pathsToDelete);

  if (error) {
    console.error('Rablo: Delete error:', error);
    return false;
  }
  return true;
}
