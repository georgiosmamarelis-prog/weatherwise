// Pure helpers for the Open-Meteo hourly forecast: request building, hourly
// value parsing and date-window rules. They live outside route.ts so they can
// be unit tested without the Next runtime; route.ts keeps the HTTP handling.

// Open-Meteo accepts at most 16 forecast days, which covers today through
// today + 15 in the destination's local calendar.
export const MAX_FORECAST_DAYS = 16;

const LAST_COVERED_DAY_OFFSET = MAX_FORECAST_DAYS - 1;

// The caller's calendar day is unknown server-side: the browser can sit a day
// either side of the server's UTC day, and `timezone=auto` means the forecast
// itself is on the destination's calendar. One day of slack on each end keeps
// the pre-flight guard from rejecting a date that is valid for the user.
const TIMEZONE_SLACK_DAYS = 1;

// Open-Meteo omits hours it cannot model, sending `null` inside the series
// rather than shortening it, so the arrays are `(number | null)[]`.
export type HourlySeries = (number | null)[] | undefined;

/**
 * Reads a single hour out of an hourly series, returning `null` for anything
 * that is not a real reading.
 *
 * Presence is checked *before* numeric coercion: `Number(null)` is `0`, so
 * coercing first would silently turn a gap into a plausible-looking reading
 * (0 °C, 0 % rain, 0 km/h wind, weather code 0 = "clear sky"). A genuine `0`
 * is preserved — only null, undefined, a missing series and non-finite values
 * collapse to `null`.
 */
export function readHourlyValue(series: HourlySeries, index: number): number | null {
  const raw = series?.[index];
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
}

/** Calendar day `offsetDays` from `now`, computed entirely in UTC. */
export function utcDayYyyyMmDd(offsetDays: number, now: Date = new Date()): string {
  const d = new Date(now.getTime());
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/**
 * Cheap pre-flight guard, run before spending a network call. Because of the
 * timezone slack it only rejects dates that cannot be valid in any timezone;
 * `isDateOutsideCoverage` makes the exact call afterwards against the
 * timestamps the API actually returned.
 */
export function isPlausibleForecastDate(date: string, now: Date = new Date()): boolean {
  return (
    date >= utcDayYyyyMmDd(-TIMEZONE_SLACK_DAYS, now) &&
    date <= utcDayYyyyMmDd(LAST_COVERED_DAY_OFFSET + TIMEZONE_SLACK_DAYS, now)
  );
}

/**
 * Whether `date` is provably outside what the forecast covers. The returned
 * timestamps are authoritative — they are on the destination's calendar, which
 * is what the user asked about — so this settles the boundary exactly instead
 * of inferring it from the server clock. An empty series proves nothing, so it
 * reports `false` and the caller falls back to its generic error.
 */
export function isDateOutsideCoverage(times: string[], date: string): boolean {
  const first = times[0]?.slice(0, 10);
  const last = times[times.length - 1]?.slice(0, 10);
  if (!first || !last) return false;
  return date < first || date > last;
}

export function buildForecastUrl(latitude: number, longitude: number): string {
  return (
    `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(String(latitude))}` +
    `&longitude=${encodeURIComponent(String(longitude))}` +
    `&hourly=temperature_2m,apparent_temperature,precipitation_probability,windspeed_10m,weathercode,uv_index,visibility` +
    `&temperature_unit=celsius&windspeed_unit=kmh&timezone=auto` +
    `&forecast_days=${MAX_FORECAST_DAYS}`
  );
}
