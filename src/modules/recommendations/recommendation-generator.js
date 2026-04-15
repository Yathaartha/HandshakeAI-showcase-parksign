export function generateRecommendations({ reasoning, context, rules }) {
  const items = [];

  if (!reasoning.parkingAllowed && reasoning.nextLegalTime) {
    items.push(`Next likely legal parking time: ${capitalize(reasoning.nextLegalTime.day)} at ${reasoning.nextLegalTime.time}.`);
  }

  const meteredRule = rules.find((rule) => rule.type === "metered");
  if (meteredRule) {
    items.push("Meter rules may still apply even during otherwise legal windows, so confirm payment duration before leaving the vehicle.");
  }

  const timeLimitRule = rules.find((rule) => rule.type === "time_limited_parking" && rule.durationLimitMinutes);
  if (timeLimitRule) {
    items.push(`Parking appears time-limited during the posted window: maximum stay is about ${Math.round(timeLimitRule.durationLimitMinutes / 60)} hour${timeLimitRule.durationLimitMinutes === 60 ? "" : "s"}.`);
  }

  const towRule = rules.find((rule) => rule.type === "tow_zone");
  if (towRule) {
    items.push("Tow risk appears elevated here. If the sign is unclear, use a different block instead of relying on this interpretation.");
  }

  if (context.permits.length === 0 && rules.some((rule) => rule.type === "permit_only")) {
    items.push("A permit seems to be required. If you do not hold the matching permit, look for a posted paid-parking or unrestricted block nearby.");
  }

  if (!items.length) {
    items.push("No active restriction was detected for the supplied context, but verify curb paint, meters, and nearby signs before parking.");
  }

  return {
    safeParkingWindow: reasoning.parkingAllowed ? "Potentially legal now, subject to meters, curb markings, and municipal rules." : null,
    suggestions: items,
    disclaimer: "This interpretation is based on detected sign content and user-provided context. It is not legal advice or an official municipal determination."
  };
}

function capitalize(value) {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}
