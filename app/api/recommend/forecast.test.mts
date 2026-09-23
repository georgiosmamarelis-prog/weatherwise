import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_FORECAST_DAYS,
  buildForecastUrl,
  isDateOutsideCoverage,
  isPlausibleForecastDate,
  readHourlyValue,
  utcDayYyyyMmDd,
} from "./forecast.mts";

// Mid-afternoon UTC, so ±1 day arithmetic cannot drift across a boundary.
const NOW = new Date("2026-09-23T15:00:00Z");

test("readHourlyValue keeps a legitimate 0 distinct from a gap", () => {
  // 0 m visibility is dense fog and 0 °C / 0 km/h are ordinary readings; the
  // old `|| fallback` turned all of them into the fallback.
  assert.equal(readHourlyValue([0], 0), 0);
  assert.equal(readHourlyValue([0.4], 0), 0.4);
  assert.equal(readHourlyValue([-10.7], 0), -10.7);
});

test("readHourlyValue reports null, undefined and missing series as gaps", () => {
  assert.equal(readHourlyValue([null], 0), null);
  assert.equal(readHourlyValue([undefined as unknown as null], 0), null);
  assert.equal(readHourlyValue(undefined, 0), null);
  assert.equal(readHourlyValue([], 0), null);
  assert.equal(readHourlyValue([1], 5), null, "index past the end is a gap");
});

test("readHourlyValue rejects non-finite values", () => {
  assert.equal(readHourlyValue([Number.NaN], 0), null);
  assert.equal(readHourlyValue([Number.POSITIVE_INFINITY], 0), null);
  assert.equal(readHourlyValue([Number.NEGATIVE_INFINITY], 0), null);
});

test("a null hour never coerces into a plausible weather reading", () => {
  // Reproduces the real Open-Meteo shape at high latitude on the last
  // forecast day, where every series is null for the same hour. Coercing
  // first (`Number(null)` is 0) would report 0 °C, 0 % rain, 0 km/h wind,
  // weather code 0 ("clear sky") and 10 km visibility.
  const gap = { temperature_2m: [null], windspeed_10m: [null], weathercode: [null], visibility: [null] };
  for (const series of Object.values(gap)) {
    assert.equal(readHourlyValue(series, 0), null);
    assert.notEqual(readHourlyValue(series, 0), 0, "a gap must not read as 0");
  }
});

test("null visibility is a gap, not the old safe 10000 m default", () => {
  assert.equal(readHourlyValue([null], 0), null);
  assert.notEqual(readHourlyValue([null], 0), 10000);
  // ...while a real 0 survives and stays below the <500 m danger threshold.
  const real = readHourlyValue([0], 0);
  assert.equal(real, 0);
  assert.ok(real !== null && real < 500);
});

test("isPlausibleForecastDate accepts today through the last covered day", () => {
  assert.equal(isPlausibleForecastDate(utcDayYyyyMmDd(0, NOW), NOW), true, "today");
  assert.equal(isPlausibleForecastDate(utcDayYyyyMmDd(1, NOW), NOW), true, "tomorrow");
  assert.equal(isPlausibleForecastDate(utcDayYyyyMmDd(15, NOW), NOW), true, "today+15, last covered day");
});

test("isPlausibleForecastDate allows one day of slack for unknown caller timezones", () => {
  assert.equal(isPlausibleForecastDate(utcDayYyyyMmDd(-1, NOW), NOW), true, "yesterday in UTC may be today for the caller");
  assert.equal(isPlausibleForecastDate(utcDayYyyyMmDd(16, NOW), NOW), true, "today+16 in UTC may be today+15 for the caller");
});

test("isPlausibleForecastDate rejects dates impossible in any timezone", () => {
  assert.equal(isPlausibleForecastDate(utcDayYyyyMmDd(-2, NOW), NOW), false);
  assert.equal(isPlausibleForecastDate(utcDayYyyyMmDd(17, NOW), NOW), false);
  assert.equal(isPlausibleForecastDate("2026-11-30", NOW), false);
});

test("utcDayYyyyMmDd crosses month boundaries in UTC regardless of server offset", () => {
  assert.equal(utcDayYyyyMmDd(15, NOW), "2026-10-08");
  assert.equal(utcDayYyyyMmDd(0, new Date("2026-12-31T23:30:00Z")), "2026-12-31");
  assert.equal(utcDayYyyyMmDd(1, new Date("2026-12-31T23:30:00Z")), "2027-01-01");
});

// A 16-day window as Open-Meteo returns it: hourly rows from today 00:00
// through today+15 23:00, on the destination's calendar.
const coverage = Array.from({ length: MAX_FORECAST_DAYS * 24 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 8, 23, 0, 0));
  d.setUTCHours(d.getUTCHours() + i);
  return `${d.toISOString().slice(0, 13)}:00`;
});

test("isDateOutsideCoverage settles the boundary from the returned timestamps", () => {
  assert.equal(coverage[0], "2026-09-23T00:00");
  assert.equal(coverage[coverage.length - 1], "2026-10-08T23:00");

  assert.equal(isDateOutsideCoverage(coverage, "2026-09-23"), false, "today is covered");
  assert.equal(isDateOutsideCoverage(coverage, "2026-10-08"), false, "today+15 is covered");
  assert.equal(isDateOutsideCoverage(coverage, "2026-10-09"), true, "today+16 is beyond the window");
  assert.equal(isDateOutsideCoverage(coverage, "2026-09-22"), true, "yesterday is before the window");
});

test("isDateOutsideCoverage stays silent when coverage is unknown", () => {
  // Proves nothing, so the caller falls back to its generic error.
  assert.equal(isDateOutsideCoverage([], "2026-10-09"), false);
});

test("buildForecastUrl requests the full 16-day window", () => {
  const url = new URL(buildForecastUrl(37.98, 23.73));
  assert.equal(url.searchParams.get("forecast_days"), "16");
  assert.equal(MAX_FORECAST_DAYS, 16, "16 is Open-Meteo's documented maximum");
});

test("buildForecastUrl keeps the fields the recommendation depends on", () => {
  const url = new URL(buildForecastUrl(37.98, 23.73));
  assert.equal(url.searchParams.get("latitude"), "37.98");
  assert.equal(url.searchParams.get("longitude"), "23.73");
  assert.equal(url.searchParams.get("timezone"), "auto");
  const hourly = url.searchParams.get("hourly")?.split(",") ?? [];
  for (const field of [
    "temperature_2m",
    "apparent_temperature",
    "precipitation_probability",
    "windspeed_10m",
    "weathercode",
    "uv_index",
    "visibility",
  ]) {
    assert.ok(hourly.includes(field), `missing hourly field ${field}`);
  }
});
