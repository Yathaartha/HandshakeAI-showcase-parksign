import { feedbackHandler } from "../src/api/feedback-handler.js";

export default async function handler(req, res) {
  return feedbackHandler(req, res);
}
