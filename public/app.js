const imageInput = document.querySelector("#imageInput");
const previewImage = document.querySelector("#previewImage");
const analyzeButton = document.querySelector("#analyzeButton");
const emptyState = document.querySelector("#emptyState");
const results = document.querySelector("#results");
const statusCard = document.querySelector("#statusCard");
const explanationText = document.querySelector("#explanationText");
const recommendationList = document.querySelector("#recommendationList");
const detectedSigns = document.querySelector("#detectedSigns");
const ruleList = document.querySelector("#ruleList");
const timeline = document.querySelector("#timeline");
const reliabilityBox = document.querySelector("#reliabilityBox");
const feedbackStatus = document.querySelector("#feedbackStatus");
const feedbackCorrection = document.querySelector("#feedbackCorrection");
const ocrStatus = document.querySelector("#ocrStatus");
const ocrConfidenceLabel = document.querySelector("#ocrConfidenceLabel");
const imageSizeLabel = document.querySelector("#imageSizeLabel");

const MAX_UPLOAD_BYTES = Math.round(4.5 * 1024 * 1024);
const OCR_MAX_DIMENSION = 1600;

let uploadedImageDataUrl = "";
let currentAnalysisId = "";
let currentOcr = {
  text: "",
  confidence: 0,
  lines: [],
  userEdited: false
};
let tesseractWorkerPromise = null;

document.querySelector("#manualSignText").addEventListener("input", () => {
  currentOcr.userEdited = true;
});

imageInput.addEventListener("change", async (event) => {
  const [file] = event.target.files || [];

  if (!file) {
    return;
  }

  ocrStatus.textContent = "Preparing image...";
  imageSizeLabel.textContent = formatBytes(file.size);

  const preparedImage = await prepareImageForUpload(file);
  uploadedImageDataUrl = preparedImage.dataUrl;
  previewImage.src = uploadedImageDataUrl;
  previewImage.hidden = false;
  imageSizeLabel.textContent = `${formatBytes(preparedImage.bytes)}${preparedImage.compressed ? ` (compressed from ${formatBytes(file.size)})` : ""}`;
  await runBrowserOcr(uploadedImageDataUrl);
});

analyzeButton.addEventListener("click", async () => {
  analyzeButton.disabled = true;
  analyzeButton.textContent = "Interpreting...";

  try {
    const payload = {
      manualSignText: valueOf("#manualSignText"),
      ocrText: currentOcr.text,
      ocrConfidence: currentOcr.confidence,
      ocrLines: currentOcr.lines,
      parkingDateTime: valueOf("#parkingDateTime"),
      city: valueOf("#city"),
      state: valueOf("#state"),
      country: valueOf("#country"),
      vehicleType: valueOf("#vehicleType"),
      plannedDurationMinutes: Number(valueOf("#plannedDurationMinutes") || 0),
      permits: valueOf("#permits") ? [valueOf("#permits")] : [],
      imageQuality: valueOf("#imageQuality")
    };

    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Unable to analyze sign.");
    }

    currentAnalysisId = result.analysisId;
    renderResult(result);
  } catch (error) {
    window.alert(error.message);
  } finally {
    analyzeButton.disabled = false;
    analyzeButton.textContent = "Interpret Sign";
  }
});

document.querySelectorAll("[data-feedback]").forEach((button) => {
  button.addEventListener("click", async () => {
    if (!currentAnalysisId) {
      feedbackStatus.textContent = "Run an interpretation first so feedback can be attached to it.";
      return;
    }

    const helpful = button.dataset.feedback === "yes";

    const response = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        analysisId: currentAnalysisId,
        helpful,
        correction: feedbackCorrection.value
      })
    });

    const result = await response.json();
    feedbackStatus.textContent = response.ok
      ? "Feedback saved for evaluation and model improvement."
      : (result.error || "Unable to save feedback.");
  });
});

async function runBrowserOcr(imageDataUrl) {
  ocrStatus.textContent = "Running in-browser OCR...";
  ocrConfidenceLabel.textContent = "Working...";

  try {
    const worker = await getTesseractWorker();
    const processedImage = await preprocessImage(imageDataUrl);
    const result = await worker.recognize(processedImage);
    const lines = (result.data.lines || [])
      .map((line) => ({
        text: line.text.trim(),
        confidence: line.confidence
      }))
      .filter((line) => line.text);
    const joinedText = lines.map((line) => line.text).join("\n").trim() || result.data.text.trim();
    const normalizedConfidence = Number(((result.data.confidence || 0) / 100).toFixed(2));

    currentOcr = {
      text: joinedText,
      confidence: normalizedConfidence,
      lines,
      userEdited: currentOcr.userEdited
    };

    const manualField = document.querySelector("#manualSignText");
    if (!currentOcr.userEdited || !manualField.value.trim()) {
      manualField.value = joinedText;
      currentOcr.userEdited = false;
    }

    ocrStatus.textContent = joinedText ? "OCR complete" : "OCR finished, but little text was detected";
    ocrConfidenceLabel.textContent = `${Math.round(normalizedConfidence * 100)}%`;
  } catch (error) {
    currentOcr = { text: "", confidence: 0, lines: [], userEdited: currentOcr.userEdited };
    ocrStatus.textContent = "OCR failed";
    ocrConfidenceLabel.textContent = "N/A";
    window.alert(error.message || "Failed to run OCR in the browser.");
  }
}

