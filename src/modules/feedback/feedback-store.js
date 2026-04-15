import crypto from "node:crypto";
import { appendJsonLine } from "../../utils/runtime-storage.js";

export async function logFeedback(input) {
  if (!input.analysisId) {
    throw new Error("Feedback must include an analysisId.");
  }

  const payload = {
    id: crypto.randomUUID(),
    analysisId: input.analysisId,
    helpful: Boolean(input.helpful),
    correction: typeof input.correction === "string" ? input.correction.trim() : "",
    createdAt: new Date().toISOString()
  };

  await appendJsonLine("feedback.jsonl", payload);
  return payload;
}
