import { z } from 'zod';
import { ContextSchema } from '@/lib/domain';
import { getConfig, publicConfig } from '@/lib/server/config';
import { prepare } from '@/lib/server/evaluation';
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
      .object({ context: ContextSchema })
      .strict()
      .parse(await readBody(request));
    if (!publicConfig().configured)
      throw new ServiceError('SETUP_REQUIRED', publicConfig().message, 503);
    release = acquireRequest(request);
    return json(
      await prepare(
        body.context,
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
