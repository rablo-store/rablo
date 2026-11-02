/**
 * RABLO — Supabase Storage Operations
 * Image upload to 'product-images' bucket with public URL generation.
 */

import { supabase, isSupabaseConfigured } from './supabase';

const BUCKET = 'product-images';

export interface StorageUploadResult {
  success: boolean;
  url?: string;
  path?: string;
  error?: string;
}

/**
 * Upload an image file to Supabase Storage.
 * Files are stored under the user's folder: {userId}/{timestamp}_{filename}
 */
export async function uploadProductImage(
  file: File,
  userId?: string
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
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = `${folder}/${timestamp}_${sanitizedName}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    console.error('Rablo: Upload error:', error);
    return { success: false, error: error.message };
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(filePath);

  return {
    success: true,
    url: urlData.publicUrl,
    path: filePath,
  };
}

/**
 * Upload multiple images. Returns array of URLs.
 */
export async function uploadMultipleImages(
  files: File[],
  userId?: string
): Promise<{ urls: string[]; errors: string[] }> {
  const urls: string[] = [];
  const errors: string[] = [];

  for (const file of files) {
    const result = await uploadProductImage(file, userId);
    if (result.success && result.url) {
      urls.push(result.url);
    } else {
      errors.push(`${file.name}: ${result.error || 'Upload failed'}`);
    }
  }

  return { urls, errors };
}

/**
 * Delete an image from storage by its path.
 */
export async function deleteProductImage(filePath: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;

  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([filePath]);

  if (error) {
    console.error('Rablo: Delete error:', error);
    return false;
  }
  return true;
}
