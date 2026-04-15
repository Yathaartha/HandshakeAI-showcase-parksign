import { config } from "../../config.js";
import { createGroqResponse } from "../llm/groq-client.js";
import { parseFallbackTextToSigns } from "../parsing/fallback-text-parser.js";

const EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    overallConfidence: { type: "number" },
    lowConfidenceReasons: {
      type: "array",
      items: { type: "string" }
    },
    signs: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          signId: { type: "string" },
          rawText: { type: "string" },
          confidence: { type: "number" },
          arrows: {
            type: "array",
            items: {
              type: "string",
              enum: ["left", "right", "both", "none"]
            }
          },
          icons: {
            type: "array",
            items: { type: "string" }
          },
          notes: { type: "string" }
        },
        required: ["signId", "rawText", "confidence", "arrows", "icons", "notes"]
      }
    }
  },
  required: ["overallConfidence", "lowConfidenceReasons", "signs"]
};

const SIGN_KEYWORD_REGEX = /\b(no parking|parking|street cleaning|tow|permit|meter|loading|standing|stopping|commercial|courier|passenger|except|hour|min|am|pm|mon|tue|wed|thu|fri|sat|sun)\b/i;
const TIME_REGEX = /\b\d{1,2}(?::\d{2})?\s*(am|pm)\b/i;

function normalizeComparableText(value = "") {
  return value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, " ")
    .trim();
}

function dedupeRawText(ocrText, manualSignText) {
  const normalizedOcr = normalizeComparableText(ocrText);
  const normalizedManual = normalizeComparableText(manualSignText);

  if (!manualSignText) {
    return ocrText.trim();
  }

  if (!ocrText) {
    return manualSignText.trim();
  }

  if (normalizedOcr && normalizedOcr === normalizedManual) {
    return ocrText.trim();
  }

  return [ocrText, manualSignText].filter(Boolean).join("\n").trim();
}

function selectHelpfulOcrLines(ocrLines = []) {
  return ocrLines
    .map((line) => ({
      text: String(line.text || "").trim(),
      confidence: Number(line.confidence || 0)
    }))
    .filter((line) => line.text)
    .filter((line) => line.confidence >= 35 || SIGN_KEYWORD_REGEX.test(line.text) || TIME_REGEX.test(line.text))
    .filter((line) => /[a-z0-9]/i.test(line.text))
    .slice(0, 24);
}

function assessOcrQuality(rawText, ocrLines = [], ocrConfidence = 0) {
  const helpfulLines = selectHelpfulOcrLines(ocrLines);
  const keywordHits = helpfulLines.filter((line) => SIGN_KEYWORD_REGEX.test(line.text)).length;
  const timeHits = helpfulLines.filter((line) => TIME_REGEX.test(line.text)).length;
  const alphaNumChars = (rawText.match(/[a-z0-9]/gi) || []).length;
  const punctuationChars = (rawText.match(/[^a-z0-9\s]/gi) || []).length;
  const garbageRatio = alphaNumChars === 0 ? 1 : punctuationChars / alphaNumChars;
  const isLikelyUnreadable = (
    (ocrConfidence > 0 && ocrConfidence < 0.55 && keywordHits === 0) ||
    (helpfulLines.length === 0 && rawText.length > 40) ||
    (garbageRatio > 0.35 && keywordHits < 2 && timeHits < 1)
  );

  return {
    helpfulLines,
    keywordHits,
    timeHits,
    isLikelyUnreadable
  };
}

function buildFallbackExtraction(rawText, ocrConfidence = 0, quality = null) {
  if (quality?.isLikelyUnreadable) {
    return {
      overallConfidence: Math.max(0.12, Math.min(0.45, ocrConfidence || 0.2)),
      lowConfidenceReasons: [
        "OCR appears too noisy or incomplete to safely interpret this sign.",
        "Try a closer, straighter photo or correct the OCR text manually before analyzing."
      ],
      signs: []
    };
  }

  const signs = parseFallbackTextToSigns(rawText);
  return {
    overallConfidence: rawText ? Math.max(0.2, ocrConfidence || 0.62) : 0.2,
    lowConfidenceReasons: rawText ? ["Using deterministic OCR-text fallback extraction."] : ["No OCR text was provided."],
    signs
  };
}

function buildGroqInput({ rawText, context, ocrLines = [] }) {
  const lines = ocrLines.slice(0, 20).map((line, index) => {
    const confidence = line.confidence == null ? "unknown" : `${Math.round(line.confidence)}%`;
    return `${index + 1}. ${line.text} [${confidence}]`;
  }).join("\n");

  return [
    `OCR text:\n${rawText}`,
    lines ? `OCR lines:\n${lines}` : "OCR lines: none",
    `Context: city=${context.city || "unknown"}, state=${context.state || "unknown"}, country=${context.country || "unknown"}, vehicle=${context.vehicleType}.`,
    "Remove obvious OCR garbage, duplicated fragments, random symbols, and non-parking words before structuring the signs.",
    "Prefer short cleaned sign text that keeps only meaningful parking restrictions, days, times, arrows, permit terms, and duration limits.",
    "Split stacked signs when possible. Preserve arrow direction if visible in OCR text such as left, right, ←, →, or both.",
    "Only structure what the OCR text supports. If uncertain, lower confidence and explain uncertainty in notes."
  ].join("\n\n");
}

export async function extractSignData({ ocrText, manualSignText, ocrLines, ocrConfidence, context }) {
  const rawText = dedupeRawText(ocrText, manualSignText);
  const quality = assessOcrQuality(rawText, ocrLines, ocrConfidence);

  if (!config.groqApiKey || !rawText) {
    return buildFallbackExtraction(rawText, ocrConfidence, quality);
  }

  if (quality.isLikelyUnreadable) {
    return buildFallbackExtraction(rawText, ocrConfidence, quality);
  }

  const response = await createGroqResponse({
    model: config.groqModel,
    instructions: [
      "You convert OCR text from parking signs into structured sign objects.",
      "Denoise the OCR first by removing obvious gibberish and random words that are not part of the sign.",
      "Do not decide legality. Only structure sign text, arrows, icons, and uncertainty.",
      "Return strict JSON only."
    ].join(" "),
    input: buildGroqInput({ rawText, context, ocrLines: quality.helpfulLines }),
    reasoning: { effort: "low" },
    text: {
      format: {
        type: "json_schema",
        name: "parking_sign_extraction",
        schema: EXTRACTION_SCHEMA
      }
    }
  });

  if (!response?.output_text) {
    return buildFallbackExtraction(rawText, ocrConfidence, quality);
  }

  const parsed = JSON.parse(response.output_text);
  if (ocrConfidence && parsed.overallConfidence < ocrConfidence) {
    parsed.overallConfidence = Number(ocrConfidence.toFixed(2));
  }
  if (quality.keywordHits === 0 && quality.timeHits === 0) {
    parsed.lowConfidenceReasons = [
      ...(parsed.lowConfidenceReasons || []),
      "OCR text did not contain enough recognizable parking-language patterns to fully trust the interpretation."
    ];
  }

  return parsed;
}
