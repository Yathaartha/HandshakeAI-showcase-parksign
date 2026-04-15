import { config } from "../config.js";

export function healthHandler(_req, res) {
  res.status(200).json({
    ok: true,
    modelConfigured: Boolean(config.groqApiKey),
    model: config.groqModel
  });
}
