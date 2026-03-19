'use client';

/**
 * RecurrenceEditor Component
 *
 * UI for editing recurrence rules for calendar events.
 * Supports daily, weekly, monthly, and yearly patterns.
 */

import * as React from 'react';
import { format, addDays, addWeeks, addMonths, addYears } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Calendar as CalendarIcon, X, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { ScheduleRecurrenceRule } from '@/lib/scheduling/types';

// ============================================================================
// Types
// ============================================================================

interface RecurrenceEditorProps {
  value?: ScheduleRecurrenceRule;
  onChange: (rule: ScheduleRecurrenceRule | undefined) => void;
  startDate?: Date;
  className?: string;
}

type FrequencyType = 'daily' | 'weekly' | 'monthly' | 'yearly';
type EndType = 'never' | 'count' | 'date';

const DAYS_OF_WEEK = [
  { value: 'MO', label: 'Lun', fullLabel: 'Lundi' },
  { value: 'TU', label: 'Mar', fullLabel: 'Mardi' },
  { value: 'WE', label: 'Mer', fullLabel: 'Mercredi' },
  { value: 'TH', label: 'Jeu', fullLabel: 'Jeudi' },
  { value: 'FR', label: 'Ven', fullLabel: 'Vendredi' },
  { value: 'SA', label: 'Sam', fullLabel: 'Samedi' },
  { value: 'SU', label: 'Dim', fullLabel: 'Dimanche' },
];

const FREQUENCY_LABELS: Record<FrequencyType, string> = {
  daily: 'Quotidien',
  weekly: 'Hebdomadaire',
  monthly: 'Mensuel',
  yearly: 'Annuel',
};

const ORDINAL_LABELS = [
  { value: '1', label: 'Premier' },
  { value: '2', label: 'Deuxième' },
  { value: '3', label: 'Troisième' },
  { value: '4', label: 'Quatrième' },
  { value: '-1', label: 'Dernier' },
];

// ============================================================================
// Component
// ============================================================================

