import test from "node:test";
import assert from "node:assert/strict";
import { parseSignsToRules } from "../src/modules/parsing/rule-parser.js";

test("parser extracts days, times, and arrow direction", () => {
  const rules = parseSignsToRules({
    signs: [
      {
        signId: "sign-1",
        rawText: "No Parking Mon-Fri 7 AM - 9 AM →",
        primaryArrow: "right",
        iconSummary: [],
        confidence: 0.87
      }
    ]
  });

  assert.equal(rules[0].type, "no_parking");
  assert.deepEqual(rules[0].days, ["monday", "tuesday", "wednesday", "thursday", "friday"]);
  assert.deepEqual(rules[0].timeWindows, [{ start: 420, end: 540 }]);
  assert.equal(rules[0].direction, "right");
});

test("parser handles except sunday and one hour parking", () => {
  const rules = parseSignsToRules({
    signs: [
      {
        signId: "sign-2",
        rawText: "NO STOPPING 7 TO 9 A.M. 4 TO 6:15 P.M. EXCEPT SUNDAY",
        primaryArrow: "none",
        iconSummary: [],
        confidence: 0.91
      },
      {
        signId: "sign-3",
        rawText: "1 HOUR PARKING 9 A.M. TO 4 P.M. EXCEPT SUNDAY",
        primaryArrow: "none",
        iconSummary: [],
        confidence: 0.9
      }
    ]
  });

  assert.equal(rules[0].type, "no_stopping");
  assert.deepEqual(rules[0].days, ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]);
  assert.deepEqual(rules[0].timeWindows, [{ start: 420, end: 540 }, { start: 960, end: 1095 }]);
  assert.equal(rules[1].type, "time_limited_parking");
  assert.equal(rules[1].durationLimitMinutes, 60);
  assert.deepEqual(rules[1].days, ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]);
});
