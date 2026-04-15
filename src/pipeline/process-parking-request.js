import crypto from "node:crypto";
import { validateIntake } from "../modules/intake/validate-intake.js";
import { extractSignData } from "../modules/vision/extract-sign-data.js";
import { detectSignLayout } from "../modules/detection/sign-detection.js";
import { parseSignsToRules } from "../modules/parsing/rule-parser.js";
import { reasonAboutParking } from "../modules/reasoning/rule-reasoner.js";
import { generateRecommendations } from "../modules/recommendations/recommendation-generator.js";
import { logAnalysis } from "../modules/logging/analysis-logger.js";

export async function processParkingRequest(input) {
  const { context, warnings } = validateIntake(input);
  const extraction = await extractSignData({
    ocrText: context.ocrText,
    manualSignText: context.manualSignText,
    ocrLines: context.ocrLines,
    ocrConfidence: context.ocrConfidence,
    context
  });
  const detection = detectSignLayout(extraction);
  const rules = parseSignsToRules(detection);
  const reasoning = reasonAboutParking({
    rules,
    context,
    extractionWarnings: [...warnings, ...(extraction.lowConfidenceReasons || [])]
  });
  const recommendations = generateRecommendations({ reasoning, context, rules });
  const analysisId = crypto.randomUUID();

  const output = {
    ok: true,
    analysisId,
    intake: {
      city: context.city,
      state: context.state,
      country: context.country,
      vehicleType: context.vehicleType,
      dayOfWeek: context.dayOfWeek,
      plannedDurationMinutes: context.plannedDurationMinutes,
      permits: context.permits
    },
    extraction,
    detection,
    rules,
    reasoning,
    recommendations,
    reliability: {
      ocrConfidence: context.ocrConfidence || extraction.overallConfidence,
      lowConfidence: extraction.overallConfidence < 0.6,
      disclaimers: [
        "Browser OCR may miss faded text, arrows, curb paint, or temporary notices.",
        "Municipal rules, curb paint, meters, and temporary notices can override sign-only interpretation.",
        "This system should support, not replace, official parking verification."
      ]
    },
    systemLog: {
      stages: [
        "Structured intake validated",
        "Browser OCR and sign detection completed",
        "Rules parsed into normalized objects",
        "Reasoning engine evaluated active restrictions",
        "Recommendations generated"
      ]
    }
  };

  await logAnalysis({
    analysisId,
    createdAt: new Date().toISOString(),
    intake: output.intake,
    ocrConfidence: extraction.overallConfidence,
    rulesCount: rules.length,
    parkingAllowed: reasoning.parkingAllowed,
    confidence: reasoning.confidence.score
  });

  return output;
}
