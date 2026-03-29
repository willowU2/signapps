"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Clock, Focus } from "lucide-react";
import { cn } from "@/lib/utils";

export function FocusMode() {
  const [isActive, setIsActive] = useState(false);
  const [duration, setDuration] = useState(25);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [totalFocusToday, setTotalFocusToday] = useState(0);

  // Timer effect
  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setIsActive(false);
          setTotalFocusToday((prev) => prev + duration);
          setTimeLeft(duration * 60);
          return duration * 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, duration]);

  // Format time display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Handle duration slider change
  const handleDurationChange = (value: number[]) => {
    const newDuration = value[0];
    setDuration(newDuration);
    if (!isActive) {
      setTimeLeft(newDuration * 60);
    }
  };

  // Toggle focus mode
  const toggleFocus = () => {
    if (isActive) {
      setTotalFocusToday((prev) => prev + Math.ceil((duration * 60 - timeLeft) / 60));
      setIsActive(false);
      setTimeLeft(duration * 60);
    } else {
      setIsActive(true);
    }
  };

  // Calculate progress percentage
  const progress = ((duration * 60 - timeLeft) / (duration * 60)) * 100;

  return (
    <div className="space-y-4">
      {/* Focus Mode Card */}
      <Card className={cn(
        "transition-all",
        isActive && "border-amber-500 shadow-lg shadow-amber-500/20"
      )}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Focus className="w-5 h-5" />
              Mode Focus
            </CardTitle>
            <span className={cn(
              "text-xs font-semibold px-2.5 py-1 rounded-full",
              isActive
                ? "bg-amber-100 text-amber-700"
                : "bg-muted text-muted-foreground"
            )}>
              {isActive ? "ACTIF" : "INACTIF"}
            </span>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Timer Display */}
          <div className="text-center">
            <div className={cn(
              "relative w-32 h-32 mx-auto rounded-full flex items-center justify-center",
              isActive
                ? "bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-400"
                : "bg-muted border-2 border-border"
            )}>
              {/* Progress Ring */}
              <svg className="absolute inset-0 w-full h-full -rotate-90" style={{ overflow: "visible" }}>
                <circle
                  cx="50%"
                  cy="50%"
                  r="55"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  className={cn(
                    "text-gray-200 transition-all",
                    isActive && "text-amber-400"
                  )}
                  strokeDasharray={`${progress * 3.46} 346`}
                />
              </svg>

              {/* Time Text */}
              <div className="text-center z-10">
                <div className={cn(
                  "text-4xl font-bold font-mono",
                  isActive ? "text-amber-600" : "text-muted-foreground"
                )}>
                  {formatTime(timeLeft)}
                </div>
              </div>
            </div>
          </div>

          {/* Duration Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-muted-foreground">
                Durée
              </label>
              <span className="text-sm font-semibold text-foreground">
                {duration} min
              </span>
            </div>
            <Slider
              value={[duration]}
              onValueChange={handleDurationChange}
              min={25}
              max={90}
              step={5}
              disabled={isActive}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground px-1">
              <span>25 min</span>
              <span>90 min</span>
            </div>
          </div>

          {/* Control Button */}
          <Button
            onClick={toggleFocus}
            size="lg"
            className={cn(
              "w-full font-semibold transition-all",
              isActive
                ? "bg-amber-500 hover:bg-amber-600 text-white shadow-lg"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            )}
          >
            {isActive ? "⏸ Pause" : "▶ Commencer"}
          </Button>
        </CardContent>
      </Card>

      {/* Stats Card */}
      {totalFocusToday > 0 && (
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 p-3">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Temps focus aujourd'hui
                </p>
                <p className="text-2xl font-bold text-blue-600">
                  {totalFocusToday} min
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
