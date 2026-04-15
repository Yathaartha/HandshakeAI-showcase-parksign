export function detectSignLayout(extraction) {
  const signs = (extraction.signs || []).map((sign, index) => ({
    ...sign,
    signId: sign.signId || `sign-${index + 1}`,
    primaryArrow: Array.isArray(sign.arrows) && sign.arrows.length ? sign.arrows[0] : "none",
    iconSummary: Array.isArray(sign.icons) ? sign.icons : []
  }));

  return {
    detectedCount: signs.length,
    multipleSignsDetected: signs.length > 1,
    signs
  };
}
