import { z } from 'zod';
import { ValidationError } from '../domain';
import { ServiceError } from './provider';
const HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};
export function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: HEADERS });
}
export function errorResponse(e: unknown) {
  if (e instanceof ServiceError)
    return json({ error: { code: e.code, message: e.message } }, e.status);
  if (e instanceof z.ZodError)
    return json(
      {
        error: {
          code: 'INVALID_INPUT',
          message:
            'Some fields or saved report data are invalid. Check your question, answer, and optional materials. Your text is preserved.',
        },
      },
      400,
    );
  if (e instanceof ValidationError)
    return json(
      {
        error: {
          code: 'INCONSISTENT_ASSESSMENT',
          message:
            'The AI assessment failed consistency checks (scores, rubric rules, or evidence). No unreliable score was published. Your answer and rubric are preserved; please retry.',
        },
      },
      502,
    );
  // Never send or log provider payloads, secrets, or student contents.
  return json(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message:
          'Analysis could not be completed. Your text is preserved. Please retry.',
      },
    },
    500,
  );
}
export async function readBody(request: Request, max = 250000) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin)
    throw new ServiceError(
      'ORIGIN_MISMATCH',
      'This request must come from the StatReport workspace.',
      403,
    );
  if (
    !request.headers
      .get('content-type')
      ?.toLowerCase()
      .startsWith('application/json')
  )
    throw new ServiceError('CONTENT_TYPE', 'Submit the form as JSON.', 415);
  if (Number(request.headers.get('content-length')) > max)
    throw new ServiceError(
      'INPUT_TOO_LARGE',
      'This submission is too large. Shorten optional materials and try again.',
      413,
    );
  const reader = request.body?.getReader();
  if (!reader)
    throw new ServiceError('EMPTY_INPUT', 'The submission body is empty.', 400);
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > max) {
      await reader.cancel();
      throw new ServiceError(
        'INPUT_TOO_LARGE',
        'This submission is too large. Shorten optional materials and try again.',
        413,
      );
    }
    chunks.push(value);
  }
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(joined));
  } catch {
    throw new ServiceError(
      'INVALID_JSON',
      'The request was incomplete. Your text is preserved; please retry.',
      400,
    );
  }
}
const requests = new Map<string, { count: number; reset: number }>();
let active = 0;
// An isolate-local safeguard, not a distributed billing/security boundary.
export function acquireRequest(request: Request) {
  const key = request.headers.get('cf-connecting-ip') || 'local',
    now = Date.now();
  for (const [k, v] of requests) if (v.reset < now) requests.delete(k);
  const state = requests.get(key) || { count: 0, reset: now + 60000 };
  if (state.count >= 8 || active >= 3)
    throw new ServiceError(
      'APP_RATE_LIMIT',
      'Too many analyses are in progress. Wait a minute and try again.',
      429,
    );
  state.count++;
  requests.set(key, state);
  active++;
  let released = false;
  return () => {
    if (!released) {
      active--;
      released = true;
    }
  };
}
