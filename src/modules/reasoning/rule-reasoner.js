import {
  addMinutes,
  evaluateRuleActivity,
  getDayOrder,
  minutesToLabel
} from "../../utils/time.js";

const RESTRICTIVE_RULES = new Set([
  "no_stopping",
  "no_parking",
  "street_cleaning",
  "tow_zone",
  "permit_only",
  "loading_only"
]);

function isPermitSatisfied(rule, userPermits) {
  if (rule.type !== "permit_only") {
    return true;
  }

  if (!rule.permits?.length) {
    return false;
  }

  return rule.permits.some((permit) => userPermits.includes(permit));
}

function isRuleBlocking(rule, userPermits) {
  if (!RESTRICTIVE_RULES.has(rule.type)) {
    return false;
  }

  if (rule.type === "permit_only") {
    return !isPermitSatisfied(rule, userPermits);
  }

  return true;
}

function describeRule(rule) {
  const labels = {
    no_stopping: "Stopping is prohibited during the active window.",
    no_parking: "No parking is posted during the active window.",
    street_cleaning: "Street cleaning restrictions are active.",
    tow_zone: "This appears to be a tow-away zone.",
    permit_only: "This area appears to require a permit.",
    time_limited_parking: "Parking may be allowed, but only for the posted time limit during the active window.",
    metered: "Parking may be allowed if meter rules are satisfied.",
    loading_only: "This space is reserved for loading activity."
  };

  return labels[rule.type] || "Parking rules apply here.";
}

function makeTimeline(rules, dayName, permits) {
  const slots = [];

  for (let hour = 0; hour < 24; hour += 1) {
    const start = hour * 60;
    const active = rules.filter((rule) => evaluateRuleActivity(rule, dayName, start));
    const restrictive = active.filter((rule) => isRuleBlocking(rule, permits));

    slots.push({
      start,
      end: start + 60,
      allowed: restrictive.length === 0,
      label: `${minutesToLabel(start)} - ${minutesToLabel((start + 60) % 1440)}`,
      activeRestrictions: restrictive.map((rule) => rule.type)
    });
  }

  return slots;
}

function findNextLegalTime(rules, dayName, minutesOfDay, permits) {
  const days = getDayOrder();
  let currentDayIndex = days.indexOf(dayName);
  let currentMinutes = minutesOfDay;

  for (let step = 0; step < 7 * 48; step += 1) {
    const restrictive = rules.filter((rule) => evaluateRuleActivity(rule, days[currentDayIndex], currentMinutes))
      .filter((rule) => isRuleBlocking(rule, permits));

    if (restrictive.length === 0) {
      return {
        day: days[currentDayIndex],
        time: minutesToLabel(currentMinutes)
      };
    }

    const next = addMinutes(currentDayIndex, currentMinutes, 30);
    currentDayIndex = next.dayIndex;
    currentMinutes = next.minutes;
  }

  return null;
}

export function reasonAboutParking({ rules, context, extractionWarnings = [] }) {
  const unclearInput = extractionWarnings.some((warning) => /too noisy|too incomplete|safely interpret|double-check/i.test(warning));
  const activeRules = rules.filter((rule) => evaluateRuleActivity(rule, context.dayOfWeek, context.minutesOfDay));
  const unmetPermitRules = activeRules.filter((rule) => isRuleBlocking(rule, context.permits));
  const allowed = unclearInput && rules.length === 0 ? null : unmetPermitRules.length === 0;
  const topRule = unmetPermitRules[0] || activeRules[0] || null;
  const confidenceScore = Math.max(0.15, Math.min(0.99, rules.reduce((sum, rule) => sum + (rule.confidence || 0.5), 0) / Math.max(rules.length, 1)));
  const confidenceLabel = confidenceScore > 0.8 ? "High" : confidenceScore > 0.55 ? "Medium" : "Low";
  const nextLegalTime = allowed === false ? findNextLegalTime(rules, context.dayOfWeek, context.minutesOfDay, context.permits) : null;

  return {
    parkingAllowed: allowed,
    status: allowed === null ? "Unclear" : allowed ? "Yes" : "No",
    reason: allowed === null
      ? "The sign text was too unclear to safely determine whether parking is allowed."
      : topRule
      ? (allowed
        ? `Parking appears allowed right now. The strongest active sign context is: ${describeRule(topRule)}`
        : `Parking is not allowed right now. ${describeRule(topRule)}`)
      : "No active restriction was detected from the available sign data.",
    activeRestriction: allowed === null
      ? "Unclear OCR text. Please retake the photo or correct the extracted text."
      : topRule ? topRule.rawText : "No active restriction detected.",
    plainLanguageExplanation: allowed === null
      ? "The OCR output did not produce enough reliable parking-language detail to justify a yes or no answer. A clearer photo or manual text correction is needed."
      : unmetPermitRules.length
      ? unmetPermitRules.map((rule) => rule.rawText).join(" Also, ")
      : "Based on the visible rules and your context, there is no active no-parking restriction at this time.",
    confidence: {
      score: Number(confidenceScore.toFixed(2)),
      label: confidenceLabel,
      warnings: extractionWarnings
    },
    activeRules,
    conflicts: detectConflicts(rules),
    nextLegalTime,
    timeline: allowed === null ? [] : makeTimeline(rules, context.dayOfWeek, context.permits)
  };
}

function detectConflicts(rules) {
  const conflicts = [];
  const restrictive = rules.filter((rule) => RESTRICTIVE_RULES.has(rule.type));
  const permissive = rules.filter((rule) => rule.type === "parking_allowed");

  for (const denyRule of restrictive) {
    for (const allowRule of permissive) {
      conflicts.push({
        restrictiveRule: denyRule.rawText,
        permissiveRule: allowRule.rawText,
        resolution: "Restrictive rule wins during overlapping windows."
      });
    }
  }

  return conflicts;
}
