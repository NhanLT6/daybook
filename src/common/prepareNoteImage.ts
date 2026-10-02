// Screenshots dominate note images: a full-screen PNG is often 1–3 MB, the same image as WebP ~10x smaller.
// Re-encoded once at paste time so the image store stays small; GIFs keep their bytes (canvas drops animation).
export const NOTE_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp'];

const MAX_SIDE = 2560; // still sharp on a 4K screen at half width, caps oversized captures
const WEBP_QUALITY = 0.9; // high enough that screenshot text stays crisp
export const MAX_NOTE_IMAGE_BYTES = 20 * 1024 * 1024;

export interface PreparedNoteImage {
  blob: Blob;
  width: number;
  height: number;
}

export async function prepareNoteImage(file: Blob): Promise<PreparedNoteImage> {
  if (file.size > MAX_NOTE_IMAGE_BYTES) throw new Error('Image is larger than 20 MB');

  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    if (file.type === 'image/gif') return { blob: file, width: bitmap.width, height: bitmap.height };

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, width, height);
    const webp = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', WEBP_QUALITY));

    // Safari can't encode WebP (toBlob silently falls back to PNG): keep whichever is smaller,
    // unless the original had to be downscaled.
    const encoded = webp?.type === 'image/webp' ? webp : null;
    if (encoded && (scale < 1 || encoded.size < file.size)) return { blob: encoded, width, height };
    if (scale < 1 && webp) return { blob: webp, width, height };
    return { blob: file, width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
}
