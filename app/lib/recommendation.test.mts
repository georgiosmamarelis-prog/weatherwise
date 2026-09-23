import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildRecommendation,
  isValidYyyyMmDd,
  selectClosestHourIndexOnDate,
  timeOfDayToTargetHour,
  weatherCodeToLabel,
  type Weather,
} from "./recommendation.mts";

/** Benign baseline: mild, dry, calm, clear. Override only what a test is about. */
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

const title = (...args: Parameters<typeof buildRecommendation>) => buildRecommendation(...args).title;

describe("timeOfDayToTargetHour", () => {
  it("maps each slot to its representative hour", () => {
    assert.equal(timeOfDayToTargetHour("morning"), 8);
    assert.equal(timeOfDayToTargetHour("noon"), 12);
    assert.equal(timeOfDayToTargetHour("afternoon"), 15);
    assert.equal(timeOfDayToTargetHour("evening"), 18);
    assert.equal(timeOfDayToTargetHour("night"), 21);
  });
});

describe("isValidYyyyMmDd", () => {
  it("accepts a well-formed date", () => {
    assert.equal(isValidYyyyMmDd("2026-04-07"), true);
  });

  it("rejects malformed input", () => {
    for (const bad of ["", "2026-4-7", "07/04/2026", "2026-04-07T10:00", "not-a-date"]) {
      assert.equal(isValidYyyyMmDd(bad), false, `expected ${JSON.stringify(bad)} to be rejected`);
    }
  });
});

describe("selectClosestHourIndexOnDate", () => {
  const times = [
    "2026-04-06T21:00",
    "2026-04-07T06:00",
    "2026-04-07T14:00",
    "2026-04-07T17:00",
    "2026-04-08T15:00",
  ];

  it("picks the hour nearest the target on the requested date", () => {
    assert.equal(selectClosestHourIndexOnDate(times, "2026-04-07", 15), 2);
    assert.equal(selectClosestHourIndexOnDate(times, "2026-04-07", 8), 1);
    assert.equal(selectClosestHourIndexOnDate(times, "2026-04-07", 21), 3);
  });

  it("never crosses into a neighbouring date", () => {
    // 21:00 on the 6th is a closer clock-hour match than 06:00 on the 7th.
    assert.equal(selectClosestHourIndexOnDate(times, "2026-04-07", 22), 3);
  });

  it("keeps the earliest index when two hours are equally close", () => {
    const tied = ["2026-04-07T14:00", "2026-04-07T16:00"];
    assert.equal(selectClosestHourIndexOnDate(tied, "2026-04-07", 15), 0);
  });

  it("returns -1 when the date is not in the series", () => {
    assert.equal(selectClosestHourIndexOnDate(times, "2026-04-09", 15), -1);
    assert.equal(selectClosestHourIndexOnDate([], "2026-04-07", 15), -1);
  });
});

describe("weatherCodeToLabel", () => {
  it("maps each code band to its label", () => {
    assert.equal(weatherCodeToLabel(0, "en"), "Clear sky");
    assert.equal(weatherCodeToLabel(3, "en"), "Partly cloudy");
    assert.equal(weatherCodeToLabel(48, "en"), "Foggy");
    assert.equal(weatherCodeToLabel(67, "en"), "Rain");
    assert.equal(weatherCodeToLabel(77, "en"), "Snow");
    assert.equal(weatherCodeToLabel(82, "en"), "Showers");
    assert.equal(weatherCodeToLabel(99, "en"), "Thunderstorm");
    assert.equal(weatherCodeToLabel(100, "en"), "Mixed");
  });

  it("localises to Greek", () => {
    assert.equal(weatherCodeToLabel(0, "el"), "Αίθριος");
    assert.equal(weatherCodeToLabel(99, "el"), "Καταιγίδα");
  });
});

