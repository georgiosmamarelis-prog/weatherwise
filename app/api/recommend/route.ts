import { NextResponse } from "next/server";
import {
  buildRecommendation,
  isValidYyyyMmDd,
  selectClosestHourIndexOnDate,
  timeOfDayToTargetHour,
  weatherCodeToLabel,
  type Language,
  type OptionId,
  type RecommendResponse,
  type TimeOfDay,
  type Weather,
} from "@/app/lib/recommendation.mts";

import {
  buildForecastUrl,
  isDateOutsideCoverage,
  isPlausibleForecastDate,
  readHourlyValue,
  utcDayYyyyMmDd,
  type HourlySeries,
} from "./forecast.mts";

type GeocodeResponse = {
  results?: Array<{
    name?: string;
    latitude?: number;
    longitude?: number;
    admin1?: string;
    country?: string;
  }>;
};

// Every hourly series can contain `null` for hours Open-Meteo cannot model.
type ForecastResponse = {
  hourly?: {
    time?: string[];
    temperature_2m?: HourlySeries;
    apparent_temperature?: HourlySeries;
    precipitation_probability?: HourlySeries;
    windspeed_10m?: HourlySeries;
    weathercode?: HourlySeries;
    uv_index?: HourlySeries;
    visibility?: HourlySeries;
  };
};

function dateOutOfRangeResponse(language: Language) {
  return NextResponse.json(
    {
      error:
        language === "el"
          ? "Έχουμε πρόγνωση μόνο για τις επόμενες 16 ημέρες."
          : "Forecasts are only available up to 16 days ahead.",
    },
    { status: 400 },
  );
}
async function geocodeCity(city: string) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  const res = await fetch(url, { cache: "no-store", signal: controller.signal }).finally(() => clearTimeout(timeoutId));
  if (!res.ok) throw new Error("geocoding_failed");

  const data = (await res.json()) as GeocodeResponse;
  const first = Array.isArray(data?.results) ? data.results[0] : null;
  if (!first) return null;

  const latitude = Number(first.latitude);
  const longitude = Number(first.longitude);
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) return null;

  const nameParts = [first.name, first.admin1, first.country].filter(Boolean);
  const resolvedName = nameParts.join(", ");

  return { latitude, longitude, resolvedName };
}

async function fetchHourlyForecast(lat: number, lon: number) {
  const url = buildForecastUrl(lat, lon);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  const res = await fetch(url, { cache: "no-store", signal: controller.signal }).finally(() => clearTimeout(timeoutId));
  if (!res.ok) throw new Error("forecast_failed");
  return (await res.json()) as ForecastResponse;
}

