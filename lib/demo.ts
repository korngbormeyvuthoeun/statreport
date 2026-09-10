import type {
  AssessmentReport,
  Rubric,
  Session,
  SubmissionContext,
} from './domain';
import { checkCalculations } from './numerical';

export const demoContext: SubmissionContext = {
  question:
    'A school district randomly selects 150 students from its 3,000 students. Of those selected, 96 say they would prefer a later school start time.\n\n(a) Construct a 95% confidence interval for the proportion of all students in the district who prefer a later start time. Show the calculation and verify the conditions. Use z* = 1.96.\n(b) Interpret your confidence interval in context.',
  rubricText: '',
  referenceAnswer: '',
  source: 'Original StatReport practice question',
  courseYear: '2026–27',
  questionType: 'Classroom practice',
};
export const demoAnswer =
  '(a) p-hat = 96/150 = 0.64.\nSE = sqrt(0.64 × 0.36 / 150) = 0.0392.\nThe 95% interval is 0.64 ± 1.96(0.0392) = (0.5632, 0.7168).\n\n(b) There is a 95% probability that the true proportion of district students who prefer a later start time is between 0.5632 and 0.7168.';
export const demoRevision =
  '(a) Use a one-sample z interval for a population proportion. The sample was randomly selected. The sample of 150 is less than 10% of the 3,000 district students. The 96 successes and 54 failures are both at least 10, so the normal approximation is reasonable.\np-hat = 96/150 = 0.64. SE = sqrt(0.64 × 0.36 / 150) = 0.0392.\nThe 95% interval is 0.64 ± 1.96(0.0392) = (0.5632, 0.7168).\n\n(b) We are 95% confident that between 56.32% and 71.68% of all students in this district prefer a later school start time.';
