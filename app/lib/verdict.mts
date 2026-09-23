import type { OptionId, Weather } from "./recommendation.mts";

export type VerdictKind = "good" | "okay" | "not";

export function getVerdictAndRisk(option: OptionId, weather: Weather) {
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
