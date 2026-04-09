import { NextResponse } from "next/server";

type OptionId = "running" | "wear" | "motorbike" | "walk";
type TimeOfDay = "morning" | "noon" | "afternoon" | "evening" | "night";
type Language = "en" | "el";

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
    precipitation_probability?: number[];
    windspeed_10m?: number[];
  };
};

function timeOfDayToTargetHour(timeOfDay: TimeOfDay) {
  if (timeOfDay === "morning") return 8;
  if (timeOfDay === "noon") return 12;
  if (timeOfDay === "afternoon") return 15;
  if (timeOfDay === "evening") return 18;
  return 21;
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

function buildRecommendation(option: OptionId, weather: Weather, language: Language): Recommendation {
  const { temperature, rainChance, wind } = weather;

  if (option === "running") {
    const good = temperature >= 8 && temperature <= 22 && rainChance < 30 && wind < 20;
    return {
      title: good
        ? language === "el"
          ? "Καλή επιλογή για τρέξιμο"
          : "Good for running"
        : language === "el"
          ? "Δεν είναι ιδανικό για τρέξιμο"
          : "Not ideal for running",
      summary: good
        ? language === "el"
          ? "Καλή θερμοκρασία, χαμηλή πιθανότητα βροχής και ήπιος άνεμος."
          : "Comfortable temperature with low rain and manageable wind."
        : language === "el"
          ? "Ίσως χρειαστεί να προσαρμόσεις το πλάνο σου λόγω βροχής ή αέρα."
          : "Consider adjusting your plan based on rain or wind.",
      reasons:
        language === "el"
          ? [
              `Θερμοκρασία: ${temperature}°C (ιδανικά 8–22°C).`,
              `Πιθανότητα βροχής: ${rainChance}% (ιδανικά κάτω από 30%).`,
              `Άνεμος: ${wind} km/h (ιδανικά κάτω από 20 km/h).`,
            ]
          : [
              `Temperature: ${temperature}°C (best between 8–22°C).`,
              `Rain chance: ${rainChance}% (best under 30%).`,
              `Wind: ${wind} km/h (best under 20 km/h).`,
            ],
    };
  }

  if (option === "motorbike") {
    const notIdeal = rainChance > 40 || wind > 25;
    return {
      title: notIdeal
        ? language === "el"
          ? "Δεν προτείνεται για μηχανάκι"
          : "Not ideal for motorbike"
        : language === "el"
          ? "Λογικό για μηχανάκι"
          : "Reasonable for motorbike",
      summary: notIdeal
        ? language === "el"
          ? "Υψηλή πιθανότητα βροχής ή δυνατός άνεμος μειώνουν ασφάλεια και άνεση."
          : "High rain chance or strong wind can reduce safety and comfort."
        : language === "el"
          ? "Οι συνθήκες φαίνονται διαχειρίσιμες—οδήγησε προσεκτικά."
          : "Conditions look manageable—ride safe.",
      reasons:
        language === "el"
          ? [
              `Πιθανότητα βροχής: ${rainChance}% (δεν είναι ιδανικό πάνω από 40%).`,
              `Άνεμος: ${wind} km/h (δεν είναι ιδανικό πάνω από 25 km/h).`,
              `Θερμοκρασία: ${temperature}°C.`,
            ]
          : [
              `Rain chance: ${rainChance}% (not ideal over 40%).`,
              `Wind: ${wind} km/h (not ideal over 25 km/h).`,
              `Temperature: ${temperature}°C.`,
            ],
    };
  }

  if (option === "walk") {
    const good = rainChance < 40 && temperature > 5;
    return {
      title: good
        ? language === "el"
          ? "Καλή επιλογή για βόλτα"
          : "Good for a walk"
        : language === "el"
          ? "Δεν είναι ιδανικό για βόλτα"
          : "Not ideal for a walk",
      summary: good
        ? language === "el"
          ? "Φιλική θερμοκρασία για βόλτα με λογικό ρίσκο βροχής."
          : "Walk-friendly temperatures with a reasonable rain risk."
        : language === "el"
          ? "Ίσως χρειαστεί να μικρύνεις τη βόλτα ή να πάρεις προστασία."
          : "You may want to shorten the walk or bring protection.",
      reasons:
        language === "el"
          ? [
              `Πιθανότητα βροχής: ${rainChance}% (καλό κάτω από 40%).`,
              `Θερμοκρασία: ${temperature}°C (καλό πάνω από 5°C).`,
              `Άνεμος: ${wind} km/h.`,
            ]
          : [
              `Rain chance: ${rainChance}% (good under 40%).`,
              `Temperature: ${temperature}°C (good above 5°C).`,
              `Wind: ${wind} km/h.`,
            ],
    };
  }

  // wear
  const base =
    language === "el"
      ? temperature < 10
        ? "Φόρεσε μπουφάν."
        : temperature <= 20
          ? "Φόρεσε ελαφρύ μπουφάν."
          : "Ένα t-shirt ή ελαφριές στρώσεις είναι ιδανικές."
      : temperature < 10
        ? "Wear a jacket."
        : temperature <= 20
          ? "Wear a light jacket."
          : "A t-shirt or light layers should work.";
  const extras: string[] = [];
  if (rainChance > 40)
    extras.push(language === "el" ? "Πάρε ομπρέλα ή αδιάβροχο." : "Bring an umbrella or a waterproof layer.");
  if (wind > 20)
    extras.push(language === "el" ? "Σκέψου ένα αντιανεμικό εξωτερικό layer." : "Consider a windproof outer layer.");

  return {
    title: language === "el" ? "Τι να φορέσω" : "What to wear",
    summary: [base, ...extras].join(" "),
    reasons:
      language === "el"
        ? [`Θερμοκρασία: ${temperature}°C.`, `Πιθανότητα βροχής: ${rainChance}%.`, `Άνεμος: ${wind} km/h.`]
        : [`Temperature: ${temperature}°C.`, `Rain chance: ${rainChance}%.`, `Wind: ${wind} km/h.`],
  };
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
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(String(lat))}` +
    `&longitude=${encodeURIComponent(String(lon))}` +
    `&hourly=temperature_2m,precipitation_probability,windspeed_10m&windspeed_unit=kmh&timezone=auto`;
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
    if (!selectedTimeOfDay)
      return NextResponse.json(
        { error: language === "el" ? "Διάλεξε ώρα ημέρας." : "Please select time of day." },
        { status: 400 },
      );

    const geo = await geocodeCity(city);
    if (!geo) {
      return NextResponse.json(
        {
          error:
            language === "el"
              ? `Δεν βρήκαμε την πόλη “${city}”. Δοκίμασε μια κοντινή πόλη ή έλεγξε την ορθογραφία.`
              : `We couldn’t find “${city}”. Try a nearby city or double-check the spelling.`,
        },
        { status: 404 },
      );
    }

    const forecast = await fetchHourlyForecast(geo.latitude, geo.longitude);

    const hourly = forecast?.hourly;
    const times: string[] | undefined = hourly?.time;
    const temps: number[] | undefined = hourly?.temperature_2m;
    const rains: number[] | undefined = hourly?.precipitation_probability;
    const winds: number[] | undefined = hourly?.windspeed_10m;

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

    const weather: Weather = {
      temperature: Math.round(temperature),
      rainChance: Math.round(rainChance),
      wind: Math.round(wind),
    };

    const recommendation = buildRecommendation(selectedOption, weather, language);

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

