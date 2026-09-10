import { z } from 'zod';

export const DISCLAIMER =
  'Independent AP Statistics practice tool. Not affiliated with or endorsed by College Board. AI-generated feedback may require teacher review.';
export const PRACTICE_LABEL =
  'AI-generated rubric — not official College Board scoring.';
export const newSkills = [
  'Formulate Questions',
  'Collect Data',
  'Analyze Data',
  'Interpret Results',
] as const;
export const oldSkills = [
  'Selecting Statistical Methods',
  'Data Analysis',
  'Using Probability and Simulation',
  'Statistical Argumentation',
] as const;
const text = z.string().max(12000);
const short = z.string().min(1).max(1200);
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,60}$/);
const score = z.number().min(0).max(100);
export const ContextSchema = z
  .object({
    question: z
      .string()
      .trim()
      .min(15, 'Include the full question (at least 15 characters).')
      .max(20000),
    rubricText: z.string().max(20000),
    referenceAnswer: z.string().max(15000),
    source: z.string().max(500),
    courseYear: z.string().regex(/^20\d{2}–\d{2}$/),
    questionType: z.enum([
      'Free response',
      'Multiple choice',
      'Classroom practice',
    ]),
  })
  .strict();
export const AnswerSchema = z
  .string()
  .trim()
  .min(
    1,
    'Paste your answer, or write “No answer” to review an unanswered question.',
  )
  .max(20000);
