import { expandDayRange, normalizeDays, parseTimeToMinutes } from "../../utils/time.js";

const RULE_TYPES = [
  { pattern: /no stopping/i, type: "no_stopping", severity: 120 },
  { pattern: /no parking/i, type: "no_parking", severity: 100 },
  { pattern: /street cleaning/i, type: "street_cleaning", severity: 95 },
  { pattern: /tow[-\s]?away|tow zone/i, type: "tow_zone", severity: 110 },
  { pattern: /permit/i, type: "permit_only", severity: 90 },
  { pattern: /\b\d+\s*hour parking\b/i, type: "time_limited_parking", severity: 55 },
  { pattern: /meter/i, type: "metered", severity: 60 },
  { pattern: /loading/i, type: "loading_only", severity: 70 },
  { pattern: /parking allowed/i, type: "parking_allowed", severity: 20 }
];

const DAY_RANGE_REGEX = /\b(mon|monday|tue|tues|tuesday|wed|wednesday|thu|thur|thurs|thursday|fri|friday|sat|saturday|sun|sunday)\s*(?:-|to)\s*(mon|monday|tue|tues|tuesday|wed|wednesday|thu|thur|thurs|thursday|fri|friday|sat|saturday|sun|sunday)\b/i;
const SINGLE_DAY_REGEX = /\b(mon|monday|tue|tues|tuesday|wed|wednesday|thu|thur|thurs|thursday|fri|friday|sat|saturday|sun|sunday)\b/gi;
const EXCEPT_DAY_REGEX = /\bexcept\s+(mon|monday|tue|tues|tuesday|wed|wednesday|thu|thur|thurs|thursday|fri|friday|sat|saturday|sun|sunday)\b/i;
const TIME_RANGE_REGEX = /(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)\s*(?:-|to)\s*(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)/ig;
const DURATION_LIMIT_REGEX = /\b(\d+)\s*hour parking\b/i;

const ALL_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

function detectRuleType(rawText) {
  for (const entry of RULE_TYPES) {
    if (entry.pattern.test(rawText)) {
      return entry;
    }
  }

  return { type: "general_notice", severity: 10 };
}

function extractDays(rawText) {
  const exceptMatch = rawText.match(EXCEPT_DAY_REGEX);
  if (exceptMatch) {
    const excluded = normalizeDays([exceptMatch[1]]);
    return ALL_DAYS.filter((day) => !excluded.includes(day));
  }

  const rangeMatch = rawText.match(DAY_RANGE_REGEX);

  if (rangeMatch) {
    return expandDayRange(rangeMatch[1], rangeMatch[2]);
  }

  const matches = [...rawText.matchAll(SINGLE_DAY_REGEX)].map((match) => match[1]);
  return normalizeDays(matches);
}

function extractTimeWindows(rawText) {
  const windows = [];
  const normalizedText = rawText.toLowerCase().replaceAll(".", "");

  for (const match of normalizedText.matchAll(TIME_RANGE_REGEX)) {
    let startText = match[1].trim();
    let endText = match[2].trim();
    const endMeridiem = endText.match(/\b(am|pm)\b/)?.[1];

    if (endMeridiem && !/\b(am|pm)\b/.test(startText)) {
      startText = `${startText} ${endMeridiem}`;
    }

    if (!endMeridiem) {
      const startMeridiem = startText.match(/\b(am|pm)\b/)?.[1];
      if (startMeridiem) {
        endText = `${endText} ${startMeridiem}`;
      }
    }

    const start = parseTimeToMinutes(startText);
    const end = parseTimeToMinutes(endText);

    if (start != null && end != null) {
      windows.push({ start, end });
    }
  }

  return windows;
}

function extractPermits(rawText) {
  const normalized = rawText.toLowerCase();
  const permits = [];

  if (normalized.includes("residential")) {
    permits.push("residential");
  }

  if (normalized.includes("handicap") || normalized.includes("disabled")) {
    permits.push("accessible");
  }

  if (normalized.includes("commercial")) {
    permits.push("commercial");
  }

  return permits;
}

function extractDurationLimitMinutes(rawText) {
  const match = rawText.match(DURATION_LIMIT_REGEX);
  if (!match) {
    return null;
  }

  return Number(match[1]) * 60;
}

export function parseSignsToRules(detectedLayout) {
  const rules = [];

  for (const sign of detectedLayout.signs) {
    const definition = detectRuleType(sign.rawText);

    rules.push({
      id: `${sign.signId}-${definition.type}`,
      type: definition.type,
      severity: definition.severity,
      direction: sign.primaryArrow,
      rawText: sign.rawText,
      sourceSignId: sign.signId,
      days: extractDays(sign.rawText),
      timeWindows: extractTimeWindows(sign.rawText),
      durationLimitMinutes: extractDurationLimitMinutes(sign.rawText),
      permits: extractPermits(sign.rawText),
      icons: sign.iconSummary,
      confidence: sign.confidence
    });
  }

  rules.sort((left, right) => right.severity - left.severity);

  return rules;
}
