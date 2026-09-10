'use client';
import { useEffect, useState, useId } from 'react';
import {
  ArrowRight,
  Check,
  CheckCheck,
  ChevronDown,
  Copy,
  FileText,
  Info,
  Pencil,
  Printer,
  Save,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  compareAttempts,
  PRACTICE_LABEL,
  type Session,
  type AssessmentReport,
} from '@/lib/domain';
import { checkPractice } from '@/lib/numerical';
import { reportText } from '@/lib/export';
import { MathText } from './math-text';

export function PracticeCard({
  practice,
}: {
  practice: AssessmentReport['practice'][number];
}) {
  const inputId = useId();
  const [answer, setAnswer] = useState(''),
    [feedback, setFeedback] = useState('');
  return (
    <div className="practice-card">
      <MathText text={practice.question} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            setFeedback(
              checkPractice(
                practice.operation,
                practice.inputs,
                practice.answerIndex,
                answer,
              ).message,
            );
          } catch {
            setFeedback(
              'This numerical exercise could not be checked. Try another practice question.',
            );
          }
        }}
      >
        <label className="sr-only" htmlFor={inputId}>
          Your numerical answer
        </label>
        <input
          id={inputId}
          inputMode="decimal"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Your numerical answer"
        />
        <Button type="submit" variant="outline">
          Check answer
          <ArrowRight size={15} />
        </Button>
      </form>
      <output className="practice-feedback">{feedback}</output>
      <details>
        <summary>
          Reveal hint & solution
          <ChevronDown size={15} />
        </summary>
        <p>
          <MathText text={practice.hint} />
        </p>
        <p>
          <MathText text={practice.solution} />
        </p>
      </details>
    </div>
  );
}
export default function Report({
  session,
  onRevise,
  onSave,
  saved,
  onNotice,
}: {
  session: Session;
  onRevise: () => void;
  onSave: () => void;
  saved: boolean;
  onNotice: (message: string) => void;
}) {
  const [tab, setTab] = useState('feedback');
  const { context, rubric } = session.envelope,
    attempt = session.attempts.at(-1)!,
    report = attempt.report;
  const comparison = compareAttempts(session);
  useEffect(() => {
    let details: HTMLDetailsElement[] = [];
    let states: boolean[] = [];
    const before = () => {
      details = Array.from(
        document.querySelectorAll<HTMLDetailsElement>(
          '.report-document details',
        ),
      );
      states = details.map((d) => d.open);
      details.forEach((d) => (d.open = true));
    };
    const after = () => details.forEach((d, i) => (d.open = states[i]));
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, []);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reportText(session));
      onNotice('Report copied to your clipboard.');
    } catch {
      onNotice(
        'Clipboard access was blocked. Use Print / Save as PDF to export your report.',
      );
    }
  };
  const print = () => {
    window.print();
  };
  return (
    <article className="report-document">
      {session.demo && (
        <div className="demo-banner no-print">
          <Sparkles size={17} />
          <div>
            <strong>Fixed sample demonstration</strong>
            <span>
              This report uses a prepared question and answer. Your own
              submissions are never graded in demo mode.
            </span>
          </div>
        </div>
      )}
      <div className="report-summary">
        <div>
          <span className="step-label">
            {session.demo ? 'DEMONSTRATION' : 'YOUR ASSESSMENT'} /{' '}
            {context.courseYear}
          </span>
          <h2>{rubric.title}</h2>
          <p className="topic-line">{rubric.topic}</p>
          <p className="summary-text">
            <MathText text={report.summary} />
          </p>
          <div className="skill-tags">
            {rubric.skills.map((s) => (
              <span key={s}>{s}</span>
            ))}
          </div>
          <p className="microcopy">
            Skills assessed in this question; this response does not establish
            mastery.
          </p>
        </div>
        <div className="score-card">
          <span>Estimated practice score</span>
          <div className="score-number">
            {report.totalEarned ?? '—'}
            <small>/ {rubric.totalAvailable ?? '—'}</small>
          </div>
          <span>
            {report.totalEarned === null
              ? 'Scoring withheld / qualitative review'
              : `${report.rows.filter((r) => r.status === 'Met').length} of ${rubric.criteria.length} criteria met`}
          </span>
          {session.attempts.length > 1 && (
            <div className="revision-score">
              <CheckCheck size={14} />
              Revision {session.attempts.length - 1}
            </div>
          )}
        </div>
      </div>
      <div className="rubric-source">
        <Info size={16} />
        <div>
          <strong>
            {rubric.source === 'practice'
              ? session.demo
                ? 'Fixed demonstration practice rubric'
                : PRACTICE_LABEL
              : 'Supplied rubric'}
          </strong>
          <span>{rubric.sourceDescription}</span>
        </div>
      </div>
      {(rubric.match !== 'matched' ||
        report.uncertainty.length > 0 ||
        rubric.warnings.length > 0) && (
        <details className="review-warning" open={rubric.match !== 'matched'}>
          <summary>
            Uncertainty & teacher review
            <ChevronDown size={16} />
          </summary>
          {rubric.match !== 'matched' && <p>{rubric.matchExplanation}</p>}
          {[...rubric.warnings, ...report.uncertainty].map((x, i) => (
            <p key={i}>{x}</p>
          ))}
        </details>
      )}
      <div className="report-toolbar no-print">
        <Button onClick={onRevise} className="primary-button">
          <Pencil size={15} />
          Revise My Answer
        </Button>
        <div>
          <Button variant="ghost" onClick={onSave}>
            <Save size={16} />
            {saved ? 'Saved locally' : 'Save locally'}
          </Button>
          <Button variant="ghost" onClick={copy}>
            <Copy size={16} />
            Copy report
          </Button>
          <Button variant="outline" onClick={print}>
            <Printer size={16} />
            Print / Save as PDF
          </Button>
        </div>
      </div>
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(String(v))}
        className="report-tabs"
      >
        <TabsList variant="line" className="no-print">
          <TabsTrigger value="feedback">Your feedback</TabsTrigger>
          <TabsTrigger value="submission">Question & submission</TabsTrigger>
          {session.attempts.length > 1 && (
            <TabsTrigger value="comparison">Compare revisions</TabsTrigger>
          )}
        </TabsList>
        <TabsContent
          value="feedback"
          keepMounted
          className="feedback-content print-content"
        >
          <section className="report-section">
            <div className="report-section-heading">
              <span>01</span>
              <h3>What the question asks</h3>
            </div>
            {rubric.requirements.map((q) => (
              <div className="requirement" key={q.part}>
                <span className="part-tag">{q.part}</span>
                <MathText text={q.description} />
              </div>
            ))}
          </section>
          <section className="report-section">
            <div className="report-section-heading">
              <span>02</span>
              <h3>Part-by-part scoring</h3>
            </div>
            <Table className="scoring-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Part & criterion</TableHead>
                  <TableHead>Evidence & decision</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="points-cell">
                    {rubric.scoringMode === 'epi' ? 'Rating' : 'Points'}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.rows.map((row) => {
                  const c = rubric.criteria.find(
                    (c) => c.id === row.criterionId,
                  )!;
                  return (
                    <TableRow key={row.criterionId}>
                      <TableCell>
                        <span className="criterion-part">{c.part}</span>
                        <strong>{c.requirement}</strong>
                      </TableCell>
                      <TableCell>
                        {row.evidence.length > 0 ? (
                          <blockquote>
                            {row.evidence.map((q, i) => (
                              <MathText
                                key={i}
                                text={`“${q}”${i < row.evidence.length - 1 ? '\n' : ''}`}
                              />
                            ))}
                          </blockquote>
                        ) : (
                          <span className="no-evidence">
                            {row.status === 'Not assessable'
                              ? 'Information needed to assess this part.'
                              : 'No supporting text in your answer.'}
                          </span>
                        )}
                        <p>
                          <MathText text={row.explanation} />
                        </p>
                        {row.issueType === 'alternative_method' && (
                          <span className="alternative-tag">
                            Valid alternative approach
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`status-tag ${row.status === 'Met' ? 'met' : row.status === 'Not assessable' ? 'unassessable' : row.status === 'Partially met' ? 'partial' : 'not-met'}`}
                        >
                          {row.status === 'Met' ? (
                            <Check size={13} />
                          ) : (
                            <Info size={13} />
                          )}{' '}
                          {row.status === 'Not assessable'
                            ? 'Not assessable from supplied information'
                            : row.status}
                        </span>
                      </TableCell>
                      <TableCell className="points-cell">
                        {row.epiRating ??
                          (c.maxPoints === null
                            ? '—'
                            : `${row.earned ?? '—'} / ${c.maxPoints}`)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <details className="rubric-details">
              <summary>
                View the saved rubric & scoring rules
                <ChevronDown size={15} />
              </summary>
              <p>
                <MathText text={rubric.scoringRules} />
              </p>
              <p>
                Error carry forward:{' '}
                {rubric.errorCarryForward || 'No additional rule specified.'}
              </p>
              {rubric.criteria.map((c) => (
                <div key={c.id}>
                  <strong>
                    {c.part} · {c.requirement}
                  </strong>
                  <p>
                    <MathText text={c.expectedAnswer} />
                  </p>
                  {c.partialCredit && (
                    <p>Partial credit: {c.partialCreditRule}</p>
                  )}
                  {c.epiDefinitions && <p>{c.epiDefinitions}</p>}
                </div>
              ))}
              {rubric.epiLookup.length > 0 && (
                <p>
                  Overall lookup (ratings in criterion order):{' '}
                  {rubric.epiLookup
                    .map((x) => `${x.pattern} → ${x.points}`)
                    .join('; ')}
                </p>
              )}
              <p className="microcopy">
                Rubric {rubric.id} · Established{' '}
                {new Date(session.envelope.createdAt).toLocaleString()} · Reused
                for all revisions
              </p>
            </details>
          </section>
          <section className="report-section">
            <div className="report-section-heading">
              <span>03</span>
              <h3>Statistical reasoning review</h3>
              <span className="text-badge">Diagnostic feedback</span>
            </div>
            <p className="section-note">
              Suggestions here do not create additional point deductions.
            </p>
            <div className="reasoning-grid">
              {report.reasoning.map((item) => (
                <div className="reasoning-item" key={item.aspect}>
                  <h4>{item.aspect}</h4>
                  <span
                    className={
                      item.assessment === 'Appropriate'
                        ? 'text-positive'
                        : 'text-attention'
                    }
                  >
                    {item.assessment}
                  </span>
                  <p>
                    <MathText text={item.observation} />
                  </p>
                  {item.improvement && (
                    <p className="reasoning-improve">
                      <MathText text={item.improvement} />
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
          <div className="feedback-pair">
            <section className="report-section strengths">
              <div className="report-section-heading">
                <span>04</span>
                <h3>Keep doing this</h3>
              </div>
              {report.strengths.length ? (
                report.strengths.map((s, i) => (
                  <div className="strength" key={i}>
                    <CheckCheck size={18} />
                    <div>
                      <p>
                        <MathText text={s.description} />
                      </p>
                      <blockquote>“{s.evidence}”</blockquote>
                    </div>
                  </div>
                ))
              ) : (
                <p>
                  No specific strengths could be established from the supplied
                  answer.
                </p>
              )}
            </section>
            <section className="report-section issues">
              <div className="report-section-heading">
                <span>05</span>
                <h3>Errors & misconceptions</h3>
              </div>
              {report.issues.length ? (
                report.issues.map((issue, i) => (
                  <details key={i} open>
                    <summary>
                      {issue.issue}
                      <ChevronDown size={15} />
                    </summary>
                    <p className="issue-statement">
                      {issue.statement
                        ? `“${issue.statement}”`
                        : 'Missing component'}
                    </p>
                    <p>
                      <MathText text={issue.why} />
                    </p>
                    <p>
                      <strong>Try this: </strong>
                      <MathText text={issue.correction} />
                    </p>
                  </details>
                ))
              ) : (
                <p>No important errors were identified under this rubric.</p>
              )}
            </section>
          </div>
          <section className="revision-plan report-section">
            <div className="report-section-heading">
              <span>06</span>
              <h3>How to improve this answer</h3>
            </div>
            <ol>
              {report.revisionPlan.map((step, i) => (
                <li key={i}>
                  <span>{i + 1}</span>
                  <MathText text={step} />
                </li>
              ))}
            </ol>
          </section>
          <section className="report-section">
            <div className="report-section-heading">
              <span>07</span>
              <h3>A worked example</h3>
            </div>
            <details className="example-answer">
              <summary>
                <BookIcon />
                Show Example Answer
                <ChevronDown size={16} />
              </summary>
              <p className="example-label">
                Example response — other valid approaches may also earn credit.
              </p>
              <MathText text={report.exampleAnswer} />
              <p className="microcopy">
                {session.demo
                  ? 'Fixed example with independently recomputed interval arithmetic.'
                  : 'The example was reviewed in a separate AI pass; that review is not a guarantee of correctness.'}{' '}
                No official full-credit guarantee is made.
              </p>
            </details>
            <details className="numerical-details">
              <summary>
                Calculation verification
                <ChevronDown size={15} />
              </summary>
              {attempt.checks.length ? (
                attempt.checks.map((check) => (
                  <div key={check.id}>
                    <strong>
                      {check.label} · {check.status}
                    </strong>
                    <p>
                      {check.result
                        ?.map((n) => Number(n.toPrecision(7)))
                        .join(', ')}
                    </p>
                    <p>{check.detail}</p>
                  </div>
                ))
              ) : (
                <p>
                  No supported calculation was independently recomputed.
                  Calculations in this report remain AI-reviewed only.
                </p>
              )}
            </details>
          </section>
          <section className="report-section practice-section">
            <div className="report-section-heading">
              <span>08</span>
              <h3>Your next practice step</h3>
            </div>
            <p className="section-note">
              A small step to make the reasoning stick. Numerical answers are
              checked locally.
            </p>
            {report.practice.length ? (
              report.practice.map((p, i) => (
                <PracticeCard key={`${attempt.id}-${i}`} practice={p} />
              ))
            ) : (
              <p>
                A reliable targeted exercise could not be generated from the
                supplied information.
              </p>
            )}
          </section>
        </TabsContent>
        <TabsContent
          value="submission"
          keepMounted
          className="submission-content print-content"
        >
          <section className="report-section">
            <h3>Question & submitted work</h3>
            <p className="section-note">
              {context.courseYear} · {context.questionType} ·{' '}
              {context.source || 'Source not supplied'}
            </p>
            <h4>Question</h4>
            <div className="original-text">
              <MathText text={context.question} />
            </div>
            <h4>Student answer</h4>
            <div className="original-text">
              <MathText text={attempt.answer} />
            </div>
            <h4>Teacher-provided rubric</h4>
            <div className="original-text">
              <MathText
                text={
                  context.rubricText ||
                  'None supplied. A question-specific practice rubric is used.'
                }
              />
            </div>
            <h4>Optional reference answer</h4>
            <div className="original-text">
              <MathText text={context.referenceAnswer || 'None supplied.'} />
            </div>
          </section>
        </TabsContent>
        {session.attempts.length > 1 && (
          <TabsContent
            value="comparison"
            keepMounted
            className="comparison-content print-content"
          >
            <section className="report-section">
              <h3>Your revision, side by side</h3>
              <p className="section-note">
                Both answers use the same saved rubric. Added length does not
                earn credit by itself.
              </p>
              <div className="comparison-grid">
                {[comparison.original, comparison.latest].map((a, i) => (
                  <div key={i}>
                    <div className="comparison-heading">
                      <strong>
                        {i === 0 ? 'Original response' : 'Latest revision'}
                      </strong>
                      <span>
                        {a.report.totalEarned ?? '—'} /{' '}
                        {rubric.totalAvailable ?? '—'}
                      </span>
                    </div>
                    <div className="original-text">
                      <MathText text={a.answer} />
                    </div>
                    <p>
                      <MathText text={a.report.summary} />
                    </p>
                  </div>
                ))}
              </div>
              <div className="comparison-result">
                <p>
                  {comparison.comparable
                    ? `Estimated score change: ${comparison.delta! > 0 ? '+' : ''}${comparison.delta} point${Math.abs(comparison.delta!) === 1 ? '' : 's'}.`
                    : 'Scores are not numerically comparable because scoring was withheld or qualitative.'}
                </p>
                <h4>Requirements now met</h4>
                {comparison.newlyMet.length ? (
                  comparison.newlyMet.map((id) => (
                    <p key={id}>
                      <Check size={16} />{' '}
                      {rubric.criteria.find((c) => c.id === id)?.requirement}
                    </p>
                  ))
                ) : (
                  <p>No additional criteria are fully met.</p>
                )}
                <h4>Remaining issues</h4>
                {comparison.remaining.length ? (
                  comparison.remaining.map((id) => (
                    <p key={id}>
                      {rubric.criteria.find((c) => c.id === id)?.requirement}:{' '}
                      {
                        comparison.latest.report.rows.find(
                          (r) => r.criterionId === id,
                        )?.explanation
                      }
                    </p>
                  ))
                ) : (
                  <p>All criteria in this rubric are met.</p>
                )}
              </div>
              <details>
                <summary>
                  All attempts ({session.attempts.length})
                  <ChevronDown size={16} />
                </summary>
                {session.attempts.map((a, i) => (
                  <div className="past-attempt" key={a.id}>
                    <h4>
                      Attempt {i + 1} · {a.report.totalEarned ?? '—'} /{' '}
                      {rubric.totalAvailable ?? '—'}
                    </h4>
                    <MathText text={a.answer} />
                    <p>{a.report.summary}</p>
                  </div>
                ))}
              </details>
            </section>
          </TabsContent>
        )}
      </Tabs>
      <p className="print-only">
        {session.demo ? 'FIXED SAMPLE DEMONSTRATION · ' : ''}Estimated practice
        feedback. Independent AP Statistics practice tool. Not affiliated with
        or endorsed by College Board. AI-generated feedback may require teacher
        review.
      </p>
    </article>
  );
}
function BookIcon() {
  return <FileText size={17} />;
}
