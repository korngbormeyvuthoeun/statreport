import { z } from 'zod';

export const MAX_PHOTOS = 3;
export const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 1024 * 1024;
export const MAX_PHOTO_REQUEST_BYTES = 4_200_000;
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp';

export function validatePhotoFile(file: { type: string; size: number }) {
  if (!PHOTO_TYPES.includes(file.type))
    throw new Error(
      'Choose a JPG, PNG, or WebP photo. For HEIC or PDF, export as JPG or take a screenshot first.',
    );
  if (!file.size || file.size > MAX_SOURCE_BYTES)
    throw new Error(
      'Each photo must be between 1 byte and 15 MB. Choose a smaller photo.',
    );
}

export function validImageDataUrl(value: string): boolean {
  const match =
    /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || match[2].length % 4 !== 0) return false;
  const bytes =
    (match[2].length * 3) / 4 -
    (match[2].endsWith('==') ? 2 : match[2].endsWith('=') ? 1 : 0);
  if (bytes < 12 || bytes > MAX_IMAGE_BYTES) return false;
  try {
    const prefix = atob(match[2].slice(0, 24));
    if (match[1] === 'jpeg') return prefix.startsWith('\xff\xd8\xff');
    if (match[1] === 'png') return prefix.startsWith('\x89PNG\r\n\x1a\n');
    return prefix.startsWith('RIFF') && prefix.slice(8, 12) === 'WEBP';
  } catch {
    return false;
  }
}

export const TranscriptionRequestSchema = z
  .object({
    target: z.enum(['question', 'answer']),
    images: z
      .array(
        z
          .string()
          .max(1_398_130)
          .refine(validImageDataUrl, 'Invalid photo data.'),
      )
      .min(1)
      .max(MAX_PHOTOS),
  })
  .strict();
export const TranscriptionSchema = z
  .object({
    text: z.string().max(20000),
    warnings: z.array(z.string().min(1).max(600)).max(12),
  })
  .strict();
export type Transcription = z.infer<typeof TranscriptionSchema>;

export function combinePhotoText(
  existing: string,
  draft: string,
  append: boolean,
) {
  const text =
    append && existing.trim()
      ? `${existing.trimEnd()}\n\n${draft.trim()}`
      : draft.trim();
  if (!draft.trim())
    throw new Error('Add the text you can read, or choose a clearer photo.');
  if (text.length > 20000)
    throw new Error(
      'The combined text is over 20,000 characters. Shorten it before continuing.',
    );
  return text;
}