export function RecurrenceEditor({
  value,
  onChange,
  startDate = new Date(),
  className,
}: RecurrenceEditorProps) {
  // Internal state
  const [frequency, setFrequency] = React.useState<FrequencyType>(
    value?.frequency === 'custom' ? 'weekly' : (value?.frequency || 'weekly')
  );
  const [interval, setInterval] = React.useState(value?.interval || 1);
  const [selectedDays, setSelectedDays] = React.useState<string[]>(
    value?.byDay || []
  );
  const [monthDay, setMonthDay] = React.useState<number | undefined>(
    value?.byMonthDay?.[0]
  );
  const [endType, setEndType] = React.useState<EndType>(
    value?.endDate ? 'date' : value?.count ? 'count' : 'never'
  );
  const [endDate, setEndDate] = React.useState<Date | undefined>(
    value?.endDate
  );
  const [count, setCount] = React.useState(value?.count || 10);

  // Sync external value changes
  React.useEffect(() => {
    if (value) {
      setFrequency(value.frequency === 'custom' ? 'weekly' : value.frequency);
      setInterval(value.interval || 1);
      setSelectedDays(value.byDay || []);
      setMonthDay(value.byMonthDay?.[0]);
      setEndType(value.endDate ? 'date' : value.count ? 'count' : 'never');
      setEndDate(value.endDate);
      setCount(value.count || 10);
    }
  }, [value]);

  // Build and emit rule on changes
  React.useEffect(() => {
    const rule: ScheduleRecurrenceRule = {
      frequency,
      interval,
    };

    if (frequency === 'weekly' && selectedDays.length > 0) {
      rule.byDay = selectedDays;
    }

    if (frequency === 'monthly' && monthDay) {
      rule.byMonthDay = [monthDay];
    }

    if (endType === 'date' && endDate) {
      rule.endDate = endDate;
    } else if (endType === 'count') {
      rule.count = count;
    }

    onChange(rule);
  }, [frequency, interval, selectedDays, monthDay, endType, endDate, count, onChange]);

  // Toggle day selection
  const toggleDay = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  // Calculate preview dates
  const previewDates = React.useMemo(() => {
    const dates: Date[] = [];
    let current = startDate;

    for (let i = 0; i < 3; i++) {
      switch (frequency) {
        case 'daily':
          current = addDays(current, interval);
          break;
        case 'weekly':
          current = addWeeks(current, interval);
          break;
        case 'monthly':
          current = addMonths(current, interval);
          break;
        case 'yearly':
          current = addYears(current, interval);
          break;
      }

      if (endType === 'date' && endDate && current > endDate) break;
      if (endType === 'count' && i >= count - 1) break;

      dates.push(current);
    }

    return dates;
  }, [startDate, frequency, interval, endType, endDate, count]);

  // Human-readable description
  const description = React.useMemo(() => {
    let desc = 'Répète ';

    switch (frequency) {
      case 'daily':
        desc += interval === 1 ? 'tous les jours' : `tous les ${interval} jours`;
        break;
      case 'weekly':
        if (interval === 1) {
          desc += 'chaque semaine';
        } else {
          desc += `toutes les ${interval} semaines`;
        }
        if (selectedDays.length > 0) {
          const dayNames = selectedDays
            .map((d) => DAYS_OF_WEEK.find((day) => day.value === d)?.fullLabel)
            .filter(Boolean)
            .join(', ');
          desc += ` le ${dayNames}`;
        }
        break;
      case 'monthly':
        if (interval === 1) {
          desc += 'chaque mois';
        } else {
          desc += `tous les ${interval} mois`;
        }
        if (monthDay) {
          desc += ` le ${monthDay}`;
        }
        break;
      case 'yearly':
        desc += interval === 1 ? 'chaque année' : `tous les ${interval} ans`;
        break;
    }

    if (endType === 'count') {
      desc += `, ${count} fois`;
    } else if (endType === 'date' && endDate) {
      desc += `, jusqu'au ${format(endDate, 'd MMMM yyyy', { locale: fr })}`;
    }

    return desc;
  }, [frequency, interval, selectedDays, monthDay, endType, endDate, count]);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Frequency Selection */}
      <div className="space-y-2">
        <Label>Fréquence</Label>
        <Select
          value={frequency}
          onValueChange={(val) => setFrequency(val as FrequencyType)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(FREQUENCY_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Interval */}
      <div className="space-y-2">
        <Label>Intervalle</Label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Tous les</span>
          <Input
            type="number"
            min={1}
            max={99}
            value={interval}
            onChange={(e) => setInterval(parseInt(e.target.value, 10) || 1)}
            className="w-16"
          />
          <span className="text-sm text-muted-foreground">
            {frequency === 'daily' && (interval === 1 ? 'jour' : 'jours')}
            {frequency === 'weekly' &&
              (interval === 1 ? 'semaine' : 'semaines')}
            {frequency === 'monthly' && 'mois'}
            {frequency === 'yearly' && (interval === 1 ? 'an' : 'ans')}
          </span>
        </div>
      </div>

      {/* Weekly Day Selection */}
      {frequency === 'weekly' && (
        <div className="space-y-2">
          <Label>Jours de la semaine</Label>
          <div className="flex flex-wrap gap-1">
            {DAYS_OF_WEEK.map((day) => (
              <TooltipProvider key={day.value}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant={selectedDays.includes(day.value) ? 'default' : 'outline'}
                      size="sm"
                      className="w-10 h-10 p-0"
                      onClick={() => toggleDay(day.value)}
                    >
                      {day.label}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{day.fullLabel}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        </div>
      )}

      {/* Monthly Day Selection */}
      {frequency === 'monthly' && (
        <div className="space-y-2">
          <Label>Jour du mois</Label>
          <Select
            value={monthDay?.toString() || ''}
            onValueChange={(val) => setMonthDay(parseInt(val, 10))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner un jour" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                <SelectItem key={day} value={day.toString()}>
                  {day}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* End Type */}
      <div className="space-y-3">
        <Label>Fin de la récurrence</Label>
        <RadioGroup
          value={endType}
          onValueChange={(val) => setEndType(val as EndType)}
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="never" id="end-never" />
            <Label htmlFor="end-never" className="font-normal">
              Jamais
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <RadioGroupItem value="count" id="end-count" />
            <Label htmlFor="end-count" className="font-normal">
              Après
            </Label>
            <Input
              type="number"
              min={1}
              max={999}
              value={count}
              onChange={(e) => setCount(parseInt(e.target.value, 10) || 1)}
              disabled={endType !== 'count'}
              className="w-16 h-8"
            />
            <span className="text-sm text-muted-foreground">occurrences</span>
          </div>

          <div className="flex items-center space-x-2">
            <RadioGroupItem value="date" id="end-date" />
            <Label htmlFor="end-date" className="font-normal">
              Le
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={endType !== 'date'}
                  className={cn(
                    'w-[180px] justify-start text-left font-normal',
                    !endDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? (
                    format(endDate, 'PPP', { locale: fr })
                  ) : (
                    <span>Choisir une date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  locale={fr}
                  disabled={(date) => date < startDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </RadioGroup>
      </div>

      {/* Description Preview */}
      <div className="p-3 rounded-lg bg-muted/50 space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Info className="h-4 w-4" />
          <span>{description}</span>
        </div>

        {previewDates.length > 0 && (
          <div className="text-xs text-muted-foreground">
            Prochaines dates:{' '}
            {previewDates
              .map((d) => format(d, 'd MMM', { locale: fr }))
              .join(', ')}
            ...
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Compact Version
// ============================================================================

interface RecurrenceSelectProps {
  value?: ScheduleRecurrenceRule;
  onChange: (rule: ScheduleRecurrenceRule | undefined) => void;
  className?: string;
}

export function RecurrenceSelect({
  value,
  onChange,
  className,
}: RecurrenceSelectProps) {
  const [isCustom, setIsCustom] = React.useState(false);

  // Quick presets
  const presets: Array<{
    label: string;
    value: ScheduleRecurrenceRule | undefined;
  }> = [
    { label: 'Une fois', value: undefined },
    { label: 'Tous les jours', value: { frequency: 'daily', interval: 1 } },
    { label: 'Chaque semaine', value: { frequency: 'weekly', interval: 1 } },
    { label: 'Tous les 2 semaines', value: { frequency: 'weekly', interval: 2 } },
    { label: 'Chaque mois', value: { frequency: 'monthly', interval: 1 } },
    { label: 'Chaque année', value: { frequency: 'yearly', interval: 1 } },
  ];

  const currentPreset = React.useMemo(() => {
    if (!value) return 'Une fois';

    const match = presets.find(
      (p) =>
        p.value?.frequency === value.frequency &&
        p.value?.interval === value.interval &&
        !value.byDay?.length &&
        !value.byMonth?.length &&
        !value.byMonthDay?.length
    );

    return match?.label || 'Personnalisé';
  }, [value]);

  if (isCustom) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="flex items-center justify-between">
          <Label>Récurrence personnalisée</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsCustom(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <RecurrenceEditor value={value} onChange={onChange} />
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      <Label>Récurrence</Label>
      <Select
        value={currentPreset}
        onValueChange={(val) => {
          if (val === 'Personnalisé') {
            setIsCustom(true);
          } else {
            const preset = presets.find((p) => p.label === val);
            if (preset !== undefined) {
              onChange(preset.value);
            }
          }
        }}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {presets.map((preset) => (
            <SelectItem key={preset.label} value={preset.label}>
              {preset.label}
            </SelectItem>
          ))}
          <SelectItem value="Personnalisé">Personnalisé...</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export default RecurrenceEditor;
