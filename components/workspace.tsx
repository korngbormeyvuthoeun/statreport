'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  FileText,
  History,
  Info,
  Lightbulb,
  LoaderCircle,
  LockKeyhole,
  Plus,
  Settings2,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import {
  AnswerSchema,
  ContextSchema,
  DISCLAIMER,
  type Attempt,
  type Session,
  type SignedRubric,
  type SubmissionContext,
} from '@/lib/domain';
import { createDemoSession, demoRevision } from '@/lib/demo';
import {
  clearHistory,
  deleteSession,
  HISTORY_PREFERENCE_KEY,
  readHistory,
  saveSession,
} from '@/lib/history';
import Report from './report';
import SubmissionField from './submission-field';

const empty: SubmissionContext = {
  question: '',
  rubricText: '',
  referenceAnswer: '',
  source: '',
  courseYear: '2026–27',
  questionType: 'Free response',
};
type Config = { configured: boolean; provider: string; message: string };
async function post<T>(
  url: string,
  body: unknown,
  signal: AbortSignal,
): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      'The server returned an incomplete response. Your text is still here; please try again.',
    );
  }
  if (!response.ok)
    throw new Error(
      (data as { error?: { message?: string } }).error?.message ||
        'Analysis could not be completed. Your text is still here.',
    );
  return data as T;
}
export default function Workspace() {
  const [context, setContext] = useState<SubmissionContext>(empty),
    [answer, setAnswer] = useState('');
  const [mode, setMode] = useState('new'),
    [session, setSession] = useState<Session | null>(null),
    [revising, setRevising] = useState(false);
  const [prepared, setPrepared] = useState<SignedRubric | null>(null),
    [busy, setBusy] = useState(false),
    [phase, setPhase] = useState('');
  const [error, setError] = useState(''),
    [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState(''),
    [config, setConfig] = useState<Config | null>(null),
    [history, setHistory] = useState<Session[]>([]);
  const [saveHistory, setSaveHistory] = useState(false),
    [historyError, setHistoryError] = useState('');
  const [setupOpen, setSetupOpen] = useState(false);
  const [editorRevision, setEditorRevision] = useState(0);
  const [photoState, setPhotoState] = useState({
    question: { pending: false, working: false },
    answer: { pending: false, working: false },
  });
  const onPhotoState = useCallback(
    (target: 'question' | 'answer', pending: boolean, working: boolean) => {
      setPhotoState((state) => ({ ...state, [target]: { pending, working } }));
    },
    [],
  );
  const locked =
    busy || photoState.question.working || photoState.answer.working;
  const pendingPhotos =
    photoState.question.pending || photoState.answer.pending;
  const questionReady =
    !!context.question.trim() && !photoState.question.pending;
  const answerReady = !!answer.trim() && !photoState.answer.pending;
  const readyToSubmit = questionReady && answerReady && !!config?.configured;
  const nextStep = pendingPhotos
    ? 'Review your photo drafts and choose “Use this question” or “Use this answer”.'
    : !questionReady
      ? 'Add your statistics question to get started.'
      : !answerReady
        ? 'Add your answer, including calculations and reasoning.'
        : !config
          ? 'Checking the feedback service…'
          : !config.configured
            ? 'Your text is ready. Personal feedback will be available after app setup.'
            : 'Your question and answer are ready for feedback.';
  const answerRef = useRef<HTMLTextAreaElement>(null),
    questionRef = useRef<HTMLTextAreaElement>(null),
    abortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    fetch('/api/config')
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json() as Promise<Config>;
      })
      .then(setConfig)
      .catch(() =>
        setConfig({
          configured: false,
          provider: 'OpenAI',
          message:
            'Cannot connect to the analysis server. Your text is safe to keep editing; try again when the server is available.',
        }),
      );
    queueMicrotask(() => {
      try {
        setHistory(readHistory(localStorage));
        setSaveHistory(localStorage.getItem(HISTORY_PREFERENCE_KEY) === 'true');
      } catch {
        setHistoryError(
          'Saved work could not be read in this browser. Clear saved history to reset it.',
        );
      }
    });
    return () => abortRef.current?.abort();
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  const updateContext = <K extends keyof SubmissionContext>(
    key: K,
    value: SubmissionContext[K],
  ) => {
    setContext((c) => ({ ...c, [key]: value }));
    setPrepared(null);
  };
  const storeWork = (value: Session) => {
    try {
      setHistory(saveSession(localStorage, value));
      setNotice('Report saved in this browser.');
    } catch {
      setNotice(
        'This browser could not save the report. Your current report is still available; copy or print it.',
      );
    }
  };
  const preference = (value: boolean) => {
    setSaveHistory(value);
    try {
      localStorage.setItem(HISTORY_PREFERENCE_KEY, String(value));
    } catch {
      setNotice('The saving preference could not be stored in this browser.');
    }
  };
  const analyze = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    if (locked) return;
    if (pendingPhotos) {
      setError(
        'Finish reviewing your photo text and choose “Use this question” or “Use this answer”. You can also discard the photo draft to use your typed text.',
      );
      return;
    }
    const c = ContextSchema.safeParse(context),
      a = AnswerSchema.safeParse(answer);
    if (!c.success || !a.success) {
      const fields: Record<string, string> = {};
      if (!c.success)
        c.error.issues.forEach((i) => (fields[String(i.path[0])] = i.message));
      if (!a.success) fields.answer = a.error.issues[0].message;
      setFieldErrors(fields);
      setError('Check the marked fields. Everything you typed has been kept.');
      if (fields.question) questionRef.current?.focus();
      else answerRef.current?.focus();
      return;
    }
    if (!config?.configured) {
      setError(
        config?.message ||
          'The analysis server is not ready. See AI setup or explore the fixed sample report.',
      );
      return;
    }
    if (revising && session && session.attempts.length >= 20) {
      setError(
        'This report has reached 20 attempts. Copy or print your work, then start a new analysis.',
      );
      return;
    }
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;
    const timer = setTimeout(() => controller.abort('timeout'), 375000);
    try {
      let envelope =
        revising && session && !session.demo ? session.envelope : prepared;
      if (!envelope) {
        setPhase('Understanding the question & establishing the rubric');
        envelope = await post<SignedRubric>(
          '/api/prepare',
          { context: c.data },
          controller.signal,
        );
        setPrepared(envelope);
      }
      setPhase('Evaluating your reasoning & checking the report');
      const attempt = await post<Attempt>(
        '/api/evaluate',
        { envelope, answer: a.data },
        controller.signal,
      );
      const next: Session =
        revising && session && !session.demo
          ? { ...session, attempts: [...session.attempts, attempt] }
          : {
              id: crypto.randomUUID(),
              envelope,
              attempts: [attempt],
              demo: false,
            };
      setSession(next);
      setRevising(false);
      setMode('new');
      if (saveHistory) storeWork(next);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(
        controller.signal.aborted
          ? controller.signal.reason === 'timeout'
            ? 'Analysis timed out. Your text and any prepared rubric have been kept. Please retry.'
            : 'Analysis canceled. Your text and any prepared rubric have been kept.'
          : err instanceof Error
            ? err.message
            : 'Analysis failed. Please try again.',
      );
    } finally {
      clearTimeout(timer);
      setBusy(false);
      setPhase('');
      abortRef.current = null;
    }
  };
  const showDemo = () => {
    setSession(createDemoSession());
    setRevising(false);
    setError('');
    setMode('new');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const startRevision = () => {
    if (!session) return;
    setEditorRevision((revision) => revision + 1);
    setPrepared(null);
    setContext(session.envelope.context);
    setAnswer(session.attempts.at(-1)!.answer);
    setRevising(true);
    setError('');
    setFieldErrors({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => answerRef.current?.focus(), 100);
  };
  const backToEditor = () => {
    setSession(null);
    setRevising(false);
    setError('');
    setMode('new');
  };
  const loadSaved = (s: Session) => {
    setSession(s);
    setRevising(false);
    setMode('new');
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const removeSaved = (id: string) => {
    try {
      setHistory(deleteSession(localStorage, id));
      setNotice('Saved report deleted from this browser.');
    } catch {
      setHistoryError(
        'This saved report could not be deleted. You can try clearing all saved history.',
      );
    }
  };
  const clearSaved = () => {
    try {
      setHistory(clearHistory(localStorage));
      setHistoryError('');
      setNotice('All saved reports deleted from this browser.');
    } catch {
      setHistoryError('This browser blocked history deletion.');
    }
  };
  const isReport = !!session && !revising;
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to workspace
      </a>
      <header className="topbar">
        <Link
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            if (!locked) backToEditor();
          }}
          aria-label="StatReport workspace"
        >
          <span className="brand-symbol">
            s<span>r</span>
          </span>
          StatReport
          <span className="brand-divider" />
          <span className="brand-caption">AP STATISTICS</span>
        </Link>
        <div className="topbar-right">
          <span className="course-chip">
            <BookOpen size={15} />
            2026–27 ready
          </span>
          <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
            <DialogTrigger
              render={<Button variant="ghost" className="setup-trigger" />}
            >
              <Settings2 size={16} />
              AI setup
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Connect the analysis engine</DialogTitle>
                <DialogDescription>
                  Real answers are analyzed by a server-side OpenAI integration.
                </DialogDescription>
              </DialogHeader>
              <div className="setup-content">
                <p
                  className={
                    config?.configured ? 'text-positive' : 'text-attention'
                  }
                >
                  {config?.configured
                    ? 'Server credentials are configured.'
                    : 'Live analysis needs server configuration.'}
                </p>
                <p>
                  In the project’s server environment, set{' '}
                  <code>OPENAI_API_KEY</code> and a random{' '}
                  <code>STATREPORT_SIGNING_SECRET</code> of at least 32
                  characters. Restart the server after changing them.
                </p>
                <p>
                  <code>OPENAI_MODEL</code> selects the model. The default is{' '}
                  <code>gpt-5-mini</code>. The README and{' '}
                  <code>.env.example</code> contain the full setup instructions.
                </p>
                <p>
                  Never paste an API key into a question or answer. Keys stay on
                  the server. This application does not ask for them in the
                  browser.
                </p>
                <p>
                  Until setup is complete, use the fixed sample report to
                  explore feedback and revision comparison.
                </p>
                <DialogClose
                  render={<Button variant="outline" />}
                  onClick={showDemo}
                  disabled={locked}
                >
                  Open fixed sample report
                  <ArrowRight size={16} />
                </DialogClose>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>
      <main id="main" className="workspace">
        <div className="workspace-heading">
          <div>
            {isReport && <p className="eyebrow">YOUR PRACTICE REPORT</p>}
            <h1>
              {isReport
                ? 'From your answer to understanding'
                : revising
                  ? 'Give your reasoning another look'
                  : 'Check your statistics work'}
              <span>.</span>
            </h1>
            <p className="subtitle">
              {isReport
                ? 'A closer look at what works, what needs attention, and where to go next.'
                : revising
                  ? 'Use your feedback to revise. The question and scoring criteria stay the same.'
                  : 'Add your question and answer. Type, paste, or scan a photo—then get feedback on your reasoning.'}
            </p>
          </div>
          {isReport ? (
            <Button variant="outline" onClick={backToEditor}>
              <ArrowLeft size={16} />
              Back to workspace
            </Button>
          ) : config?.configured ? (
            <Button
              variant="outline"
              className="sample-button"
              onClick={showDemo}
              disabled={locked}
            >
              <FileText size={16} />
              Explore a sample report
              <ArrowRight size={15} />
            </Button>
          ) : null}
        </div>
        {config && !config.configured && !isReport && (
          <div className="workspace-availability">
            <Info size={18} />
            <p>
              <strong>Sample mode.</strong> Automatic photo reading and personal
              feedback aren’t connected yet. You can prepare your work or
              explore a sample.
            </p>
            <Button variant="outline" disabled={locked} onClick={showDemo}>
              Try a sample
              <ArrowRight size={15} />
            </Button>
          </div>
        )}
        <Tabs
          value={mode}
          onValueChange={(v) => {
            if (!locked) setMode(String(v));
          }}
        >
          <TabsList variant="line" className="work-tabs">
            <TabsTrigger value="new" disabled={locked}>
              <Plus size={16} />
              {isReport
                ? 'Current report'
                : revising
                  ? 'Revise answer'
                  : 'New analysis'}
            </TabsTrigger>
            <TabsTrigger value="history" disabled={locked}>
              <History size={16} />
              Saved reports
              {history.length > 0 && (
                <span className="count-badge">{history.length}</span>
              )}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="new" keepMounted>
            {isReport && (
              <Report
                key={session!.attempts.at(-1)!.id}
                session={session!}
                onRevise={startRevision}
                onSave={() => storeWork(session!)}
                saved={history.some(
                  (s) =>
                    s.id === session!.id &&
                    s.attempts.length === session!.attempts.length,
                )}
                onNotice={setNotice}
              />
            )}
            <div className="workspace-grid submission-editor" hidden={isReport}>
              <section className="input-panel">
                <div className="section-top submission-panel-top">
                  <div>
                    <span className="step-label">
                      01 / {revising ? 'YOUR REVISION' : 'YOUR SUBMISSION'}
                    </span>
                    <h2>
                      {revising
                        ? 'Build on your first answer.'
                        : 'Add your work.'}
                    </h2>
                  </div>
                  <span className="text-badge">
                    {revising ? 'Same rubric' : 'Type or scan'}
                  </span>
                </div>
                <nav
                  className="submission-steps"
                  aria-label="Submission progress"
                >
                  <a
                    href="#submission-question"
                    aria-current={!questionReady ? 'step' : undefined}
                    className={questionReady ? 'complete' : ''}
                  >
                    <span>{questionReady ? <Check size={15} /> : '1'}</span>
                    <div>
                      <strong>Question</strong>
                      <small>
                        {photoState.question.pending
                          ? 'Review photos'
                          : questionReady
                            ? 'Added'
                            : 'Add question'}
                      </small>
                    </div>
                  </a>
                  <a
                    href="#submission-answer"
                    aria-current={
                      questionReady && !answerReady ? 'step' : undefined
                    }
                    className={answerReady ? 'complete' : ''}
                  >
                    <span>{answerReady ? <Check size={15} /> : '2'}</span>
                    <div>
                      <strong>Answer</strong>
                      <small>
                        {photoState.answer.pending
                          ? 'Review photos'
                          : answerReady
                            ? 'Added'
                            : 'Add answer'}
                      </small>
                    </div>
                  </a>
                  <a
                    href="#submission-actions"
                    aria-current={
                      questionReady && answerReady ? 'step' : undefined
                    }
                  >
                    <span>3</span>
                    <div>
                      <strong>Feedback</strong>
                      <small>
                        {busy
                          ? 'In progress'
                          : readyToSubmit
                            ? 'Ready'
                            : 'Next'}
                      </small>
                    </div>
                  </a>
                </nav>
                <form className="input-body" onSubmit={analyze} noValidate>
                  {revising && (
                    <div className="revision-notice">
                      <Button
                        variant="ghost"
                        type="button"
                        onClick={() => {
                          setRevising(false);
                          setError('');
                        }}
                        disabled={locked}
                      >
                        <ArrowLeft size={15} />
                        Back to report
                      </Button>
                      <p>Your previous response and report are preserved.</p>
                      {session?.demo && (
                        <div className="sample-revision">
                          <strong>Fixed sample revision</strong>
                          <p>
                            Load the prepared improved answer to explore
                            comparison. An answer you edit requires the live AI
                            engine.
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setAnswer(demoRevision)}
                          >
                            Load sample revision
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                  <SubmissionField
                    key={`question-${editorRevision}`}
                    target="question"
                    value={context.question}
                    onChange={(value) => updateContext('question', value)}
                    inputRef={questionRef}
                    readOnly={revising}
                    disabled={busy || photoState.answer.working}
                    configured={!!config?.configured}
                    error={fieldErrors.question}
                    onPhotoState={onPhotoState}
                  />
                  <SubmissionField
                    key={`answer-${editorRevision}`}
                    target="answer"
                    value={answer}
                    onChange={setAnswer}
                    inputRef={answerRef}
                    disabled={busy || photoState.question.working}
                    configured={!!config?.configured}
                    error={fieldErrors.answer}
                    onPhotoState={onPhotoState}
                  />
                  <details className="additional">
                    <summary>
                      <Plus size={17} />
                      Additional information<span>Optional</span>
                      <ChevronDown size={16} />
                    </summary>
                    <fieldset disabled={locked || revising}>
                      <label htmlFor="rubric">
                        Teacher rubric or scoring guidelines
                      </label>
                      <textarea
                        id="rubric"
                        value={context.rubricText}
                        onChange={(e) =>
                          updateContext('rubricText', e.target.value)
                        }
                        rows={4}
                        maxLength={20000}
                        placeholder="Paste the complete rubric, including point values and any E/P/I or error-carry-forward rules."
                      />
                      <label htmlFor="reference">Reference answer</label>
                      <textarea
                        id="reference"
                        value={context.referenceAnswer}
                        onChange={(e) =>
                          updateContext('referenceAnswer', e.target.value)
                        }
                        rows={3}
                        maxLength={15000}
                        placeholder="Optional solution or teacher-provided reference answer"
                      />
                      <label htmlFor="source">
                        Question source, year & number
                      </label>
                      <input
                        id="source"
                        value={context.source}
                        onChange={(e) =>
                          updateContext('source', e.target.value)
                        }
                        maxLength={500}
                        placeholder="e.g., 2023 practice exam, question 2"
                      />
                      <div className="metadata-grid">
                        <div>
                          <label id="course-label" htmlFor="course-year">
                            Course / exam year
                          </label>
                          <Select
                            value={context.courseYear}
                            onValueChange={(v) =>
                              v && updateContext('courseYear', v)
                            }
                            disabled={locked || revising}
                          >
                            <SelectTrigger
                              id="course-year"
                              aria-labelledby="course-label"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from(
                                { length: 28 },
                                (_, i) => 2026 - i,
                              ).map((year) => (
                                <SelectItem
                                  key={year}
                                  value={`${year}–${String(year + 1).slice(-2)}`}
                                >
                                  {year}–{String(year + 1).slice(-2)}
                                  {year === 2026 ? ' (revised framework)' : ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label id="type-label" htmlFor="question-type">
                            Question type
                          </label>
                          <Select
                            value={context.questionType}
                            onValueChange={(v) =>
                              v &&
                              updateContext(
                                'questionType',
                                v as SubmissionContext['questionType'],
                              )
                            }
                            disabled={locked || revising}
                          >
                            <SelectTrigger
                              id="question-type"
                              aria-labelledby="type-label"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[
                                'Free response',
                                'Multiple choice',
                                'Classroom practice',
                              ].map((type) => (
                                <SelectItem key={type} value={type}>
                                  {type}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <p className="field-hint">
                        Older questions retain their supplied scoring structure.
                        No rubric? We create and save a clearly labeled practice
                        rubric before grading.
                      </p>
                    </fieldset>
                  </details>
                  <div className="save-preference">
                    <Checkbox
                      id="save-history"
                      checked={saveHistory}
                      onCheckedChange={(v) => preference(!!v)}
                      disabled={locked}
                    />
                    <label htmlFor="save-history">
                      Save completed reports in this browser
                      <span>
                        Optional. Local history stays on this device and can be
                        deleted anytime.
                      </span>
                    </label>
                  </div>
                  <div id="submission-actions" className="submit-readiness">
                    <span className={readyToSubmit ? 'text-positive' : ''}>
                      {readyToSubmit ? <Check size={17} /> : <Info size={17} />}
                      {nextStep}
                    </span>
                  </div>
                  <div className="form-actions">
                    <p>
                      <LockKeyhole size={15} />
                      <span>
                        Your question, answer, and additional materials will be
                        sent to {config?.provider || 'OpenAI'} for analysis. No
                        name or email needed.
                      </span>
                    </p>
                    {session?.demo && revising && answer === demoRevision ? (
                      <Button
                        type="button"
                        className="primary-button"
                        disabled={locked || pendingPhotos}
                        onClick={() => {
                          setSession(createDemoSession(true));
                          setRevising(false);
                          setNotice(
                            'Showing the fixed sample comparison. No AI request was made.',
                          );
                        }}
                      >
                        View sample comparison
                        <ArrowRight size={17} />
                      </Button>
                    ) : config && !config.configured ? (
                      <Button
                        type="button"
                        className="primary-button"
                        disabled={locked}
                        onClick={showDemo}
                      >
                        <FileText size={17} />
                        Explore sample feedback
                        <ArrowRight size={17} />
                      </Button>
                    ) : (
                      <Button
                        type="submit"
                        className="primary-button"
                        disabled={locked || !readyToSubmit}
                      >
                        {busy ? (
                          <LoaderCircle size={17} className="spin" />
                        ) : (
                          <Sparkles size={17} />
                        )}
                        Analyze My Answer
                        <ArrowRight size={17} />
                      </Button>
                    )}
                  </div>
                  {busy && (
                    <output className="analysis-progress">
                      <LoaderCircle size={18} className="spin" />
                      <div>
                        <strong>{phase}</strong>
                        <span>
                          The rubric is saved before your answer is evaluated.
                          This can take a few minutes.
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => abortRef.current?.abort()}
                      >
                        Cancel
                      </Button>
                    </output>
                  )}
                  {error && (
                    <div className="error-notice" role="alert">
                      <Info size={18} />
                      <div>
                        <strong>We couldn’t complete the analysis.</strong>
                        <p>{error}</p>
                      </div>
                    </div>
                  )}
                </form>
              </section>
              <aside className="side-column">
                <section className="guide-card">
                  <span className="small-icon">
                    <Sparkles size={20} />
                  </span>
                  <h2>
                    A little prep.
                    <br />
                    Better feedback.
                  </h2>
                  <p>Bring the complete question and your original work.</p>
                  <div className="guide-item">
                    <span>01</span>
                    <div>
                      <h3>Keep the full question</h3>
                      <p>
                        Include every subpart, graph label, table, and unit.
                      </p>
                    </div>
                  </div>
                  <div className="guide-item">
                    <span>02</span>
                    <div>
                      <h3>Show your reasoning</h3>
                      <p>
                        Include the method you chose and why it fits, even if
                        you’re unsure.
                      </p>
                    </div>
                  </div>
                  <div className="guide-item">
                    <span>03</span>
                    <div>
                      <h3>Double-check photo text</h3>
                      <p>
                        Compare numbers, minus signs, and statistical symbols
                        with the original page.
                      </p>
                    </div>
                  </div>
                  <div className="guide-foot">
                    <FileText size={15} />A report you can save, print, and
                    revisit.
                  </div>
                </section>
                <section className="tip-card">
                  <Lightbulb size={20} />
                  <div>
                    <h3>Bring your rubric.</h3>
                    <p>
                      Have your teacher’s scoring guidelines? Add them for
                      feedback grounded in the same criteria.
                    </p>
                  </div>
                </section>
                <div className="sidebar-note">
                  <span className="tiny-rule" />
                  <p>
                    Practice feedback, with perspective.
                    <br />
                    An estimated score is a starting point for learning.
                  </p>
                </div>
              </aside>
            </div>
          </TabsContent>
          <TabsContent value="history">
            <section className="history-panel">
              <div className="section-top">
                <div>
                  <span className="step-label">ON THIS DEVICE</span>
                  <h2>Your saved reports.</h2>
                </div>
                {(history.length > 0 || historyError) && (
                  <Button variant="outline" onClick={clearSaved}>
                    <Trash2 size={15} />
                    Delete all saved work
                  </Button>
                )}
              </div>
              <p className="section-note">
                History is optional and stays in this browser. Saving stores
                your question, answer, rubric, and reports on this device.
                Deleting saved work does not erase copies already sent to the AI
                provider.
              </p>
              {historyError && (
                <p role="alert" className="field-error">
                  {historyError}
                </p>
              )}
              {history.length ? (
                history.map((s) => (
                  <div className="history-row" key={s.id}>
                    <span className="history-icon">
                      <FileText size={21} />
                    </span>
                    <div>
                      <button onClick={() => loadSaved(s)}>
                        {s.envelope.rubric.title}
                      </button>
                      <p>
                        {s.demo ? 'Fixed demo · ' : ''}
                        {s.envelope.context.courseYear} · {s.attempts.length}{' '}
                        attempt{s.attempts.length === 1 ? '' : 's'} ·{' '}
                        {new Date(
                          s.attempts.at(-1)!.createdAt,
                        ).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="history-score">
                      {s.attempts.at(-1)!.report.totalEarned ?? '—'} /{' '}
                      {s.envelope.rubric.totalAvailable ?? '—'}
                    </span>
                    <Button
                      variant="ghost"
                      onClick={() => loadSaved(s)}
                      aria-label={`Open ${s.envelope.rubric.title}`}
                    >
                      <ArrowRight size={17} />
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => removeSaved(s.id)}
                      aria-label={`Delete ${s.envelope.rubric.title}`}
                    >
                      <Trash2 size={17} />
                    </Button>
                  </div>
                ))
              ) : (
                <div className="history-empty">
                  <History size={32} />
                  <h3>A little progress, worth keeping.</h3>
                  <p>
                    Your saved reports will appear here. Complete an analysis
                    and choose “Save locally” to keep it.
                  </p>
                  <Button variant="outline" onClick={() => setMode('new')}>
                    Back to workspace
                    <ArrowRight size={15} />
                  </Button>
                </div>
              )}
            </section>
          </TabsContent>
        </Tabs>
        <footer>
          <div className="footer-brand">
            <span className="footer-dot" />
            Made for the way you learn.
          </div>
          <p>{DISCLAIMER}</p>
        </footer>
      </main>
      {notice && (
        <output className="toast no-print">
          <Check size={17} />
          {notice}
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice('')}
          >
            <X size={16} />
          </button>
        </output>
      )}
    </div>
  );
}
