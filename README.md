# StatReport

A working AP Statistics answer evaluator: paste a question and your answer, optionally provide a teacher rubric, and receive structured practice feedback. Includes revisions under an immutable rubric, original/revised comparison, a fixed sample demonstration, local history, math rendering, copy export, and browser printing.

## Start locally

Use Node.js 22.13 or later and npm.

```sh
npm ci
npm run dev
```

Open the Local URL printed by the server (normally `http://localhost:3000`). No API key is needed to explore the separately labeled sample report. Your own answers are never graded with fabricated demonstration results.

To enable real analysis, copy `.env.example` to `.dev.vars` in this project and fill in the server settings. The Cloudflare local runtime reads `.dev.vars`; `.env` can also be used with the local calibration script. Restart the development server after changing configuration. On a hosted Site, set the same values as server environment variables; do not include a local secrets file in source control or a deployment archive.

Generate a signing secret locally:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

| Variable                    | Required          | Purpose                                                                                                                          |
| --------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `OPENAI_API_KEY`            | For real analysis | Server-only OpenAI API credential.                                                                                               |
| `STATREPORT_SIGNING_SECRET` | For real analysis | Random secret of at least 32 characters, used to authenticate the saved rubric and question. Keep it stable across deployments.  |
| `OPENAI_MODEL`              | No                | Defaults to `gpt-5-mini`. Must support the Responses API and strict JSON Schema output. Model access depends on the API account. |
| `AI_PROVIDER`               | No                | `openai` (the included adapter). Other values produce an actionable setup error.                                                 |
| `AI_TIMEOUT_MS`             | No                | Per-provider-request timeout; default 90,000 ms, clamped to 1,000–120,000 ms.                                                    |

Never prefix secrets with `VITE_` or `NEXT_PUBLIC_`. Never put keys in question fields, browser storage, client bundles, or Git. `.dev.vars*` and `.env*` are ignored except for the empty `.env.example` template.

## Student workflow

1. Paste the complete question and your answer. Text tables, statistical symbols, calculations, and multipart answers are accepted.
2. Expand **Additional information** for a rubric, reference answer, question source, year, and question type. The course defaults to 2026–27; older course years are supported.
3. Choose **Analyze My Answer**. The privacy notice explains that the submitted materials will be sent to OpenAI. Validation or provider failures leave your writing in the editor.
4. Read the summary, requirements, scored criteria, diagnostic reasoning review, strengths, misconceptions, and prioritized revision plan. Reveal the worked example only when you want it. Follow-up numeric exercises have locally checked answers and hidden hints/solutions.
5. Choose **Revise My Answer**. Real revisions keep the original question and signed rubric. The report preserves all previous attempts and compares the original with the latest revision.
6. Use **Copy report**, **Print / Save as PDF**, or **Save locally**. Saving is optional, stores at most 20 reports with up to 20 attempts each in the current browser, and can be cleared under **Saved reports**.

Demo revision: open **Explore a sample report**, choose **Revise My Answer**, then **Load sample revision** and **View sample comparison**. These actions display fixed sample data, not AI feedback. Editing that sample answer requires live analysis.

## Evaluation design

- `POST /api/prepare` accepts only the question and additional context. Its schema rejects a student answer. A separate provider request understands the question, establishes an expected response, and creates or adapts the rubric without seeing the submission. The result is validated and HMAC-signed before being returned and retained by the client.
- `POST /api/evaluate` verifies the signed context and rubric, evaluates the answer, and sends the draft through a separate AI checking pass. Only a structurally and semantically validated report is published.
- Strict Zod/JSON schemas validate IDs, evidence quotations, supported status labels, ranges, maxima, full/partial/zero point relationships, and totals. Quoted strengths and issue statements must also occur verbatim in the submission. Unassessable criteria have null scores and withhold the overall total.
- Supplied rubrics take priority. Mismatched or uncertain matches withhold scoring instead of silently switching rubrics. Additive rubrics, including 10-point FRQs, retain their allocations. Legacy E/P/I uses explicit question-specific definitions and overall lookup rules, never a universal conversion. Missing overall mappings withhold a total.
- Question source metadata is not treated as proof of official rubric verification. This version does not retrieve published rubrics. Paste the verified question-specific guide if you want it applied; otherwise the rubric is explicitly labeled practice scoring.
- User content is passed as JSON in a user message beneath fixed evaluator instructions. It is never executed or treated as a replacement for those instructions. There is no arbitrary model-code execution.
- Numerical checks are typed functions for mean, sample SD, normal CDF, binomial PMF, one-proportion z tests/intervals, and failure counts. Tests use known numeric results. These checks recompute arithmetic; they do not independently prove that AI-selected inputs or methods match the statistical context. Unsupported work is labeled AI-reviewed only.
- Responses API calls use strict structured output and `store: false`. Timeout, rate limit/quota, authentication, unavailable model, refusal, incomplete output, and malformed result cases return actionable errors without provider payloads or student text.

