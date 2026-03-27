"use client";

import { useState, useEffect } from "react";
import { Play, Pause, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TimeTrackerProps {
  onEntryComplete: (entry: { project: string; task: string; duration: number }) => void;
}

const PROJECTS = ["Web App", "Mobile", "Documentation", "Backend"];
const TASKS = ["Development", "Testing", "Design", "Research", "Code Review"];

export function TimeTracker({ onEntryComplete }: TimeTrackerProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [selectedTask, setSelectedTask] = useState<string>("");

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isRunning && !isPaused) {
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isRunning, isPaused]);

  const handleStart = () => {
    if (!selectedProject || !selectedTask) {
      toast.error("Please select a project and task");
      return;
    }
    setIsRunning(true);
    setIsPaused(false);
  };

  const handlePause = () => {
    setIsPaused(!isPaused);
  };

  const handleStop = () => {
    if (elapsedSeconds > 0) {
      onEntryComplete({
        project: selectedProject,
        task: selectedTask,
        duration: elapsedSeconds,
      });
    }
    setIsRunning(false);
    setIsPaused(false);
    setElapsedSeconds(0);
    setSelectedProject("");
    setSelectedTask("");
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6 rounded-lg border p-6 shadow-sm">
      <h2 className="text-xl font-semibold">Time Tracker</h2>

      {/* Elapsed Time Display */}
      <div className="rounded-md bg-muted p-6 text-center">
        <p className="mb-2 text-sm text-muted-foreground">Elapsed Time</p>
        <p className="font-mono text-5xl font-bold tracking-wider">
          {formatTime(elapsedSeconds)}
        </p>
      </div>

      {/* Project Selector */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Project</label>
        <Select value={selectedProject} onValueChange={setSelectedProject} disabled={isRunning}>
          <SelectTrigger>
            <SelectValue placeholder="Select a project" />
          </SelectTrigger>
          <SelectContent>
            {PROJECTS.map((project) => (
              <SelectItem key={project} value={project}>
                {project}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Task Selector */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Task</label>
        <Select value={selectedTask} onValueChange={setSelectedTask} disabled={isRunning}>
          <SelectTrigger>
            <SelectValue placeholder="Select a task" />
          </SelectTrigger>
          <SelectContent>
            {TASKS.map((task) => (
              <SelectItem key={task} value={task}>
                {task}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Control Buttons */}
      <div className="flex gap-3">
        {!isRunning ? (
          <Button onClick={handleStart} size="lg" className="flex-1 gap-2">
            <Play className="h-4 w-4" />
            Start
          </Button>
        ) : (
          <>
            <Button
              onClick={handlePause}
              variant="outline"
              size="lg"
              className="flex-1 gap-2"
            >
              <Pause className="h-4 w-4" />
              {isPaused ? "Resume" : "Pause"}
            </Button>
            <Button
              onClick={handleStop}
              variant="destructive"
              size="lg"
              className="flex-1 gap-2"
            >
              <Square className="h-4 w-4" />
              Stop
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
