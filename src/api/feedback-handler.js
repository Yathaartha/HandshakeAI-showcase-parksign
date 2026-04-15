import { logFeedback } from "../modules/feedback/feedback-store.js";

export async function feedbackHandler(req, res) {
  try {
    const payload = await logFeedback(req.body ?? {});
    res.status(200).json({ ok: true, payload });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(400).json({ ok: false, error: message });
  }
}
