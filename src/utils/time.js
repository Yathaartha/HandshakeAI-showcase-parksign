const DAY_ALIASES = {
  mon: "monday",
  monday: "monday",
  tue: "tuesday",
  tues: "tuesday",
  tuesday: "tuesday",
  wed: "wednesday",
  wednesday: "wednesday",
  thu: "thursday",
  thur: "thursday",
  thurs: "thursday",
  thursday: "thursday",
  fri: "friday",
  friday: "friday",
  sat: "saturday",
  saturday: "saturday",
  sun: "sunday",
  sunday: "sunday"
};

const DAY_ORDER = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday"
];

export function normalizeDayName(value) {
  if (!value) {
    return null;
  }

  return DAY_ALIASES[String(value).trim().toLowerCase()] || null;
}

export function dayNameFromDate(input) {
  const date = new Date(input);
  const index = date.getDay();
  return DAY_ORDER[(index + 6) % 7];
}

export function parseTimeToMinutes(value) {
  if (!value) {
    return null;
  }

  const raw = String(value).trim().toLowerCase();
  const match = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);

  if (!match) {
    return null;
  }

  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  const meridiem = match[3];

  if (meridiem === "pm" && hours < 12) {
    hours += 12;
  }

  if (meridiem === "am" && hours === 12) {
    hours = 0;
  }

  if (hours > 23 || minutes > 59) {
    return null;
  }

  return (hours * 60) + minutes;
}

export function minutesToLabel(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  const meridiem = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;

  return `${displayHour}:${String(minutes).padStart(2, "0")} ${meridiem}`;
}

export function expandDayRange(start, end) {
  const startIndex = DAY_ORDER.indexOf(normalizeDayName(start));
  const endIndex = DAY_ORDER.indexOf(normalizeDayName(end));

  if (startIndex === -1 || endIndex === -1) {
    return [];
  }

  if (startIndex <= endIndex) {
    return DAY_ORDER.slice(startIndex, endIndex + 1);
  }

  return [...DAY_ORDER.slice(startIndex), ...DAY_ORDER.slice(0, endIndex + 1)];
}

export function normalizeDays(days = []) {
  if (!Array.isArray(days) || days.length === 0) {
    return [];
  }

  return [...new Set(days.map(normalizeDayName).filter(Boolean))];
}

export function timeWindowContains(window, minutes) {
  if (!window || window.start == null || window.end == null || minutes == null) {
    return false;
  }

  if (window.start <= window.end) {
    return minutes >= window.start && minutes < window.end;
  }

  return minutes >= window.start || minutes < window.end;
}

export function ruleAppliesOnDay(rule, dayName) {
  if (!rule.days?.length) {
    return true;
  }

  return rule.days.includes(dayName);
}

export function evaluateRuleActivity(rule, dayName, minutes) {
  if (!ruleAppliesOnDay(rule, dayName)) {
    return false;
  }

  if (!rule.timeWindows?.length) {
    return true;
  }

  return rule.timeWindows.some((window) => timeWindowContains(window, minutes));
}

export function addMinutes(dayIndex, minutes, increment) {
  const total = minutes + increment;

  if (total >= 1440) {
    return { dayIndex: (dayIndex + Math.floor(total / 1440)) % 7, minutes: total % 1440 };
  }

  return { dayIndex, minutes: total };
}

export function nextDay(dayName) {
  const index = DAY_ORDER.indexOf(dayName);
  return DAY_ORDER[(index + 1) % 7];
}

export function getDayOrder() {
  return [...DAY_ORDER];
}
