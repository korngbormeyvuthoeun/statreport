import { MAX_IMAGE_BYTES, validatePhotoFile } from './photos';

// Decode and re-encode on the device: bounded uploads, upright pixels, no EXIF/GPS metadata.
export async function preparePhoto(file: File): Promise<string> {
  validatePhotoFile(file);
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode().catch(() => {
      throw new Error(
        'This photo could not be opened. Try another JPG, PNG, or WebP image.',
      );
    });
    if (
      !image.naturalWidth ||
      !image.naturalHeight ||
      image.naturalWidth * image.naturalHeight > 60_000_000
    )
      throw new Error(
        'This photo is too large to process. Crop it to one page and try again.',
      );
    const ratio = Math.min(
      1,
      2400 / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.naturalWidth * ratio);
    canvas.height = Math.round(image.naturalHeight * ratio);
    const ctx = canvas.getContext('2d');
    if (!ctx)
      throw new Error(
        'Photo processing is unavailable in this browser. You can still type your work.',
      );
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.9, 0.8, 0.7]) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      if (((dataUrl.length - 23) * 3) / 4 <= MAX_IMAGE_BYTES) return dataUrl;
    }
    throw new Error(
      'This page has too much detail for one upload. Crop to the relevant question or answer and try again.',
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
