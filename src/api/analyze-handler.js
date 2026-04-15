import { processParkingRequest } from "../pipeline/process-parking-request.js";

export async function analyzeHandler(req, res) {
  try {
    const result = await processParkingRequest(req.body ?? {});
    res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(400).json({ ok: false, error: message });
  }
}
