import { NextResponse } from "next/server";

type OptionId = "running" | "wear" | "motorbike" | "walk";
type TimeOfDay = "morning" | "afternoon" | "evening";

type Weather = {
  temperature: number;
  rainChance: number;
  wind: number;
};

type Recommendation = {
  title: string;
  summary: string;
  reasons: string[];
};

type RecommendResponse = {
  city: string;
  resolvedCity?: string;
  selectedOption: OptionId;
  selectedDate: string;
  selectedTimeOfDay: TimeOfDay;
  recommendation: Recommendation;
  weather: Weather;
};

function timeOfDayToTargetHour(timeOfDay: TimeOfDay) {
  if (timeOfDay === "morning") return 8;
  if (timeOfDay === "afternoon") return 14;
  return 19;
}

function isValidYyyyMmDd(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

function selectClosestHourIndexOnDate(times: string[], date: string, targetHour: number) {
  let bestIdx = -1;
  let bestDiff = Number.POSITIVE_INFINITY;

  for (let i = 0; i < times.length; i++) {
    const t = times[i]; // e.g. "2026-04-07T14:00"
    if (!t.startsWith(`${date}T`)) continue;

    const hourStr = t.slice(11, 13);
    const hour = Number(hourStr);
    if (Number.isNaN(hour)) continue;

    const diff = Math.abs(hour - targetHour);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIdx = i;
    }
  }

  return bestIdx;
}

function buildRecommendation(option: OptionId, weather: Weather): Recommendation {
  const { temperature, rainChance, wind } = weather;

  if (option === "running") {
    const good = temperature >= 8 && temperature <= 22 && rainChance < 30 && wind < 20;
    return {
      title: good ? "Good for running" : "Not ideal for running",
      summary: good
        ? "Comfortable temperature with low rain and manageable wind."
        : "Consider adjusting your plan based on rain or wind.",
      reasons: [
        `Temperature: ${temperature}°C (best between 8–22°C).`,
        `Rain chance: ${rainChance}% (best under 30%).`,
        `Wind: ${wind} km/h (best under 20 km/h).`,
      ],
    };
  }

  if (option === "motorbike") {
    const notIdeal = rainChance > 40 || wind > 25;
    return {
      title: notIdeal ? "Not ideal for motorbike" : "Reasonable for motorbike",
      summary: notIdeal ? "High rain chance or strong wind can reduce safety and comfort." : "Conditions look manageable—ride safe.",
      reasons: [
        `Rain chance: ${rainChance}% (not ideal over 40%).`,
        `Wind: ${wind} km/h (not ideal over 25 km/h).`,
        `Temperature: ${temperature}°C.`,
      ],
    };
  }

  if (option === "walk") {
    const good = rainChance < 40 && temperature > 5;
    return {
      title: good ? "Good for a walk" : "Not ideal for a walk",
      summary: good ? "Walk-friendly temperatures with a reasonable rain risk." : "You may want to shorten the walk or bring protection.",
      reasons: [
        `Rain chance: ${rainChance}% (good under 40%).`,
        `Temperature: ${temperature}°C (good above 5°C).`,
        `Wind: ${wind} km/h.`,
      ],
    };
  }

  // wear
  const base =
    temperature < 10 ? "Wear a jacket." : temperature <= 20 ? "Wear a light jacket." : "A t-shirt or light layers should work.";
  const extras: string[] = [];
  if (rainChance > 40) extras.push("Bring an umbrella or a waterproof layer.");
  if (wind > 20) extras.push("Consider a windproof outer layer.");

  return {
    title: "What to wear",
    summary: [base, ...extras].join(" "),
    reasons: [`Temperature: ${temperature}°C.`, `Rain chance: ${rainChance}%.`, `Wind: ${wind} km/h.`],
  };
}

async function geocodeCity(city: string) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("geocoding_failed");

  const data = (await res.json()) as any;
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
    `&hourly=temperature_2m,precipitation_probability,windspeed_10m&timezone=auto`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("forecast_failed");
  return (await res.json()) as any;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      city?: string;
      selectedOption?: OptionId;
      selectedDate?: string;
      selectedTimeOfDay?: TimeOfDay;
    };

    const city = (body.city ?? "").trim();
    const selectedOption = body.selectedOption;
    const selectedDate = (body.selectedDate ?? "").trim();
    const selectedTimeOfDay = body.selectedTimeOfDay;

    if (!city) return NextResponse.json({ error: "Please enter a city." }, { status: 400 });
    if (!selectedOption) return NextResponse.json({ error: "Please select an option." }, { status: 400 });
    if (!selectedDate || !isValidYyyyMmDd(selectedDate))
      return NextResponse.json({ error: "Please select a date." }, { status: 400 });
    if (!selectedTimeOfDay) return NextResponse.json({ error: "Please select time of day." }, { status: 400 });

    const geo = await geocodeCity(city);
    if (!geo) return NextResponse.json({ error: `Sorry, we couldn't find "${city}". Try a nearby city name.` }, { status: 404 });

    const forecast = await fetchHourlyForecast(geo.latitude, geo.longitude);

    const hourly = forecast?.hourly;
    const times: string[] = hourly?.time;
    const temps: number[] = hourly?.temperature_2m;
    const rains: number[] = hourly?.precipitation_probability;
    const winds: number[] = hourly?.windspeed_10m;

    if (!Array.isArray(times) || !Array.isArray(temps) || !Array.isArray(rains) || !Array.isArray(winds)) {
      return NextResponse.json({ error: "Forecast data was unavailable for this location." }, { status: 502 });
    }

    const targetHour = timeOfDayToTargetHour(selectedTimeOfDay);
    const idx = selectClosestHourIndexOnDate(times, selectedDate, targetHour);
    if (idx < 0) {
      return NextResponse.json({ error: "No hourly forecast was available for the selected date." }, { status: 404 });
    }

    const temperature = Number(temps[idx]);
    const rainChance = Number(rains[idx]);
    const wind = Number(winds[idx]);

    if ([temperature, rainChance, wind].some((n) => Number.isNaN(n))) {
      return NextResponse.json({ error: "Forecast data was incomplete for the selected time." }, { status: 502 });
    }

    const weather: Weather = {
      temperature: Math.round(temperature),
      rainChance: Math.round(rainChance),
      wind: Math.round(wind),
    };

    const recommendation = buildRecommendation(selectedOption, weather);

    const response: RecommendResponse = {
      city,
      resolvedCity: geo.resolvedName || undefined,
      selectedOption,
      selectedDate,
      selectedTimeOfDay,
      recommendation,
      weather,
    };

    return NextResponse.json(response);
  } catch {
    return NextResponse.json(
      { error: "Sorry—something went wrong while generating your recommendation. Please try again." },
      { status: 500 },
    );
  }
}

