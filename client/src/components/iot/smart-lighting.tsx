"use client";

import { useState } from "react";
import { Lightbulb } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";

interface Light {
  id: string;
  room: string;
  isOn: boolean;
  brightness: number;
  mode: "manual" | "presence-auto";
}

export default function SmartLighting() {
  const [lights, setLights] = useState<Light[]>([
    {
      id: "1",
      room: "Lobby",
      isOn: true,
      brightness: 80,
      mode: "presence-auto",
    },
    { id: "2", room: "Office A", isOn: true, brightness: 100, mode: "manual" },
    {
      id: "3",
      room: "Meeting Room",
      isOn: false,
      brightness: 0,
      mode: "presence-auto",
    },
    {
      id: "4",
      room: "Corridor",
      isOn: true,
      brightness: 60,
      mode: "presence-auto",
    },
  ]);

  const toggleLight = (id: string) => {
    setLights((prevLights) =>
      prevLights.map((light) =>
        light.id === id
          ? {
              ...light,
              isOn: !light.isOn,
              brightness: !light.isOn ? 50 : light.brightness,
            }
          : light,
      ),
    );
  };

  const setBrightness = (id: string, brightness: number) => {
    setLights((prevLights) =>
      prevLights.map((light) =>
        light.id === id
          ? { ...light, brightness, isOn: brightness > 0 }
          : light,
      ),
    );
  };

  const setMode = (id: string, mode: "manual" | "presence-auto") => {
    setLights((prevLights) =>
      prevLights.map((light) => (light.id === id ? { ...light, mode } : light)),
    );
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <Lightbulb className="w-6 h-6" />
        Smart Lighting
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {lights.map((light) => (
          <Card key={light.id} className="p-4">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-lg">{light.room}</h3>
                <Badge
                  className={
                    light.mode === "presence-auto"
                      ? "bg-purple-500 mt-1"
                      : "bg-gray-600 mt-1"
                  }
                >
                  {light.mode === "presence-auto" ? "Presence Auto" : "Manual"}
                </Badge>
              </div>
              <Switch
                checked={light.isOn}
                onCheckedChange={() => toggleLight(light.id)}
              />
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Brightness</span>
                  <span className="font-semibold">{light.brightness}%</span>
                </div>
                <Slider
                  value={[light.brightness]}
                  onValueChange={(value) => setBrightness(light.id, value[0])}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>

              <div className="flex gap-2">
                <button
                  className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${
                    light.mode === "manual"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200 text-muted-foreground hover:bg-gray-300"
                  }`}
                  onClick={() => setMode(light.id, "manual")}
                >
                  Manual
                </button>
                <button
                  className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${
                    light.mode === "presence-auto"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200 text-muted-foreground hover:bg-gray-300"
                  }`}
                  onClick={() => setMode(light.id, "presence-auto")}
                >
                  Auto
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
