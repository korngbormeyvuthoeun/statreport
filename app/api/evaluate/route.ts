import { z } from 'zod';
import { AnswerSchema } from '@/lib/domain';
import { getConfig, publicConfig } from '@/lib/server/config';
import { evaluate } from '@/lib/server/evaluation';
import { getProvider, ServiceError } from '@/lib/server/provider';
import {
  acquireRequest,
  errorResponse,
  json,
  readBody,
} from '@/lib/server/http';
export async function POST(request: Request) {
  let release: (() => void) | undefined;
  try {
    const body = z
      .object({ envelope: z.unknown(), answer: AnswerSchema })
      .strict()
      .parse(await readBody(request));
    if (!publicConfig().configured)
      throw new ServiceError('SETUP_REQUIRED', publicConfig().message, 503);
    release = acquireRequest(request);
    return json(
      await evaluate(
        body.envelope,
        body.answer,
        getProvider(),
        getConfig().signingSecret,
        request.signal,
      ),
    );
  } catch (e) {
    return errorResponse(e);
  } finally {
    release?.();
  }
}
