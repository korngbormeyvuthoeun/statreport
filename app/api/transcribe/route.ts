import {
  MAX_PHOTO_REQUEST_BYTES,
  TranscriptionRequestSchema,
} from '@/lib/photos';
import { publicConfig } from '@/lib/server/config';
import { getProvider, ServiceError } from '@/lib/server/provider';
import {
  acquireRequest,
  errorResponse,
  json,
  readBody,
} from '@/lib/server/http';
import { transcribe } from '@/lib/server/transcription';

export async function POST(request: Request) {
  let release: (() => void) | undefined;
  try {
    const body = TranscriptionRequestSchema.parse(
      await readBody(request, MAX_PHOTO_REQUEST_BYTES),
    );
    if (!publicConfig().configured)
      throw new ServiceError(
        'SETUP_REQUIRED',
        'Photo reading needs the AI engine. Ask the app owner to complete AI setup, or use Type / paste to enter your work.',
        503,
      );
    release = acquireRequest(request);
    return json(await transcribe(body, getProvider(), request.signal));
  } catch (error) {
    return errorResponse(error);
  } finally {
    release?.();
  }
}
