/**
 * RABLO — Browser Image Resizing & WebP Conversion
 * Client-side canvas resizing with EXIF orientation handling, never upscaling.
 */

export interface TargetDimensions {
  width: number;
  height: number;
}

/**
 * Pure calculation of target dimensions. Never upscales.
 * Maintains aspect ratio when scaling down images wider than maxWidth.
 */
export function computeTargetSize(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number = 1920
): TargetDimensions {
  if (originalWidth <= 0 || originalHeight <= 0 || maxWidth <= 0) {
    return { width: 0, height: 0 };
  }

  // Never upscale
  if (originalWidth <= maxWidth) {
    return {
      width: Math.round(originalWidth),
      height: Math.round(originalHeight),
    };
  }

  const scale = maxWidth / originalWidth;
  return {
    width: Math.round(maxWidth),
    height: Math.round(originalHeight * scale),
  };
}

/**
 * Resizes an image file/blob to WebP format, respecting EXIF orientation,
 * never upscaling, and maintaining aspect ratio.
 */
export async function resizeToWebp(
  file: File | Blob,
  maxWidth: number = 1920,
  quality: number = 0.82
): Promise<Blob> {
  let bitmap: ImageBitmap;

  // Try createImageBitmap with imageOrientation: 'from-image' to respect EXIF rotation
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // Fallback without options for environments with partial option support
    bitmap = await createImageBitmap(file);
  }

  try {
    const { width, height } = computeTargetSize(bitmap.width, bitmap.height, maxWidth);

    if (width <= 0 || height <= 0) {
      throw new Error(`Invalid dimensions calculated: ${width}x${height}`);
    }

    // Support OffscreenCanvas where available (e.g. Web Workers, modern browsers)
    if (typeof OffscreenCanvas !== 'undefined') {
      const offscreen = new OffscreenCanvas(width, height);
      const ctx = offscreen.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to acquire 2D context from OffscreenCanvas');
      }
      ctx.drawImage(bitmap, 0, 0, width, height);
      return await offscreen.convertToBlob({ type: 'image/webp', quality });
    }

    // Standard DOM Canvas fallback
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to acquire 2D context from HTMLCanvasElement');
      }
      ctx.drawImage(bitmap, 0, 0, width, height);

      return await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Canvas conversion to WebP blob failed'));
            }
          },
          'image/webp',
          quality
        );
      });
    }

    throw new Error('No canvas implementation available in the current environment');
  } finally {
    bitmap.close();
  }
}

/**
 * Crops an image to a 1:1 square from the center and scales down if larger than maxDimension.
 * Never upscales. Outputs high-quality modern WebP.
 */
export async function cropAndResizeToSquareWebp(
  file: File | Blob,
  maxDimension: number = 1000,
  quality: number = 0.88
): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    bitmap = await createImageBitmap(file);
  }

  try {
    const originalWidth = bitmap.width;
    const originalHeight = bitmap.height;
    const minDim = Math.min(originalWidth, originalHeight);
    if (minDim <= 0) {
      throw new Error(`Invalid image dimensions: ${originalWidth}x${originalHeight}`);
    }

    // Center crop coordinates
    const srcX = Math.round((originalWidth - minDim) / 2);
    const srcY = Math.round((originalHeight - minDim) / 2);

    // Target dimension: min of minDim and maxDimension (never upscale)
    const outDim = Math.min(minDim, maxDimension);

    if (typeof OffscreenCanvas !== 'undefined') {
      const offscreen = new OffscreenCanvas(outDim, outDim);
      const ctx = offscreen.getContext('2d');
      if (!ctx) throw new Error('Failed to acquire 2D context from OffscreenCanvas');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bitmap, srcX, srcY, minDim, minDim, 0, 0, outDim, outDim);
      return await offscreen.convertToBlob({ type: 'image/webp', quality });
    }

    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = outDim;
      canvas.height = outDim;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to acquire 2D context from HTMLCanvasElement');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bitmap, srcX, srcY, minDim, minDim, 0, 0, outDim, outDim);

      return await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Canvas conversion to 1:1 WebP blob failed'));
          },
          'image/webp',
          quality
        );
      });
    }

    throw new Error('No canvas implementation available in the current environment');
  } finally {
    bitmap.close();
  }
}
