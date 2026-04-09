"use client";

import { track } from "@vercel/analytics";
import { useEffect, useMemo, useRef, useState } from "react";

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
  selectedDate: string; // yyyy-mm-dd
  selectedTimeOfDay: TimeOfDay;
  recommendation: Recommendation;
  weather: Weather;
  conditionLabel: string;
};

type FieldErrors = {
  city?: string;
  option?: string;
  date?: string;
  timeOfDay?: string;
};

type CitySuggestion = {
  name: string;
  country: string;
  admin1?: string;
  latitude: number;
  longitude: number;
};

const SCENARIO_EMOJI: Record<OptionId, string> = {
  running: "🏃",
  wear: "👕",
  motorbike: "🛵",
  walk: "🚶",
  cycling: "🚴",
  beach: "🏖️",
};

const translations = {
  en: {
    header: { brand: "WeatherWise", tagline: "Make the call. Dress right.", langEN: "EN", langEL: "EL" },
    hero: {
      title: "WeatherWise",
      subtitle: "Weather advice for real-life decisions",
      description: "Get quick weather-based recommendations for running, cycling, the beach, clothing, and more.",
    },
    inputs: {
      cityLabel: "City",
      cityPlaceholder: "e.g. Athens",
      suggestionsLoading: "Searching…",
      noSuggestions: "No cities found.",
      dateLabel: "Date",
      selectedDate: "Selected:",
      quickToday: "Today",
      quickTomorrow: "Tomorrow",
      timeOfDayLabel: "Time of day",
    },
    quickStartLabel: "Try an example:",
    timeOfDay: { morning: "Morning", noon: "Noon", afternoon: "Afternoon", evening: "Evening", night: "Night" },
    scenarios: {
      running: { title: "Running", description: "Pace, layers, and rain/wind tips." },
      wear: { title: "What to wear", description: "Outfit suggestions for the day ahead." },
      motorbike: { title: "Motorbike", description: "Visibility, grip, and comfort guidance." },
      walk: { title: "Walk", description: "Umbrella and route-friendly advice." },
      cycling: { title: "Cycling", description: "Wind, grip, and comfort for your ride." },
      beach: { title: "Beach / Outdoors", description: "Sun, wind, and UV for your outdoor plans." },
    },
    actions: { getRecommendation: "Get recommendation", loading: "Getting your recommendation…" },
    validation: {
      city: "Please enter a city.",
      option: "Please select an option.",
      date: "Please select a date.",
      timeOfDay: "Please select time of day.",
    },
    result: {
      title: "Result",
      loading: "We're checking the forecast and preparing your recommendation.",
      ready: "Here's your weather-based recommendation.",
      emptyLead: "No recommendation yet",
      emptyBody: "Add a city, pick what you're planning to do, choose a day and time, then tap Get recommendation.",
      weather: "Weather snapshot",
      basedOnSelectedTime: "Based on your selected time",
      temp: "Temp",
      feelsLike: "Feels like",
      rain: "Rain",
      wind: "Wind",
    },
    verdict: {
      good: "Good choice",
      okay: "Okay, but be prepared",
      not: "Not recommended",
      riskLow: "Low risk",
      riskModerate: "Moderate risk",
      riskHigh: "High risk",
    },
    feedback: {
      question: "Was this recommendation useful?",
      yes: "Yes",
      no: "No",
      thanks: "Thanks for your feedback!",
      share: "Share",
      copied: "Copied!",
      whyNot: "What went wrong?",
      reasonWrongForecast: "Forecast seems wrong",
      reasonNotHelpful: "Advice wasn't helpful",
      reasonMissingScenario: "Missing my scenario",
    },
    errors: {
      network: "Network error. Please check your connection and try again.",
      generic: "Something went wrong while fetching the forecast. Please try again.",
    },
    disclaimer: "Forecast data provided by Open-Meteo. Recommendations are informational only.",
  },
  el: {
    header: { brand: "WeatherWise", tagline: "Πάρε απόφαση. Ντύσου σωστά.", langEN: "EN", langEL: "EL" },
    hero: {
      title: "WeatherWise",
      subtitle: "Συμβουλές καιρού για πραγματικές αποφάσεις",
      description: "Πάρε γρήγορες προτάσεις με βάση τον καιρό για τρέξιμο, ποδήλατο, παραλία, ντύσιμο και άλλα.",
    },
    inputs: {
      cityLabel: "Πόλη",
      cityPlaceholder: "π.χ. Αθήνα",
      suggestionsLoading: "Αναζήτηση…",
      noSuggestions: "Δεν βρέθηκαν πόλεις.",
      dateLabel: "Ημερομηνία",
      selectedDate: "Επιλεγμένη:",
      quickToday: "Σήμερα",
      quickTomorrow: "Αύριο",
      timeOfDayLabel: "Ώρα ημέρας",
    },
    quickStartLabel: "Δοκίμασε ένα παράδειγμα:",
    timeOfDay: { morning: "Πρωί", noon: "Μεσημέρι", afternoon: "Απόγευμα", evening: "Βράδυ", night: "Νύχτα" },
    scenarios: {
      running: { title: "Τρέξιμο", description: "Ρυθμός, ρούχα και συμβουλές για βροχή/αέρα." },
      wear: { title: "Τι να φορέσω", description: "Προτάσεις ντυσίματος για την ημέρα." },
      motorbike: { title: "Μηχανάκι", description: "Ορατότητα, πρόσφυση και άνεση στη διαδρομή." },
      walk: { title: "Βόλτα", description: "Ομπρέλα και συμβουλές για πιο άνετη βόλτα." },
      cycling: { title: "Ποδήλατο", description: "Άνεμος, πρόσφυση και άνεση για τη βόλτα σου." },
      beach: { title: "Παραλία / Εξωτερικός χώρος", description: "Ήλιος, άνεμος και UV για τις εξωτερικές δραστηριότητές σου." },
    },
    actions: { getRecommendation: "Πάρε πρόταση", loading: "Υπολογίζουμε την πρόταση…" },
    validation: {
      city: "Γράψε μια πόλη.",
      option: "Διάλεξε μια επιλογή.",
      date: "Διάλεξε ημερομηνία.",
      timeOfDay: "Διάλεξε ώρα ημέρας.",
    },
    result: {
      title: "Αποτέλεσμα",
      loading: "Ελέγχουμε την πρόγνωση και ετοιμάζουμε την πρότασή σου.",
      ready: "Έτοιμη η πρότασή σου με βάση τον καιρό.",
      emptyLead: "Δεν υπάρχει πρόταση ακόμα",
      emptyBody: "Βάλε πόλη, διάλεξε τι θες να κάνεις, επέλεξε ημερομηνία και ώρα ημέρας και πάτησε Πάρε πρόταση.",
      weather: "Στιγμιότυπο καιρού",
      basedOnSelectedTime: "Με βάση την επιλεγμένη ώρα",
      temp: "Θερμ.",
      feelsLike: "Αίσθηση",
      rain: "Βροχή",
      wind: "Άνεμος",
    },
    verdict: {
      good: "Καλή επιλογή",
      okay: "ΟΚ, αλλά προετοιμάσου",
      not: "Δεν προτείνεται",
      riskLow: "Χαμηλό ρίσκο",
      riskModerate: "Μέτριο ρίσκο",
      riskHigh: "Υψηλό ρίσκο",
    },
    feedback: {
      question: "Σου ήταν χρήσιμη η πρόταση;",
      yes: "Ναι",
      no: "Όχι",
      thanks: "Ευχαριστούμε για το feedback!",
      share: "Μοιράσου",
      copied: "Αντιγράφηκε!",
      whyNot: "Τι πήγε στραβά;",
      reasonWrongForecast: "Η πρόγνωση φαίνεται λανθασμένη",
      reasonNotHelpful: "Η συμβουλή δεν ήταν χρήσιμη",
      reasonMissingScenario: "Λείπει η δραστηριότητά μου",
    },
    errors: {
      network: "Σφάλμα δικτύου. Έλεγξε τη σύνδεσή σου και δοκίμασε ξανά.",
      generic: "Κάτι πήγε στραβά με την πρόγνωση. Δοκίμασε ξανά.",
    },
    disclaimer: "Δεδομένα πρόγνωσης από Open-Meteo. Οι προτάσεις είναι μόνο ενημερωτικές.",
  },
} satisfies Record<Language, any>;

