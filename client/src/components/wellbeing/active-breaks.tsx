"use client";

import { useEffect, useState } from "react";
import { Play, Pause, Clock, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Exercise {
  name: string;
  description: string;
  duration: number;
}

export default function ActiveBreaks() {
  const [timeRemaining, setTimeRemaining] = useState(300); // 5 minutes
  const [isRunning, setIsRunning] = useState(false);
  const [currentExercise, setCurrentExercise] = useState(0);

  const exercises: Exercise[] = [
    { name: "Neck Rolls", description: "Slow circular motion", duration: 60 },
    { name: "Shoulder Shrugs", description: "Up and down, 10 reps", duration: 45 },
    { name: "Wrist Stretches", description: "Extend arms, gentle pull", duration: 60 },
    { name: "Eye Focus", description: "Look away from screen", duration: 120 },
    { name: "Standing Stretch", description: "Full body extension", duration: 75 },
  ];

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, timeRemaining]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSnooze = () => {
    setTimeRemaining(300);
    setIsRunning(false);
    const nextExercise = (currentExercise + 1) % exercises.length;
    setCurrentExercise(nextExercise);
  };

  const handleSkip = () => {
    const nextExercise = (currentExercise + 1) % exercises.length;
    setCurrentExercise(nextExercise);
    setTimeRemaining(300);
  };

  const exercise = exercises[currentExercise];

  return (
    <div className="space-y-6 p-4">
      <h2 className="text-2xl font-bold">Active Breaks</h2>

      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-2">Break Time</p>
          <div className="text-6xl font-bold text-blue-600 font-mono mb-4">
            {formatTime(timeRemaining)}
          </div>
          <div className="flex justify-center gap-3">
            <Button
              size="lg"
              onClick={() => setIsRunning(!isRunning)}
              className={isRunning ? "bg-orange-500 hover:bg-orange-600" : "bg-green-500 hover:bg-green-600"}
            >
              {isRunning ? (
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
            <Button size="lg" variant="outline" onClick={() => setTimeRemaining(300)}>
              <Clock className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-card p-4 rounded-lg border border-border">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-orange-500" />
          Current Exercise
        </h3>
        <div className="space-y-4">
          <div>
            <h4 className="text-xl font-bold text-foreground">{exercise.name}</h4>
            <p className="text-sm text-muted-foreground mt-1">{exercise.description}</p>
            <p className="text-xs text-muted-foreground mt-2">Duration: ~{exercise.duration}s</p>
          </div>
          <div className="bg-orange-50 p-3 rounded border border-orange-200">
            <p className="text-sm text-orange-900">
              Exercise {currentExercise + 1} of {exercises.length}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold">Upcoming Exercises</h3>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {exercises.map((ex, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-lg text-sm ${
                idx === currentExercise ? "bg-blue-100 border border-blue-300" : "bg-muted border border-border"
              }`}
            >
              <p className="font-medium">{ex.name}</p>
              <p className="text-xs text-muted-foreground">{ex.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={handleSkip}>
          Next Exercise
        </Button>
        <Button variant="outline" className="flex-1" onClick={handleSnooze}>
          Snooze (15 min)
        </Button>
      </div>
    </div>
  );
}
