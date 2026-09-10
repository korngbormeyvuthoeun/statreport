# Verification record

Checked in the supplied Windows workspace on 2026-09-10.

## Executed checks

| Check | Result |
| --- | --- |
| `npm test` | **57 passed, 0 failed.** Uses original fictional fixtures and provider mocks. |
| `npm run typecheck` | Passed. |
| `npm run lint` | Passed for app, server, scripts, and tests. Generated starter UI primitives and hooks are excluded because their unchanged source has upstream lint errors. |
| `npm run build` | Passed. Browser assets, KaTeX fonts, and Worker routes were generated. A non-blocking large client-chunk warning remains. |
| `npm run test:live` | **Skipped explicitly:** no API key or signing secret configured. No paid provider request was made. |
| HTTP `/` and `/api/config` | Returned 200. Configuration endpoint reports setup required without disclosing secrets. |
| HTTP `/api/prepare` without credentials | Returned 503 `SETUP_REQUIRED`; no fabricated report. |

The offline suite covers all requested examples: fully correct; partially correct; correct numerical answer with missing justification; valid alternative method; conceptual error; unanswered subpart; missing graph; mismatched rubric; embedded manipulation instructions; and inconsistent AI scores. It also checks precise permitted point values, 10-point rubrics, E/P/I lookups without universal conversion, exact evidence references, signing/tampering, independent rubric preparation, a separate audit pass, error states, numerical routines, revision comparisons, optional history/deletion, and export content.

The fixtures and mocked outcomes verify deterministic application behavior. They do **not** prove that a live model will recognize every misconception, malicious instruction, or valid alternative. The opt-in calibration script can check real responses after configuring credentials.

## Browser workflow exercised

- Entered an original question; submitted with a missing answer; confirmed a validation message and preserved question text.
- Entered an answer and submitted without credentials; confirmed setup guidance rather than a fabricated score.
- Opened the fixed sample report and inspected the summary, scoring evidence, rubric decisions, reasoning feedback, and revision plan.
- Loaded the explicitly prepared sample revision; compared the original 2/4 with the revised 4/4; confirmed the original response and summary were preserved and newly met criteria were identified.
- Saved the sample locally, opened the saved-report view, and deleted the saved sample; the empty state returned.
- Copied the report and confirmed the clipboard export included the revision comparison.
- Confirmed the example response was initially hidden and appeared when revealed.
- Entered `28` for the original failure-count practice question and received a correct-result message from the deterministic checker.
- Activated **Print / Save as PDF**. Print CSS tests confirm inclusion of all report panels, question/answer/rubric content, repeated table headers, and removal of editing/navigation controls.
- Inspected the desktop page visually. The in-app browser's viewport override did not reliably produce the requested CSS viewport dimensions; exact mobile breakpoint and 200% zoom certification remain manual checks. Temporary viewport overrides were reset.

No physical printer output or final PDF pagination was captured. The app uses the browser's native print dialog, with before/after-print expansion and restoration of report details. Verify pagination in the target browser if a particular page format is required.

## Photo-input update

- Added eight offline checks (57 total): supported formats and source size, data URL/signature validation, processed image size and page count, separation of question and answer, append/replace review behavior, unclear/invalid transcription results, image-aware Responses payloads with `store:false`, and an isolated bounded photo request body.
- Type checking and lint passed after the photo integration. The production build was rerun for this update.
- The actual local `/api/transcribe` route returned 503 `SETUP_REQUIRED` with actionable guidance when credentials were absent. It did not return fabricated extracted text.
- Browser inspection confirmed separate Type / paste and Photos controls for question and answer, the upload/camera actions, file-format guidance, privacy notice, and the setup-required state. Switching to Photos preserved the typed question in component state.
- The browser file-chooser automation did not complete reliably. Full browser upload → preview → OCR → edit → confirm interaction, real-device camera capture, orientation handling, and live handwriting/graph recognition remain unverified. A temporary local proxy for fixture-only UI testing was stopped and is excluded from source and deployment.
- The backend photo flow and review helpers use deterministic mocks in tests. These do not establish OCR accuracy; check real handwritten samples once credentials are configured. HEIC/PDF require conversion to JPG/PNG/WebP. Uploaded images are transient; local report history contains only confirmed text.

## Dependency checks (original audit)

Security fixes were applied to React, React DOM, React Server Components, Vinext, Vite, and the Cloudflare toolchain. The final advisory scan reports **four high-severity dependency entries** (`sharp`, `miniflare`, `wrangler`, and `@cloudflare/vite-plugin`), all tracing to the toolchain's pinned `sharp@0.35.2` image library. The package manager's proposed automated fix is an incompatible downgrade of the Cloudflare tools, so it was not forced. These packages serve local development/packaging; StatReport processes photos with browser canvas and sends bounded image data directly to its AI provider; it does not use Sharp in its browser, upload route, or assessment code. The finding remains open for the upstream toolchain to update its pinned dependency.

## Remaining validation

Run real-provider calibration and a full custom-answer → analysis → revision workflow once credentials are available. Model quality, provider quota/access, rubric interpretation, and deployment-specific timeout behavior require that live check. Check the printed PDF in the target browser and exact mobile/zoom behavior manually. See `README.md` for setup and all application limitations.
