import { analyzeHandler } from "../src/api/analyze-handler.js";

export default async function handler(req, res) {
  return analyzeHandler(req, res);
}
