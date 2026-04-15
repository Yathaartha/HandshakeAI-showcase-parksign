# Parkwise AI

Parkwise AI is a modular parking sign interpretation web app designed to resemble a polished consumer upload tool while using a production-style low-cost pipeline:

- Structured intake for image and manual parking context
- Browser-side Tesseract.js OCR for parking sign text extraction
- Groq text reasoning for low-cost sign normalization
- Deterministic parsing and rule reasoning for explainable outputs
- Confidence flags, disclaimers, feedback capture, and logging
- A UI that surfaces OCR status, timeline, normalized rules, and recommendations

## Run locally

1. Copy `.env.example` to `.env` and add `GROQ_API_KEY`.
2. Install dependencies with `npm install`.
3. Start the app with `npm start`.
4. Open `http://localhost:3000`.

## Cost-saving stack

- Tesseract.js runs OCR in the browser, so uploaded images do not need to be sent to the LLM.
- Groq receives extracted text plus user context rather than raw images, which usually means much lower token usage than multimodal vision flows.
- The project includes `api/*.js` handlers so it can deploy cleanly to Vercel Functions on the free tier for small projects and prototypes.

## System architecture

### 1. Structured Intake Layer

- Collects a parking sign image plus optional city, state, country, date/time, vehicle type, permits, and parking duration.
- Validates missing inputs and warns when the image is likely blurry or when no timestamp is supplied.
- Normalizes the parking attempt into a deterministic context object used by every later module.

### 2. Image Intake and Sign Detection

- Tesseract.js runs in the browser and extracts text before the request is sent to the backend.
- `extract-sign-data.js` uses Groq on text-only OCR output to split stacked signs, infer arrows and icons when possible, and attach uncertainty notes.
- `sign-detection.js` converts that raw extraction into a normalized layout for downstream parsing.

### 3. Parsing Engine

- `rule-parser.js` converts sign text into normalized rule objects.
- It extracts rule type, day windows, time windows, permit requirements, arrow direction, source sign, and severity.
- Restrictive rules are sorted ahead of permissive ones to support conflict resolution.

### 4. Rule Reasoning Layer

- `rule-reasoner.js` applies the parsed rules to the user context.
- It determines whether parking is currently allowed, identifies the active restriction, detects permissive-vs-restrictive conflicts, and computes the next likely legal time.
- Timeline generation creates a day view of likely legal vs restricted windows.

### 5. Recommendation and Guardrails

- `recommendation-generator.js` turns the reasoning result into practical next steps such as permit reminders, tow-risk warnings, and safe-window guidance.
- Reliability guardrails surface OCR uncertainty, warn about missing or blurry inputs, and avoid legal guarantees.
- The UI repeats that the interpretation is advisory and may be superseded by local rules, curb paint, meters, or temporary notices.

### 6. Logging, Feedback, and Evaluation

- `analysis-logger.js` stores each analysis as JSONL with OCR confidence, rule counts, and final outcome.
- `feedback-store.js` captures "Was this correct?" feedback and optional corrections for later review and model refinement.
- The architecture is designed to support offline evaluation pipelines that compare user corrections with extracted rules.

### 7. Scalability Path

For large-scale urban deployment, the same module split can scale cleanly:

- Image ingestion can be fronted by a CDN and queue-backed upload service.
- OCR can stay on-device for privacy-sensitive or low-cost flows, while heavier preprocessing can move to distributed workers when needed.
- A rule store can be sharded by city and language, while a retrieval layer augments model outputs with municipal ordinances and official parking datasets.
- Timeline and reasoning logic should stay deterministic so repeated inputs produce repeated decisions.
- Feedback logs can feed a model evaluation pipeline, dataset curation flow, and later fine-tuning or retrieval-ranking improvements.

## Reliability strategy

- Tesseract handles cheap OCR in the browser.
- Groq handles text-only sign normalization and interpretation support.
- Deterministic code handles rule parsing, conflict resolution, time math, and recommendation consistency.
- Low-confidence outputs are flagged instead of overstated.
- Every response includes a disclaimer to avoid presenting model output as legal advice.

## Vercel deployment

1. Push the repo to GitHub.
2. Import the project into Vercel.
3. Add `GROQ_API_KEY` and optional `GROQ_MODEL` in Vercel project environment variables.
4. Deploy. Vercel will serve the static `public` assets and run `api/analyze.js`, `api/feedback.js`, and `api/health.js` as serverless functions.

## Tests

Run `npm test` to execute parser and reasoning tests, including:

- Multiple-rule conflict handling
- Permit logic
- Day and time extraction