describe("buildRecommendation — running", () => {
  it("calls the full ideal window ideal, at both temperature edges", () => {
    assert.equal(title("running", wx({ temperature: 8, feelsLike: 8 }), "en"), "Ideal for running");
    assert.equal(title("running", wx({ temperature: 22, feelsLike: 22 }), "en"), "Ideal for running");
    assert.equal(title("running", wx({ rainChance: 29, wind: 19 }), "en"), "Ideal for running");
  });

  it("downgrades to manageable just outside the ideal window", () => {
    assert.equal(title("running", wx({ temperature: 23, feelsLike: 23 }), "en"), "Manageable for running");
    assert.equal(title("running", wx({ rainChance: 30 }), "en"), "Manageable for running");
    assert.equal(title("running", wx({ wind: 20 }), "en"), "Manageable for running");
  });

  it("advises skipping outside the manageable window", () => {
    assert.equal(title("running", wx({ temperature: 27, feelsLike: 27 }), "en"), "Skip the run today");
    assert.equal(title("running", wx({ rainChance: 50 }), "en"), "Skip the run today");
    assert.equal(title("running", wx({ wind: 30 }), "en"), "Skip the run today");
  });

  it("treats a thunderstorm as disqualifying regardless of otherwise perfect conditions", () => {
    const rec = buildRecommendation("running", wx({ weatherCode: 95 }), "en");
    assert.equal(rec.title, "Skip the run today");
    assert.match(rec.summary, /Thunderstorm — avoid going out\./);
  });

  it("warns when it feels much colder than the air temperature", () => {
    const rec = buildRecommendation("running", wx({ temperature: 12, feelsLike: 4 }), "en");
    assert.match(rec.summary, /Feels much colder/);
  });

  it("warns about high UV from index 6 up, and not below", () => {
    assert.match(buildRecommendation("running", wx({ uvIndex: 6 }), "en").summary, /High UV/);
    assert.doesNotMatch(buildRecommendation("running", wx({ uvIndex: 5 }), "en").summary, /High UV/);
  });

  it("omits the UV reason when the index is zero", () => {
    assert.ok(buildRecommendation("running", wx({ uvIndex: 0 }), "en").reasons.every((r) => !r.startsWith("UV index")));
    assert.ok(buildRecommendation("running", wx({ uvIndex: 3 }), "en").reasons.includes("UV index: 3."));
  });
});

describe("buildRecommendation — motorbike", () => {
  it("flags danger on thunderstorm, gale wind, or near-zero visibility", () => {
    assert.equal(title("motorbike", wx({ weatherCode: 95 }), "en"), "Dangerous for motorbike");
    assert.equal(title("motorbike", wx({ wind: 41 }), "en"), "Dangerous for motorbike");
    assert.equal(title("motorbike", wx({ visibility: 499 }), "en"), "Dangerous for motorbike");
  });

  it("discourages riding on rain, strong wind, or reduced visibility", () => {
    assert.equal(title("motorbike", wx({ rainChance: 41 }), "en"), "Not recommended for motorbike");
    assert.equal(title("motorbike", wx({ wind: 26 }), "en"), "Not recommended for motorbike");
    assert.equal(title("motorbike", wx({ visibility: 999 }), "en"), "Not recommended for motorbike");
  });

  it("allows riding at the safe edge of every threshold", () => {
    assert.equal(title("motorbike", wx({ rainChance: 40, wind: 25, visibility: 1000 }), "en"), "Reasonable for motorbike");
  });

  it("adds a visibility caution only when there is no thunderstorm to warn about first", () => {
    assert.match(buildRecommendation("motorbike", wx({ visibility: 800 }), "en").summary, /Reduced visibility/);
    const storm = buildRecommendation("motorbike", wx({ visibility: 800, weatherCode: 95 }), "en");
    assert.match(storm.summary, /do not ride/);
    assert.doesNotMatch(storm.summary, /Reduced visibility/);
  });

  it("recommends warm gloves below 5°C", () => {
    assert.match(buildRecommendation("motorbike", wx({ temperature: 4 }), "en").summary, /thermal gloves/);
    assert.doesNotMatch(buildRecommendation("motorbike", wx({ temperature: 5 }), "en").summary, /thermal gloves/);
  });

  it("reports visibility in km at or above 1000 m, and in m below it", () => {
    assert.ok(buildRecommendation("motorbike", wx({ visibility: 8500 }), "en").reasons.includes("Visibility: 8.5 km."));
    assert.ok(buildRecommendation("motorbike", wx({ visibility: 900 }), "en").reasons.includes("Visibility: 900 m."));
  });
});

