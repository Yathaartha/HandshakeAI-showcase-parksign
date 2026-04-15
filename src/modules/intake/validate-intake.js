import { dayNameFromDate, normalizeDayName, parseTimeToMinutes } from "../../utils/time.js";

export function validateIntake(input) {
  const warnings = [];
  const context = {
    manualSignText: typeof input.manualSignText === "string" ? input.manualSignText.trim() : "",
    ocrText: typeof input.ocrText === "string" ? input.ocrText.trim() : "",
    ocrConfidence: Number(input.ocrConfidence || 0),
    ocrLines: Array.isArray(input.ocrLines) ? input.ocrLines : [],
    city: typeof input.city === "string" ? input.city.trim() : "",
    state: typeof input.state === "string" ? input.state.trim() : "",
    country: typeof input.country === "string" ? input.country.trim() : "",
    vehicleType: typeof input.vehicleType === "string" ? input.vehicleType.trim().toLowerCase() : "car",
    plannedDurationMinutes: Number(input.plannedDurationMinutes || 0),
    permits: Array.isArray(input.permits) ? input.permits.filter(Boolean) : [],
    parkingDateTime: typeof input.parkingDateTime === "string" ? input.parkingDateTime : "",
    explicitDayOfWeek: normalizeDayName(input.dayOfWeek),
    explicitTime: parseTimeToMinutes(input.timeOfParking),
    imageQuality: typeof input.imageQuality === "string" ? input.imageQuality : ""
  };

  if (!context.ocrText && !context.manualSignText) {
    throw new Error("Upload a parking sign image and wait for OCR, or provide manual sign text.");
  }

  if (!context.parkingDateTime && context.explicitTime == null) {
    warnings.push("No parking attempt time provided. Results use the current local time.");
  }

  if (context.imageQuality === "blurry") {
    warnings.push("The uploaded photo was marked blurry. OCR confidence may be reduced.");
  }

  if (context.ocrConfidence > 0 && context.ocrConfidence < 0.6) {
    warnings.push("OCR confidence is low. Double-check the extracted text before relying on the interpretation.");
  }

  const now = context.parkingDateTime ? new Date(context.parkingDateTime) : new Date();
  const dayOfWeek = context.explicitDayOfWeek || dayNameFromDate(now.toISOString());
  const minutesOfDay = context.explicitTime ?? ((now.getHours() * 60) + now.getMinutes());

  return {
    context: {
      ...context,
      dayOfWeek,
      minutesOfDay
    },
    warnings
  };
}