The framework labels follow the [current AP Statistics course framework](https://apcentral.collegeboard.org/courses/ap-statistics). The revised course takes effect in 2026–27; the [course revisions page](https://apcentral.collegeboard.org/courses/ap-statistics/future-revisions) describes the new 10-point FRQ format. The integration follows the official [Structured Outputs documentation](https://developers.openai.com/api/docs/guides/structured-outputs), [Responses API reference](https://developers.openai.com/api/reference/resources/responses/methods/create), and [GPT-5 mini model documentation](https://developers.openai.com/api/docs/models/gpt-5-mini).

## Commands and checks

```sh
npm test            # Offline fixtures, validation, provider mocks, arithmetic, history, export
npm run typecheck   # TypeScript
npm run lint        # App and test source; generated UI primitives are excluded
npm run build       # Production Worker + browser assets
npm start           # Preview the compiled Worker locally
npm run test:live    # Optional real-provider calibration, two original cases; uses API credits
npm run test:live -- --all # All nine original grading scenarios; uses API credits
```

The live calibration script explicitly skips without credentials. Mocked-provider checks test the pipeline contract and failure handling; they do not establish real-model grading accuracy or resistance to every prompt attack. See `TESTING.md` for the checks run in this workspace.

## Privacy and deployment

No student identity is required. Full submissions are not logged by application code or stored in a server database. Questions, answers, supplied rubrics, and reference answers are transmitted to the configured provider when analyzing. Provider-side retention and abuse-monitoring rules still apply even with `store: false`; deleting browser history cannot erase provider copies. Local history is unencrypted browser storage, visible to others using that browser profile. Clear it on a shared device.

The project uses React, TypeScript, Vinext, and the Cloudflare Workers runtime with the Sites plugin. `.openai/hosting.json` associates this checkout with its Site. Keep the hosted Site owner-only for a personal installation. The in-memory request/concurrency limiter is isolate-local, not a distributed quota boundary. A multi-user public deployment needs appropriate access control, durable rate limits, and provider spending limits before opening access.

## Known limitations

- Real AI grading requires credentials. A working integration and validated mock pipeline are included, but live grading quality cannot be verified without an API key.
- Teacher rubric matching, semantic reasoning, alternate-method recognition, and the independent example review are model judgments and can be wrong. Ask a teacher to review consequential interpretations. A separate AI pass is not a guarantee of full credit.
- E/P/I support requires the actual definitions and complete question-specific overall rules. Rubrics with unsupported non-additive schemes should produce qualitative feedback or withheld scores rather than an invented conversion.
- Only the listed numerical operations have deterministic verification. Graph interpretation cannot proceed reliably without a supplied graph description/data; this text-first version has no image upload or OCR.
- Follow-up exercises are restricted to self-contained numerical questions the checker supports. A purely conceptual difficulty may receive a revision instruction instead of an unreliable auto-graded follow-up.
- A provider request may take up to 90 seconds by default. Initial analysis has one preparation request and two grading/review requests. Retrying uses an already prepared rubric when possible. There is no automatic retry that could silently multiply API cost.
- Unsaved drafts exist in memory only and are lost on a full page reload. Form validation, provider failures, and cancellation preserve them within the open page. Local storage can be unavailable or full; the UI reports that failure and retains the current report for copying/printing.
- Rotating the signing secret invalidates further grading with previously signed rubrics. Saved reports remain readable.
- Browser print layouts vary. Printing expands report details and includes the question, submitted answer, rubric rules, feedback, and comparison; navigation, editing controls, and practice solutions are hidden.

Independent AP Statistics practice tool. Not affiliated with or endorsed by College Board. AI-generated feedback may require teacher review.
