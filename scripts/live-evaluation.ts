import { existsSync } from 'node:fs';
import { fixtures } from '../tests/fixtures';
import { getConfig, publicConfig } from '../lib/server/config';
import { getProvider } from '../lib/server/provider';
import { prepare, evaluate } from '../lib/server/evaluation';

// Opt-in calibration against a real provider. Never runs during npm test/build.
// Uses only original fictional fixtures; never reads students' browser history.
if (existsSync('.env')) process.loadEnvFile('.env');
if (existsSync('.dev.vars')) process.loadEnvFile('.dev.vars');
if (!publicConfig().configured) {
  console.log(
    'SKIPPED: live AI checks require OPENAI_API_KEY and STATREPORT_SIGNING_SECRET. No provider calls were made.',
  );
  process.exit(0);
}
const selected = process.argv.includes('--all')
  ? fixtures
  : fixtures.slice(0, 2);
let failures = 0;
for (const fixture of selected) {
  const context = { ...fixture.context };
  if (!context.rubricText)
    context.rubricText = [
      fixture.rubric.scoringRules,
      ...fixture.rubric.criteria.map(
        (c) =>
          `${c.part}: ${c.requirement} (${c.maxPoints} point). Expected: ${c.expectedAnswer}`,
      ),
      fixture.rubric.errorCarryForward,
    ].join('\n');
  try {
    const envelope = await prepare(
      context,
      getProvider(),
      getConfig().signingSecret,
    );
    const result = await evaluate(
      envelope,
      fixture.answer,
      getProvider(),
      getConfig().signingSecret,
    );
    const expected = fixture.report.totalEarned;
    const pass = result.report.totalEarned === expected;
    if (!pass) failures++;
    console.log(
      `${pass ? 'PASS' : 'REVIEW'}: ${fixture.name}; expected ${expected ?? 'withheld'}, received ${result.report.totalEarned ?? 'withheld'}`,
    );
  } catch {
    failures++;
    console.log(
      `FAILED: ${fixture.name}; provider or validation error. No submission content was logged.`,
    );
  }
}
process.exitCode = failures ? 1 : 0;
