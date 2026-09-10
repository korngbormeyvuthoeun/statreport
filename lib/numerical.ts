import type { Calculation, NumericalCheck } from './domain';

function requireValue(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}
// Abramowitz & Stegun 7.1.26; max absolute CDF approximation error < 7.5e-8.
export function normalCDF(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp((-z * z) / 2);
  const tail =
    d *
    t *
    (0.31938153 +
      t *
        (-0.356563782 +
          t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z >= 0 ? 1 - tail : tail;
}
export function calculate(
  operation: Calculation['operation'],
  x: number[],
): number[] {
  requireValue(
    x.length > 0 && x.length <= 500 && x.every(Number.isFinite),
    'Inputs must be finite numbers.',
  );
  let result: number[];
  switch (operation) {
    case 'countFailures':
      requireValue(
        x.length === 2 &&
          Number.isInteger(x[0]) &&
          Number.isInteger(x[1]) &&
          x[0] >= 0 &&
          x[1] > 0 &&
          x[0] <= x[1],
        'Use [successes, sample size].',
      );
      result = [x[1] - x[0]];
      break;
    case 'mean':
      result = [x.reduce((a, b) => a + b, 0) / x.length];
      break;
    case 'sampleSD': {
      requireValue(
        x.length >= 2,
        'A sample standard deviation needs at least two observations.',
      );
      const m = calculate('mean', x)[0];
      result = [
        Math.sqrt(x.reduce((s, v) => s + (v - m) ** 2, 0) / (x.length - 1)),
      ];
      break;
    }
    case 'normalCDF':
      requireValue(x.length === 1, 'Use [z].');
      result = [normalCDF(x[0])];
      break;
    case 'binomialProbability': {
      const [n, p, k] = x;
      requireValue(
        x.length === 3 &&
          Number.isInteger(n) &&
          n >= 1 &&
          n <= 10000 &&
          p >= 0 &&
          p <= 1 &&
          Number.isInteger(k) &&
          k >= 0 &&
          k <= n,
        'Use [n, p, k] with valid binomial parameters.',
      );
      if (p === 0 || p === 1) {
        result = [(p === 0 && k === 0) || (p === 1 && k === n) ? 1 : 0];
        break;
      }
      let logCombination = 0;
      for (let i = 1; i <= Math.min(k, n - k); i++)
        logCombination += Math.log(n - i + 1) - Math.log(i);
      result = [
        Math.exp(logCombination + k * Math.log(p) + (n - k) * Math.log1p(-p)),
      ];
      break;
    }
    case 'oneProportionZ': {
      const [successes, n, p0] = x;
      requireValue(
        x.length === 3 &&
          Number.isInteger(n) &&
          n > 0 &&
          Number.isInteger(successes) &&
          successes >= 0 &&
          successes <= n &&
          p0 > 0 &&
          p0 < 1,
        'Use [successes, n, null proportion].',
      );
      const z = (successes / n - p0) / Math.sqrt((p0 * (1 - p0)) / n);
      result = [z, normalCDF(z), 1 - normalCDF(z)];
      break;
    }
    case 'oneProportionInterval': {
      const [successes, n, zCritical] = x;
      requireValue(
        x.length === 3 &&
          Number.isInteger(n) &&
          n > 0 &&
          Number.isInteger(successes) &&
          successes >= 0 &&
          successes <= n &&
          zCritical > 0 &&
          zCritical <= 5,
        'Use [successes, n, z critical].',
      );
      const p = successes / n,
        margin = zCritical * Math.sqrt((p * (1 - p)) / n);
      result = [p - margin, p + margin, margin];
      break;
    }
  }
  requireValue(
    result.every(Number.isFinite),
    'The calculation is outside the supported numeric range.',
  );
  return result;
}
export function checkCalculations(
  requests: Calculation[],
  question: string,
): NumericalCheck[] {
  return requests.map((c) => {
    if (!c.sourceQuotes.every((q) => question.includes(q)))
      return {
        id: c.id,
        label: c.label,
        result: null,
        status: 'Unverified',
        detail: 'The proposed inputs could not be traced to the question.',
      };
    try {
      const result = calculate(c.operation, c.inputs);
      const matches =
        result.length === c.expected.length &&
        result.every(
          (v, i) =>
            Math.abs(v - c.expected[i]) <=
            Math.max(0.0001, Math.abs(v) * 0.001),
        );
      return {
        id: c.id,
        label: c.label,
        result,
        status: matches ? 'Recomputed' : 'Discrepancy',
        detail: matches
          ? 'Arithmetic recomputed by a tested function. Input selection and method suitability still require review.'
          : 'The proposed result differs from the independently recomputed arithmetic. Affected scoring requires review.',
      };
    } catch {
      return {
        id: c.id,
        label: c.label,
        result: null,
        status: 'Unverified',
        detail: 'This calculation is outside the supported input range.',
      };
    }
  });
}
export function checkPractice(
  operation: Calculation['operation'],
  inputs: number[],
  answerIndex: number,
  answer: string,
) {
  if (!/^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(answer.trim()))
    return {
      correct: false,
      message: 'Enter one number (use a decimal for probabilities).',
    };
  const expected = calculate(operation, inputs)[answerIndex];
  if (expected === undefined) throw new Error('Invalid practice answer index.');
  const tolerance = Math.max(0.0005, Math.abs(expected) * 0.002);
  const correct = Math.abs(Number(answer) - expected) <= tolerance;
  return {
    correct,
    message: correct
      ? 'Correct — your numerical result is within the rounding tolerance.'
      : 'Not quite. Check the inputs and calculation, then try again.',
  };
}