function formatDateForDisplay(yyyyMmDd: string) {
  const parts = yyyyMmDd.split("-").map((p) => Number(p));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return yyyyMmDd;
  const [yyyy, mm, dd] = parts;
  const pad2 = (n: number) => String(n).padStart(2, "0");
  return `${pad2(dd)}/${pad2(mm)}/${String(yyyy)}`;
}

function formatDateForInput(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getTodayYyyyMmDd() {
  return formatDateForInput(new Date());
}

function getTomorrowYyyyMmDd() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return formatDateForInput(d);
}

function getMaxDateYyyyMmDd() {
  const d = new Date();
  d.setDate(d.getDate() + 16);
  return formatDateForInput(d);
}

function getWeatherEmoji(temperature: number, rainChance: number, wind: number, weatherCode: number): string {
  if (weatherCode >= 95) return "⛈️";
  if (weatherCode >= 71 && weatherCode <= 77) return "🌨️";
  if (rainChance >= 60) return "🌧️";
  if (rainChance >= 30) return "🌦️";
  if (wind >= 30) return "💨";
  if (temperature >= 28) return "☀️";
  if (temperature <= 0) return "🥶";
  return "⛅";
}

type VerdictKind = "good" | "okay" | "not";

function getVerdictAndRisk(option: OptionId, weather: Weather) {
  const { temperature, feelsLike, rainChance, wind, weatherCode } = weather;
  const isThunderstorm = weatherCode >= 95;
  let verdict: VerdictKind;

  if (option === "running") {
    const good = temperature >= 8 && temperature <= 22 && rainChance < 30 && wind < 20 && !isThunderstorm;
    if (good) verdict = "good";
    else if (!isThunderstorm && rainChance < 50 && wind < 30 && temperature >= 5 && temperature <= 26) verdict = "okay";
    else verdict = "not";
  } else if (option === "motorbike") {
    const dangerous = isThunderstorm || wind > 40 || weather.visibility < 500;
    const notIdeal = rainChance > 40 || wind > 25 || weather.visibility < 1000;
    if (dangerous || notIdeal) verdict = "not";
    else if (rainChance > 25 || wind > 15) verdict = "okay";
    else verdict = "good";
  } else if (option === "walk") {
    const good = rainChance < 40 && temperature > 5 && !isThunderstorm;
    if (good) verdict = "good";
    else if (!isThunderstorm && rainChance < 55 && temperature > 0) verdict = "okay";
    else verdict = "not";
  } else if (option === "cycling") {
    const ideal = temperature >= 10 && temperature <= 25 && feelsLike > 8 && rainChance < 25 && wind < 25 && !isThunderstorm;
    const manageable = !isThunderstorm && rainChance < 45 && wind < 35 && temperature >= 8;
    if (ideal) verdict = "good";
    else if (manageable) verdict = "okay";
    else verdict = "not";
  } else if (option === "beach") {
    const great = temperature > 24 && rainChance < 20 && wind < 20 && weatherCode <= 3;
    const okay = temperature >= 20 && rainChance < 30 && wind < 30 && !isThunderstorm;
    if (great) verdict = "good";
    else if (okay) verdict = "okay";
    else verdict = "not";
  } else {
    // wear
    const tooWetOrWindy = rainChance > 70 || wind > 35;
    const moderate = rainChance > 40 || wind > 20;
    if (tooWetOrWindy) verdict = "not";
    else if (moderate) verdict = "okay";
    else verdict = "good";
  }

  const badgeClasses =
    verdict === "good"
      ? "border-emerald-400 bg-emerald-50 text-emerald-900"
      : verdict === "okay"
        ? "border-amber-400 bg-amber-50 text-amber-900"
        : "border-rose-400 bg-rose-50 text-rose-900";

  const riskClasses =
    verdict === "good"
      ? "text-emerald-800 bg-emerald-50 border-emerald-200"
      : verdict === "okay"
        ? "text-amber-800 bg-amber-50 border-amber-200"
        : "text-rose-800 bg-rose-50 border-rose-200";

  return { verdict, badgeClasses, riskClasses };
}

