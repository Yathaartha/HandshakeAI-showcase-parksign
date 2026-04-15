# Production-Level Parking Sign Interpretation System

## Overview

This project implements a modular, multi-step digital parking assistant suitable for smart-city platforms, navigation products, and parking compliance tools. The design deliberately separates model-driven perception from deterministic policy logic so the system remains explainable, testable, and safe.

## End-to-end data flow

1. The UI collects an image and optional context such as city, time, vehicle type, permits, and parking duration.
2. The intake layer validates the request, normalizes context, and flags missing or low-quality inputs.
3. Tesseract.js runs OCR in the browser and extracts text, line-level confidence, and lightweight text structure before the request reaches the backend.
4. The Groq reasoning layer converts OCR text into structured sign entities with sign IDs, directional metadata, icon hints, and uncertainty notes.
5. The parsing engine converts those normalized sign texts into rule objects covering:
   - no parking intervals
   - permit requirements
   - meter restrictions
   - street cleaning windows
   - tow-away zones
   - loading restrictions
6. The rule reasoning module evaluates those rules against user context to determine whether parking is likely legal at the requested time and why.
7. The recommendation generator produces user-facing guidance, including the next likely legal time and cautionary alternatives.
8. The logging and feedback layer stores confidence, reasoning outcomes, and user corrections for evaluation and continuous improvement.

## Module responsibilities

### Image Intake Module

- Accepts image upload and manual fallback text.
- Runs lightweight client-side preprocessing before OCR.
- Handles poor-image warnings.
- In a production deployment, this module would also run image preprocessing such as crop suggestion, denoising, perspective correction, and glare reduction.

### Sign Detection Module

- Detects whether a single photo contains stacked or adjacent signs.
- Preserves sign order.
- Captures arrows and symbols so restrictions can be associated with the correct curb direction.

### Parsing Engine

- Converts raw text into typed rules.
- Normalizes time windows into machine-readable intervals.
- Maps day ranges into explicit day sets.
- Produces severity so restrictive rules take precedence.

### Rule Reasoning Module

- Applies time and day logic deterministically.
- Resolves overlapping signs.
- Prefers stricter restrictions when conflict exists.
- Computes next legal parking time.
- Produces the explanation the user sees.

### Recommendation Generator

- Turns reasoning into practical action.
- Warns about tow-risk zones and permit mismatches.
- Suggests safer interpretation behavior when confidence is low.

### UI Layer

- Shows a status card, explanation, parsed rules, sign extraction, confidence warnings, and a timeline view.
- Captures user feedback for correctness and correction.

### Logging and Evaluation

- Stores OCR confidence, parse decisions, and outcome.
- Supports offline audits, regression tests, and model-quality dashboards.

## GPT integration strategy

Groq models should be used where they add value and bounded where deterministic logic is safer.

### Tesseract.js is responsible for

- extracting text from parking sign images in the browser
- producing word and line confidence data
- reducing token cost by avoiding image-to-LLM uploads

### Groq is responsible for

- splitting messy OCR into separate sign candidates
- inferring likely arrows and icons from OCR text
- structuring noisy sign text into predictable JSON

### Deterministic code is responsible for

- day and time normalization
- rule object construction
- overlap handling
- conflict resolution
- permit checks
- timeline generation
- next legal time computation

This hybrid pattern improves reliability because OCR stays cheap and local, the model only handles textual ambiguity, and code handles policy logic consistently.

## Reliability and safety approach

The system is designed to avoid overconfident answers.

- OCR confidence is surfaced directly to the user.
- Low-confidence or blurry inputs produce warnings.
- The assistant avoids legal guarantees and repeats that official local rules may supersede the interpretation.
- Deterministic logic ensures the same parsed rules and same context produce the same decision.
- Feedback creates a recovery loop for incorrect or incomplete interpretations.

## Testing approach

The included automated tests cover:

- blurry or incomplete parsing fallback
- multiple-rule conflict resolution
- permit handling
- deterministic consistency for repeated inputs

A production rollout should add:

- image fixture tests for common city sign layouts
- city-specific regression suites
- multilingual sign fixtures
- canary evaluations for new model versions

## Scalability for millions of users

To scale this for large urban deployment:

- Route uploads through region-aware API gateways.
- Keep OCR on-device for default flows, and move only premium or difficult cases to asynchronous extraction pipelines.
- Cache sign templates and rule interpretations by neighborhood or sign hash.
- Maintain city-specific rule retrieval layers backed by municipal datasets and ordinance APIs.
- Use edge inference or lightweight preprocessing on mobile devices to reduce bandwidth and latency.
- Partition analytics, feedback, and evaluation pipelines by city and language.

## Multi-country and multilingual support

A global version should support:

- multilingual OCR prompts and localized post-processing
- country-specific rule parsers
- unit and terminology normalization
- locale-aware date and time handling
- jurisdiction-specific disclaimers and legal wording

Rather than one universal rule parser, production systems should use a shared core plus regional plugins that adapt to local parking law patterns.

## Optional advanced capabilities

This architecture can be extended with:

- real-time legality checks using GPS context
- AR overlays showing which curb direction each sign applies to
- permit database lookups
- parking meter integrations
- nearby legal parking suggestions
- smart-city dashboards for recurring sign-confusion hotspots
