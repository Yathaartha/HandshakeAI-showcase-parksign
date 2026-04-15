import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./src/config.js";
import { processParkingRequest } from "./src/pipeline/process-parking-request.js";
import { logFeedback } from "./src/modules/feedback/feedback-store.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.json({ limit: "15mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    modelConfigured: Boolean(config.groqApiKey),
    model: config.groqModel
  });
});

app.post("/api/analyze", async (req, res) => {
  try {
    const result = await processParkingRequest(req.body ?? {});
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    res.status(400).json({
      ok: false,
      error: message
    });
  }
});

app.post("/api/feedback", async (req, res) => {
  try {
    const payload = await logFeedback(req.body ?? {});
    res.json({ ok: true, payload });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    res.status(400).json({
      ok: false,
      error: message
    });
  }
});

app.listen(config.port, () => {
  console.log(`Parking assistant listening on http://localhost:${config.port}`);
});
