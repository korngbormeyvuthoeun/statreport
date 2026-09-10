import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculate,
  checkCalculations,
  checkPractice,
  normalCDF,
} from '../lib/numerical';
import { demoContext, demoRubric } from '../lib/demo';
const close = (actual: number, expected: number, tolerance = 1e-6) =>
  assert.ok(
    Math.abs(actual - expected) < tolerance,
    `${actual} != ${expected}`,
  );
test('mean and sample standard deviation match known independent examples', () => {
  close(calculate('mean', [2, 4, 6])[0], 4);
  close(calculate('sampleSD', [2, 4, 6])[0], 2);
  close(calculate('sampleSD', [1, 1, 1])[0], 0);
});
test('normal probabilities match published normal table reference values', () => {
  close(normalCDF(0), 0.5);
  close(normalCDF(1.96), 0.9750021);
  close(normalCDF(-1.96), 0.0249979);
  close(normalCDF(8), 1);
});
test('binomial probability handles exact small examples and boundaries', () => {
  close(calculate('binomialProbability', [4, 0.5, 2])[0], 0.375);
  assert.deepEqual(calculate('binomialProbability', [10, 0, 0]), [1]);
  assert.deepEqual(calculate('binomialProbability', [10, 1, 10]), [1]);
});
test('one proportion interval and test use the proper standard errors', () => {
  const ci = calculate('oneProportionInterval', [96, 150, 1.96]);
  close(ci[0], 0.5631840016663193);
  close(ci[1], 0.7168159983336807);
  const z = calculate('oneProportionZ', [60, 100, 0.5]);
  close(z[0], 2);
  close(z[1], 0.9772499);
  close(z[2], 0.0227501);
});
test('counts are checked from the raw sample numbers', () =>
  assert.deepEqual(calculate('countFailures', [52, 80]), [28]));
test('invalid and nonfinite numeric inputs cannot run calculations', () => {
  assert.throws(() => calculate('sampleSD', [4]));
  assert.throws(() => calculate('mean', [NaN]));
  assert.throws(() => calculate('oneProportionZ', [8, 4, 0.5]));
  assert.throws(() => calculate('binomialProbability', [10, 2, 1]));
  assert.throws(() => calculate('countFailures', [81, 80]));
});
test('numeric verification distinguishes recomputation, discrepancy, and untraced inputs', () => {
  assert.equal(
    checkCalculations(demoRubric.calculations, demoContext.question)[0].status,
    'Recomputed',
  );
  const c = structuredClone(demoRubric.calculations);
  c[0].expected = [0, 1, 1];
  assert.equal(
    checkCalculations(c, demoContext.question)[0].status,
    'Discrepancy',
  );
  c[0].sourceQuotes = ['sample size 200'];
  assert.equal(
    checkCalculations(c, demoContext.question)[0].status,
    'Unverified',
  );
});
test('practice checker accepts justified rounding and rejects arbitrary strings', () => {
  assert.equal(
    checkPractice('oneProportionInterval', [60, 100, 1.96], 0, '0.5040')
      .correct,
    true,
  );
  assert.equal(checkPractice('countFailures', [52, 80], 0, '28').correct, true);
  assert.equal(
    checkPractice('countFailures', [52, 80], 0, '27').correct,
    false,
  );
  assert.equal(checkPractice('mean', [2, 4], 0, '3 garbage').correct, false);
  assert.equal(checkPractice('mean', [2, 4], 0, '').correct, false);
});