describe("buildRecommendation — walk", () => {
  it("is happy while rain stays under 40% and it is warmer than 5°C", () => {
    assert.equal(title("walk", wx({ rainChance: 39, temperature: 6 }), "en"), "Good for a walk");
  });

  it("turns negative at the rain and temperature limits", () => {
    assert.equal(title("walk", wx({ rainChance: 40 }), "en"), "Not ideal for a walk");
    assert.equal(title("walk", wx({ temperature: 5 }), "en"), "Not ideal for a walk");
    assert.equal(title("walk", wx({ weatherCode: 95 }), "en"), "Not ideal for a walk");
  });

  it("escalates rain advice from a small umbrella to waterproofs", () => {
    assert.doesNotMatch(buildRecommendation("walk", wx({ rainChance: 19 }), "en").summary, /umbrella/);
    assert.match(buildRecommendation("walk", wx({ rainChance: 20 }), "en").summary, /a small umbrella is enough/);
    assert.match(buildRecommendation("walk", wx({ rainChance: 40 }), "en").summary, /umbrella or waterproof layer/);
  });
});

describe("buildRecommendation — cycling", () => {
  it("calls the ideal window ideal, at both temperature edges", () => {
    assert.equal(title("cycling", wx({ temperature: 10, feelsLike: 10 }), "en"), "Ideal for cycling");
    assert.equal(title("cycling", wx({ temperature: 25, feelsLike: 25 }), "en"), "Ideal for cycling");
  });

  it("requires feels-like above 8°C for ideal, and flags the cold strictly below it", () => {
    // feels-like 8 sits in the gap: too cold to be ideal, not cold enough to warn about.
    const borderline = buildRecommendation("cycling", wx({ temperature: 12, feelsLike: 8 }), "en");
    assert.equal(borderline.title, "Manageable for cycling");
    assert.doesNotMatch(borderline.summary, /Feels cold/);

    const cold = buildRecommendation("cycling", wx({ temperature: 12, feelsLike: 7 }), "en");
    assert.equal(cold.title, "Manageable for cycling");
    assert.match(cold.summary, /Feels cold — wear thermal gloves\./);
  });

  it("stays manageable up to the rain and wind limits", () => {
    assert.equal(title("cycling", wx({ temperature: 8, feelsLike: 8, rainChance: 44, wind: 34 }), "en"), "Manageable for cycling");
  });

  it("calls conditions tough past the manageable limits", () => {
    assert.equal(title("cycling", wx({ temperature: 7, feelsLike: 7 }), "en"), "Tough conditions for cycling");
    assert.equal(title("cycling", wx({ rainChance: 45 }), "en"), "Tough conditions for cycling");
    assert.equal(title("cycling", wx({ wind: 35 }), "en"), "Tough conditions for cycling");
    assert.equal(title("cycling", wx({ weatherCode: 95 }), "en"), "Tough conditions for cycling");
  });
});

