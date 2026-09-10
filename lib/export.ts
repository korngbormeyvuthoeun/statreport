import { DISCLAIMER, PRACTICE_LABEL, type Session } from './domain';
export function reportText(session: Session) {
  const { context, rubric } = session.envelope,
    attempt = session.attempts.at(-1)!,
    r = attempt.report;
  const sections = [
    `StatReport — ${rubric.title}`,
    session.demo
      ? 'FIXED SAMPLE DEMONSTRATION'
      : 'Estimated practice assessment',
    `${context.courseYear} · ${context.questionType}\n${rubric.topic}`,
    `Estimated practice score: ${r.totalEarned ?? 'Withheld'} / ${rubric.totalAvailable ?? 'Not assigned'}`,
    `Rubric: ${rubric.sourceDescription}\n${rubric.source === 'practice' ? PRACTICE_LABEL : ''}`,
    `QUESTION\n${context.question}`,
    `QUESTION SOURCE\n${context.source || 'Not supplied'}`,
    `STUDENT ANSWER\n${attempt.answer}`,
    `SUPPLIED RUBRIC\n${context.rubricText || 'None'}`,
    `REFERENCE ANSWER\n${context.referenceAnswer || 'None'}`,
    `SUMMARY\n${r.summary}\n${r.uncertainty.join('\n')}`,
    `QUESTION REQUIREMENTS\n${rubric.requirements.map((q) => `${q.part}: ${q.description}`).join('\n')}`,
    `SCORING\n${r.rows
      .map((row) => {
        const c = rubric.criteria.find((c) => c.id === row.criterionId)!;
        return `${c.part} · ${c.requirement}\n${row.status} · ${row.epiRating ?? (c.maxPoints === null ? 'No separate points' : `${row.earned ?? 'Withheld'}/${c.maxPoints}`)}\nEvidence: ${row.evidence.join(' | ') || 'No supporting text supplied'}\n${row.explanation}`;
      })
      .join('\n\n')}`,
    `RUBRIC RULES\n${rubric.scoringRules}\nError carry forward: ${rubric.errorCarryForward || 'No additional rule specified.'}`,
    `STATISTICAL REASONING REVIEW (diagnostic)\n${r.reasoning.map((x) => `${x.aspect} — ${x.assessment}\n${x.observation}\n${x.improvement}`).join('\n\n')}`,
    `STRENGTHS\n${r.strengths.map((x) => `${x.description}\nEvidence: ${x.evidence}`).join('\n\n')}`,
    `ERRORS AND MISCONCEPTIONS\n${r.issues.map((x) => `${x.issue}\n${x.statement || 'Missing component'}\n${x.why}\nCorrection: ${x.correction}`).join('\n\n')}`,
    `REVISION PLAN\n${r.revisionPlan.map((x, i) => `${i + 1}. ${x}`).join('\n')}`,
    `EXAMPLE RESPONSE — OTHER VALID APPROACHES MAY ALSO EARN CREDIT\n${r.exampleAnswer}`,
    `NUMERICAL CHECKS\n${attempt.checks.map((c) => `${c.label}: ${c.status} · ${c.result?.join(', ') ?? ''}\n${c.detail}`).join('\n') || 'No supported calculation was independently recomputed.'}`,
    `NEXT PRACTICE STEP\n${r.practice.map((p) => p.question).join('\n\n')}`,
  ];
  if (session.attempts.length > 1)
    sections.push(
      `REVISION COMPARISON\n${session.attempts.map((a, i) => `Attempt ${i + 1}: ${a.report.totalEarned ?? 'Withheld'} / ${rubric.totalAvailable ?? 'Not assigned'}\n${a.answer}`).join('\n\n')}`,
    );
  sections.push(DISCLAIMER);
  return sections.join('\n\n');
}
