'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Copy,
  Clock,
  Users,
  GripVertical,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { CoverageSlot, WeeklyPattern, FunctionDefinition } from '@/types/workforce';

// Days of the week configuration
const DAYS_OF_WEEK = [
  { key: 'monday' as const, label: 'Lundi', short: 'Lun', dayIndex: 1 },
  { key: 'tuesday' as const, label: 'Mardi', short: 'Mar', dayIndex: 2 },
  { key: 'wednesday' as const, label: 'Mercredi', short: 'Mer', dayIndex: 3 },
  { key: 'thursday' as const, label: 'Jeudi', short: 'Jeu', dayIndex: 4 },
  { key: 'friday' as const, label: 'Vendredi', short: 'Ven', dayIndex: 5 },
  { key: 'saturday' as const, label: 'Samedi', short: 'Sam', dayIndex: 6 },
  { key: 'sunday' as const, label: 'Dimanche', short: 'Dim', dayIndex: 0 },
] as const;

type DayKey = (typeof DAYS_OF_WEEK)[number]['key'];

const EMPTY_PATTERN: WeeklyPattern = {
  monday: [],
  tuesday: [],
  wednesday: [],
  thursday: [],
  friday: [],
  saturday: [],
  sunday: [],
};

interface CoverageEditorProps {
  value: WeeklyPattern;
  onChange: (pattern: WeeklyPattern) => void;
  availableFunctions?: FunctionDefinition[];
  readOnly?: boolean;
  className?: string;
}

interface SlotFormData {
  start_time: string;
  end_time: string;
  min_employees: number;
  max_employees?: number;
  required_functions: string[];
  label?: string;
}

const DEFAULT_SLOT: SlotFormData = {
  start_time: '09:00',
  end_time: '17:00',
  min_employees: 1,
  required_functions: [],
};

