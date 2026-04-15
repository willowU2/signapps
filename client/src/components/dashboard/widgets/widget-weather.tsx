"use client";

// IDEA-122: Weather widget for the extended widget library

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Cloud,
  Sun,
  CloudRain,
  CloudSnow,
  Wind,
  Droplets,
  Loader2,
} from "lucide-react";
import type { WidgetRenderProps } from "@/lib/dashboard/types";

interface WeatherData {
  city: string;
  temperature: number;
  feels_like: number;
  description: string;
  humidity: number;
  wind_speed: number;
  condition: "sunny" | "cloudy" | "rainy" | "snowy" | "windy";
}

// Open-Meteo — free, no API key required
async function fetchWeather(): Promise<WeatherData> {
  // Get IP-based location first, then weather
  const locRes = await fetch("https://ipapi.co/json/");
  const loc = await locRes.json();
  const lat = loc.latitude ?? 48.8566;
  const lon = loc.longitude ?? 2.3522;
  const city = loc.city ?? "Paris";

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code`;
  const res = await fetch(url);
  const data = await res.json();
  const c = data.current;

  const code: number = c.weather_code ?? 0;
  let condition: WeatherData["condition"] = "sunny";
  if (code >= 71 && code <= 77) condition = "snowy";
  else if (code >= 51 && code <= 67) condition = "rainy";
  else if (code >= 80 && code <= 99) condition = "rainy";
  else if (code >= 45 && code <= 48) condition = "cloudy";
  else if (code >= 1 && code <= 3) condition = "cloudy";
  else if (c.wind_speed_10m > 30) condition = "windy";

  const DESCRIPTIONS: Record<string, string> = {
    sunny: "Ensoleillé",
    cloudy: "Nuageux",
    rainy: "Pluvieux",
    snowy: "Neigeux",
    windy: "Venteux",
  };

  return {
    city,
    temperature: Math.round(c.temperature_2m),
    feels_like: Math.round(c.apparent_temperature),
    description: DESCRIPTIONS[condition],
    humidity: c.relative_humidity_2m,
    wind_speed: Math.round(c.wind_speed_10m),
    condition,
  };
}

const CONDITIONS = {
  sunny: { icon: Sun, color: "text-yellow-500", bg: "bg-yellow-50" },
  cloudy: { icon: Cloud, color: "text-slate-500", bg: "bg-slate-50" },
  rainy: { icon: CloudRain, color: "text-blue-500", bg: "bg-blue-50" },
  snowy: { icon: CloudSnow, color: "text-sky-400", bg: "bg-sky-50" },
  windy: { icon: Wind, color: "text-teal-500", bg: "bg-teal-50" },
};

export function WidgetWeather({ widget }: WidgetRenderProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["widget-weather"],
    queryFn: fetchWeather,
    staleTime: 15 * 60 * 1000, // 15 min
    retry: 1,
  });

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Cloud className="h-4 w-4" />
            Météo
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Cloud className="h-4 w-4" />
            Météo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">Météo indisponible</p>
        </CardContent>
      </Card>
    );
  }

  const cond = CONDITIONS[data.condition];
  const WeatherIcon = cond.icon;

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Cloud className="h-4 w-4" />
          Météo — {data.city}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-4">
          <div className={`rounded-full p-3 ${cond.bg}`}>
            <WeatherIcon className={`h-8 w-8 ${cond.color}`} />
          </div>
          <div>
            <div className="text-3xl font-bold">{data.temperature}°C</div>
            <div className="text-sm text-muted-foreground">
              {data.description}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground border-t pt-3">
          <div className="flex items-center gap-1">
            <Sun className="h-3 w-3" />
            <span>Ressenti {data.feels_like}°</span>
          </div>
          <div className="flex items-center gap-1">
            <Droplets className="h-3 w-3" />
            <span>Humid. {data.humidity}%</span>
          </div>
          <div className="flex items-center gap-1">
            <Wind className="h-3 w-3" />
            <span>Vent {data.wind_speed} km/h</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