export const demoRubric: Rubric = {
  id: 'demo-ci-v1',
  title: 'A later start to the school day',
  topic: 'Inference for proportions · Confidence intervals',
  source: 'practice',
  sourceDescription:
    'Fixed demonstration practice rubric — not official College Board scoring.',
  match: 'matched',
  matchExplanation:
    'The criteria address the calculation, conditions, and contextual interpretation requested in this original question.',
  scoringMode: 'points',
  totalAvailable: 4,
  skills: ['Collect Data', 'Analyze Data', 'Interpret Results'],
  requirements: [
    {
      part: '(a)',
      description:
        'Construct a one-sample z interval for the population proportion, show your work, and verify the conditions.',
      criterionIds: ['method', 'conditions', 'calculation'],
    },
    {
      part: '(b)',
      description:
        'Explain what the interval estimates, naming the population and the confidence level.',
      criterionIds: ['interpretation'],
    },
  ],
  criteria: [
    {
      id: 'method',
      part: '(a)',
      requirement: 'Use an appropriate interval method.',
      expectedAnswer:
        'Use a one-sample z interval for a population proportion. An unambiguous correct formula also demonstrates the method.',
      maxPoints: 1,
      allowedPoints: [0,1],
      partialCredit: false,
      partialCreditRule: '',
      epiDefinitions: '',
      assessable: true,
      missingInformation: '',
    },
    {
      id: 'conditions',
      part: '(a)',
      requirement: 'Verify random selection, independence, and large counts.',
      expectedAnswer:
        'Random sample; 150 < 0.10(3000) = 300; 96 successes and 54 failures are both at least 10.',
      maxPoints: 1,
      allowedPoints: [0,1],
      partialCredit: false,
      partialCreditRule: '',
      epiDefinitions: '',
      assessable: true,
      missingInformation: '',
    },
    {
      id: 'calculation',
      part: '(a)',
      requirement: 'Calculate and show the confidence interval.',
      expectedAnswer:
        'p̂ = 0.64, SE ≈ 0.03919, margin ≈ 0.07682, interval ≈ (0.56318, 0.71682). Equivalent rounding is accepted.',
      maxPoints: 1,
      allowedPoints: [0,1],
      partialCredit: false,
      partialCreditRule: '',
      epiDefinitions: '',
      assessable: true,
      missingInformation: '',
    },
    {
      id: 'interpretation',
      part: '(b)',
      requirement:
        'Interpret confidence in the population proportion in context.',
      expectedAnswer:
        'We are 95% confident that the interval from about 56.3% to 71.7% captures the proportion of all district students who prefer a later start time. Equivalent meaningful wording is accepted.',
      maxPoints: 1,
      allowedPoints: [0,1],
      partialCredit: false,
      partialCreditRule: '',
      epiDefinitions: '',
      assessable: true,
      missingInformation: '',
    },
  ],
  epiLookup: [],
  scoringRules:
    'Four criteria, one point each. Each criterion is met or not met; no partial credit within a criterion. This short classroom exercise is not forced onto a 10-point scale.',
  errorCarryForward:
    'An incorrect interval carried into a statistically correct contextual interpretation does not by itself lose the interpretation point.',
  warnings: [],
  exampleAnswer: demoRevision,
  calculations: [
    {
      id: 'ci',
      label: '95% one-proportion z interval',
      operation: 'oneProportionInterval',
      inputs: [96, 150, 1.96],
      sourceQuotes: ['150 students', '96 say', 'z* = 1.96'],
      expected: [0.563184, 0.716816, 0.076816],
    },
  ],
};
export const demoReport: AssessmentReport = {
  rubricId: 'demo-ci-v1',
  summary:
    'Your interval calculation is correct, and your work shows an appropriate method. The next step is to justify the conditions and describe confidence without assigning a probability to the fixed population proportion.',
  uncertainty: [
    'Fixed sample demonstration. This report does not evaluate anything you type.',
  ],
  rows: [
    {
      criterionId: 'method',
      status: 'Met',
      earned: 1,
      epiRating: null,
      evidence: ['0.64 ± 1.96(0.0392)'],
      issueType: 'correct',
      explanation:
        'Your interval formula shows a one-sample z interval for a population proportion. Naming the procedure separately is not required by this practice rubric.',
    },
    {
      criterionId: 'conditions',
      status: 'Not met',
      earned: 0,
      epiRating: null,
      evidence: [],
      issueType: 'missing_explanation',
      explanation:
        'The question explicitly asks you to verify conditions. Random selection, the 10% condition, and large counts are not addressed.',
    },
    {
      criterionId: 'calculation',
      status: 'Met',
      earned: 1,
      epiRating: null,
      evidence: ['p-hat = 96/150 = 0.64.', '(0.5632, 0.7168)'],
      issueType: 'correct',
      explanation:
        'The sample proportion, standard error, and endpoints are correct within rounding.',
    },
    {
      criterionId: 'interpretation',
      status: 'Not met',
      earned: 0,
      epiRating: null,
      evidence: ['There is a 95% probability that the true proportion'],
      issueType: 'wrong_statement',
      explanation:
        'The population proportion is fixed. The 95% confidence level describes the long-run success rate of the interval method, not a probability assigned to this fixed parameter after the interval is calculated.',
    },
  ],
  totalEarned: 2,
  reasoning: [
    {
      aspect: 'Method and calculation',
      observation:
        'You used the sample proportion and the correct standard error in a z interval.',
      assessment: 'Appropriate',
      improvement: 'Keep the calculation and the endpoints you already have.',
    },
    {
      aspect: 'Conditions and assumptions',
      observation:
        'Your answer proceeds to calculation without checking the requested conditions.',
      assessment: 'Needs attention',
      improvement:
        'Use the random sample stated in the question, compare 150 with 300, and show the two counts: 96 and 54.',
    },
    {
      aspect: 'Interpretation in context',
      observation:
        'You correctly identify district students and later start times, but assign a probability to the fixed parameter.',
      assessment: 'Needs attention',
      improvement:
        'Express confidence that your interval captures the population proportion. Exact memorized wording is not necessary.',
    },
  ],
  strengths: [
    {
      description: 'Your formula demonstrates the appropriate interval method.',
      evidence: '0.64 ± 1.96(0.0392)',
    },
    {
      description:
        'You calculated the sample proportion and interval correctly.',
      evidence: '(0.5632, 0.7168)',
    },
  ],
  issues: [
    {
      statement: '',
      issue: 'The conditions are missing.',
      why: 'This question explicitly requests the checks that justify the interval method.',
      correction:
        'State random selection; show 150 < 300; and show that 96 successes and 54 failures both exceed 10.',
    },
    {
      statement: 'There is a 95% probability that the true proportion',
      issue:
        'Confidence is being confused with probability for a fixed parameter.',
      why: 'After sampling, the interval either captures the fixed population proportion or it does not.',
      correction:
        'Describe 95% confidence that the interval captures the proportion of all district students who prefer a later start time.',
    },
  ],
  revisionPlan: [
    'Add the three condition checks before your calculation: random selection, 150 < 300, and the counts 96 and 54.',
    'Keep your interval calculation. Rewrite part (b) to express confidence about the proportion of all district students.',
  ],
  exampleAnswer: demoRevision,
  practice: [
    {
      question:
        'In a random sample of 80 library visitors, 52 prefer weekend hours. How many failures should you use when checking the large-counts condition? Enter a whole number.',
      hint: 'A failure is someone who does not prefer weekend hours.',
      operation: 'countFailures',
      inputs: [52, 80],
      answerIndex: 0,
      solution:
        '80 − 52 = 28 failures. The 52 successes and 28 failures both exceed 10.',
      targetCriterionId: 'conditions',
    },
    {
      question:
        'A random sample of 100 residents includes 60 who favor a new park. Find the lower endpoint of a 95% one-proportion z interval. Use z* = 1.96; enter a decimal rounded to four places.',
      hint: 'Use p̂ − 1.96√[p̂(1 − p̂)/n].',
      operation: 'oneProportionInterval',
      inputs: [60, 100, 1.96],
      answerIndex: 0,
      solution:
        'p̂ = 0.60. The margin is 1.96√(0.60 × 0.40 / 100) ≈ 0.0960, giving a lower endpoint of 0.5040.',
      targetCriterionId: 'calculation',
    },
  ],
};
export const revisedDemoReport: AssessmentReport = {
  ...demoReport,
  summary:
    'The fixed sample revision now verifies all requested conditions and interprets the interval in context. The original correct calculation is preserved.',
  totalEarned: 4,
  rows: demoRubric.criteria.map((c, i) => ({
    criterionId: c.id,
    status: 'Met',
    earned: 1,
    epiRating: null,
    evidence: [
      ['Use a one-sample z interval for a population proportion.'],
      [
        'The sample of 150 is less than 10% of the 3,000 district students.',
        'The 96 successes and 54 failures are both at least 10',
        'The sample was randomly selected.',
      ],
      ['(0.5632, 0.7168)'],
      [
        'We are 95% confident that between 56.32% and 71.68% of all students in this district prefer a later school start time.',
      ],
    ][i],
    issueType: 'correct',
    explanation: [
      'The method is appropriate for a population proportion.',
      'The answer verifies all three conditions using the given context and counts.',
      'The calculation remains correct.',
      'The statement describes confidence, the interval, the population, and the preference in context.',
    ][i],
  })),
  reasoning: [
    {
      aspect: 'Conditions and interpretation',
      observation:
        'The revision adds specific justification and expresses confidence about the population proportion.',
      assessment: 'Appropriate',
      improvement:
        'Apply the same care to the population and parameter in your next question.',
    },
  ],
  strengths: [
    {
      description: 'You justify the large-counts condition with both counts.',
      evidence: 'The 96 successes and 54 failures are both at least 10',
    },
    {
      description:
        'You identify the population in a correct confidence statement.',
      evidence: 'all students in this district',
    },
  ],
  issues: [],
  revisionPlan: [
    'Try the follow-up interval question with a different sample.',
  ],
};
export function createDemoSession(revised = false): Session {
  const checks = checkCalculations(
      demoRubric.calculations,
      demoContext.question,
    ),
    createdAt = new Date().toISOString();
  const attempts = [
    {
      id: 'demo-original',
      answer: demoAnswer,
      report: structuredClone(demoReport),
      createdAt,
      checks,
    },
  ];
  if (revised)
    attempts.push({
      id: 'demo-revised',
      answer: demoRevision,
      report: structuredClone(revisedDemoReport),
      createdAt,
      checks,
    });
  return {
    id: 'demo-session',
    envelope: {
      context: structuredClone(demoContext),
      rubric: structuredClone(demoRubric),
      createdAt,
      signature: 'demo-only',
    },
    attempts,
    demo: true,
  };
}

