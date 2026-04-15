"use client";

import { useEffect, useState } from "react";
import { Play, Pause, Volume2, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AmbientSound {
  id: string;
  name: string;
  icon: string;
}

export default function MeditationGuide() {
  const [duration, setDuration] = useState(5);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [selectedSound, setSelectedSound] = useState("rain");
  const [breathPhase, setBreathPhase] = useState<"inhale" | "exhale" | "hold">(
    "inhale",
  );

  const durations = [5, 10, 15];
  const ambientSounds: AmbientSound[] = [
    { id: "rain", name: "Rain", icon: "🌧️" },
    { id: "ocean", name: "Ocean Waves", icon: "🌊" },
    { id: "forest", name: "Forest", icon: "🌲" },
    { id: "wind", name: "Wind Chimes", icon: "🎐" },
  ];

  // Breathing animation cycle: 4s inhale, 4s hold, 4s exhale = 12s total
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setTimeElapsed((prev) => {
          const nextTime = prev + 1;
          if (nextTime >= duration * 60) {
            setIsPlaying(false);
            return 0;
          }
          const cycle = nextTime % 12;
          if (cycle < 4) setBreathPhase("inhale");
          else if (cycle < 8) setBreathPhase("hold");
          else setBreathPhase("exhale");
          return nextTime;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, duration]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const progress = (timeElapsed / (duration * 60)) * 100;
  const breathScale =
    breathPhase === "inhale" ? 1.3 : breathPhase === "exhale" ? 0.7 : 1;

  return (
    <div className="space-y-6 p-4">
      <h2 className="text-2xl font-bold">Meditation Guide</h2>

      {/* Session Controls */}
      <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-lg border border-purple-200">
        <div className="text-center mb-6">
          <h3 className="text-sm text-muted-foreground mb-2">
            Session Duration
          </h3>
          <div className="flex justify-center gap-2">
            {durations.map((d) => (
              <button
                key={d}
                onClick={() => {
                  setDuration(d);
                  setTimeElapsed(0);
                  setIsPlaying(false);
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  duration === d
                    ? "bg-purple-600 text-white"
                    : "bg-card border border-purple-200 text-purple-600 hover:bg-purple-50"
                }`}
              >
                {d}m
              </button>
            ))}
          </div>
        </div>

        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-2">Time Elapsed</p>
          <div className="text-5xl font-bold text-purple-600 font-mono mb-4">
            {formatTime(timeElapsed)}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
            <div
              className="h-2 rounded-full bg-purple-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <Button
            size="lg"
            onClick={() => setIsPlaying(!isPlaying)}
            className={
              isPlaying
                ? "bg-orange-500 hover:bg-orange-600"
                : "bg-purple-600 hover:bg-purple-700"
            }
          >
            {isPlaying ? (
              <>
                <Pause className="w-5 h-5 mr-2" />
                Pause
              </>
            ) : (
              <>
                <Play className="w-5 h-5 mr-2" />
                Start
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Breathing Circle */}
      {isPlaying && (
        <div className="flex justify-center py-8">
          <div className="relative w-32 h-32">
            <div
              className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 transition-transform duration-1000 ease-in-out"
              style={{
                transform: `scale(${breathScale})`,
                opacity: 0.6,
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p className="text-sm font-medium text-muted-foreground capitalize">
                  {breathPhase}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ambient Sound Selector */}
      <div className="space-y-3">
        <h3 className="font-semibold flex items-center gap-2">
          <Volume2 className="w-5 h-5" />
          Ambient Sound
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {ambientSounds.map((sound) => (
            <button
              key={sound.id}
              onClick={() => setSelectedSound(sound.id)}
              className={`p-3 rounded-lg border-2 transition-all text-center ${
                selectedSound === sound.id
                  ? "border-purple-500 bg-purple-50"
                  : "border-border bg-card hover:border-purple-300"
              }`}
            >
              <p className="text-2xl mb-1">{sound.icon}</p>
              <p className="text-xs font-medium">{sound.name}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-2">Meditation Tips</h3>
        <ul className="space-y-1 text-sm text-blue-800">
          <li>• Find a quiet, comfortable place</li>
          <li>• Focus on your natural breathing</li>
          <li>• Let thoughts pass without judgment</li>
          <li>• Return gently to your breath</li>
        </ul>
      </div>
    </div>
  );
}
