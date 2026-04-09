import { NextRequest, NextResponse } from "next/server";

export type CitySuggestion = {
  name: string;
  country: string;
  admin1?: string;
  latitude: number;
  longitude: number;
};

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json([]);

  const lang = req.nextUrl.searchParams.get("lang") ?? "en";
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=${lang}&format=json`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(url, { cache: "no-store", signal: controller.signal });
    const data = (await res.json()) as {
      results?: Array<{
        name?: string;
        country?: string;
        admin1?: string;
        latitude?: number;
        longitude?: number;
      }>;
    };
    clearTimeout(timeoutId);

    const suggestions: CitySuggestion[] = (data.results ?? [])
      .filter((r) => r.name && r.country && r.latitude != null && r.longitude != null)
      .slice(0, 5)
      .map((r) => ({
        name: r.name!,
        country: r.country!,
        admin1: r.admin1,
        latitude: r.latitude!,
        longitude: r.longitude!,
      }));

    return NextResponse.json(suggestions);
  } catch {
    clearTimeout(timeoutId);
    return NextResponse.json([]);
  }
}
