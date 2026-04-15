"use client";

import { SpinnerInfinity } from "spinners-react";

/**
 * AutoSchedulePanel Component
 *
 * AI-powered auto-scheduling interface for tasks.
 * Shows unscheduled tasks and provides smart scheduling suggestions.
 */

import * as React from "react";
import { format, addDays } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Sparkles,
  Play,
  Pause,
  Settings,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  Task,
  ScheduleBlock,
  AutoScheduleResult,
  AutoScheduleConstraints,
  AutoSchedulePreferences,
  DateRange,
} from "@/lib/scheduling/types";
import {
  autoScheduleTasks,
  previewAutoSchedule,
} from "@/lib/scheduling/ai/auto-scheduler";
import { PRIORITY_COLORS } from "@/lib/scheduling/types/time-item";

// ============================================================================
// Types
// ============================================================================

interface AutoSchedulePanelProps {
  tasks: Task[];
  existingEvents: ScheduleBlock[];
  onApplySchedule: (scheduled: Array<{ task: Task; slot: DateRange }>) => void;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function AutoSchedulePanel({
  tasks,
  existingEvents,
  onApplySchedule,
  className,
}: AutoSchedulePanelProps) {
  // State
  const [isOpen, setIsOpen] = React.useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [isScheduling, setIsScheduling] = React.useState(false);
  const [result, setResult] = React.useState<AutoScheduleResult | null>(null);
  const [previewMode, setPreviewMode] = React.useState(true);

  // Settings state
  const [constraints, setConstraints] = React.useState<AutoScheduleConstraints>(
    {
      dateRange: {
        start: new Date(),
        end: addDays(new Date(), 14),
      },
      workingHours: { start: 9, end: 18 },
      excludeDays: [0, 6],
      respectDeadlines: true,
      minBlockSize: 30,
      maxBlockSize: 180,
    },
  );

  const [preferences, setPreferences] = React.useState<AutoSchedulePreferences>(
    {
      preferMorning: false,
      groupSimilarTasks: true,
      bufferBetweenTasks: 15,
      prioritizeUrgent: true,
    },
  );

  // Filter unscheduled tasks
  const unscheduledTasks = React.useMemo(
    () => tasks.filter((t) => !t.start || t.status === "backlog"),
    [tasks],
  );

  // Preview stats
  const previewStats = React.useMemo(() => {
    if (!previewMode || unscheduledTasks.length === 0) return null;

    const preview = previewAutoSchedule(
      { tasks: unscheduledTasks, constraints, preferences },
      existingEvents,
    );

    return preview.stats;
  }, [unscheduledTasks, existingEvents, constraints, preferences, previewMode]);

  // Handle auto-schedule
  const handleAutoSchedule = React.useCallback(async () => {
    setIsScheduling(true);

    // Simulate async processing
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const scheduleResult = autoScheduleTasks(
      { tasks: unscheduledTasks, constraints, preferences },
      existingEvents,
    );

    setResult(scheduleResult);
    setIsScheduling(false);
  }, [unscheduledTasks, existingEvents, constraints, preferences]);

  // Handle apply
  const handleApply = React.useCallback(() => {
    if (!result) return;

    onApplySchedule(
      result.scheduled.map((s) => ({
        task: s.task,
        slot: s.suggestedSlot,
      })),
    );

    setResult(null);
  }, [result, onApplySchedule]);

  // Reset
  const handleReset = React.useCallback(() => {
    setResult(null);
  }, []);

  // Calculate stats
  const totalEstimatedMinutes = React.useMemo(
    () =>
      unscheduledTasks.reduce((sum, t) => sum + (t.estimatedMinutes || 60), 0),
    [unscheduledTasks],
  );

  return (
    <Card className={cn("overflow-hidden", className)}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-500" />
                <CardTitle className="text-base">Planification IA</CardTitle>
                {unscheduledTasks.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {unscheduledTasks.length} tâches
                  </Badge>
                )}
              </div>
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">
                    {unscheduledTasks.length}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Tâches à planifier
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">
                    {Math.round(totalEstimatedMinutes / 60)}h
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Temps estimé
                  </div>
                </div>
              </div>
            </div>

            {/* Preview Stats */}
            {previewStats && (
              <div className="p-3 rounded-lg border bg-purple-50/50 dark:bg-purple-950/20">
                <div className="flex items-center gap-2 text-sm text-purple-700 dark:text-purple-300">
                  <Zap className="h-4 w-4" />
                  <span>
                    <strong>{previewStats.schedulable}</strong> tâches peuvent
                    être planifiées automatiquement
                  </span>
                </div>
                {previewStats.conflicts > 0 && (
                  <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 mt-1">
                    <AlertTriangle className="h-4 w-4" />
                    <span>{previewStats.conflicts} conflits potentiels</span>
                  </div>
                )}
              </div>
            )}

            {/* Result Display */}
            {result && (
              <div className="space-y-3">
                {/* Success */}
                {result.scheduled.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>{result.scheduled.length} tâches planifiées</span>
                    </div>
                    <div className="max-h-32 overflow-y-auto space-y-1.5">
                      {result.scheduled.map((s) => (
                        <div
                          key={s.task.id}
                          className="flex items-center justify-between p-2 rounded bg-green-50 dark:bg-green-950/30 text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{
                                backgroundColor:
                                  PRIORITY_COLORS[s.task.priority || "medium"],
                              }}
                            />
                            <span className="truncate max-w-[150px]">
                              {s.task.title}
                            </span>
                          </div>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="text-xs text-muted-foreground">
                                  {format(
                                    s.suggestedSlot.start,
                                    "EEE d HH:mm",
                                    {
                                      locale: fr,
                                    },
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>
                                  Confiance: {Math.round(s.confidence * 100)}%
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Failures */}
                {result.unscheduled.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-red-600 dark:text-red-400">
                      <XCircle className="h-4 w-4" />
                      <span>
                        {result.unscheduled.length} tâches non planifiées
                      </span>
                    </div>
                    <div className="max-h-24 overflow-y-auto space-y-1.5">
                      {result.unscheduled.map((u) => (
                        <div
                          key={u.task.id}
                          className="p-2 rounded bg-red-50 dark:bg-red-950/30 text-sm"
                        >
                          <div className="font-medium truncate">
                            {u.task.title}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {u.reason}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Conflicts */}
                {result.conflicts.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="h-4 w-4" />
                      <span>{result.conflicts.length} avertissements</span>
                    </div>
                    <div className="space-y-1.5">
                      {result.conflicts.map((c) => (
                        <div
                          key={c.id}
                          className="p-2 rounded bg-amber-50 dark:bg-amber-950/30 text-sm"
                        >
                          {c.description}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Settings */}
            <Collapsible open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  <span>Paramètres</span>
                  <ChevronRight
                    className={cn(
                      "h-4 w-4 ml-auto transition-transform",
                      isSettingsOpen && "rotate-90",
                    )}
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-4">
                {/* Working Hours */}
                <div className="space-y-2">
                  <Label className="text-xs">
                    Heures de travail: {constraints.workingHours.start}h -{" "}
                    {constraints.workingHours.end}h
                  </Label>
                  <div className="flex gap-2">
                    <Slider
                      value={[constraints.workingHours.start]}
                      min={6}
                      max={12}
                      step={1}
                      className="flex-1"
                      onValueChange={([start]) =>
                        setConstraints((c) => ({
                          ...c,
                          workingHours: { ...c.workingHours, start },
                        }))
                      }
                    />
                    <Slider
                      value={[constraints.workingHours.end]}
                      min={15}
                      max={22}
                      step={1}
                      className="flex-1"
                      onValueChange={([end]) =>
                        setConstraints((c) => ({
                          ...c,
                          workingHours: { ...c.workingHours, end },
                        }))
                      }
                    />
                  </div>
                </div>

                {/* Buffer */}
                <div className="space-y-2">
                  <Label className="text-xs">
                    Pause entre tâches: {preferences.bufferBetweenTasks} min
                  </Label>
                  <Slider
                    value={[preferences.bufferBetweenTasks || 0]}
                    min={0}
                    max={60}
                    step={5}
                    onValueChange={([bufferBetweenTasks]) =>
                      setPreferences((p) => ({ ...p, bufferBetweenTasks }))
                    }
                  />
                </div>

                {/* Toggles */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="respect-deadlines" className="text-xs">
                      Respecter les deadlines
                    </Label>
                    <Switch
                      id="respect-deadlines"
                      checked={constraints.respectDeadlines}
                      onCheckedChange={(respectDeadlines) =>
                        setConstraints((c) => ({ ...c, respectDeadlines }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="prefer-morning" className="text-xs">
                      Préférer le matin
                    </Label>
                    <Switch
                      id="prefer-morning"
                      checked={preferences.preferMorning}
                      onCheckedChange={(preferMorning) =>
                        setPreferences((p) => ({ ...p, preferMorning }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="group-tasks" className="text-xs">
                      Grouper par projet
                    </Label>
                    <Switch
                      id="group-tasks"
                      checked={preferences.groupSimilarTasks}
                      onCheckedChange={(groupSimilarTasks) =>
                        setPreferences((p) => ({ ...p, groupSimilarTasks }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="prioritize-urgent" className="text-xs">
                      Priorité aux urgences
                    </Label>
                    <Switch
                      id="prioritize-urgent"
                      checked={preferences.prioritizeUrgent}
                      onCheckedChange={(prioritizeUrgent) =>
                        setPreferences((p) => ({ ...p, prioritizeUrgent }))
                      }
                    />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              {result ? (
                <>
                  <Button
                    onClick={handleApply}
                    className="flex-1"
                    disabled={result.scheduled.length === 0}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Appliquer
                  </Button>
                  <Button variant="outline" onClick={handleReset}>
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <Button
                  onClick={handleAutoSchedule}
                  className="flex-1"
                  disabled={isScheduling || unscheduledTasks.length === 0}
                >
                  {isScheduling ? (
                    <>
                      <SpinnerInfinity
                        size={24}
                        secondaryColor="rgba(128,128,128,0.2)"
                        color="currentColor"
                        speed={120}
                        className="h-4 w-4 mr-2 "
                      />
                      Planification...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Planifier automatiquement
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export default AutoSchedulePanel;
