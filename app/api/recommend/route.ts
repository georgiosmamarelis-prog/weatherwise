import { NextResponse } from "next/server";

type OptionId = "running" | "wear" | "motorbike" | "walk" | "cycling" | "beach";
type TimeOfDay = "morning" | "noon" | "afternoon" | "evening" | "night";
type Language = "en" | "el";

type Weather = {
  temperature: number;
  feelsLike: number;
  rainChance: number;
  wind: number;
  weatherCode: number;
  uvIndex: number;
  visibility: number;
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
  conditionLabel: string;
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
    apparent_temperature?: number[];
    precipitation_probability?: number[];
    windspeed_10m?: number[];
    weathercode?: number[];
    uv_index?: number[];
    visibility?: number[];
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

function weatherCodeToLabel(code: number, language: Language): string {
  const el = language === "el";
  if (code === 0) return el ? "Αίθριος" : "Clear sky";
  if (code <= 3) return el ? "Αραιή νέφωση" : "Partly cloudy";
  if (code <= 48) return el ? "Ομίχλη" : "Foggy";
  if (code <= 67) return el ? "Βροχή" : "Rain";
  if (code <= 77) return el ? "Χιόνι" : "Snow";
  if (code <= 82) return el ? "Ντουζ" : "Showers";
  if (code <= 99) return el ? "Καταιγίδα" : "Thunderstorm";
  return el ? "Μεταβλητός" : "Mixed";
}

function buildRecommendation(option: OptionId, weather: Weather, language: Language): Recommendation {
  const { temperature, feelsLike, rainChance, wind, weatherCode, uvIndex, visibility } = weather;
  const isThunderstorm = weatherCode >= 95;
  const el = language === "el";

  if (option === "running") {
    const ideal = temperature >= 8 && temperature <= 22 && rainChance < 30 && wind < 20 && !isThunderstorm;
    const manageable = !isThunderstorm && rainChance < 50 && wind < 30 && temperature >= 5 && temperature <= 26;

    const title = ideal
      ? el ? "Ιδανικό για τρέξιμο" : "Ideal for running"
      : manageable
        ? el ? "Διαχειρίσιμο για τρέξιμο" : "Manageable for running"
        : el ? "Αποφύγε το τρέξιμο σήμερα" : "Skip the run today";

    const baseSummary = ideal
      ? el ? "Καλή θερμοκρασία, χαμηλή βροχή και ήπιος άνεμος." : "Good temperature, low rain, and light wind."
      : manageable
        ? el ? "Οι συνθήκες είναι διαχειρίσιμες — ετοιμάσου κατάλληλα." : "Conditions are workable — prepare accordingly."
        : el ? "Σκέψου προπόνηση σε κλειστό χώρο ή αναβολή." : "Consider an indoor workout or reschedule.";

    const extras: string[] = [];
    if (feelsLike < 5) extras.push(el ? "Αισθάνεται πολύ πιο κρύα — φόρεσε επιπλέον στρώσεις." : "Feels much colder — dress in extra layers.");
    if (uvIndex >= 6) extras.push(el ? "Υψηλός UV — άλειψε αντηλιακό." : "High UV — wear sunscreen.");
    if (isThunderstorm) extras.push(el ? "Καταιγίδα — αποφύγε την έξοδο." : "Thunderstorm — avoid going out.");

    return {
      title,
      summary: [baseSummary, ...extras].join(" "),
      reasons: el
        ? [
            `Θερμοκρασία: ${temperature}°C (αίσθηση: ${feelsLike}°C, ιδανικά 8–22°C).`,
            `Πιθανότητα βροχής: ${rainChance}% (ιδανικά κάτω από 30%).`,
            `Άνεμος: ${wind} km/h (ιδανικά κάτω από 20 km/h).`,
            ...(uvIndex > 0 ? [`UV index: ${uvIndex}.`] : []),
          ]
        : [
            `Temperature: ${temperature}°C (feels like ${feelsLike}°C, best between 8–22°C).`,
            `Rain chance: ${rainChance}% (best under 30%).`,
            `Wind: ${wind} km/h (best under 20 km/h).`,
            ...(uvIndex > 0 ? [`UV index: ${uvIndex}.`] : []),
          ],
    };
  }

  if (option === "motorbike") {
    const dangerous = isThunderstorm || wind > 40 || visibility < 500;
    const notIdeal = rainChance > 40 || wind > 25 || visibility < 1000;

    const title = dangerous
      ? el ? "Επικίνδυνο για μηχανάκι" : "Dangerous for motorbike"
      : notIdeal
        ? el ? "Δεν προτείνεται για μηχανάκι" : "Not recommended for motorbike"
        : el ? "Λογικό για μηχανάκι" : "Reasonable for motorbike";

    const baseSummary = dangerous
      ? el ? "Συνθήκες επικίνδυνες για οδήγηση μηχανής." : "Conditions are dangerous for riding."
      : notIdeal
        ? el ? "Υψηλή πιθανότητα βροχής ή δυνατός αέρας — μειωμένη ασφάλεια." : "High rain or strong wind reduces safety and comfort."
        : el ? "Οι συνθήκες φαίνονται διαχειρίσιμες — οδήγησε προσεκτικά." : "Conditions look manageable — ride safe.";

    const extras: string[] = [];
    if (isThunderstorm) extras.push(el ? "Καταιγίδα — μην βγεις με μηχανάκι." : "Thunderstorm — do not ride.");
    if (visibility < 1000 && !isThunderstorm) extras.push(el ? "Μειωμένη ορατότητα — επιπλέον προσοχή." : "Reduced visibility — extra caution.");
    if (wind > 40) extras.push(el ? "Επικίνδυνοι πλευρικοί άνεμοι — αναβολή αν είναι εφικτό." : "Dangerous crosswinds — postpone if possible.");
    if (temperature < 5) extras.push(el ? "Θερμαινόμενα γάντια / θερμικά αξεσουάρ συνιστώνται." : "Heated grips or thermal gloves recommended.");

    return {
      title,
      summary: [baseSummary, ...extras].join(" "),
      reasons: el
        ? [
            `Πιθανότητα βροχής: ${rainChance}% (δεν είναι ιδανικό πάνω από 40%).`,
            `Άνεμος: ${wind} km/h (δεν είναι ιδανικό πάνω από 25 km/h).`,
            `Ορατότητα: ${visibility >= 1000 ? `${(visibility / 1000).toFixed(1)} km` : `${visibility} m`}.`,
            `Θερμοκρασία: ${temperature}°C.`,
          ]
        : [
            `Rain chance: ${rainChance}% (not ideal over 40%).`,
            `Wind: ${wind} km/h (not ideal over 25 km/h).`,
            `Visibility: ${visibility >= 1000 ? `${(visibility / 1000).toFixed(1)} km` : `${visibility} m`}.`,
            `Temperature: ${temperature}°C.`,
          ],
    };
  }

  if (option === "walk") {
    const good = rainChance < 40 && temperature > 5 && !isThunderstorm;

    const baseSummary = good
      ? el
        ? `Φιλική θερμοκρασία (αίσθηση: ${feelsLike}°C) με λογικό ρίσκο βροχής.`
        : `Walk-friendly temperature (feels like ${feelsLike}°C) with manageable rain risk.`
      : el
        ? `Αίσθηση ${feelsLike}°C — σκέψου να μικρύνεις τη βόλτα ή πάρε προστασία.`
        : `Feels like ${feelsLike}°C — consider a shorter walk or bring protection.`;

    const extras: string[] = [];
    if (rainChance >= 20 && rainChance < 40) extras.push(el ? "Μικρή πιθανότητα βροχής — μια μικρή ομπρέλα αρκεί." : "Light chance of rain — a small umbrella is enough.");
    if (rainChance >= 40) extras.push(el ? "Πάρε ομπρέλα ή αδιάβροχο." : "Bring an umbrella or waterproof layer.");
    if (uvIndex >= 6) extras.push(el ? "Υψηλός UV — άλειψε αντηλιακό." : "High UV — apply sunscreen.");
    if (isThunderstorm) extras.push(el ? "Καταιγίδα — απόφυγε την έξοδο." : "Thunderstorm — avoid going out.");

    return {
      title: good
        ? el ? "Καλή επιλογή για βόλτα" : "Good for a walk"
        : el ? "Δεν είναι ιδανικό για βόλτα" : "Not ideal for a walk",
      summary: [baseSummary, ...extras].join(" "),
      reasons: el
        ? [
            `Θερμοκρασία: ${temperature}°C (αίσθηση: ${feelsLike}°C).`,
            `Πιθανότητα βροχής: ${rainChance}% (καλό κάτω από 40%).`,
            `Άνεμος: ${wind} km/h.`,
            ...(uvIndex > 0 ? [`UV index: ${uvIndex}.`] : []),
          ]
        : [
            `Temperature: ${temperature}°C (feels like ${feelsLike}°C).`,
            `Rain chance: ${rainChance}% (good under 40%).`,
            `Wind: ${wind} km/h.`,
            ...(uvIndex > 0 ? [`UV index: ${uvIndex}.`] : []),
          ],
    };
  }

  if (option === "cycling") {
    const ideal = temperature >= 10 && temperature <= 25 && feelsLike > 8 && rainChance < 25 && wind < 25 && !isThunderstorm;
    const manageable = !isThunderstorm && rainChance < 45 && wind < 35 && temperature >= 8;

    const title = ideal
      ? el ? "Ιδανικό για ποδηλασία" : "Ideal for cycling"
      : manageable
        ? el ? "Διαχειρίσιμο για ποδηλασία" : "Manageable for cycling"
        : el ? "Δύσκολες συνθήκες για ποδήλατο" : "Tough conditions for cycling";

    const baseSummary = ideal
      ? el ? "Εξαιρετικές συνθήκες για ποδήλατο." : "Excellent conditions for a bike ride."
      : manageable
        ? el ? "Αποδεκτές συνθήκες — ετοιμάσου κατάλληλα." : "Acceptable conditions — gear up accordingly."
        : el ? "Δύσκολες συνθήκες — σκέψου αναβολή ή εναλλακτική." : "Tough conditions — consider rescheduling.";

    const extras: string[] = [];
    if (wind >= 25) extras.push(el ? "Δυνατός άνεμος — προσοχή σε ανοιχτές διαδρομές." : "Strong wind — caution on open routes.");
    if (rainChance >= 25) extras.push(el ? "Πιθανή βροχή — κατάλληλη εξάρτηση." : "Possible rain — gear up accordingly.");
    if (uvIndex >= 6) extras.push(el ? "Υψηλός UV — αντηλιακό για μεγάλες διαδρομές." : "High UV — sunscreen for longer rides.");
    if (isThunderstorm) extras.push(el ? "Καταιγίδα — αποφύγε την έξοδο." : "Thunderstorm — avoid cycling.");
    if (feelsLike < 8) extras.push(el ? "Αισθάνεται κρύο — φόρεσε θερμά γάντια." : "Feels cold — wear thermal gloves.");

    return {
      title,
      summary: [baseSummary, ...extras].join(" "),
      reasons: el
        ? [
            `Θερμοκρασία: ${temperature}°C (αίσθηση: ${feelsLike}°C).`,
            `Πιθανότητα βροχής: ${rainChance}% (ιδανικά κάτω από 25%).`,
            `Άνεμος: ${wind} km/h (σημαντικός παράγοντας για ποδήλατο).`,
            ...(uvIndex > 0 ? [`UV index: ${uvIndex}.`] : []),
          ]
        : [
            `Temperature: ${temperature}°C (feels like ${feelsLike}°C).`,
            `Rain chance: ${rainChance}% (best under 25%).`,
            `Wind: ${wind} km/h (key factor for cycling).`,
            ...(uvIndex > 0 ? [`UV index: ${uvIndex}.`] : []),
          ],
    };
  }

  if (option === "beach") {
    const great = temperature > 24 && rainChance < 20 && wind < 20 && weatherCode <= 3;
    const okay = temperature >= 20 && rainChance < 30 && wind < 30 && !isThunderstorm;

    const title = great
      ? el ? "Εξαιρετικό για παραλία" : "Great beach day"
      : okay
        ? el ? "Εντάξει για παραλία" : "Decent beach day"
        : el ? "Δεν είναι ιδανικό για παραλία" : "Not ideal for the beach";

    const baseSummary = great
      ? el ? "Ζεστός ήλιος, ήπιος αέρας — ιδανικό για παραλία." : "Warm sun and light breeze — perfect beach weather."
      : okay
        ? el ? "Αξιοπρεπείς συνθήκες για παραλία — έλεγξε τα επιμέρους δεδομένα." : "Decent beach conditions — check the details below."
        : el ? "Οι συνθήκες δεν είναι φιλικές για παραλία σήμερα." : "Conditions are not beach-friendly today.";

    const extras: string[] = [];
    if (uvIndex > 0) extras.push(el ? `UV index: ${uvIndex} — αντηλιακό απαραίτητο.` : `UV index: ${uvIndex} — sunscreen essential.`);
    if (wind >= 25) extras.push(el ? "Δυνατός αέρας — άμμος και σταγόνες νερού στον αέρα." : "Strong breeze — sand and spray in the air.");
    if (rainChance >= 20) extras.push(el ? "Πιθανή βροχή — έχε πλάνο Β." : "Possible rain — have a backup plan.");
    if (isThunderstorm) extras.push(el ? "Καταιγίδα — αποφύγε την παραλία." : "Thunderstorm — avoid the beach.");

    return {
      title,
      summary: [baseSummary, ...extras].join(" "),
      reasons: el
        ? [
            `Θερμοκρασία: ${temperature}°C (αίσθηση: ${feelsLike}°C, ιδανικά πάνω από 24°C).`,
            `Πιθανότητα βροχής: ${rainChance}% (ιδανικά κάτω από 20%).`,
            `Άνεμος: ${wind} km/h (ιδανικά κάτω από 20 km/h).`,
            `UV index: ${uvIndex}.`,
          ]
        : [
            `Temperature: ${temperature}°C (feels like ${feelsLike}°C, best above 24°C).`,
            `Rain chance: ${rainChance}% (best under 20%).`,
            `Wind: ${wind} km/h (best under 20 km/h).`,
            `UV index: ${uvIndex}.`,
          ],
    };
  }

  // wear — uses feelsLike as primary driver
  const effectiveTemp = feelsLike;
  const base =
    el
      ? effectiveTemp < 5
        ? "Βαρύ μπουφάν + θερμικό εσώρουχο."
        : effectiveTemp < 15
          ? "Μπουφάν + ενδιάμεσο layer."
          : effectiveTemp < 22
            ? "Ελαφρύ μπουφάν ή μακρυμάνικο."
            : "T-shirt ή ελαφριές στρώσεις."
      : effectiveTemp < 5
        ? "Heavy coat + thermal base layer."
        : effectiveTemp < 15
          ? "Jacket + mid layer."
          : effectiveTemp < 22
            ? "Light jacket or long sleeves."
            : "T-shirt or light layers.";

  const extras: string[] = [];
  if (rainChance >= 10 && rainChance < 40)
    extras.push(el ? "Πάρε μια μικρή ομπρέλα." : "Pack a compact umbrella.");
  if (rainChance >= 40)
    extras.push(el ? "Αδιάβροχο μπουφάν ή ομπρέλα." : "Waterproof jacket or umbrella.");
  if (wind > 20)
    extras.push(el ? "Σκέψου ένα αντιανεμικό εξωτερικό layer." : "Consider a windproof outer layer.");
  if (uvIndex >= 6)
    extras.push(el ? "Υψηλός UV — άλειψε αντηλιακό." : "High UV — apply sunscreen.");

  return {
    title: el ? "Τι να φορέσω" : "What to wear",
    summary: [base, ...extras].join(" "),
    reasons: el
      ? [
          `Αίσθηση θερμοκρασίας: ${feelsLike}°C (θερμοκρασία αέρα: ${temperature}°C).`,
          `Πιθανότητα βροχής: ${rainChance}%.`,
          `Άνεμος: ${wind} km/h.`,
          ...(uvIndex > 0 ? [`UV index: ${uvIndex}.`] : []),
        ]
      : [
          `Feels like: ${feelsLike}°C (air temperature: ${temperature}°C).`,
          `Rain chance: ${rainChance}%.`,
          `Wind: ${wind} km/h.`,
          ...(uvIndex > 0 ? [`UV index: ${uvIndex}.`] : []),
        ],
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

    const geo = await geocodeCity(city);
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
