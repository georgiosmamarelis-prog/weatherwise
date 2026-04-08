"use client";

import { useMemo, useRef, useState } from "react";

type OptionId = "running" | "wear" | "motorbike" | "walk";
type TimeOfDay = "morning" | "noon" | "afternoon" | "evening" | "night";

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

const OPTIONS: Array<{ id: OptionId; title: string; description: string }> = [
  { id: "running", title: "Running", description: "Pace, layers, and rain/wind tips." },
  { id: "wear", title: "What to wear", description: "Outfit suggestions for the day ahead." },
  { id: "motorbike", title: "Motorbike", description: "Visibility, grip, and comfort guidance." },
  { id: "walk", title: "Walk", description: "Umbrella and route-friendly advice." },
];

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
  if (t === "morning") return "Morning";
  if (t === "noon") return "Noon";
  if (t === "afternoon") return "Afternoon";
  if (t === "evening") return "Evening";
  return "Night";
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

  const verdictLabel =
    verdict === "good" ? "Good choice" : verdict === "okay" ? "Okay, but be prepared" : "Not recommended";
  const riskLabel = verdict === "good" ? "Low risk" : verdict === "okay" ? "Moderate risk" : "High risk";

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

  return { verdict, verdictLabel, riskLabel, badgeClasses, riskClasses };
}