export async function POST(req: Request) {
  let language: Language = "en";
  try {
    const body = (await req.json()) as {
      language?: Language;
      city?: string;
      selectedOption?: OptionId;
      selectedDate?: string;
      selectedTimeOfDay?: TimeOfDay;
      latitude?: number;
      longitude?: number;
      resolvedCity?: string;
    };

    language = body.language === "en" ? "en" : "el";
    const city = (body.city ?? "").trim();
    const selectedOption = body.selectedOption;
    const selectedDate = (body.selectedDate ?? "").trim();
    const selectedTimeOfDay = body.selectedTimeOfDay;

    if (!city)
      return NextResponse.json({ error: language === "el" ? "Γράψε μια πόλη." : "Please enter a city." }, { status: 400 });
    if (city.length > 100)
      return NextResponse.json({ error: language === "el" ? "Το όνομα της πόλης είναι πολύ μεγάλο." : "City name is too long." }, { status: 400 });
    if (!selectedOption)
      return NextResponse.json({ error: language === "el" ? "Διάλεξε μια επιλογή." : "Please select an option." }, { status: 400 });
    if (!selectedDate || !isValidYyyyMmDd(selectedDate))
      return NextResponse.json(
        { error: language === "el" ? "Διάλεξε ημερομηνία." : "Please select a date." },
        { status: 400 },
      );
    // Pre-flight guard only. It carries a day of timezone slack, so it rejects
    // just the dates that cannot be valid in any timezone; the exact window is
    // settled after the fetch against the timestamps the API returned.
    if (!isPlausibleForecastDate(selectedDate)) {
      if (selectedDate < utcDayYyyyMmDd(0))
        return NextResponse.json(
          { error: language === "el" ? "Διάλεξε σημερινή ή μελλοντική ημερομηνία." : "Please select today or a future date." },
          { status: 400 },
        );
      return dateOutOfRangeResponse(language);
    }
    if (!selectedTimeOfDay)
      return NextResponse.json(
        { error: language === "el" ? "Διάλεξε ώρα ημέρας." : "Please select time of day." },
        { status: 400 },
      );

    const providedLat = typeof body.latitude === "number" && !Number.isNaN(body.latitude) ? body.latitude : null;
    const providedLon = typeof body.longitude === "number" && !Number.isNaN(body.longitude) ? body.longitude : null;

    let geo: { latitude: number; longitude: number; resolvedName: string } | null = null;

    if (providedLat !== null && providedLon !== null) {
      geo = {
        latitude: providedLat,
        longitude: providedLon,
        resolvedName: typeof body.resolvedCity === "string" && body.resolvedCity ? body.resolvedCity : city,
      };
    } else {
      geo = await geocodeCity(city);
      if (!geo) {
        return NextResponse.json(
          {
            error:
              language === "el"
                ? `Δεν βρήκαμε την πόλη "${city}". Δοκίμασε μια κοντινή πόλη ή έλεγξε την ορθογραφία.`
                : `We couldn't find "${city}". Try a nearby city or double-check the spelling.`,
          },
          { status: 404 },
        );
      }
    }

    const forecast = await fetchHourlyForecast(geo.latitude, geo.longitude);

    const hourly = forecast?.hourly;
    const times: string[] | undefined = hourly?.time;
    const temps: HourlySeries = hourly?.temperature_2m;
    const feelsLikeArr: HourlySeries = hourly?.apparent_temperature;
    const rains: HourlySeries = hourly?.precipitation_probability;
    const winds: HourlySeries = hourly?.windspeed_10m;
    const weatherCodes: HourlySeries = hourly?.weathercode;
    const uvs: HourlySeries = hourly?.uv_index;
    const vises: HourlySeries = hourly?.visibility;

    if (!Array.isArray(times) || !Array.isArray(temps) || !Array.isArray(rains) || !Array.isArray(winds)) {
      return NextResponse.json(
        { error: language === "el" ? "Δεν υπάρχουν διαθέσιμα δεδομένα πρόγνωσης για αυτή την τοποθεσία." : "Forecast data was unavailable for this location." },
        { status: 502 },
      );
    }

    const targetHour = timeOfDayToTargetHour(selectedTimeOfDay);
    const idx = selectClosestHourIndexOnDate(times, selectedDate, targetHour);
    if (idx < 0) {
      // The returned timestamps are the authoritative coverage window, so a
      // date beyond them gets the precise out-of-range message rather than a
      // generic lookup failure.
      if (isDateOutsideCoverage(times, selectedDate)) return dateOutOfRangeResponse(language);
      return NextResponse.json(
        { error: language === "el" ? "Δεν βρέθηκε ωριαία πρόγνωση για την επιλεγμένη ημερομηνία." : "No hourly forecast was available for the selected date." },
        { status: 404 },
      );
    }

    // Every safety-relevant field is read through readHourlyValue, which
    // rejects gaps *before* numeric coercion. Coercing first would turn a
    // `null` hour into 0 °C / 0 % rain / 0 km/h / clear sky / 10 km visibility
    // and produce a confidently wrong recommendation instead of an error.
    const temperature = readHourlyValue(temps, idx);
    const feelsLike = readHourlyValue(feelsLikeArr, idx);
    const rainChance = readHourlyValue(rains, idx);
    const wind = readHourlyValue(winds, idx);
    const weatherCode = readHourlyValue(weatherCodes, idx);
    const visibility = readHourlyValue(vises, idx);

    if (
      temperature === null ||
      feelsLike === null ||
      rainChance === null ||
      wind === null ||
      weatherCode === null ||
      visibility === null
    ) {
      return NextResponse.json(
        { error: language === "el" ? "Η πρόγνωση είναι ελλιπής για την επιλεγμένη ώρα." : "Forecast data was incomplete for the selected time." },
        { status: 502 },
      );
    }

    // UV only drives advisory copy, and a real 0 (night, deep winter) already
    // means "nothing to say", so a gap degrades to 0 rather than failing.
    const uvIndex = readHourlyValue(uvs, idx) ?? 0;

    const weather: Weather = {
      temperature: Math.round(temperature),
      feelsLike: Math.round(feelsLike),
      rainChance: Math.round(rainChance),
      wind: Math.round(wind),
      weatherCode: Math.round(weatherCode),
      uvIndex: Math.round(uvIndex),
      visibility: Math.round(visibility),
    };

    const conditionLabel = weatherCodeToLabel(weather.weatherCode, language);
    const recommendation = buildRecommendation(selectedOption, weather, language);

    const response: RecommendResponse = {
      city,
      resolvedCity: geo.resolvedName || undefined,
      selectedOption,
      selectedDate,
      selectedTimeOfDay,
      recommendation,
      weather,
      conditionLabel,
    };

    return NextResponse.json(response);
  } catch {
    return NextResponse.json(
      {
        error:
          language === "el"
            ? "Κάτι πήγε στραβά. Δοκίμασε ξανά σε λίγο."
            : "Something went wrong. Please try again in a moment.",
      },
      { status: 500 },
    );
  }
}
