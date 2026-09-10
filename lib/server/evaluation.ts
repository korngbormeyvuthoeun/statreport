import {
  AnswerSchema,
  ContextSchema,
  ReportSchema,
  RubricSchema,
  validateReport,
  validateRubric,
  type Attempt,
  type SignedRubric,
} from '../domain';
import { calculate, checkCalculations } from '../numerical';
import type { AIProvider } from './provider';
import { PREPARE_PROMPT, EVALUATE_PROMPT, AUDIT_PROMPT } from './prompts';
import { signRubric, verifyRubric } from './signing';

export async function prepare(
  contextInput: unknown,
  provider: AIProvider,
  secret: string,
  signal?: AbortSignal,
): Promise<SignedRubric> {
  const context = ContextSchema.parse(contextInput);
  // There is deliberately no answer parameter. Requirements cannot be generated from the response.
  const result = await provider.generate(
    'question_rubric',
    RubricSchema,
    PREPARE_PROMPT,
    { context },
    signal,
  );
  const rubric = validateRubric(result, context);
  // Persisted as a signed envelope on the client before /evaluate is requested.
  return signRubric(context, rubric, secret);
}
export async function evaluate(
  envelopeInput: unknown,
  answerInput: unknown,
  provider: AIProvider,
  secret: string,
  signal?: AbortSignal,
): Promise<Attempt> {
  const envelope = await verifyRubric(envelopeInput, secret),
    answer = AnswerSchema.parse(answerInput);
  const checks = checkCalculations(
    envelope.rubric.calculations,
    envelope.context.question,
  );
  const data = {
    context: envelope.context,
    rubric: envelope.rubric,
    studentAnswer: answer,
    numericalChecks: checks,
  };
  const draft = await provider.generate(
    'draft_assessment',
    ReportSchema,
    EVALUATE_PROMPT,
    data,
    signal,
  );
  const audited = await provider.generate(
    'checked_assessment',
    ReportSchema,
    AUDIT_PROMPT,
    { ...data, draft },
    signal,
  );
  const report = validateReport(audited, envelope.rubric, answer);
  // Reject unsupported tasks instead of showing a broken or false checker.
  report.practice = report.practice.filter((p) => {
    try {
      return Number.isFinite(calculate(p.operation, p.inputs)[p.answerIndex]);
    } catch {
      return false;
    }
  });
  if (
    checks.some((c) => c.status !== 'Recomputed') &&
    !report.uncertainty.some((x) => /calculation|numeric|arithmetic/i.test(x))
  )
    report.uncertainty.push(
      'A numerical check needs review. Arithmetic checks do not establish that AI-selected inputs and methods are appropriate.',
    );
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    answer,
    report,
    checks,
  };
}
