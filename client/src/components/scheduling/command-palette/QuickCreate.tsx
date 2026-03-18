'use client';

/**
 * QuickCreate Component
 *
 * Natural language event creation with intelligent parsing.
 * Supports quick creation of events, tasks, and bookings.
 */

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Tag,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Sparkles,
} from 'lucide-react';
import {
  format,
  parse,
  addHours,
  setHours,
  setMinutes,
  isToday,
  isTomorrow,
  addDays,
  nextMonday,
  nextFriday,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSchedulingNavigation } from '@/stores/scheduling-store';
import { useCreateEvent } from '@/lib/scheduling/api/calendar';
import type { ParsedInput, RecurrenceRule, Priority, EventTemplate } from '@/lib/scheduling/types/scheduling';

// ============================================================================
// Types
// ============================================================================

interface QuickCreateProps {
  isOpen: boolean;
  onClose: () => void;
  defaultDate?: Date;
  templates?: EventTemplate[];
  className?: string;
}

interface ParseResult {
  title: string;
  date?: Date;
  time?: string;
  duration?: number;
  location?: string;
  participants?: string[];
  recurrence?: RecurrenceRule;
  priority?: Priority;
  confidence: number;
}

// ============================================================================
// NLP Parser (Simplified)
// ============================================================================

function parseNaturalLanguage(input: string): ParseResult {
  const result: ParseResult = {
    title: input,
    confidence: 0.5,
  };

  let remaining = input.trim();
  const today = new Date();

  // ---- Date Parsing ----

  // "demain"
  if (/\bdemain\b/i.test(remaining)) {
    result.date = addDays(today, 1);
    remaining = remaining.replace(/\bdemain\b/i, '');
    result.confidence += 0.1;
  }
  // "aujourd'hui"
  else if (/\baujourd'?hui\b/i.test(remaining)) {
    result.date = today;
    remaining = remaining.replace(/\baujourd'?hui\b/i, '');
    result.confidence += 0.1;
  }
  // "lundi", "mardi", etc.
  else if (/\blundi\b/i.test(remaining)) {
    result.date = nextMonday(today);
    remaining = remaining.replace(/\blundi\b/i, '');
    result.confidence += 0.1;
  }
  else if (/\bvendredi\b/i.test(remaining)) {
    result.date = nextFriday(today);
    remaining = remaining.replace(/\bvendredi\b/i, '');
    result.confidence += 0.1;
  }
  // "le XX" (date numérique)
  else {
    const dateMatch = remaining.match(/\ble\s+(\d{1,2})(?:\s+(\w+))?\b/i);
    if (dateMatch) {
      const day = parseInt(dateMatch[1], 10);
      const targetDate = new Date(today);
      targetDate.setDate(day);
      if (targetDate < today) {
        targetDate.setMonth(targetDate.getMonth() + 1);
      }
      result.date = targetDate;
      remaining = remaining.replace(dateMatch[0], '');
      result.confidence += 0.1;
    }
  }

  // ---- Time Parsing ----

  // "à XXh" ou "à XX:XX"
  const timeMatch = remaining.match(/\bà\s*(\d{1,2})(?:h|:)(\d{0,2})?\b/i);
  if (timeMatch) {
    const hour = parseInt(timeMatch[1], 10);
    const minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    result.time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

    if (result.date) {
      result.date = setMinutes(setHours(result.date, hour), minute);
    }

    remaining = remaining.replace(timeMatch[0], '');
    result.confidence += 0.1;
  }

  // ---- Duration Parsing ----

  // "pendant Xh" ou "X heures"
  const durationMatch = remaining.match(/\b(?:pendant\s+)?(\d+)\s*(?:h(?:eure)?s?|min(?:ute)?s?)\b/i);
  if (durationMatch) {
    const value = parseInt(durationMatch[1], 10);
    const isMinutes = /min/i.test(durationMatch[0]);
    result.duration = isMinutes ? value : value * 60;
    remaining = remaining.replace(durationMatch[0], '');
    result.confidence += 0.1;
  }

  // ---- Location Parsing ----

  // "à/au/en [lieu]" (après la date/heure)
  const locationMatch = remaining.match(/\b(?:à|au|en)\s+([A-Za-zÀ-ÿ\s]+?)(?:\s+avec|\s*$)/i);
  if (locationMatch && !timeMatch) {
    result.location = locationMatch[1].trim();
    remaining = remaining.replace(locationMatch[0], locationMatch[0].includes('avec') ? ' avec' : '');
    result.confidence += 0.1;
  }

  // ---- Participants Parsing ----

  // "avec X, Y et Z"
  const participantsMatch = remaining.match(/\bavec\s+(.+)/i);
  if (participantsMatch) {
    const names = participantsMatch[1]
      .split(/,|\bet\b/i)
      .map((n) => n.trim())
      .filter((n) => n.length > 0);
    result.participants = names;
    remaining = remaining.replace(participantsMatch[0], '');
    result.confidence += 0.1;
  }

  // ---- Priority Parsing ----

  if (/\b(?:urgent|importante?|prioritaire)\b/i.test(remaining)) {
    result.priority = 'high';
    remaining = remaining.replace(/\b(?:urgent|importante?|prioritaire)\b/i, '');
    result.confidence += 0.05;
  }

  // ---- Recurrence Parsing ----

  if (/\b(?:chaque|tous les)\s*(?:jours?|semaines?|mois)\b/i.test(remaining)) {
    if (/jours?/i.test(remaining)) {
      result.recurrence = { frequency: 'daily', interval: 1 };
    } else if (/semaines?/i.test(remaining)) {
      result.recurrence = { frequency: 'weekly', interval: 1 };
    } else if (/mois/i.test(remaining)) {
      result.recurrence = { frequency: 'monthly', interval: 1 };
    }
    remaining = remaining.replace(/\b(?:chaque|tous les)\s*(?:jours?|semaines?|mois)\b/i, '');
    result.confidence += 0.1;
  }

  // ---- Clean up title ----
  result.title = remaining.trim().replace(/\s+/g, ' ') || input;

  // Capitalize first letter
  if (result.title) {
    result.title = result.title.charAt(0).toUpperCase() + result.title.slice(1);
  }

  return result;
}

// ============================================================================
// Preview Component
// ============================================================================

function ParsePreview({ result }: { result: ParseResult }) {
  const hasExtras = result.date || result.time || result.location || result.participants?.length;

  if (!hasExtras) return null;

  return (
    <div className="space-y-2 text-sm">
      {result.date && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>
            {isToday(result.date)
              ? "Aujourd'hui"
              : isTomorrow(result.date)
              ? 'Demain'
              : format(result.date, 'EEEE d MMMM', { locale: fr })}
          </span>
        </div>
      )}

      {result.time && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>
            {result.time}
            {result.duration && ` (${result.duration >= 60 ? `${result.duration / 60}h` : `${result.duration}min`})`}
          </span>
        </div>
      )}

      {result.location && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span>{result.location}</span>
        </div>
      )}

      {result.participants && result.participants.length > 0 && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>{result.participants.join(', ')}</span>
        </div>
      )}

      {result.priority && (
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4" />
          <Badge variant={result.priority === 'high' ? 'destructive' : 'secondary'}>
            {result.priority === 'high' ? 'Urgent' : result.priority}
          </Badge>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function QuickCreate({
  isOpen,
  onClose,
  defaultDate,
  templates = [],
  className,
}: QuickCreateProps) {
  const [input, setInput] = React.useState('');
  const [parseResult, setParseResult] = React.useState<ParseResult | null>(null);
  const [isCreating, setIsCreating] = React.useState(false);
  const [showTemplates, setShowTemplates] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const { currentDate } = useSchedulingNavigation();
  const createEvent = useCreateEvent();

  // Filter templates based on input
  const filteredTemplates = React.useMemo(() => {
    if (!input.trim()) return templates.slice(0, 5);
    const search = input.toLowerCase();
    return templates
      .filter(t =>
        t.name.toLowerCase().includes(search) ||
        t.eventDefaults.title?.toLowerCase().includes(search) ||
        t.category?.toLowerCase().includes(search)
      )
      .slice(0, 5);
  }, [templates, input]);

  // Apply template
  const handleSelectTemplate = (template: EventTemplate) => {
    const defaults = template.eventDefaults;
    const title = defaults.title || template.name;
    setInput(title);

    // Create parse result from template
    const start = defaultDate || currentDate;
    const result: ParseResult = {
      title,
      date: start,
      duration: defaults.duration,
      location: defaults.location,
      confidence: 0.9,
    };
    if (defaults.recurrence) {
      result.recurrence = defaults.recurrence;
    }
    setParseResult(result);
    setShowTemplates(false);
  };

  // Parse input on change
  React.useEffect(() => {
    if (input.trim()) {
      const result = parseNaturalLanguage(input);
      setParseResult(result);
    } else {
      setParseResult(null);
    }
  }, [input]);

  // Focus input when opened
  React.useEffect(() => {
    if (isOpen) {
      setInput('');
      setParseResult(null);
      setShowTemplates(templates.length > 0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, templates.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!parseResult?.title) return;

    setIsCreating(true);

    try {
      const start = parseResult.date || defaultDate || currentDate;
      const duration = parseResult.duration || 60;
      const end = addHours(start, duration / 60);

      await createEvent.mutateAsync({
        calendarId: 'default', // TODO: Get from context
        input: {
          title: parseResult.title,
          start,
          end,
          calendarId: 'default',
          recurrence: parseResult.recurrence,
          location: parseResult.location ? { name: parseResult.location } : undefined,
        },
      });

      onClose();
    } catch (error) {
      console.error('Failed to create event:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'fixed left-1/2 top-[20%] -translate-x-1/2 z-50',
              'w-full max-w-lg',
              'rounded-xl border bg-background shadow-2xl',
              'overflow-hidden',
              className
            )}
          >
            <form onSubmit={handleSubmit}>
              {/* Header */}
              <div className="flex items-center gap-2 border-b px-4 py-3">
                <Sparkles className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">Création rapide</span>
              </div>

              {/* Input */}
              <div className="p-4">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ex: Réunion avec Marc demain à 14h"
                  className={cn(
                    'w-full bg-transparent text-lg outline-none',
                    'placeholder:text-muted-foreground'
                  )}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                />

                {/* Template Suggestions */}
                {showTemplates && filteredTemplates.length > 0 && !parseResult && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-4 pt-4 border-t"
                  >
                    <p className="text-xs text-muted-foreground mb-2">Modèles suggérés</p>
                    <div className="space-y-1">
                      {filteredTemplates.map((template) => (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() => handleSelectTemplate(template)}
                          className={cn(
                            'w-full text-left px-3 py-2 rounded-md text-sm',
                            'hover:bg-accent transition-colors',
                            'flex items-center gap-2'
                          )}
                        >
                          {template.eventDefaults.color && (
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: template.eventDefaults.color }}
                            />
                          )}
                          <span className="flex-1">{template.name}</span>
                          {template.category && (
                            <Badge variant="outline" className="text-xs">
                              {template.category}
                            </Badge>
                          )}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Parse Preview */}
                {parseResult && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-4 pt-4 border-t"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <h4 className="font-medium mb-2">{parseResult.title}</h4>
                        <ParsePreview result={parseResult} />
                      </div>
                      <div className="flex items-center gap-1 text-xs">
                        {parseResult.confidence >= 0.7 ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-yellow-500" />
                        )}
                        <span className="text-muted-foreground">
                          {Math.round(parseResult.confidence * 100)}%
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t px-4 py-3 bg-muted/30">
                <div className="text-xs text-muted-foreground">
                  <kbd className="rounded bg-muted px-1.5 py-0.5">↵</kbd> créer
                  <span className="mx-2">•</span>
                  <kbd className="rounded bg-muted px-1.5 py-0.5">Esc</kbd> annuler
                </div>

                <div className="flex gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                    Annuler
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!parseResult?.title || isCreating}
                  >
                    {isCreating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Création...
                      </>
                    ) : (
                      'Créer'
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default QuickCreate;