export function CoverageEditor({
  value = EMPTY_PATTERN,
  onChange,
  availableFunctions = [],
  readOnly = false,
  className,
}: CoverageEditorProps) {
  const [selectedDay, setSelectedDay] = useState<DayKey | null>(null);
  const [editingSlot, setEditingSlot] = useState<{ day: DayKey; index: number } | null>(null);
  const [slotForm, setSlotForm] = useState<SlotFormData>(DEFAULT_SLOT);
  const [showSlotDialog, setShowSlotDialog] = useState(false);

  // Calculate total hours per day
  const dayStats = useMemo(() => {
    const stats: Record<DayKey, { slotCount: number; totalHours: number; totalEmployees: number }> = {
      monday: { slotCount: 0, totalHours: 0, totalEmployees: 0 },
      tuesday: { slotCount: 0, totalHours: 0, totalEmployees: 0 },
      wednesday: { slotCount: 0, totalHours: 0, totalEmployees: 0 },
      thursday: { slotCount: 0, totalHours: 0, totalEmployees: 0 },
      friday: { slotCount: 0, totalHours: 0, totalEmployees: 0 },
      saturday: { slotCount: 0, totalHours: 0, totalEmployees: 0 },
      sunday: { slotCount: 0, totalHours: 0, totalEmployees: 0 },
    };

    for (const day of DAYS_OF_WEEK) {
      const slots = value[day.key] || [];
      stats[day.key].slotCount = slots.length;
      for (const slot of slots) {
        const [startH, startM] = slot.start_time.split(':').map(Number);
        const [endH, endM] = slot.end_time.split(':').map(Number);
        const hours = (endH * 60 + endM - startH * 60 - startM) / 60;
        stats[day.key].totalHours += hours;
        stats[day.key].totalEmployees += slot.min_employees;
      }
    }

    return stats;
  }, [value]);

  // Open slot dialog for adding/editing
  const openSlotDialog = useCallback((day: DayKey, index?: number) => {
    setSelectedDay(day);
    if (index !== undefined) {
      const slot = value[day][index];
      setEditingSlot({ day, index });
      setSlotForm({
        start_time: slot.start_time,
        end_time: slot.end_time,
        min_employees: slot.min_employees,
        max_employees: slot.max_employees,
        required_functions: slot.required_functions,
        label: slot.label,
      });
    } else {
      setEditingSlot(null);
      setSlotForm(DEFAULT_SLOT);
    }
    setShowSlotDialog(true);
  }, [value]);

  // Save slot from dialog
  const saveSlot = useCallback(() => {
    if (!selectedDay) return;

    const dayIndex = DAYS_OF_WEEK.find(d => d.key === selectedDay)?.dayIndex ?? 0;
    const newSlot: CoverageSlot = {
      day_of_week: dayIndex,
      start_time: slotForm.start_time,
      end_time: slotForm.end_time,
      min_employees: slotForm.min_employees,
      max_employees: slotForm.max_employees,
      required_functions: slotForm.required_functions,
      label: slotForm.label,
    };

    const newPattern = { ...value };
    if (editingSlot) {
      // Update existing slot
      newPattern[selectedDay] = [...value[selectedDay]];
      newPattern[selectedDay][editingSlot.index] = newSlot;
    } else {
      // Add new slot
      newPattern[selectedDay] = [...(value[selectedDay] || []), newSlot];
    }

    // Sort slots by start time
    newPattern[selectedDay].sort((a, b) => a.start_time.localeCompare(b.start_time));

    onChange(newPattern);
    setShowSlotDialog(false);
  }, [selectedDay, slotForm, editingSlot, value, onChange]);

  // Delete a slot
  const deleteSlot = useCallback((day: DayKey, index: number) => {
    const newPattern = { ...value };
    newPattern[day] = value[day].filter((_, i) => i !== index);
    onChange(newPattern);
  }, [value, onChange]);

  // Copy slots from one day to another
  const copyDaySlots = useCallback((fromDay: DayKey, toDay: DayKey) => {
    const toDayIndex = DAYS_OF_WEEK.find(d => d.key === toDay)?.dayIndex ?? 0;
    const newPattern = { ...value };
    newPattern[toDay] = value[fromDay].map(slot => ({
      ...slot,
      day_of_week: toDayIndex,
    }));
    onChange(newPattern);
  }, [value, onChange]);

  // Render a single slot
  const renderSlot = (slot: CoverageSlot, day: DayKey, index: number) => {
    const functionBadges = slot.required_functions.map(f => {
      const fn = availableFunctions.find(def => def.code === f);
      return fn?.name || f;
    });

    return (
      <div
        key={`${day}-${index}`}
        className={cn(
          'group flex items-center gap-2 rounded-md border bg-card p-2 text-sm',
          !readOnly && 'cursor-pointer hover:border-primary/50'
        )}
        onClick={() => !readOnly && openSlotDialog(day, index)}
      >
        {!readOnly && (
          <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
        )}

        <div className="flex flex-1 items-center gap-3 overflow-hidden">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span className="font-mono text-xs">
              {slot.start_time} - {slot.end_time}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs">
              {slot.min_employees}
              {slot.max_employees && slot.max_employees !== slot.min_employees && (
                <span className="text-muted-foreground">-{slot.max_employees}</span>
              )}
            </span>
          </div>

          {slot.label && (
            <Badge variant="outline" className="h-5 px-1.5 text-xs">
              {slot.label}
            </Badge>
          )}

          {functionBadges.length > 0 && (
            <div className="flex gap-1 overflow-hidden">
              {functionBadges.slice(0, 2).map((name, i) => (
                <Badge key={i} variant="secondary" className="h-5 shrink-0 px-1.5 text-xs">
                  {name}
                </Badge>
              ))}
              {functionBadges.length > 2 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                  +{functionBadges.length - 2}
                </Badge>
              )}
            </div>
          )}
        </div>

        {!readOnly && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              deleteSlot(day, index);
            }}
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        )}
      </div>
    );
  };

  // Render a day column
  const renderDayColumn = (day: (typeof DAYS_OF_WEEK)[number]) => {
    const slots = value[day.key] || [];
    const stats = dayStats[day.key];
    const isExpanded = selectedDay === day.key;

    return (
      <div
        key={day.key}
        className={cn(
          'flex flex-col rounded-lg border bg-muted/30 p-3',
          isExpanded && 'ring-2 ring-primary/20'
        )}
      >
        {/* Day header */}
        <div
          className="mb-2 flex items-center justify-between cursor-pointer"
          onClick={() => setSelectedDay(isExpanded ? null : day.key)}
        >
          <div className="flex items-center gap-2">
            <span className="font-medium">{day.short}</span>
            {stats.slotCount > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                {stats.slotCount}
              </Badge>
            )}
          </div>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>

        {/* Stats */}
        {stats.slotCount > 0 && !isExpanded && (
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{stats.totalHours.toFixed(1)}h</span>
            <Users className="ml-2 h-3 w-3" />
            <span>{stats.totalEmployees}</span>
          </div>
        )}

        {/* Slots list (expanded) */}
        {isExpanded && (
          <div className="space-y-2">
            {slots.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                Aucun créneau défini
              </p>
            ) : (
              slots.map((slot, index) => renderSlot(slot, day.key, index))
            )}

            {!readOnly && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => openSlotDialog(day.key)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Ajouter un créneau
              </Button>
            )}
          </div>
        )}

        {/* Quick actions (collapsed) */}
        {!isExpanded && !readOnly && (
          <TooltipProvider>
            <div className="mt-auto flex justify-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      openSlotDialog(day.key);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Ajouter un créneau</TooltipContent>
              </Tooltip>

              {slots.length > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Copy to next day
                        const currentIndex = DAYS_OF_WEEK.findIndex(d => d.key === day.key);
                        const nextDay = DAYS_OF_WEEK[(currentIndex + 1) % 7];
                        copyDaySlots(day.key, nextDay.key);
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Copier vers le jour suivant</TooltipContent>
                </Tooltip>
              )}
            </div>
          </TooltipProvider>
        )}
      </div>
    );
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Weekly grid */}
      <div className="grid grid-cols-7 gap-2">
        {DAYS_OF_WEEK.map(renderDayColumn)}
      </div>

      {/* Slot edit dialog */}
      <Dialog open={showSlotDialog} onOpenChange={setShowSlotDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingSlot ? 'Modifier le créneau' : 'Nouveau créneau'}
            </DialogTitle>
            <DialogDescription>
              Définissez les horaires et les exigences de personnel pour ce créneau.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Time range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_time">Début</Label>
                <Input
                  id="start_time"
                  type="time"
                  value={slotForm.start_time}
                  onChange={(e) => setSlotForm({ ...slotForm, start_time: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_time">Fin</Label>
                <Input
                  id="end_time"
                  type="time"
                  value={slotForm.end_time}
                  onChange={(e) => setSlotForm({ ...slotForm, end_time: e.target.value })}
                />
              </div>
            </div>

            {/* Employee counts */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="min_employees">Employés min.</Label>
                <Input
                  id="min_employees"
                  type="number"
                  min={0}
                  value={slotForm.min_employees}
                  onChange={(e) => setSlotForm({ ...slotForm, min_employees: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_employees">Employés max.</Label>
                <Input
                  id="max_employees"
                  type="number"
                  min={slotForm.min_employees}
                  placeholder="Illimité"
                  value={slotForm.max_employees ?? ''}
                  onChange={(e) => setSlotForm({
                    ...slotForm,
                    max_employees: e.target.value ? parseInt(e.target.value) : undefined
                  })}
                />
              </div>
            </div>

            {/* Label */}
            <div className="space-y-2">
              <Label htmlFor="label">Étiquette (optionnel)</Label>
              <Input
                id="label"
                placeholder="ex: Pause déjeuner"
                value={slotForm.label ?? ''}
                onChange={(e) => setSlotForm({ ...slotForm, label: e.target.value || undefined })}
              />
            </div>

            {/* Required functions */}
            {availableFunctions.length > 0 && (
              <div className="space-y-2">
                <Label>Fonctions requises</Label>
                <Select
                  value=""
                  onValueChange={(code) => {
                    if (!slotForm.required_functions.includes(code)) {
                      setSlotForm({
                        ...slotForm,
                        required_functions: [...slotForm.required_functions, code],
                      });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Ajouter une fonction requise..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableFunctions
                      .filter(f => !slotForm.required_functions.includes(f.code))
                      .map((fn) => (
                        <SelectItem key={fn.id} value={fn.code}>
                          {fn.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>

                {slotForm.required_functions.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {slotForm.required_functions.map((code) => {
                      const fn = availableFunctions.find(f => f.code === code);
                      return (
                        <Badge key={code} variant="secondary" className="gap-1">
                          {fn?.name || code}
                          <button
                            className="ml-1 hover:text-destructive"
                            onClick={() => setSlotForm({
                              ...slotForm,
                              required_functions: slotForm.required_functions.filter(c => c !== code),
                            })}
                          >
                            ×
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSlotDialog(false)}>
              Annuler
            </Button>
            <Button onClick={saveSlot}>
              {editingSlot ? 'Mettre à jour' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Export types
export type { CoverageEditorProps };