async function getTesseractWorker() {
  if (!tesseractWorkerPromise) {
    const tesseract = globalThis.Tesseract;

    if (!tesseract?.createWorker) {
      throw new Error("Tesseract OCR failed to load in the browser.");
    }

    tesseractWorkerPromise = Promise.resolve(tesseract.createWorker("eng"));
  }

  return tesseractWorkerPromise;
}

async function preprocessImage(dataUrl) {
  const image = new Image();
  image.src = dataUrl;
  await image.decode();

  const scale = Math.min(1, OCR_MAX_DIMENSION / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);

  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;

  for (let index = 0; index < data.length; index += 4) {
    const gray = Math.round((data[index] * 0.299) + (data[index + 1] * 0.587) + (data[index + 2] * 0.114));
    const boosted = gray > 160 ? 255 : Math.max(0, gray - 20);
    data[index] = boosted;
    data[index + 1] = boosted;
    data[index + 2] = boosted;
  }

  context.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

async function prepareImageForUpload(file) {
  if (file.size <= MAX_UPLOAD_BYTES) {
    return {
      dataUrl: await fileToDataUrl(file),
      bytes: file.size,
      compressed: false
    };
  }

  const image = new Image();
  image.src = await fileToDataUrl(file);
  await image.decode();

  let scale = Math.min(1, OCR_MAX_DIMENSION / Math.max(image.width, image.height));
  let quality = 0.9;
  let bestBlob = null;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await canvasToBlob(canvas, "image/jpeg", quality);
    bestBlob = blob;

    if (blob.size <= MAX_UPLOAD_BYTES) {
      return {
        dataUrl: await blobToDataUrl(blob),
        bytes: blob.size,
        compressed: true
      };
    }

    scale *= 0.85;
    quality = Math.max(0.55, quality - 0.08);
  }

  return {
    dataUrl: await blobToDataUrl(bestBlob),
    bytes: bestBlob.size,
    compressed: true
  };
}

function renderResult(result) {
  emptyState.hidden = true;
  results.hidden = false;

  const blocked = !result.reasoning.parkingAllowed;
  statusCard.className = `status-card ${result.reasoning.status === "Unclear" ? "" : blocked ? "danger" : "success"}`;
  statusCard.innerHTML = `
    <p class="step-tag">Parking Status</p>
    <h3>Parking Allowed: ${result.reasoning.status}</h3>
    <p>${result.reasoning.reason}</p>
    <p><strong>Active restriction:</strong> ${escapeHtml(result.reasoning.activeRestriction)}</p>
    <p><strong>Next legal time:</strong> ${result.reasoning.nextLegalTime ? `${capitalize(result.reasoning.nextLegalTime.day)} ${result.reasoning.nextLegalTime.time}` : "Now, based on current sign interpretation."}</p>
  `;

  explanationText.textContent = result.reasoning.plainLanguageExplanation;
  recommendationList.innerHTML = result.recommendations.suggestions
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");

  detectedSigns.innerHTML = result.detection.signs.map((sign) => `
    <div class="sign-item">
      <strong>${escapeHtml(sign.signId)}</strong>
      <div>${escapeHtml(sign.rawText)}</div>
      <div>Confidence: ${Math.round(sign.confidence * 100)}% | Arrow: ${escapeHtml(sign.primaryArrow)}</div>
    </div>
  `).join("");

  ruleList.innerHTML = result.rules.map((rule) => `
    <div class="rule-item">
      <strong>${escapeHtml(rule.type)}</strong>
      <div>${escapeHtml(rule.rawText)}</div>
      <div>Direction: ${escapeHtml(rule.direction)} | Severity: ${rule.severity}</div>
    </div>
  `).join("");

  timeline.innerHTML = result.reasoning.timeline.map((slot) => `
    <div class="slot ${slot.allowed ? "allowed" : "blocked"}">
      <strong>${slot.label}</strong>
      <div>${slot.allowed ? "Likely allowed" : "Restricted"}</div>
    </div>
  `).join("");

  reliabilityBox.innerHTML = [
    `<div class="reliability-item"><strong>Confidence:</strong> ${result.reasoning.confidence.label} (${Math.round(result.reasoning.confidence.score * 100)}%)</div>`,
    ...result.reasoning.confidence.warnings.map((warning) => `<div class="reliability-item">${escapeHtml(warning)}</div>`),
    ...result.reliability.disclaimers.map((warning) => `<div class="reliability-item">${escapeHtml(warning)}</div>`)
  ].join("");
}

function valueOf(selector) {
  return document.querySelector(selector)?.value?.trim() || "";
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read blob."));
    reader.readAsDataURL(blob);
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to compress image."));
        return;
      }

      resolve(blob);
    }, type, quality);
  });
}

function formatBytes(bytes) {
  if (!bytes) {
    return "0 B";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function capitalize(value) {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
