import test from "node:test";
import assert from "node:assert/strict";
import { reasonAboutParking } from "../src/modules/reasoning/rule-reasoner.js";

test("restrictive rule overrides permissive overlap", () => {
  const result = reasonAboutParking({
    rules: [
      {
        id: "1",
        type: "no_parking",
        rawText: "No Parking 8 AM - 10 AM",
        days: ["monday"],
        timeWindows: [{ start: 480, end: 600 }],
        permits: [],
        confidence: 0.9
      },
      {
        id: "2",
        type: "parking_allowed",
        rawText: "Parking Allowed 9 AM - 5 PM",
        days: ["monday"],
        timeWindows: [{ start: 540, end: 1020 }],
        permits: [],
        confidence: 0.9
      }
    ],
    context: {
      dayOfWeek: "monday",
      minutesOfDay: 570,
      permits: []
    }
  });

  assert.equal(result.parkingAllowed, false);
  assert.match(result.reason, /not allowed/i);
  assert.equal(result.conflicts.length > 0, true);
});

test("permit rule passes when the user holds the matching permit", () => {
  const result = reasonAboutParking({
    rules: [
      {
        id: "3",
        type: "permit_only",
        rawText: "Residential Permit Only 8 AM - 6 PM",
        days: ["tuesday"],
        timeWindows: [{ start: 480, end: 1080 }],
        permits: ["residential"],
        confidence: 0.84
      }
    ],
    context: {
      dayOfWeek: "tuesday",
      minutesOfDay: 600,
      permits: ["residential"]
    }
  });

  assert.equal(result.parkingAllowed, true);
});

test("unclear OCR does not default to parking allowed", () => {
  const result = reasonAboutParking({
    rules: [],
    context: {
      dayOfWeek: "wednesday",
      minutesOfDay: 600,
      permits: []
    },
    extractionWarnings: ["OCR appears too noisy or incomplete to safely interpret this sign."]
  });

  assert.equal(result.parkingAllowed, null);
  assert.equal(result.status, "Unclear");
  assert.match(result.reason, /too unclear/i);
});
