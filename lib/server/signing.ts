import {
  ContextSchema,
  RubricSchema,
  validateRubric,
  type SignedRubric,
  type SubmissionContext,
  type Rubric,
} from '../domain';
import { ServiceError } from './provider';
function bytes(value: string) {
  return new TextEncoder().encode(value);
}
function unsigned(e: Omit<SignedRubric, 'signature'>) {
  return JSON.stringify({
    context: e.context,
    rubric: e.rubric,
    createdAt: e.createdAt,
  });
}
async function signingKey(secret: string) {
  if (secret.length < 32)
    throw new ServiceError(
      'SETUP_REQUIRED',
      'Set STATREPORT_SIGNING_SECRET to a random value of at least 32 characters on the server. It protects saved rubrics across revisions.',
      503,
    );
  return crypto.subtle.importKey(
    'raw',
    bytes(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}
export async function signRubric(
  context: SubmissionContext,
  rubric: Rubric,
  secret: string,
): Promise<SignedRubric> {
  const payload = { context, rubric, createdAt: new Date().toISOString() };
  const signature = await crypto.subtle.sign(
    'HMAC',
    await signingKey(secret),
    bytes(unsigned(payload)),
  );
  return {
    ...payload,
    signature: Array.from(new Uint8Array(signature), (b) =>
      b.toString(16).padStart(2, '0'),
    ).join(''),
  };
}
export async function verifyRubric(
  raw: unknown,
  secret: string,
): Promise<SignedRubric> {
  if (!raw || typeof raw !== 'object')
    throw new ServiceError(
      'INVALID_RUBRIC',
      'The saved rubric is missing. Start a new analysis.',
      400,
    );
  const input = raw as SignedRubric;
  const context = ContextSchema.parse(input.context),
    rubric = validateRubric(RubricSchema.parse(input.rubric), context);
  if (
    typeof input.signature !== 'string' ||
    !/^[a-f0-9]{64}$/.test(input.signature) ||
    typeof input.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(input.createdAt))
  )
    throw new ServiceError(
      'INVALID_RUBRIC',
      'The saved rubric could not be verified. Start a new analysis.',
      400,
    );
  const payload = { context, rubric, createdAt: input.createdAt };
  const signature = Uint8Array.from(input.signature.match(/.{2}/g)!, (v) =>
    parseInt(v, 16),
  );
  if (
    !(await crypto.subtle.verify(
      'HMAC',
      await signingKey(secret),
      signature,
      bytes(unsigned(payload)),
    ))
  )
    throw new ServiceError(
      'INVALID_RUBRIC',
      'This rubric was changed or its server signing key was replaced. Your saved report is readable, but a new analysis is required for grading.',
      400,
    );
  return { ...payload, signature: input.signature };
}
