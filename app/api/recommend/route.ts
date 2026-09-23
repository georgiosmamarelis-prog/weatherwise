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

type GeocodeResponse = {
  results?: Array<{
    name?: string;
    latitude?: number;
    longitude?: number;
    admin1?: string;
    country?: string;
  }>;
};

type ForecastResponse = {
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    apparent_temperature?: number[];
    precipitation_probability?: number[];
    windspeed_10m?: number[];
    weathercode?: number[];
    uv_index?: number[];
    visibility?: number[];
  };
};

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
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(String(lat))}` +
    `&longitude=${encodeURIComponent(String(lon))}` +
    `&hourly=temperature_2m,apparent_temperature,precipitation_probability,windspeed_10m,weathercode,uv_index,visibility` +
    `&temperature_unit=celsius&windspeed_unit=kmh&timezone=auto`;
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
    const todayStr = new Date().toISOString().slice(0, 10);
    if (selectedDate < todayStr)
      return NextResponse.json(
        { error: language === "el" ? "Διάλεξε σημερινή ή μελλοντική ημερομηνία." : "Please select today or a future date." },
        { status: 400 },
      );
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 16);
    if (selectedDate > maxDate.toISOString().slice(0, 10))
      return NextResponse.json(
        { error: language === "el" ? "Έχουμε πρόγνωση μόνο για τις επόμενες 16 ημέρες." : "Forecasts are only available up to 16 days ahead." },
        { status: 400 },
      );
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
    const temps: number[] | undefined = hourly?.temperature_2m;
    const feelsLikeArr: number[] | undefined = hourly?.apparent_temperature;
    const rains: number[] | undefined = hourly?.precipitation_probability;
    const winds: number[] | undefined = hourly?.windspeed_10m;
    const weatherCodes: number[] | undefined = hourly?.weathercode;
    const uvs: number[] | undefined = hourly?.uv_index;
    const vises: number[] | undefined = hourly?.visibility;

    if (!Array.isArray(times) || !Array.isArray(temps) || !Array.isArray(rains) || !Array.isArray(winds)) {
      return NextResponse.json(
        { error: language === "el" ? "Δεν υπάρχουν διαθέσιμα δεδομένα πρόγνωσης για αυτή την τοποθεσία." : "Forecast data was unavailable for this location." },
        { status: 502 },
      );
    }

    const targetHour = timeOfDayToTargetHour(selectedTimeOfDay);
    const idx = selectClosestHourIndexOnDate(times, selectedDate, targetHour);
    if (idx < 0) {
      return NextResponse.json(
        { error: language === "el" ? "Δεν βρέθηκε ωριαία πρόγνωση για την επιλεγμένη ημερομηνία." : "No hourly forecast was available for the selected date." },
        { status: 404 },
      );
    }

    const temperature = Number(temps[idx]);
    const rainChance = Number(rains[idx]);
    const wind = Number(winds[idx]);

    if ([temperature, rainChance, wind].some((n) => Number.isNaN(n))) {
      return NextResponse.json(
        { error: language === "el" ? "Η πρόγνωση είναι ελλιπής για την επιλεγμένη ώρα." : "Forecast data was incomplete for the selected time." },
        { status: 502 },
      );
    }

    const feelsLike = feelsLikeArr ? Math.round(Number(feelsLikeArr[idx])) : Math.round(temperature);
    const weatherCode = weatherCodes ? Math.round(Number(weatherCodes[idx])) || 0 : 0;
    const uvIndex = uvs ? Math.round(Number(uvs[idx])) || 0 : 0;
    const visibility = vises ? Math.round(Number(vises[idx])) || 10000 : 10000;

    const weather: Weather = {
      temperature: Math.round(temperature),
      feelsLike: Number.isNaN(feelsLike) ? Math.round(temperature) : feelsLike,
      rainChance: Math.round(rainChance),
      wind: Math.round(wind),
      weatherCode: Number.isNaN(weatherCode) ? 0 : weatherCode,
      uvIndex: Number.isNaN(uvIndex) ? 0 : uvIndex,
      visibility: Number.isNaN(visibility) ? 10000 : visibility,
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
