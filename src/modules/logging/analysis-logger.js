import { appendJsonLine } from "../../utils/runtime-storage.js";

export async function logAnalysis(entry) {
  await appendJsonLine("analysis-log.jsonl", entry);
}
