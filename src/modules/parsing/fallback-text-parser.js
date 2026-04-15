export function parseFallbackTextToSigns(manualSignText = "") {
  if (!manualSignText.trim()) {
    return [];
  }

  const chunks = manualSignText
    .split(/\n{2,}|(?=no parking|street cleaning|permit|meter|tow)/i)
    .map((value) => value.trim())
    .filter(Boolean);

  return chunks.map((rawText, index) => ({
    signId: `fallback-${index + 1}`,
    rawText,
    confidence: 0.65,
    arrows: [detectArrow(rawText)],
    icons: detectIcons(rawText),
    notes: "Generated from manual text entry."
  }));
}

function detectArrow(text) {
  if (/\bleft\b|←/.test(text.toLowerCase())) {
    return "left";
  }

  if (/\bright\b|→/.test(text.toLowerCase())) {
    return "right";
  }

  if (/↔|both/.test(text.toLowerCase())) {
    return "both";
  }

  return "none";
}

function detectIcons(text) {
  const icons = [];
  const normalized = text.toLowerCase();

  if (normalized.includes("tow")) {
    icons.push("tow-truck");
  }

  if (normalized.includes("permit")) {
    icons.push("permit");
  }

  if (normalized.includes("wheelchair") || normalized.includes("disabled")) {
    icons.push("accessible");
  }

  if (normalized.includes("meter")) {
    icons.push("meter");
  }

  return icons;
}
