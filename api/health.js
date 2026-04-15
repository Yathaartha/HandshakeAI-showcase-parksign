import { healthHandler } from "../src/api/health-handler.js";

export default function handler(req, res) {
  return healthHandler(req, res);
}