export const CalculationSchema = z.object({
  id,
  label: short,
  operation: z.enum([
    'mean',
    'sampleSD',
    'normalCDF',
    'binomialProbability',
    'oneProportionZ',
    'oneProportionInterval',
    'countFailures',
  ]),
  inputs: z.array(z.number()).min(1).max(500),
  sourceQuotes: z.array(short).min(1).max(12),
  expected: z.array(z.number()).min(1).max(3),
});
export const CriterionSchema = z.object({
  id,
  part: short,
  requirement: short,
  expectedAnswer: text,
  maxPoints: score.nullable(),
  allowedPoints: z.array(score).max(30),
  partialCredit: z.boolean(),
  partialCreditRule: text,
  epiDefinitions: text,
  assessable: z.boolean(),
  missingInformation: text,
});
export const RubricSchema = z.object({
  id,
  title: short,
  topic: short,
  source: z.enum(['supplied', 'practice']),
  sourceDescription: short,
  match: z.enum(['matched', 'mismatched', 'uncertain']),
  matchExplanation: text,
  scoringMode: z.enum(['points', 'epi', 'qualitative']),
  totalAvailable: score.nullable(),
  skills: z.array(z.enum([...newSkills, ...oldSkills])).max(4),
  requirements: z
    .array(
      z.object({
        part: short,
        description: text,
        criterionIds: z.array(id).min(1),
      }),
    )
    .min(1)
    .max(20),
  criteria: z.array(CriterionSchema).min(1).max(30),
  // A literal, question-specific lookup from the supplied rubric, in criterion order.
  // No E/P/I to point conversion is built into the evaluator.
  epiLookup: z.array(z.object({ pattern: short, points: score })).max(1000),
  scoringRules: text,
  errorCarryForward: text,
  warnings: z.array(short).max(15),
  exampleAnswer: text,
  calculations: z.array(CalculationSchema).max(15),
});
export const StatusSchema = z.enum([
  'Met',
  'Partially met',
  'Not met',
  'Not assessable',
]);
export const ReportSchema = z.object({
  rubricId: id,
  summary: text,
  uncertainty: z.array(short).max(15),
  rows: z
    .array(
      z.object({
        criterionId: id,
        status: StatusSchema,
        earned: score.nullable(),
        epiRating: z.enum(['E', 'P', 'I']).nullable(),
        evidence: z.array(short).max(8),
        issueType: z.enum([
          'correct',
          'wrong_statement',
          'missing_explanation',
          'insufficient_work',
          'alternative_method',
          'missing_information',
        ]),
        explanation: text,
      }),
    )
    .min(1)
    .max(30),
  totalEarned: score.nullable(),
  reasoning: z
    .array(
      z.object({
        aspect: short,
        observation: text,
        assessment: z.enum([
          'Appropriate',
          'Needs attention',
          'Not assessable',
        ]),
        improvement: text,
      }),
    )
    .max(7),
  strengths: z.array(z.object({ description: text, evidence: short })).max(3),
  issues: z
    .array(
      z.object({ statement: text, issue: text, why: text, correction: text }),
    )
    .max(6),
  revisionPlan: z.array(short).max(5),
  exampleAnswer: text,
  // Self-contained numeric follow-ups have a deterministic, tested checker.
  practice: z
    .array(
      z.object({
        question: short,
        hint: text,
        operation: CalculationSchema.shape.operation,
        inputs: CalculationSchema.shape.inputs,
        answerIndex: z.number().int().min(0).max(2),
        solution: text,
        targetCriterionId: id,
      }),
    )
    .max(2),
});
export type SubmissionContext = z.infer<typeof ContextSchema>;
export type Rubric = z.infer<typeof RubricSchema>;
export type AssessmentReport = z.infer<typeof ReportSchema>;
export type Calculation = z.infer<typeof CalculationSchema>;
export type SignedRubric = {
  context: SubmissionContext;
  rubric: Rubric;
  createdAt: string;
  signature: string;
};
export type NumericalCheck = {
  id: string;
  label: string;
  result: number[] | null;
  status: 'Recomputed' | 'Discrepancy' | 'Unverified';
  detail: string;
};
export type Attempt = {
  id: string;
  answer: string;
  report: AssessmentReport;
  createdAt: string;
  checks: NumericalCheck[];
};
export type Session = {
  id: string;
  envelope: SignedRubric;
  attempts: Attempt[];
  demo: boolean;
};

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new ValidationError(message);
}
export function validateRubric(
  raw: unknown,
  context: SubmissionContext,
): Rubric {
  const r = RubricSchema.parse(raw);
  const ids = r.criteria.map((c) => c.id);
  ensure(
    new Set(ids).size === ids.length,
    'Duplicate rubric criterion identifiers.',
  );
  ensure(
    r.requirements.every((q) => q.criterionIds.every((x) => ids.includes(x))),
    'Unknown requirement criterion.',
  );
  ensure(
    ids.every((x) => r.requirements.some((q) => q.criterionIds.includes(x))),
    'A scoring criterion has no question requirement.',
  );
  ensure(
    r.source === (context.rubricText.trim() ? 'supplied' : 'practice'),
    'Incorrect rubric source.',
  );
  const skills =
    Number(context.courseYear.slice(0, 4)) >= 2026 ? newSkills : oldSkills;
  ensure(
    r.skills.every((s) => (skills as readonly string[]).includes(s)),
    'Skills do not match the selected course framework.',
  );
  ensure(
    r.criteria.every((c) => c.assessable || c.missingInformation.trim()),
    'Missing information must be identified explicitly.',
  );
  ensure(
    r.criteria.every((c) => !c.partialCredit || c.partialCreditRule.trim()),
    'Partial credit requires an explicit rule.',
  );
  if (r.scoringMode === 'points') {
    ensure(r.criteria.every(c=>c.maxPoints !== null && new Set(c.allowedPoints).size===c.allowedPoints.length && c.allowedPoints.includes(0) && c.allowedPoints.includes(c.maxPoints) && c.allowedPoints.every(p=>p<=c.maxPoints!) && (c.partialCredit?c.allowedPoints.length>2:c.allowedPoints.length===2)), 'Allowed point values do not match the rubric credit rules.');
    ensure(
      r.criteria.every((c) => c.maxPoints !== null && c.maxPoints > 0),
      'Every point criterion needs a positive maximum.',
    );
    const sum = r.criteria.reduce((n, c) => n + (c.maxPoints ?? 0), 0);
    ensure(
      r.totalAvailable !== null && Math.abs(sum - r.totalAvailable) < 1e-8,
      'Rubric maximum does not equal its criteria.',
    );
    ensure(
      r.epiLookup.length === 0,
      'Point scoring cannot use an E/P/I conversion.',
    );
  } else {
    ensure(r.criteria.every(c=>c.allowedPoints.length===0), 'Non-point criteria cannot invent allowed point values.');
    ensure(
      r.criteria.every((c) => c.maxPoints === null),
      'Do not assign separate points to non-point scoring criteria.',
    );
    if (r.scoringMode === 'epi') {
      ensure(
        r.source === 'supplied',
        'E/P/I requires the actual supplied question-specific rules.',
      );
      ensure(
        r.criteria.every((c) => c.epiDefinitions.trim()),
        'E/P/I definitions are missing.',
      );
      ensure(
        new Set(r.epiLookup.map((x) => x.pattern)).size === r.epiLookup.length,
        'Duplicate E/P/I mapping.',
      );
      ensure(
        r.epiLookup.every(
          (x) =>
            x.pattern.split(',').length === ids.length &&
            /^[EPI](,[EPI])*$/.test(x.pattern) &&
            r.totalAvailable !== null &&
            x.points <= r.totalAvailable,
        ),
        'Invalid E/P/I overall rule.',
      );
    } else
      ensure(
        r.totalAvailable === null && r.epiLookup.length === 0,
        'Qualitative assessment has no numeric score.',
      );
  }
  if (r.match !== 'matched')
    ensure(
      r.matchExplanation.trim().length > 0,
      'Explain why this rubric needs review.',
    );
  return r;
}
export function calculateTotal(
  rubric: Rubric,
  rows: AssessmentReport['rows'],
): number | null {
  if (
    rubric.match !== 'matched' ||
    rows.some((r) => r.status === 'Not assessable')
  )
    return null;
  if (rubric.scoringMode === 'points')
    return rows.reduce((n, r) => n + (r.earned ?? 0), 0);
  if (rubric.scoringMode === 'epi') {
    const pattern = rubric.criteria
      .map((c) => rows.find((r) => r.criterionId === c.id)?.epiRating ?? '?')
      .join(',');
    return rubric.epiLookup.find((x) => x.pattern === pattern)?.points ?? null;
  }
  return null;
}
export function validateReport(
  raw: unknown,
  rubric: Rubric,
  answer: string,
): AssessmentReport {
  const r = ReportSchema.parse(raw);
  ensure(r.rubricId === rubric.id, 'Report used a different rubric.');
  ensure(
    r.rows.length === rubric.criteria.length &&
      new Set(r.rows.map((x) => x.criterionId)).size === r.rows.length,
    'Missing or duplicate scoring rows.',
  );
  for (const row of r.rows) {
    const criterion = rubric.criteria.find((c) => c.id === row.criterionId);
    ensure(criterion, 'Unknown scoring criterion.');
    ensure(
      row.evidence.every((q) => answer.includes(q)),
      'A quoted passage is not in the student answer.',
    );
    if (!criterion.assessable || rubric.match !== 'matched')
      ensure(
        row.status === 'Not assessable',
        'Affected scoring must be withheld.',
      );
    if (row.status === 'Not assessable') {
      ensure(
        row.earned === null && row.epiRating === null,
        'Unassessable work cannot receive a score.',
      );
      ensure(row.explanation.trim(), 'Explain what is needed for assessment.');
      continue;
    }
    if (row.status === 'Met' || row.status === 'Partially met')
      ensure(row.evidence.length > 0, 'Credit must have quoted evidence.');
    if (row.status === 'Met')
      ensure(
        ['correct', 'alternative_method'].includes(row.issueType),
        'Full credit conflicts with the reported issue.',
      );
    if (row.status === 'Partially met')
      ensure(
        criterion.partialCredit,
        'This criterion does not allow partial credit.',
      );
    if (rubric.scoringMode === 'points') {
      ensure(
        row.earned !== null &&
          criterion.maxPoints !== null &&
          row.earned <= criterion.maxPoints,
        'Score exceeds the available points.',
      );
      ensure(criterion.allowedPoints.includes(row.earned), 'This point value is not allowed by the saved rubric.');
      ensure(
        row.epiRating === null,
        'Point criteria cannot receive E/P/I labels.',
      );
      if (row.status === 'Met')
        ensure(
          row.earned === criterion.maxPoints,
          'Met criterion must receive its full points.',
        );
      if (row.status === 'Not met')
        ensure(row.earned === 0, 'Not met criterion must receive zero.');
      if (row.status === 'Partially met')
        ensure(
          row.earned > 0 && row.earned < criterion.maxPoints,
          'Partial credit must be between zero and full credit.',
        );
    } else {
      ensure(
        row.earned === null,
        'Non-point criteria must not invent point values.',
      );
      if (rubric.scoringMode === 'epi')
        ensure(
          row.epiRating ===
            ({ Met: 'E', 'Partially met': 'P', 'Not met': 'I' } as const)[
              row.status
            ],
          'E/P/I rating contradicts criterion status.',
        );
      else
        ensure(
          row.epiRating === null,
          'Qualitative scoring has no E/P/I rating.',
        );
    }
  }
  ensure(
    r.strengths.every((s) => answer.includes(s.evidence)),
    'A strength uses invented evidence.',
  );
  ensure(
    r.issues.every((s) => !s.statement || answer.includes(s.statement)),
    'An issue quotes text absent from the submission.',
  );
  ensure(
    r.practice.every((p) =>
      rubric.criteria.some((c) => c.id === p.targetCriterionId),
    ),
    'Practice targets an unknown criterion.',
  );
  const total = calculateTotal(rubric, r.rows);
  ensure(
    total === r.totalEarned ||
      (total !== null &&
        r.totalEarned !== null &&
        Math.abs(total - r.totalEarned) < 1e-8),
    'Overall score contradicts the rubric scores.',
  );
  return r;
}
export function compareAttempts(session: Session) {
  const original = session.attempts[0],
    latest = session.attempts.at(-1)!;
  const comparable =
    original.report.rubricId === latest.report.rubricId &&
    original.report.totalEarned !== null &&
    latest.report.totalEarned !== null;
  return {
    original,
    latest,
    comparable,
    delta: comparable
      ? latest.report.totalEarned! - original.report.totalEarned!
      : null,
    newlyMet: latest.report.rows
      .filter(
        (row) =>
          row.status === 'Met' &&
          original.report.rows.find((r) => r.criterionId === row.criterionId)
            ?.status !== 'Met',
      )
      .map((r) => r.criterionId),
    remaining: latest.report.rows
      .filter((r) => r.status !== 'Met')
      .map((r) => r.criterionId),
  };
}