describe("buildRecommendation — beach", () => {
  it("needs warmth, calm, low rain and a clear-ish sky to be great", () => {
    assert.equal(title("beach", wx({ temperature: 25, rainChance: 19, wind: 19, weatherCode: 3 }), "en"), "Great beach day");
  });

  it("drops to decent when any great-day condition slips", () => {
    assert.equal(title("beach", wx({ temperature: 24, rainChance: 19, wind: 19, weatherCode: 3 }), "en"), "Decent beach day");
    assert.equal(title("beach", wx({ temperature: 25, weatherCode: 4 }), "en"), "Decent beach day");
    assert.equal(title("beach", wx({ temperature: 20, rainChance: 29, wind: 29 }), "en"), "Decent beach day");
  });

  it("rules the beach out below 20°C or in a thunderstorm", () => {
    assert.equal(title("beach", wx({ temperature: 19 }), "en"), "Not ideal for the beach");
    assert.equal(title("beach", wx({ temperature: 28, weatherCode: 95 }), "en"), "Not ideal for the beach");
  });

  it("always reports UV and calls for sunscreen whenever the index is above zero", () => {
    const rec = buildRecommendation("beach", wx({ temperature: 28, uvIndex: 7 }), "en");
    assert.match(rec.summary, /UV index: 7 — sunscreen essential\./);
    assert.ok(rec.reasons.includes("UV index: 7."));
    assert.ok(buildRecommendation("beach", wx({ uvIndex: 0 }), "en").reasons.includes("UV index: 0."));
  });
});

describe("buildRecommendation — wear", () => {
  it("steps clothing weight down as feels-like rises", () => {
    const summary = (feelsLike: number) => buildRecommendation("wear", wx({ feelsLike }), "en").summary;
    assert.match(summary(4), /^Heavy coat \+ thermal base layer\./);
    assert.match(summary(5), /^Jacket \+ mid layer\./);
    assert.match(summary(14), /^Jacket \+ mid layer\./);
    assert.match(summary(15), /^Light jacket or long sleeves\./);
    assert.match(summary(21), /^Light jacket or long sleeves\./);
    assert.match(summary(22), /^T-shirt or light layers\./);
  });

  it("dresses for feels-like, not air temperature", () => {
    const rec = buildRecommendation("wear", wx({ temperature: 30, feelsLike: 2 }), "en");
    assert.match(rec.summary, /^Heavy coat \+ thermal base layer\./);
    assert.ok(rec.reasons.includes("Feels like: 2°C (air temperature: 30°C)."));
  });

  it("escalates rain gear and adds wind and UV advice at their thresholds", () => {
    assert.doesNotMatch(buildRecommendation("wear", wx({ rainChance: 9 }), "en").summary, /umbrella/);
    assert.match(buildRecommendation("wear", wx({ rainChance: 10 }), "en").summary, /Pack a compact umbrella\./);
    assert.match(buildRecommendation("wear", wx({ rainChance: 40 }), "en").summary, /Waterproof jacket or umbrella\./);
    assert.match(buildRecommendation("wear", wx({ wind: 21 }), "en").summary, /windproof outer layer/);
    assert.doesNotMatch(buildRecommendation("wear", wx({ wind: 20 }), "en").summary, /windproof outer layer/);
    assert.match(buildRecommendation("wear", wx({ uvIndex: 6 }), "en").summary, /High UV/);
  });
});

describe("buildRecommendation — localisation", () => {
  it("returns Greek copy for every option without changing the verdict", () => {
    const ideal = wx({ temperature: 18, feelsLike: 18 });
    assert.equal(title("running", ideal, "el"), "Ιδανικό για τρέξιμο");
    assert.equal(title("cycling", ideal, "el"), "Ιδανικό για ποδηλασία");
    assert.equal(title("walk", ideal, "el"), "Καλή επιλογή για βόλτα");
    assert.equal(title("motorbike", ideal, "el"), "Λογικό για μηχανάκι");
    assert.equal(title("beach", wx({ temperature: 28, rainChance: 0, wind: 5 }), "el"), "Εξαιρετικό για παραλία");
    assert.equal(title("wear", ideal, "el"), "Τι να φορέσω");
  });

  it("keeps the same number of reasons in both languages", () => {
    const w = wx({ uvIndex: 4 });
    for (const option of ["running", "wear", "motorbike", "walk", "cycling", "beach"] as const) {
      assert.equal(
        buildRecommendation(option, w, "en").reasons.length,
        buildRecommendation(option, w, "el").reasons.length,
        `reason count differs for ${option}`,
      );
    }
  });
});