export default function Home() {
  const [language, setLanguage] = useState<Language>("el");
  const [city, setCity] = useState("");
  const [selectedOption, setSelectedOption] = useState<OptionId | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTimeOfDay, setSelectedTimeOfDay] = useState<TimeOfDay | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RecommendResponse | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<"yes" | "no" | null>(null);
  const [feedbackReason, setFeedbackReason] = useState<string | null>(null);
  const [shareState, setShareState] = useState<"idle" | "copied">("idle");
  const [slowLoading, setSlowLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const resultRef = useRef<HTMLElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const suggestDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestAbortRef = useRef<AbortController | null>(null);
  const cityWrapperRef = useRef<HTMLDivElement | null>(null);

  const t = translations[language];

  // Restore language + last city/option from localStorage on mount
  useEffect(() => {
    try {
      const savedLang = localStorage.getItem("weatherwise_language");
      if (savedLang === "en" || savedLang === "el") setLanguage(savedLang);

      const savedLast = localStorage.getItem("weatherwise_last");
      if (savedLast) {
        const { city: savedCity, selectedOption: savedOption } = JSON.parse(savedLast) as {
          city?: string;
          selectedOption?: string;
        };
        if (typeof savedCity === "string" && savedCity) setCity(savedCity);
        const validOptions: OptionId[] = ["running", "wear", "motorbike", "walk", "cycling", "beach"];
        if (savedOption && validOptions.includes(savedOption as OptionId)) {
          setSelectedOption(savedOption as OptionId);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("weatherwise_language", language);
    } catch {
      // ignore
    }
  }, [language]);

  useEffect(() => {
    if (!loading) {
      setSlowLoading(false);
      return;
    }
    const timer = setTimeout(() => setSlowLoading(true), 10000);
    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);
    if (city.trim().length < 2) {
      setSuggestions([]);
      setDropdownOpen(false);
      setSuggestionsLoading(false);
      return;
    }
    suggestDebounceRef.current = setTimeout(async () => {
      suggestAbortRef.current?.abort();
      const controller = new AbortController();
      suggestAbortRef.current = controller;
      setSuggestionsLoading(true);
      try {
        const res = await fetch(`/api/city-search?q=${encodeURIComponent(city.trim())}`, {
          signal: controller.signal,
        });
        const data = (await res.json()) as CitySuggestion[];
        setSuggestions(data);
        setDropdownOpen(true);
        setHighlightedIndex(-1);
      } catch {
        // aborted or network error — silently ignore
      } finally {
        setSuggestionsLoading(false);
      }
    }, 300);
    return () => {
      if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);
    };
  }, [city]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (cityWrapperRef.current && !cityWrapperRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const scenarioOptions = useMemo(
    () =>
      ([
        { id: "running", ...t.scenarios.running },
        { id: "wear", ...t.scenarios.wear },
        { id: "motorbike", ...t.scenarios.motorbike },
        { id: "walk", ...t.scenarios.walk },
        { id: "cycling", ...t.scenarios.cycling },
        { id: "beach", ...t.scenarios.beach },
      ] satisfies Array<{ id: OptionId; title: string; description: string }>),
    [t],
  );

  const quickStartExamples = useMemo(
    () => [
      {
        label: language === "el" ? "🏃 Τρέξιμο · Αθήνα" : "🏃 Running · Athens",
        city: language === "el" ? "Αθήνα" : "Athens",
        option: "running" as OptionId,
        timeOfDay: "morning" as TimeOfDay,
      },
      {
        label: language === "el" ? "👕 Ντύσιμο · Θεσσαλονίκη" : "👕 What to wear · Thessaloniki",
        city: language === "el" ? "Θεσσαλονίκη" : "Thessaloniki",
        option: "wear" as OptionId,
        timeOfDay: "noon" as TimeOfDay,
      },
      {
        label: language === "el" ? "🏖️ Παραλία · Ηράκλειο" : "🏖️ Beach · Heraklion",
        city: language === "el" ? "Ηράκλειο" : "Heraklion",
        option: "beach" as OptionId,
        timeOfDay: "afternoon" as TimeOfDay,
      },
    ],
    [language],
  );

  const selectedLabel = useMemo(
    () => (selectedOption ? scenarioOptions.find((o) => o.id === selectedOption)?.title ?? "" : ""),
    [selectedOption, scenarioOptions],
  );

  function scrollToResultSoon() {
    requestAnimationFrame(() => {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function onSelectSuggestion(s: CitySuggestion) {
    setCity(s.name);
    setSuggestions([]);
    setDropdownOpen(false);
    setHighlightedIndex(-1);
    if (fieldErrors.city) setFieldErrors((prev) => ({ ...prev, city: undefined }));
  }

  async function onShare(res: RecommendResponse) {
    const text = `${res.recommendation.title} — ${res.resolvedCity ?? res.city}, ${formatDateForDisplay(res.selectedDate)} (${t.timeOfDay[res.selectedTimeOfDay]}). ${res.recommendation.summary}`;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: "WeatherWise", text, url: window.location.href });
      } else {
        await navigator.clipboard.writeText(text);
        setShareState("copied");
        setTimeout(() => setShareState("idle"), 2000);
      }
    } catch {
      // user cancelled or clipboard unavailable
    }
  }

  async function onGenerate() {
    const cityValue = city.trim();

    const nextErrors: FieldErrors = {};
    if (!cityValue) nextErrors.city = t.validation.city;
    if (!selectedOption) nextErrors.option = t.validation.option;
    if (!selectedDate.trim()) nextErrors.date = t.validation.date;
    if (!selectedTimeOfDay) nextErrors.timeOfDay = t.validation.timeOfDay;

    setFieldErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setResult(null);
      setApiError(null);
      return;
    }

    const option = selectedOption;
    const timeOfDay = selectedTimeOfDay;
    if (!option || !timeOfDay) {
      setResult(null);
      setApiError(null);
      return;
    }

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setResult(null);
    setFeedback(null);
    setFeedbackReason(null);
    setShareState("idle");
    setApiError(null);

    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          language,
          city: cityValue,
          selectedOption: option,
          selectedDate: selectedDate.trim(),
          selectedTimeOfDay: timeOfDay,
        }),
        signal: controller.signal,
      });

      const data = (await res.json()) as unknown;

      if (!res.ok) {
        const message =
          typeof data === "object" && data && "error" in data && typeof (data as any).error === "string"
            ? (data as any).error
            : t.errors.generic;
        setApiError(message);
        setLoading(false);
        scrollToResultSoon();
        return;
      }

      const resultData = data as RecommendResponse;
      setResult(resultData);
      try {
        localStorage.setItem("weatherwise_last", JSON.stringify({ city: cityValue, selectedOption: option }));
      } catch {
        // ignore
      }
      track("recommendation_generated", { option, timeOfDay });
      setLoading(false);
      scrollToResultSoon();
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setApiError(t.errors.network);
      setLoading(false);
      scrollToResultSoon();
    }
  }

  return (
    <main className="min-h-screen bg-white text-zinc-900">
      <div className="relative isolate overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-24 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-gradient-to-tr from-sky-200 via-blue-200 to-emerald-200 blur-3xl opacity-80" />
          <div className="absolute -bottom-24 right-[-120px] h-[420px] w-[420px] rounded-full bg-gradient-to-tr from-indigo-200 via-fuchsia-200 to-rose-200 blur-3xl opacity-60" />
        </div>

        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
          <header className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div
                className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-sm"
                role="img"
                aria-label="WeatherWise logo"
              >
                <span className="text-sm font-semibold">WW</span>
              </div>
              <span className="text-sm font-semibold tracking-tight">{t.header.brand}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden text-sm text-zinc-500 sm:block">{t.header.tagline}</div>
              <div
                role="group"
                aria-label="Language selection"
                className="inline-flex rounded-full border border-zinc-200 bg-white/70 p-1 shadow-sm backdrop-blur"
              >
                <button
                  type="button"
                  onClick={() => setLanguage("en")}
                  className={[
                    "inline-flex h-8 items-center justify-center rounded-full px-3 text-xs font-semibold transition-colors",
                    language === "en" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100",
                  ].join(" ")}
                  aria-pressed={language === "en"}
                  aria-label="English"
                >
                  {t.header.langEN}
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage("el")}
                  className={[
                    "inline-flex h-8 items-center justify-center rounded-full px-3 text-xs font-semibold transition-colors",
                    language === "el" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100",
                  ].join(" ")}
                  aria-pressed={language === "el"}
                  aria-label="Ελληνικά"
                >
                  {t.header.langEL}
                </button>
              </div>
            </div>
          </header>

          <section className="mt-12">
            <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl">{t.hero.title}</h1>
            <p className="mt-3 text-lg font-medium text-zinc-700">{t.hero.subtitle}</p>
            <p className="mt-4 text-base leading-7 text-zinc-600">{t.hero.description}</p>

            {/* Quick-start strip */}
            <div className="mt-5">
              <p className="text-xs font-medium text-zinc-500">{t.quickStartLabel}</p>
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                {quickStartExamples.map((ex) => (
                  <button
                    key={ex.label}
                    type="button"
                    onClick={() => {
                      setCity(ex.city);
                      setSelectedOption(ex.option);
                      setSelectedDate(getTodayYyyyMmDd());
                      setSelectedTimeOfDay(ex.timeOfDay);
                      setFieldErrors({});
                    }}
                    className="inline-flex h-9 shrink-0 items-center justify-center rounded-full border border-sky-200 bg-sky-50 px-4 text-xs font-semibold text-sky-800 transition-colors hover:bg-sky-100 whitespace-nowrap"
                  >
                    {ex.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-zinc-200 bg-white/70 p-4 shadow-sm backdrop-blur sm:p-5">
              <div className="grid gap-3 sm:grid-cols-12">
                <div className="sm:col-span-6">
                  <label className="block text-sm font-medium text-zinc-800" htmlFor="city">
                    {t.inputs.cityLabel}
                  </label>
                  <div className="relative mt-2" ref={cityWrapperRef}>
                    <input
                      id="city"
                      value={city}
                      onChange={(e) => {
                        setCity(e.target.value);
                        if (fieldErrors.city) setFieldErrors((prev) => ({ ...prev, city: undefined }));
                      }}
                      onKeyDown={(e) => {
                        if (!dropdownOpen || suggestions.length === 0) return;
                        if (e.key === "ArrowDown") {
                          e.preventDefault();
                          setHighlightedIndex((i) => Math.min(i + 1, suggestions.length - 1));
                        } else if (e.key === "ArrowUp") {
                          e.preventDefault();
                          setHighlightedIndex((i) => Math.max(i - 1, 0));
                        } else if (e.key === "Enter" && highlightedIndex >= 0) {
                          e.preventDefault();
                          onSelectSuggestion(suggestions[highlightedIndex]);
                        } else if (e.key === "Escape") {
                          setDropdownOpen(false);
                          setHighlightedIndex(-1);
                        }
                      }}
                      placeholder={t.inputs.cityPlaceholder}
                      autoComplete="off"
                      aria-autocomplete="list"
                      aria-expanded={dropdownOpen}
                      aria-controls="city-suggestions"
                      role="combobox"
                      className={[
                        "h-11 w-full rounded-xl border bg-white px-4 text-sm text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100",
                        fieldErrors.city ? "border-rose-300" : "border-zinc-200",
                      ].join(" ")}
                    />
                    {dropdownOpen && (
                      <ul
                        id="city-suggestions"
                        role="listbox"
                        className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg"
                      >
                        {suggestionsLoading ? (
                          <li className="px-4 py-3 text-sm text-zinc-500">{t.inputs.suggestionsLoading}</li>
                        ) : suggestions.length === 0 ? (
                          <li className="px-4 py-3 text-sm text-zinc-500">{t.inputs.noSuggestions}</li>
                        ) : (
                          suggestions.map((s, i) => (
                            <li
                              key={`${s.latitude},${s.longitude}`}
                              role="option"
                              aria-selected={i === highlightedIndex}
                              onMouseEnter={() => setHighlightedIndex(i)}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                onSelectSuggestion(s);
                              }}
                              className={[
                                "flex cursor-pointer flex-col px-4 py-2.5 text-sm transition-colors",
                                i === highlightedIndex ? "bg-sky-50 text-sky-900" : "text-zinc-800 hover:bg-zinc-50",
                              ].join(" ")}
                            >
                              <span className="font-medium">
                                {s.name}
                                {s.admin1 ? `, ${s.admin1}` : ""}
                              </span>
                              <span className="text-xs text-zinc-500">{s.country}</span>
                            </li>
                          ))
                        )}
                      </ul>
                    )}
                  </div>
                  {fieldErrors.city ? <div className="mt-2 text-xs text-rose-700">{fieldErrors.city}</div> : null}
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-sm font-medium text-zinc-800" htmlFor="date">
                    {t.inputs.dateLabel}
                  </label>
                  <div className="mt-2">
                    <input
                      id="date"
                      type="date"
                      value={selectedDate}
                      min={getTodayYyyyMmDd()}
                      max={getMaxDateYyyyMmDd()}
                      onChange={(e) => {
                        setSelectedDate(e.target.value);
                        if (fieldErrors.date) setFieldErrors((prev) => ({ ...prev, date: undefined }));
                      }}
                      className={[
                        "h-11 w-full rounded-xl border bg-white px-4 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100",
                        fieldErrors.date ? "border-rose-300" : "border-zinc-200",
                      ].join(" ")}
                    />
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {(() => {
                      const today = getTodayYyyyMmDd();
                      const tomorrow = getTomorrowYyyyMmDd();
                      const mkBtn = (label: string, value: string) => {
                        const active = selectedDate === value;
                        return (
                          <button
                            key={label}
                            type="button"
                            onClick={() => {
                              setSelectedDate(value);
                              if (fieldErrors.date) setFieldErrors((prev) => ({ ...prev, date: undefined }));
                            }}
                            className={[
                              "inline-flex h-9 items-center justify-center rounded-full border px-4 text-xs font-semibold shadow-sm transition-colors duration-200",
                              "whitespace-nowrap",
                              active
                                ? "border-zinc-900 bg-zinc-900 text-white"
                                : "border-zinc-200 bg-zinc-50 text-zinc-800 hover:bg-zinc-100",
                            ].join(" ")}
                            aria-pressed={active}
                          >
                            {label}
                          </button>
                        );
                      };

                      return (
                        <>
                          {mkBtn(t.inputs.quickToday, today)}
                          {mkBtn(t.inputs.quickTomorrow, tomorrow)}
                        </>
                      );
                    })()}
                  </div>

                  {selectedDate ? (
                    <div className="mt-2 text-xs text-zinc-600">
                      {t.inputs.selectedDate} {formatDateForDisplay(selectedDate)}
                    </div>
                  ) : null}
                  {fieldErrors.date ? <div className="mt-2 text-xs text-rose-700">{fieldErrors.date}</div> : null}
                </div>

                <div className="sm:col-span-3">
                  <div className="block text-sm font-medium text-zinc-800">{t.inputs.timeOfDayLabel}</div>
                  <div
                    className={[
                      "mt-2 flex flex-wrap gap-3 rounded-2xl p-1",
                      fieldErrors.timeOfDay ? "ring-2 ring-rose-200" : "",
                    ].join(" ")}
                  >
                    {(["morning", "noon", "afternoon", "evening", "night"] as const).map((tod) => {
                      const active = selectedTimeOfDay === tod;
                      return (
                        <button
                          key={tod}
                          type="button"
                          onClick={() => {
                            setSelectedTimeOfDay(tod);
                            if (fieldErrors.timeOfDay) setFieldErrors((prev) => ({ ...prev, timeOfDay: undefined }));
                          }}
                          className={[
                            "inline-flex h-14 items-center justify-center rounded-full border px-4 text-sm font-semibold shadow-sm sm:px-5",
                            "whitespace-nowrap transition-colors duration-200",
                            active
                              ? "border-zinc-900 bg-zinc-900 text-white"
                              : "border-zinc-200 bg-zinc-50 text-zinc-800 hover:bg-zinc-100",
                          ].join(" ")}
                          aria-pressed={active}
                        >
                          {t.timeOfDay[tod]}
                        </button>
                      );
                    })}
                  </div>
                  {fieldErrors.timeOfDay ? (
                    <div className="mt-2 text-xs text-rose-700">{fieldErrors.timeOfDay}</div>
                  ) : null}
                </div>
              </div>

              <div className="mt-4">
                <button
                  type="button"
                  onClick={onGenerate}
                  disabled={loading}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-5 text-sm font-semibold text-white shadow-md transition hover:from-sky-600 hover:to-blue-700 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 22 6.477 22 12h-4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      {t.actions.loading}
                    </>
                  ) : (
                    <>
                      {t.actions.getRecommendation}
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                        <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
                      </svg>
                    </>
                  )}
                </button>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {scenarioOptions.map((opt) => {
                  const isSelected = opt.id === selectedOption;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setSelectedOption(opt.id);
                        if (fieldErrors.option) setFieldErrors((prev) => ({ ...prev, option: undefined }));
                      }}
                      className={[
                        "group w-full rounded-2xl border p-4 text-left shadow-sm transition",
                        "hover:-translate-y-0.5 hover:shadow-md",
                        isSelected
                          ? "border-sky-400 bg-sky-50 ring-4 ring-sky-100 shadow-md"
                          : fieldErrors.option
                            ? "border-rose-300 bg-white hover:border-rose-400"
                            : "border-zinc-200 bg-white hover:border-zinc-300",
                      ].join(" ")}
                      aria-pressed={isSelected}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{SCENARIO_EMOJI[opt.id]}</span>
                            <div className="text-sm font-semibold text-zinc-900">{opt.title}</div>
                          </div>
                          <div className="mt-1 text-xs text-zinc-500 leading-snug">{opt.description}</div>
                        </div>
                        <div
                          className={[
                            "mt-0.5 h-5 w-5 shrink-0 rounded-full border transition",
                            isSelected ? "border-sky-500 bg-sky-500" : "border-zinc-300 bg-white",
                          ].join(" ")}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
              {fieldErrors.option ? <div className="mt-2 text-xs text-rose-700">{fieldErrors.option}</div> : null}
            </div>

            <section
              aria-live="polite"
              ref={resultRef}
              className="mt-8 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-900">{t.result.title}</h2>
                  <p className="mt-1 text-sm text-zinc-600">
                    {loading
                      ? t.result.loading
                      : result || apiError
                        ? t.result.ready
                        : `${t.result.emptyLead}.`}
                    {!result && !apiError && !loading ? (
                      <span className="font-medium"> {t.actions.getRecommendation}</span>
                    ) : null}
                    {!result && !apiError && !loading ? "." : null}
                  </p>
                  {slowLoading && (
                    <p className="mt-1 text-xs text-amber-700">
                      {language === "el" ? "Λίγο ακόμα…" : "Still loading, hang tight…"}
                    </p>
                  )}
                </div>
                <div className="text-xs font-medium text-zinc-500">
                  {city.trim() ? city.trim() : t.inputs.cityLabel} · {selectedLabel || t.validation.option}
                </div>
              </div>

              {loading ? (
                <div aria-label="Loading recommendation" className="mt-4 animate-pulse space-y-3 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-5">
                  <div className="flex gap-2">
                    <div className="h-6 w-6 rounded-full bg-zinc-200" />
                    <div className="h-6 w-32 rounded-lg bg-zinc-200" />
                  </div>
                  <div className="h-3 w-full rounded-lg bg-zinc-100" />
                  <div className="h-3 w-5/6 rounded-lg bg-zinc-100" />
                  <div className="h-3 w-4/5 rounded-lg bg-zinc-100" />
                  <div className="mt-4 grid grid-cols-4 gap-2">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="h-14 rounded-lg bg-zinc-100" />
                    ))}
                  </div>
                </div>
              ) : !result && !apiError ? (
                <div className="mt-4 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-5">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 h-7 w-7 rounded-full border border-zinc-200 bg-white text-center text-sm font-semibold text-zinc-500">
                      ?
                    </div>
                    <div className="space-y-1.5 text-sm">
                      <div className="font-medium text-zinc-900">{t.result.emptyLead}</div>
                      <p className="text-zinc-600">{t.result.emptyBody}</p>
                    </div>
                  </div>
                </div>
              ) : apiError ? (
                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 break-words">
                  {apiError}
                </div>
              ) : result ? (
                <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-zinc-600">
                    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1">
                      {result.resolvedCity ?? result.city}
                    </span>
                    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1">
                      {formatDateForDisplay(result.selectedDate)}
                    </span>
                    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1">
                      {t.timeOfDay[result.selectedTimeOfDay]}
                    </span>
                  </div>

                  {(() => {
                    const { verdict, badgeClasses, riskClasses } = getVerdictAndRisk(result.selectedOption, result.weather);
                    const verdictLabel =
                      verdict === "good" ? t.verdict.good : verdict === "okay" ? t.verdict.okay : t.verdict.not;
                    const riskLabel =
                      verdict === "good"
                        ? t.verdict.riskLow
                        : verdict === "okay"
                          ? t.verdict.riskModerate
                          : t.verdict.riskHigh;

                    return (
                      <div className="mt-3 flex flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={[
                              "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-bold shadow-sm",
                              badgeClasses,
                            ].join(" ")}
                          >
                            {SCENARIO_EMOJI[result.selectedOption]} {verdictLabel}
                          </span>
                          <span
                            className={[
                              "inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold",
                              riskClasses,
                            ].join(" ")}
                          >
                            {riskLabel}
                          </span>
                        </div>

                        <div className="text-sm text-zinc-700">{result.recommendation.summary}</div>
                      </div>
                    );
                  })()}

                  <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-zinc-700">
                    {result.recommendation.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>

                  <div className="mt-5 rounded-lg bg-zinc-50 p-3 sm:p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-3xl leading-none">
                          {getWeatherEmoji(result.weather.temperature, result.weather.rainChance, result.weather.wind, result.weather.weatherCode)}
                        </span>
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-600">{t.result.weather}</div>
                          <div className="text-xs text-zinc-500">{result.conditionLabel}</div>
                        </div>
                      </div>
                      <div className="text-xs font-medium text-zinc-500">{t.result.basedOnSelectedTime}</div>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <div className="rounded-lg bg-white p-3">
                        <div className="text-[11px] text-zinc-500">{t.result.temp}</div>
                        <div className="mt-0.5 text-sm font-semibold text-zinc-900">{result.weather.temperature}°C</div>
                      </div>
                      <div className="rounded-lg bg-white p-3">
                        <div className="text-[11px] text-zinc-500">{t.result.feelsLike}</div>
                        <div className="mt-0.5 text-sm font-semibold text-zinc-900">{result.weather.feelsLike}°C</div>
                      </div>
                      <div className="rounded-lg bg-white p-3">
                        <div className="text-[11px] text-zinc-500">{t.result.rain}</div>
                        <div className="mt-0.5 text-sm font-semibold text-zinc-900">{result.weather.rainChance}%</div>
                      </div>
                      <div className="rounded-lg bg-white p-3">
                        <div className="text-[11px] text-zinc-500">{t.result.wind}</div>
                        <div className="mt-0.5 text-sm font-semibold text-zinc-900">{result.weather.wind} km/h</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 border-t border-zinc-200 pt-4">
                    <div className="text-sm font-medium text-zinc-900">{t.feedback.question}</div>
                    {feedback === "yes" || feedbackReason ? (
                      <div className="mt-2 text-sm text-zinc-600">{t.feedback.thanks}</div>
                    ) : feedback === "no" ? (
                      <div className="mt-3">
                        <div className="text-xs font-medium text-zinc-600 mb-2">{t.feedback.whyNot}</div>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { key: "wrongForecast", label: t.feedback.reasonWrongForecast },
                            { key: "notHelpful", label: t.feedback.reasonNotHelpful },
                            { key: "missingScenario", label: t.feedback.reasonMissingScenario },
                          ].map(({ key, label }) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => {
                                setFeedbackReason(key);
                                track("feedback_negative", {
                                  reason: key,
                                  option: result.selectedOption,
                                  city: result.resolvedCity ?? result.city,
                                });
                              }}
                              className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-xs font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setFeedback("yes")}
                          className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-900 shadow-sm transition hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                        >
                          {t.feedback.yes}
                        </button>
                        <button
                          type="button"
                          onClick={() => setFeedback("no")}
                          className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-900 shadow-sm transition hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                        >
                          {t.feedback.no}
                        </button>
                        <button
                          type="button"
                          onClick={() => onShare(result)}
                          className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-900 shadow-sm transition hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                        >
                          {shareState === "copied" ? (
                            t.feedback.copied
                          ) : (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                <path d="M13 4.5a2.5 2.5 0 11.702 1.737L6.97 9.604a2.518 2.518 0 010 .792l6.733 3.367a2.5 2.5 0 11-.671 1.341l-6.733-3.367a2.5 2.5 0 110-3.475l6.733-3.366A2.52 2.52 0 0113 4.5z" />
                              </svg>
                              {t.feedback.share}
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  <p className="mt-4 text-xs text-zinc-500">{t.disclaimer}</p>
                </div>
              ) : null}
            </section>
          </section>
        </div>
      </div>
    </main>
  );
}
