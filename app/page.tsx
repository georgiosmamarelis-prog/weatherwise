"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
  selectedDate: string; // yyyy-mm-dd
  selectedTimeOfDay: TimeOfDay;
  recommendation: Recommendation;
  weather: Weather;
};

type FieldErrors = {
  city?: string;
  option?: string;
  date?: string;
  timeOfDay?: string;
};

const translations = {
  en: {
    header: { brand: "WeatherWise", tagline: "Make the call. Dress right.", langEN: "EN", langEL: "EL" },
    hero: {
      title: "WeatherWise",
      subtitle: "Weather advice for real-life decisions",
      description:
        "Get quick weather-based recommendations for running, clothing, walking, or taking your motorbike.",
    },
    inputs: {
      cityLabel: "City",
      cityPlaceholder: "e.g. Athens",
      dateLabel: "Date",
      selectedDate: "Selected:",
      quickToday: "Today",
      quickTomorrow: "Tomorrow",
      timeOfDayLabel: "Time of day",
    },
    timeOfDay: { morning: "Morning", noon: "Noon", afternoon: "Afternoon", evening: "Evening", night: "Night" },
    scenarios: {
      running: { title: "Running", description: "Pace, layers, and rain/wind tips." },
      wear: { title: "What to wear", description: "Outfit suggestions for the day ahead." },
      motorbike: { title: "Motorbike", description: "Visibility, grip, and comfort guidance." },
      walk: { title: "Walk", description: "Umbrella and route-friendly advice." },
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
      loading: "We’re checking the forecast and preparing your recommendation.",
      ready: "Here’s your weather-based recommendation.",
      emptyLead: "No recommendation yet",
      emptyBody:
        "Add a city, pick what you’re planning to do, choose a day and time, then tap Get recommendation.",
      weather: "Weather",
      basedOnSelectedTime: "Based on your selected time",
      temp: "Temp",
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
      thanks: "Thanks for your feedback",
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
      description: "Πάρε γρήγορες προτάσεις με βάση τον καιρό για τρέξιμο, ντύσιμο, βόλτα ή μηχανάκι.",
    },
    inputs: {
      cityLabel: "Πόλη",
      cityPlaceholder: "π.χ. Αθήνα",
      dateLabel: "Ημερομηνία",
      selectedDate: "Επιλεγμένη:",
      quickToday: "Σήμερα",
      quickTomorrow: "Αύριο",
      timeOfDayLabel: "Ώρα ημέρας",
    },
    timeOfDay: { morning: "Πρωί", noon: "Μεσημέρι", afternoon: "Απόγευμα", evening: "Βράδυ", night: "Νύχτα" },
    scenarios: {
      running: { title: "Τρέξιμο", description: "Ρυθμός, ρούχα και συμβουλές για βροχή/αέρα." },
      wear: { title: "Τι να φορέσω", description: "Προτάσεις ντυσίματος για την ημέρα." },
      motorbike: { title: "Μηχανάκι", description: "Ορατότητα, πρόσφυση και άνεση στη διαδρομή." },
      walk: { title: "Βόλτα", description: "Ομπρέλα και συμβουλές για πιο άνετη βόλτα." },
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
      emptyBody:
        "Βάλε πόλη, διάλεξε τι θες να κάνεις, επέλεξε ημερομηνία και ώρα ημέρας και πάτησε Πάρε πρόταση.",
      weather: "Καιρός",
      basedOnSelectedTime: "Με βάση την επιλεγμένη ώρα",
      temp: "Θερμ.",
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
      thanks: "Ευχαριστούμε για το feedback",
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

function timeOfDayLabel(t: TimeOfDay) {
  // Deprecated: kept for minimal change surface (replaced by translations).
  return t;
}

type VerdictKind = "good" | "okay" | "not";

function getVerdictAndRisk(option: OptionId, weather: Weather) {
  const { temperature, rainChance, wind } = weather;

  // We intentionally derive the UI verdict from the returned values so the badge matches the recommendation.
  let verdict: VerdictKind;

  if (option === "running") {
    const good = temperature >= 8 && temperature <= 22 && rainChance < 30 && wind < 20;
    if (good) verdict = "good";
    else if (rainChance < 50 && wind < 30 && temperature >= 5 && temperature <= 26) verdict = "okay";
    else verdict = "not";
  } else if (option === "motorbike") {
    const notIdeal = rainChance > 40 || wind > 25;
    if (notIdeal) verdict = "not";
    else if (rainChance > 25 || wind > 15) verdict = "okay";
    else verdict = "good";
  } else if (option === "walk") {
    const good = rainChance < 40 && temperature > 5;
    if (good) verdict = "good";
    else if (rainChance < 55 && temperature > 0) verdict = "okay";
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

  const resultRef = useRef<HTMLElement | null>(null);

  const t = translations[language];

  useEffect(() => {
    try {
      const saved = localStorage.getItem("weatherwise_language");
      if (saved === "en" || saved === "el") setLanguage(saved);
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

  const scenarioOptions = useMemo(
    () =>
      ([
        { id: "running", ...t.scenarios.running },
        { id: "wear", ...t.scenarios.wear },
        { id: "motorbike", ...t.scenarios.motorbike },
        { id: "walk", ...t.scenarios.walk },
      ] satisfies Array<{ id: OptionId; title: string; description: string }>),
    [t],
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

    setLoading(true);
    setResult(null);
    setFeedback(null);
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

      setResult(data as RecommendResponse);
      setLoading(false);
      scrollToResultSoon();
    } catch {
      setApiError(t.errors.network);
      setLoading(false);
      scrollToResultSoon();
    }
  }

  return (
    <main className="min-h-screen bg-white text-zinc-900">
      <div className="relative isolate overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-24 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-gradient-to-tr from-sky-200 via-blue-200 to-emerald-200 blur-3xl opacity-60" />
          <div className="absolute -bottom-24 right-[-120px] h-[420px] w-[420px] rounded-full bg-gradient-to-tr from-indigo-200 via-fuchsia-200 to-rose-200 blur-3xl opacity-50" />
        </div>

        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
          <header className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-zinc-900 text-white shadow-sm">
                <span className="text-sm font-semibold">WW</span>
              </div>
              <span className="text-sm font-semibold tracking-tight">{t.header.brand}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden text-sm text-zinc-500 sm:block">{t.header.tagline}</div>
              <div className="inline-flex rounded-full border border-zinc-200 bg-white/70 p-1 shadow-sm backdrop-blur">
                <button
                  type="button"
                  onClick={() => setLanguage("en")}
                  className={[
                    "inline-flex h-8 items-center justify-center rounded-full px-3 text-xs font-semibold transition-colors",
                    language === "en" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100",
                  ].join(" ")}
                  aria-pressed={language === "en"}
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
                >
                  {t.header.langEL}
                </button>
              </div>
            </div>
          </header>

          <section className="mt-12">
            <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl">{t.hero.title}</h1>
            <p className="mt-3 text-lg font-medium text-zinc-700">{t.hero.subtitle}</p>
            <p className="mt-4 text-base leading-7 text-zinc-600">
              {t.hero.description}
            </p>

            <div className="mt-8 rounded-2xl border border-zinc-200 bg-white/70 p-4 shadow-sm backdrop-blur sm:p-5">
              <div className="grid gap-3 sm:grid-cols-12">
                <div className="sm:col-span-6">
                  <label className="block text-sm font-medium text-zinc-800" htmlFor="city">
                    {t.inputs.cityLabel}
                  </label>
                  <div className="mt-2">
                    <input
                      id="city"
                      value={city}
                      onChange={(e) => {
                        setCity(e.target.value);
                        if (fieldErrors.city) setFieldErrors((prev) => ({ ...prev, city: undefined }));
                      }}
                      placeholder={t.inputs.cityPlaceholder}
                      autoComplete="address-level2"
                      className={[
                        "h-11 w-full rounded-xl border bg-white px-4 text-sm text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100",
                        fieldErrors.city ? "border-rose-300" : "border-zinc-200",
                      ].join(" ")}
                    />
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

              <div className="mt-3">
                <button
                  type="button"
                  onClick={onGenerate}
                  disabled={loading}
                  className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-zinc-900 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  {loading ? t.actions.loading : t.actions.getRecommendation}
                </button>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
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
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-sm font-semibold text-zinc-900">{opt.title}</div>
                          <div className="mt-1 text-sm text-zinc-600">{opt.description}</div>
                        </div>
                        <div
                          className={[
                            "mt-0.5 h-5 w-5 rounded-full border transition",
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
                </div>
                <div className="text-xs font-medium text-zinc-500">
                  {city.trim() ? city.trim() : t.inputs.cityLabel} · {selectedLabel || t.validation.option}
                </div>
              </div>

              {!result && !apiError ? (
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
                              "inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold",
                              badgeClasses,
                            ].join(" ")}
                          >
                            {verdictLabel}
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
                      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-600">{t.result.weather}</div>
                      <div className="text-xs font-medium text-zinc-500">{t.result.basedOnSelectedTime}</div>
                    </div>
                    <div className="mt-2 grid gap-2 text-sm text-zinc-700 sm:grid-cols-3">
                      <div className="rounded-lg bg-white p-3">
                        <div className="text-[11px] text-zinc-500">{t.result.temp}</div>
                        <div className="mt-0.5 text-sm font-semibold text-zinc-900">{result.weather.temperature}°C</div>
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
                    {feedback ? (
                      <div className="mt-2 text-sm text-zinc-600">{t.feedback.thanks}</div>
                    ) : (
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <button
                          type="button"
                          onClick={() => setFeedback("yes")}
                          className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-900 shadow-sm transition hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 sm:w-auto"
                        >
                          {t.feedback.yes}
                        </button>
                        <button
                          type="button"
                          onClick={() => setFeedback("no")}
                          className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-900 shadow-sm transition hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 sm:w-auto"
                        >
                          {t.feedback.no}
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
