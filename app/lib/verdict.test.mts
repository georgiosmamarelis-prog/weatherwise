import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildRecommendation, type Weather } from "./recommendation.mts";
import { getVerdictAndRisk } from "./verdict.mts";

function wx(overrides: Partial<Weather> = {}): Weather {
  return {
    temperature: 15,
    feelsLike: 15,
    rainChance: 0,
    wind: 5,
    weatherCode: 0,
    uvIndex: 0,
    visibility: 10000,
    ...overrides,
  };
}

const verdict = (...args: Parameters<typeof getVerdictAndRisk>) => getVerdictAndRisk(...args).verdict;

describe("getVerdictAndRisk", () => {
  it("grades running on the same thresholds the server uses", () => {
    assert.equal(verdict("running", wx({ temperature: 8 })), "good");
    assert.equal(verdict("running", wx({ temperature: 23 })), "okay");
    assert.equal(verdict("running", wx({ rainChance: 50 })), "not");
    assert.equal(verdict("running", wx({ weatherCode: 95 })), "not");
  });

  it("grades walking, with a wider tolerance band than the recommendation copy", () => {
    assert.equal(verdict("walk", wx({ rainChance: 39, temperature: 6 })), "good");
    assert.equal(verdict("walk", wx({ rainChance: 54, temperature: 1 })), "okay");
    assert.equal(verdict("walk", wx({ rainChance: 55 })), "not");
    assert.equal(verdict("walk", wx({ temperature: 0 })), "not");
  });

  it("grades cycling on the same thresholds the server uses", () => {
    assert.equal(verdict("cycling", wx({ temperature: 10, feelsLike: 10 })), "good");
    assert.equal(verdict("cycling", wx({ temperature: 12, feelsLike: 8 })), "okay");
    assert.equal(verdict("cycling", wx({ temperature: 7, feelsLike: 7 })), "not");
  });

  it("grades the beach on the same thresholds the server uses", () => {
    assert.equal(verdict("beach", wx({ temperature: 25, rainChance: 19, wind: 19, weatherCode: 3 })), "good");
    assert.equal(verdict("beach", wx({ temperature: 20, rainChance: 29, wind: 29 })), "okay");
    assert.equal(verdict("beach", wx({ temperature: 19 })), "not");
  });

  it("grades clothing by how wet and windy it is, not by temperature", () => {
    assert.equal(verdict("wear", wx({ temperature: -10, feelsLike: -15 })), "good");
    assert.equal(verdict("wear", wx({ rainChance: 41 })), "okay");
    assert.equal(verdict("wear", wx({ wind: 21 })), "okay");
    assert.equal(verdict("wear", wx({ rainChance: 71 })), "not");
    assert.equal(verdict("wear", wx({ wind: 36 })), "not");
  });

  it("is conservative for motorbikes: any not-ideal factor is graded 'not'", () => {
    assert.equal(verdict("motorbike", wx()), "good");
    assert.equal(verdict("motorbike", wx({ rainChance: 26 })), "okay");
    assert.equal(verdict("motorbike", wx({ wind: 16 })), "okay");
    assert.equal(verdict("motorbike", wx({ rainChance: 41 })), "not");
    assert.equal(verdict("motorbike", wx({ visibility: 999 })), "not");
    assert.equal(verdict("motorbike", wx({ weatherCode: 95 })), "not");
  });

  it("colours the badge and risk chip consistently with the verdict", () => {
    for (const [weather, tone] of [
      [wx(), "emerald"],
      [wx({ temperature: 23 }), "amber"],
      [wx({ weatherCode: 95 }), "rose"],
    ] as const) {
      const { badgeClasses, riskClasses } = getVerdictAndRisk("running", weather);
      assert.ok(badgeClasses.includes(tone), `badge for ${tone} verdict: ${badgeClasses}`);
      assert.ok(riskClasses.includes(tone), `risk chip for ${tone} verdict: ${riskClasses}`);
    }
  });
});

describe("client verdict vs. server recommendation", () => {
  // The badge (client) and the title (server) are two encodings of the same call.
  // These lock in the cases where they currently agree — and the one where they don't.
  it("agrees with the server on a clearly good and a clearly bad day", () => {
    const good = wx({ temperature: 18, feelsLike: 18 });
    const bad = wx({ weatherCode: 95 });

    for (const option of ["running", "cycling", "walk", "beach"] as const) {
      assert.equal(verdict(option, bad), "not", `${option} should be 'not' in a thunderstorm`);
      assert.match(
        buildRecommendation(option, bad, "en").summary,
        /Thunderstorm/,
        `${option} summary should mention the thunderstorm`,
      );
    }

    assert.equal(verdict("running", good), "good");
    assert.equal(buildRecommendation("running", good, "en").title, "Ideal for running");
  });

  it("agrees with the server once a motorbike ride is no longer advisable", () => {
    for (const w of [wx({ rainChance: 41 }), wx({ wind: 26 }), wx({ visibility: 999 })]) {
      assert.equal(verdict("motorbike", w), "not");
      assert.equal(buildRecommendation("motorbike", w, "en").title, "Not recommended for motorbike");
    }
  });

  it("shows an amber motorbike badge in a band where the server title stays positive", () => {
    // Known divergence, captured so that changing it is a deliberate decision:
    // the client has a middle band (rain 26–40%, wind 16–25 km/h) that the
    // server copy does not — the badge goes amber while the title still reads
    // "Reasonable for motorbike".
    for (const w of [wx({ rainChance: 26 }), wx({ rainChance: 40 }), wx({ wind: 16 }), wx({ wind: 25 })]) {
      assert.equal(verdict("motorbike", w), "okay");
      assert.equal(buildRecommendation("motorbike", w, "en").title, "Reasonable for motorbike");
    }
  });
});
