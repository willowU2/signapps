'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { TimeEntryForm, type TimeEntryFormValues } from '@/components/timesheet/time-entry-form';
import { usePageTitle } from '@/hooks/use-page-title';
import {
  Play,
  Pause,
  Square,
  Plus,
  Download,
  Clock,
  DollarSign,
  Calendar,
  Timer,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TimeEntry {
  id: string;
  taskName: string;
  date: string;
  durationSeconds: number;
  billable: boolean;
  source: 'timer' | 'manual';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  return new Date(d.setDate(diff));
}

function isSameWeek(dateStr: string): boolean {
  const d = new Date(dateStr);
  const weekStart = getWeekStart(new Date());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  return d >= weekStart && d < weekEnd;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TimesheetPage() {
  usePageTitle('Pointage');

  const [entries, setEntries] = useState<TimeEntry[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      return JSON.parse(localStorage.getItem('timesheet-entries') ?? '[]');
    } catch {
      return [];
    }
  });

  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [currentTaskName, setCurrentTaskName] = useState('');
  const [timerBillable, setTimerBillable] = useState(true);
  const [showManualForm, setShowManualForm] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Persist entries
  useEffect(() => {
    localStorage.setItem('timesheet-entries', JSON.stringify(entries));
  }, [entries]);

  // Timer tick
  useEffect(() => {
    if (timerRunning) {
      intervalRef.current = setInterval(() => {
        setTimerSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timerRunning]);

  const handleStartPause = () => {
    if (!timerRunning && timerSeconds === 0 && !currentTaskName.trim()) {
      toast.error('Entrez le nom de la tache avant de demarrer.');
      return;
    }
    setTimerRunning((r) => !r);
  };

  const handleStop = () => {
    if (timerSeconds === 0) return;
    setTimerRunning(false);
    const entry: TimeEntry = {
      id: `te-${Date.now()}`,
      taskName: currentTaskName.trim() || 'Tache sans titre',
      date: new Date().toISOString().slice(0, 10),
      durationSeconds: timerSeconds,
      billable: timerBillable,
      source: 'timer',
    };
    setEntries((prev) => [entry, ...prev]);
    setTimerSeconds(0);
    setCurrentTaskName('');
    toast.success('Entree enregistree.');
  };

  const handleManualSubmit = useCallback((values: TimeEntryFormValues) => {
    const entry: TimeEntry = {
      id: `te-${Date.now()}`,
      taskName: values.taskName,
      date: values.date,
      durationSeconds: values.hours * 3600 + values.minutes * 60,
      billable: values.billable,
      source: 'manual',
    };
    setEntries((prev) => [entry, ...prev]);
    setShowManualForm(false);
    toast.success('Entree ajoutee.');
  }, []);

  const handleDeleteEntry = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  // Weekly summary
  const weekEntries = entries.filter((e) => isSameWeek(e.date));
  const totalWeekSeconds = weekEntries.reduce((a, e) => a + e.durationSeconds, 0);
  const billableWeekSeconds = weekEntries.filter((e) => e.billable).reduce((a, e) => a + e.durationSeconds, 0);

  // Export to billing (placeholder — dispatches custom event that billing module can listen to)
  const exportToBilling = () => {
    const billableEntries = weekEntries.filter((e) => e.billable);
    if (billableEntries.length === 0) {
      toast.info('Aucune entree facturable cette semaine.');
      return;
    }
    window.dispatchEvent(
      new CustomEvent('billing:import-time-entries', { detail: billableEntries }),
    );
    toast.success(`${billableEntries.length} entree(s) exportee(s) vers Billing.`);
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Timer className="h-7 w-7" />
              Pointage
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Suivez votre temps par tache, exportez vers la facturation
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={exportToBilling}>
            <DollarSign className="h-4 w-4 mr-2" />
            Exporter vers Billing
          </Button>
        </div>

        {/* Weekly summary */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Total semaine
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-2xl font-bold">{formatDuration(totalWeekSeconds)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Facturable
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {formatDuration(billableWeekSeconds)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Entrees
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-2xl font-bold">{weekEntries.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Timer */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Chronometre
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Nom de la tache..."
                value={currentTaskName}
                onChange={(e) => setCurrentTaskName(e.target.value)}
                className="flex-1 bg-muted rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                disabled={timerRunning}
              />
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={timerBillable}
                  onChange={(e) => setTimerBillable(e.target.checked)}
                  className="rounded"
                  disabled={timerRunning}
                />
                Facturable
              </label>
            </div>
            <div className="flex items-center gap-4">
              <span
                className={cn(
                  'text-4xl font-mono font-bold tabular-nums min-w-[120px]',
                  timerRunning && 'text-primary',
                )}
              >
                {formatDuration(timerSeconds)}
              </span>
              <Button
                variant={timerRunning ? 'outline' : 'default'}
                size="icon"
                onClick={handleStartPause}
                title={timerRunning ? 'Pause' : 'Demarrer'}
              >
                {timerRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleStop}
                disabled={timerSeconds === 0}
                title="Arreter et sauvegarder"
              >
                <Square className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Manual entry */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Historique
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowManualForm((v) => !v)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Saisie manuelle
          </Button>
        </div>

        {showManualForm && (
          <Card>
            <CardContent className="pt-4">
              <TimeEntryForm
                onSubmit={handleManualSubmit}
                onCancel={() => setShowManualForm(false)}
              />
            </CardContent>
          </Card>
        )}

        {/* Entries list */}
        <div className="space-y-2">
          {entries.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucune entree enregistree. Demarrez le chronometre ou ajoutez une saisie manuelle.
            </p>
          )}
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent/30 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{entry.taskName}</p>
                <p className="text-xs text-muted-foreground">{entry.date}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge
                  variant={entry.billable ? 'default' : 'secondary'}
                  className={cn(
                    'text-[10px]',
                    entry.billable &&
                      'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30',
                  )}
                >
                  {entry.billable ? 'Facturable' : 'Non facturable'}
                </Badge>
                <span className="font-mono text-sm font-semibold">
                  {formatDuration(entry.durationSeconds)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDeleteEntry(entry.id)}
                >
                  <span className="sr-only">Supprimer</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