export default function Home() {
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

  const selectedLabel = useMemo(
    () => (selectedOption ? OPTIONS.find((o) => o.id === selectedOption)?.title ?? "Option" : "Scenario"),
    [selectedOption],
  );

  function scrollToResultSoon() {
    requestAnimationFrame(() => {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function onGenerate() {
    const cityValue = city.trim();

    const nextErrors: FieldErrors = {};
    if (!cityValue) nextErrors.city = "Add a city so we know where to check.";
    if (!selectedOption) nextErrors.option = "Choose what you’re planning to do.";
    if (!selectedDate.trim()) nextErrors.date = "Pick a day you care about.";
    if (!selectedTimeOfDay) nextErrors.timeOfDay = "Select a time category.";

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
            : "Something went wrong while fetching the forecast. Please try again.";
        setApiError(message);
        setLoading(false);
        scrollToResultSoon();
        return;
      }

      setResult(data as RecommendResponse);
      setLoading(false);
      scrollToResultSoon();
    } catch {
      setApiError("Network error. Please check your connection and try again.");
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
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-zinc-900 text-white shadow-sm">
                <span className="text-sm font-semibold">WW</span>
              </div>
              <span className="text-sm font-semibold tracking-tight">WeatherWise</span>
            </div>
            <div className="hidden text-sm text-zinc-500 sm:block">Make the call. Dress right.</div>
          </header>

          <section className="mt-12">
            <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl">WeatherWise</h1>
            <p className="mt-3 text-lg font-medium text-zinc-700">Weather advice for real-life decisions</p>
            <p className="mt-4 text-base leading-7 text-zinc-600">
              Get quick weather-based recommendations for running, clothing, walking, or taking your motorbike.
            </p>

            <div className="mt-8 rounded-2xl border border-zinc-200 bg-white/70 p-4 shadow-sm backdrop-blur sm:p-5">
              <div className="grid gap-3 sm:grid-cols-12">
                <div className="sm:col-span-6">
                  <label className="block text-sm font-medium text-zinc-800" htmlFor="city">
                    City
                  </label>
                  <div className="mt-2">
                    <input
                      id="city"
                      value={city}
                      onChange={(e) => {
                        setCity(e.target.value);
                        if (fieldErrors.city) setFieldErrors((prev) => ({ ...prev, city: undefined }));
                      }}
                      placeholder="e.g. Athens"
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
                    Date
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
                      const mkBtn = (label: "Today" | "Tomorrow", value: string) => {
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
                          {mkBtn("Today", today)}
                          {mkBtn("Tomorrow", tomorrow)}
                        </>
                      );
                    })()}
                  </div>

                  {selectedDate ? (
                    <div className="mt-2 text-xs text-zinc-600">Selected: {formatDateForDisplay(selectedDate)}</div>
                  ) : null}
                  {fieldErrors.date ? <div className="mt-2 text-xs text-rose-700">{fieldErrors.date}</div> : null}
                </div>

                <div className="sm:col-span-3">
                  <div className="block text-sm font-medium text-zinc-800">Time of day</div>
                  <div
                    className={[
                      "mt-2 flex flex-wrap gap-3 rounded-2xl p-1",
                      fieldErrors.timeOfDay ? "ring-2 ring-rose-200" : "",
                    ].join(" ")}
                  >
                    {(["morning", "noon", "afternoon", "evening", "night"] as const).map((t) => {
                      const active = selectedTimeOfDay === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => {
                            setSelectedTimeOfDay(t);
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
                          {timeOfDayLabel(t)}
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
                  {loading ? "Getting your recommendation…" : "Get recommendation"}
                </button>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {OPTIONS.map((opt) => {
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
                  <h2 className="text-sm font-semibold text-zinc-900">Result</h2>
                  <p className="mt-1 text-sm text-zinc-600">
                    {loading
                      ? "We’re checking the forecast and preparing your recommendation."
                      : result || apiError
                        ? "Here’s your weather-based recommendation."
                        : "Recommendations will appear here after you click "}
                    {!result && !apiError && !loading ? <span className="font-medium">Get recommendation</span> : null}
                    {!result && !apiError && !loading ? "." : null}
                  </p>
                </div>
                <div className="text-xs font-medium text-zinc-500">
                  {city.trim() ? city.trim() : "City"} · {selectedLabel}
                </div>
              </div>

              {!result && !apiError ? (
                <div className="mt-4 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-5">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 h-7 w-7 rounded-full border border-zinc-200 bg-white text-center text-sm font-semibold text-zinc-500">
                      ?
                    </div>
                    <div className="space-y-1.5 text-sm">
                      <div className="font-medium text-zinc-900">No recommendation yet</div>
                      <p className="text-zinc-600">
                        Add a city, pick what you’re planning to do, choose a day and time, then tap{" "}
                        <span className="font-medium">Get recommendation</span>.
                      </p>
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
                      {timeOfDayLabel(result.selectedTimeOfDay)}
                    </span>
                  </div>

                  {(() => {
                    const { verdictLabel, riskLabel, badgeClasses, riskClasses } = getVerdictAndRisk(
                      result.selectedOption,
                      result.weather,
                    );

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
                      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-600">Weather</div>
                      <div className="text-xs font-medium text-zinc-500">Based on your selected time</div>
                    </div>
                    <div className="mt-2 grid gap-2 text-sm text-zinc-700 sm:grid-cols-3">
                      <div className="rounded-lg bg-white p-3">
                        <div className="text-[11px] text-zinc-500">Temp</div>
                        <div className="mt-0.5 text-sm font-semibold text-zinc-900">{result.weather.temperature}°C</div>
                      </div>
                      <div className="rounded-lg bg-white p-3">
                        <div className="text-[11px] text-zinc-500">Rain</div>
                        <div className="mt-0.5 text-sm font-semibold text-zinc-900">{result.weather.rainChance}%</div>
                      </div>
                      <div className="rounded-lg bg-white p-3">
                        <div className="text-[11px] text-zinc-500">Wind</div>
                        <div className="mt-0.5 text-sm font-semibold text-zinc-900">{result.weather.wind} km/h</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 border-t border-zinc-200 pt-4">
                    <div className="text-sm font-medium text-zinc-900">Was this recommendation useful?</div>
                    {feedback ? (
                      <div className="mt-2 text-sm text-zinc-600">Thanks for your feedback</div>
                    ) : (
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <button
                          type="button"
                          onClick={() => setFeedback("yes")}
                          className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-900 shadow-sm transition hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 sm:w-auto"
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          onClick={() => setFeedback("no")}
                          className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-900 shadow-sm transition hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 sm:w-auto"
                        >
                          No
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </section>
          </section>
        </div>
      </div>
    </main>
  );
}
